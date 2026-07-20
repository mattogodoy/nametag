---
title: Architecture
description: High-level overview of how Nametag is built.
sidebar:
  order: 2
---

Nametag is a Next.js App Router monolith backed by PostgreSQL. There's no separate backend service: pages, API routes, and server logic all live in the same codebase and deploy as a single application.

## Directory structure

```text
/app          # Next.js routes and API endpoints (file-based routing)
  /api        # API route handlers
  /dashboard  # Dashboard page
  /people     # People management pages
  /groups     # Groups management pages
  /settings   # Settings pages
  ...

/components   # React components
  /ui         # Reusable UI primitives (buttons, inputs, etc.)
  /graphs     # D3.js network graph components

/lib          # Shared utilities and business logic
  /auth       # NextAuth.js configuration
  /prisma     # Prisma client singleton
  /openapi    # OpenAPI spec generation
  /rate-limit # Redis-backed rate limiting
  /email      # Email sending (Resend and SMTP)
  /carddav    # CardDAV sync engine

/locales      # Translation files (i18n), one JSON file per language

/prisma       # Database schema and migrations
  /migrations # Migration history
  schema.prisma

/tests        # Vitest unit tests and Playwright end-to-end tests
```

## Data flow

A typical request flows like this:

```text
Browser -> Next.js App Router -> API Route Handler -> Prisma ORM -> PostgreSQL
```

Server components fetch data directly through Prisma during rendering. Client components call API route handlers, which validate input with Zod, talk to PostgreSQL through Prisma, and return JSON. Redis sits alongside this flow as an optional dependency for rate limiting, with an in-memory fallback when it isn't configured (self-hosted mode only; it's mandatory in SaaS mode).

## Data model

The schema lives in `prisma/schema.prisma`. The core entities are:

- **User**: authentication, preferences, and per-account settings.
- **Person**: the core entity. Only `fullName` is required. Related multi-value tables (`PersonPhone`, `PersonEmail`, `PersonAddress`, `PersonUrl`, `PersonIM`, `PersonLocation`) hold contact details, and `PersonCustomField` / `PersonCustomFieldValue` hold user-defined fields.
- **Group** and **PersonGroup**: user-defined categories, many-to-many with Person.
- **Relationship** and **RelationshipType**: bidirectional connections between people (parent/child, sibling, partner, friend, and so on).
- **ImportantDate**: birthdays, anniversaries, and other recurring dates, with configurable reminders.
- **JournalEntry** and **JournalEntryPerson**: freeform notes linked to one or more people.
- **CardDavConnection**, **CardDavMapping**, **CardDavPendingImport**, **CardDavConflict**: CardDAV sync state (see [CardDAV](/features/carddav/) for the feature-level explanation).
- **ApiToken**: personal access tokens for the API.
- **Subscription**, **Promotion**, **PaymentHistory**: billing, used only in SaaS mode.

Several models are soft-deletable (`Person`, `Group`, `Relationship`, `RelationshipType`, `ImportantDate`): deletes set `deletedAt` instead of removing the row, which powers the Trash feature. Every read query against these models must filter on `deletedAt: null`. See [Code Guidelines](/contributing/guidelines/) for the full rule.

## Authentication

Authentication is handled by NextAuth.js with a credentials provider (email and password) as the baseline for every deployment mode. Depending on configuration, two additional providers are available:

- **Google OAuth**, enabled only in SaaS mode.
- **Generic OIDC**, available in self-hosted mode when `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` are configured.

Password login can be disabled entirely in favor of OIDC via `DISABLE_PASSWORD_LOGIN`. See [Authentication](/self-hosting/authentication/) for self-hosting configuration details.

## Feature flags and deployment modes

`lib/features.ts` centralizes all mode-specific behavior behind a single `features` object and an `isFeatureEnabled()` helper. It distinguishes SaaS mode (`SAAS_MODE=true`, used only for the hosted nametag.one service) from self-hosted and development modes, and controls things like billing UI, tier limits, usage tracking, email verification, and which OAuth providers are available. See the "Deployment Modes" section of the project's `CLAUDE.md` for the full breakdown of what changes between modes.

## Email

Nametag supports two email providers, chosen based on configuration:

- **Resend API**, a hosted transactional email service.
- **SMTP**, via `nodemailer`, for self-hosted setups that want to use their own mail server.

Email is used for verification (SaaS mode), password resets, and notifications. See [Email](/self-hosting/email/) for configuration.

## Graph visualization

The network graph views (dashboard overview and per-person detail) are built with D3.js force-directed simulations, rendered to an HTML canvas rather than SVG for performance with larger networks. The main component is `components/graphs/NetworkGraph.tsx`, with transformation logic in `lib/graph-utils.ts` that turns Prisma query results into the `{ nodes, edges }` shape the simulation expects.

## Search

Search is client-side, powered by MiniSearch. An index is built from the person data already loaded on the page, so search is instant and works without a round trip to the server. See [Search](/features/search/) for the user-facing behavior.

## Where to go next

- [Development Setup](/contributing/development/) to get a local environment running.
- [Code Guidelines](/contributing/guidelines/) for coding standards.
- [API Overview](/api/overview/) for the REST API this architecture exposes.
