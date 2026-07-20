---
title: Redis
description: When Redis is required, when it's optional, and how to configure it.
sidebar:
  order: 5
---

Redis backs Nametag's rate limiting for authentication endpoints (login, registration, password reset, and similar), protecting your instance against brute-force attacks. Whether you need it depends on how Nametag is deployed.

## Is Redis required?

**SaaS mode** (`SAAS_MODE=true`, used only by nametag.one): Redis is **required**. The application fails to start without it. This is because a hosted service runs multiple server instances behind a load balancer, and rate limits need to be shared and persisted across all of them.

**Self-hosted production**: Redis is **optional but recommended**. Without it, Nametag falls back to in-memory rate limiting automatically and logs a warning. The limitations of the in-memory fallback are:

- Rate limit counters reset whenever the app container restarts
- Counters aren't shared across multiple instances, so if you ever run more than one app container behind a load balancer, each one tracks limits independently

For a typical single-server self-hosted deployment, the in-memory fallback works fine. Add Redis if you want rate limits to survive restarts, or if you plan to scale to multiple app instances.

**Development**: Redis is optional. The in-memory fallback is the normal path for local development.

## Running without Redis

1. Omit `REDIS_URL` (and `REDIS_PASSWORD`) from your `.env`
2. Remove or comment out the `redis` service from your `docker-compose.yml`
3. Nametag logs a warning on startup and uses in-memory rate limiting from then on

## Enabling Redis

Add a Redis service to your compose file and point Nametag at it:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?Redis password required}
    volumes:
      - redis_data:/data
    healthcheck:
      test: [CMD, redis-cli, --raw, incr, ping]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

And in `.env`:

```bash
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://:your-redis-password@redis:6379
```

Generate `REDIS_PASSWORD` the same way as other secrets:

```bash
openssl rand -base64 32
```

The production `docker-compose.yml` shipped in the repository already includes a Redis service with a health check, so if you copied that file directly, Redis is already wired up; you just need to set `REDIS_PASSWORD` in your `.env`.

## What Redis is used for

Redis only backs rate limiting in Nametag today: login attempts, registration attempts, password reset requests, email resend, and a few CardDAV-related endpoints each have their own configured limit (for example, 5 login attempts per 15 minutes). It isn't used as a general application cache or session store, so its footprint is small and it's safe to add or remove at any time without a data migration.
