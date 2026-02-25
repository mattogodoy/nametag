# Structured Logging with Pino

## Problem

Logging across Nametag is inconsistent. About 155 `console.error`, 20 `console.warn`, and 15 `console.log` calls are scattered across ~50 files, bypassing the existing structured `lib/logger.ts`. Production logs are hard to search and filter. The goal is tidy, informative, structured logging that a Datadog Agent can consume.

## Decision

Replace the homegrown `lib/logger.ts` with Pino and migrate all server-side `console.*` calls to use it.

## Design

### 1. Core Logger

Replace `lib/logger.ts` with a Pino-based logger:

- **Base instance**: `pino` configured for JSON output in production, `pino-pretty` in development.
- **Log levels**: Respect existing `LOG_LEVEL` env var (`debug`, `info`, `warn`, `error`), default `info`.
- **Standard fields**: Every log line includes `level`, `msg`, `time`, `pid`, `hostname`, `module`.
- **Child loggers**: Module-specific loggers via `logger.child({ module: 'carddav' })` for filtering in Datadog.
- **Security logger**: Preserve the `securityLogger` interface as a child logger with `module: 'security'`.
- **Error serialization**: Pino's built-in serializer captures `message`, `stack`, `name`, and custom properties.

### 2. Request Logging Middleware

Add `pino-http` for automatic HTTP request/response logging:

- **Per-request fields**: method, URL, status code, response time (ms), content-length, user-agent.
- **Request ID**: UUID per request, attached to all logs within that request's lifecycle for tracing.
- **Integration**: Next.js middleware wraps existing middleware to inject request context.
- **Redaction**: Automatically redact `authorization` headers, cookie values, and request bodies containing `password`.
- **Skip rules**: Don't log health check endpoints or static asset requests.

### 3. Migration Strategy

Migrate ~170 `console.*` calls across ~50 server-side files:

- **API route catch blocks** (~16 CardDAV routes, people, auth): Replace with `logger.error({ err, context }, 'message')` using module-specific child loggers.
- **Lib files** (`photo-storage.ts`, `email.ts`, `locale.ts`, `vcard-helpers.ts`): Replace with child loggers per module.
- **Cron jobs** (`send-reminders`): Replace mixed `console.log`/`logger.info` with consistent structured calls.
- **Client components**: Keep `console.error` — can't use server Pino. `ErrorBoundary` → `/api/log-error` forwarding stays.
- **`lib/env.ts`**: Keep `console.error` — runs at startup before logger is available.
- **`instrumentation.ts`**: Migrate to Pino (runs after module init).
- **Error pages** (`error.tsx`): Keep `console.error` — client components.

### 4. ESLint Rule

Add `no-console` as a warning/error for server-side files to prevent regression. Explicit exceptions for client components and `lib/env.ts`.

### 5. Datadog Compatibility

- **Output**: JSON to stdout — exactly what the Datadog Agent reads via Docker log collection.
- **Level names**: Add string `level_name` (`INFO`, `WARN`, `ERROR`) alongside Pino's numeric levels for easier Datadog filtering.
- **Field mapping**: `msg` → Datadog `message`, `time` → `@timestamp`, custom fields (`module`, `requestId`, `userId`) → Datadog facets.
- **Docker Compose labels**: Add `com.datadoghq.ad.logs` label for source/service tagging:
  ```yaml
  labels:
    com.datadoghq.ad.logs: '[{"source": "nodejs", "service": "nametag"}]'
  ```

## Dependencies

- `pino` — Core structured logger
- `pino-pretty` (dev only) — Human-readable development output
- `pino-http` — HTTP request/response logging middleware

## Out of Scope

- Datadog Agent setup and configuration
- APM/tracing integration (dd-trace)
- Log rotation or file-based logging
- External transports beyond stdout
