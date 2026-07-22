# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nametag** is a personal relationships manager web application. It helps users track people, their relationships, and important details like birthdays, contact information, and family connections.

**Domain**: nametag.one

## Tech Stack

- **Framework**: Next.js (TypeScript)
- **Styling**: Tailwind CSS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Internationalization**: next-intl with English and Spanish support
- **Graph Visualization**: D3.js (force-directed graphs) or alternative (SigmaJS, Vis.js, Cytoscape.js)
- **Development**: Dev Containers (VS Code) or Local Development with Docker services
- **Deployment**: Docker containers orchestrated with docker-compose

## Core Data Model

### Entities

- **User**: Authentication and preferences (email, password hash, theme, etc.)
- **Person**: Core entity with attributes (fullName, birthDate, phone, address, lastContact, notes). Only `fullName` is mandatory.
- **Relationship**: Bidirectional connections between people (parent/child, sibling, partner, friend, etc.)
- **Group**: User-defined categories (family, friends, school, etc.). Many-to-many with Person.

### Key Relationships

- User → owns many Persons, Groups
- Person → belongs to many Groups (via PersonGroup join table)
- Person → has many Relationships with other Persons
- Relationships should handle bidirectionality (if A is parent of B, B is child of A)

## Architecture

### Multi-Stage Implementation

The project follows a staged development approach:

1. **Infrastructure**: Docker, Next.js, Tailwind, Prisma setup
2. **Database Schema**: Prisma models and migrations
3. **Authentication**: User registration, login, session management
4. **Person Management**: CRUD operations for people
5. **Groups**: Category management and assignment
6. **Relationships**: Connection system between people
7. **Graph Visualization**: D3.js component development
8. **Person Details Graph**: Individual relationship network view
9. **Dashboard**: User-centric overview with statistics and full network graph
10. **Settings**: User preferences, theme, profile management
11. **Polish**: UX refinement, error handling, performance

### Key Features

- **Network Graphs**: Two main graph views
  - Dashboard: User at center showing entire network
  - Person Details: Selected person at center showing their connections
- **Graph Interactions**: Click nodes to navigate, zoom/pan controls, color-coded by groups/relationships
- **Extensibility**: Person model designed for easy addition of new fields (use Prisma JSON fields or separate tables)

## Database Configuration

Nametag supports two methods for database configuration:

### Method 1: Individual Variables (Recommended)
Use separate environment variables for each connection parameter:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nametag_db
DB_USER=nametag
DB_PASSWORD=your-password
```

This is more user-friendly and easier to configure, especially for those unfamiliar with connection strings.

### Method 2: Connection String (Advanced)
Use a full PostgreSQL connection string:
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Priority:** If `DATABASE_URL` is set, it takes precedence over individual `DB_*` variables.

**Validation:** The application requires either:
- A complete `DATABASE_URL`, OR
- All of: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` (and optionally `DB_PASSWORD`)

If neither is provided or incomplete, the application will fail to start with a clear error message.

## Development Commands

### Local Development (Services Only)
```bash
# Start/stop database services
docker-compose -f docker-compose.services.yml up -d
docker-compose -f docker-compose.services.yml down

# Setup database
./scripts/setup-db.sh

# Run development server
npm run dev
```

### Dev Container (VS Code)
```bash
# Open repository in VS Code, click "Reopen in Container"
# Everything is configured automatically

# Run development server
npm run dev
```

### Database
```bash
npx prisma migrate dev     # Create and apply migrations
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open database GUI
npx prisma db seed         # Seed test data
```

### Next.js
```bash
npm run dev                # Development server
npm run build              # Production build
npm run start              # Start production server
```

### Production Deployment
```bash
# Build production image
docker build -t nametag .

# Deploy with docker-compose
docker-compose up -d
```

## Critical Coding Standards

These rules MUST be followed at all times:

### 1. TypeScript Type Safety
**NEVER use `any` as a type.** Always define specific types for everything.

- Use proper TypeScript types and interfaces
- Avoid type assertions unless absolutely necessary
- The GitHub Actions workflow will fail if `any` types are detected
- Use `unknown` if you truly don't know the type, then narrow it with type guards

### 2. Internationalization (i18n)
**Every new user-facing string MUST be translated in ALL supported languages.**

- The supported languages live in `/locales/*.json`. Discover the current set at write-time (`ls locales/*.json`) instead of hardcoding it from this document, so a new language added later picks up automatically.
- When adding any text visible to users, add a translation to every file under `/locales/`. Key trees must stay at parity across all locale files.
- Never hardcode strings in components
- Use `useTranslations` (client) or `getTranslations` (server)
- See the Internationalization section below for detailed guidance

### 3. Design and Plan Documents
**NEVER commit design docs or plan files to the repository.** Files in `docs/plans/` are ephemeral working documents and should not be tracked in git.

### 4. Soft-Delete Filtering
**Every Prisma read query on a soft-deletable model MUST include `deletedAt: null` in its `where` clause.**

Soft-deletable models: `Person`, `Group`, `Relationship`, `RelationshipType`, `ImportantDate`

- Applies to `findMany`, `findFirst`, `findUnique`, `count`, and `aggregate` queries
- Nested includes on soft-deletable relations (e.g., `relationshipsFrom`, `importantDates`) must also add `where: { deletedAt: null }`
- The only exceptions are trash/restore routes and delete helpers that intentionally operate on deleted records
- When adding a new query on any of these models, always ask: "should this exclude soft-deleted records?"

### 5. Git Commit Attribution
**NEVER include AI co-author attribution in commits or PRs.**

- Do not add "Co-Authored-By: Claude" or similar attribution lines
- Do not mention Claude or AI assistance in commit messages, PR descriptions, or code comments
- Commits should appear as if written entirely by the human developer

### 6. OpenAPI Specification
**Every API endpoint change MUST be reflected in the OpenAPI spec (`lib/openapi.ts`).**

- When adding a new API route, add the corresponding path entry to `generateOpenAPISpec()`
- When modifying request/response schemas, update the spec to match
- When removing an API route, remove it from the spec
- Use `zodBody()` for request bodies that have a Zod validation schema in `lib/validations.ts`
- Use `jsonBody()` for simpler request bodies defined inline
- Run `npx vitest run tests/api/openapi-spec.test.ts` to verify the spec is valid

### 7. No Em-Dashes Anywhere
**NEVER use the em-dash character (`—`, U+2014) in this codebase.** It is a strong AI-writing fingerprint and we want our work to look human-authored throughout.

This rule applies to **everything**:
- Translation strings in `/locales/*.json` (all languages)
- User-facing text in components, error messages, and API responses
- Code comments and JSDoc
- Commit messages, PR descriptions, and changelog entries
- Markdown documentation, including this file's own contents

The same rule applies to the en-dash (`–`, U+2013) and the Chinese double em-dash (`——`).

Use a regular hyphen (`-`), comma, period, colon, or parentheses instead. Restructure the sentence if no punctuation feels right. Most em-dashes can be replaced by ending one sentence and starting another.

Spot the offender before committing:
```bash
grep -rn "—" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" .
```

### 8. Documentation Updates
**Every change that affects user-facing behavior, configuration, or the API MUST be reflected in the documentation site.**

The documentation lives in `docs/src/content/docs/` (Starlight/Astro site). When your commit introduces or modifies any of the following, update the corresponding docs page before committing:

- New or changed features, settings, or UI behavior: update the relevant page under `features/`
- New or changed environment variables or deployment configuration: update the relevant page under `self-hosting/`
- New, changed, or removed API endpoints: update the relevant page under `api/`
- New or changed development workflows, tooling, or code standards: update the relevant page under `contributing/`
- New or changed field limits, validation rules, or technical constraints: add or update the "Technical details" section on the affected page

To verify documentation builds after your changes:
```bash
cd docs && rm -rf .astro dist && npm run build
```

The documentation site is deployed to `docs.nametag.one`. Keeping it in sync with the codebase is as important as keeping translations in sync.

### 9. Release Notes: Breaking Changes Warning
**Release descriptions MUST highlight breaking changes and required user actions with a visible warning.**

When a release includes changes that require action from users or self-hosters (new or changed environment variables, cron jobs, Docker/docker-compose changes, database migrations, removed or renamed settings, config file changes), add a GitHub alert block at the top of the release description:

```markdown
> [!WARNING]
> **Action required before upgrading**
>
> - Add `NEW_VAR=value` to your `.env` file
> - Run `npx prisma migrate deploy` after updating
> - Update your cron schedule (see docs)
```

Rules:
- The warning block goes **before** the feature description, so it is the first thing users see
- Each bullet must tell the user **what to do**, not just what changed
- If there are no breaking or action-required changes, omit the block entirely
- This applies to both automated release notes (handled by the AI prompt in `release-please.yml`) and manually written release descriptions

## Deployment Modes

Nametag operates in three distinct modes:

### 1. Development (`NODE_ENV=development`)
- For local development and testing
- Redis: Optional (uses in-memory fallback)
- Email verification: Disabled
- Billing: Hidden
- OAuth providers: OIDC available if configured via env vars, Google disabled

### 2. Production / Self-Hosted (`NODE_ENV=production`, `SAAS_MODE=false`)
- **Default mode** when `NODE_ENV` is `production` or unset
- For self-hosted deployments
- Redis: Optional but recommended (uses in-memory fallback without it)
- Email verification: Disabled (accounts auto-verified)
- Billing: Hidden
- OAuth providers: OIDC available if configured via `OIDC_*` env vars, Google disabled
- Password login can be disabled via `DISABLE_PASSWORD_LOGIN=true` (requires OIDC)
- All features unlimited

### 3. SaaS Mode (`SAAS_MODE=true`)
- **Only for nametag.one** hosted service
- Redis: Mandatory (app fails to start without it)
- Email verification: Required for new accounts
- Billing: Enabled (Stripe integration, tier limits)
- OAuth providers: Google OAuth enabled, OIDC disabled
- Usage tracking and limits enforced

### Mode Detection

Features are controlled by `lib/features.ts`:
```typescript
import { isFeatureEnabled, isSaasMode } from '@/lib/features';

// Check specific feature
if (isFeatureEnabled('billing')) {
  // Show billing UI
}

// Check mode directly
if (isSaasMode()) {
  // SaaS-specific logic
}
```

### Adding Mode-Specific Features

To add a new SaaS-only feature:
1. Add feature flag to `lib/features.ts`
2. Use `isFeatureEnabled('yourFeature')` in code
3. Document in this section

## Important Design Decisions

### Internationalization (i18n)
**CRITICAL**: All user-facing strings MUST be translated in ALL supported languages.

**Supported languages:** the canonical list lives at `/locales/*.json`. English (`en`) is the default and source of truth for new keys. The full set of locales is whatever files exist in that directory at the time of writing — discover them with `ls locales/*.json` rather than hardcoding the list here, so a new language added later picks up automatically.

**Rules:**
1. **NEVER hardcode user-facing strings** - Always use `useTranslations` or `getTranslations`
2. **Update every locale file** when adding/modifying strings, and keep the key trees at parity across them. A missing key in any file is a bug.
3. Use descriptive translation keys (e.g., `people.form.name` not `ppl.f.n`)
4. Organize keys with namespaces matching the component structure
5. Use interpolation for dynamic values: `t('greeting', { name: 'John' })`

**Example usage:**
```typescript
// Client components
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('people.form');
  return <input placeholder={t('namePlaceholder')} />;
}

// Server components
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('people');
  return <h1>{t('title')}</h1>;
}
```

**When adding new features:**
1. Add translation keys to `/locales/en.json` (the default source-of-truth file)
2. Mirror the same keys into every other `/locales/*.json` with the appropriate translation
3. Use the translation hook in your component
4. Spot-check in at least two languages before committing

### Extensible Person Attributes
The Person model must support easy addition of new fields. Consider using:
- Prisma's `Json` field type for flexible custom attributes, OR
- Separate `PersonAttribute` table for fully typed custom fields

### Relationship Bidirectionality
When creating relationships, consider whether to:
- Store both directions explicitly in database, OR
- Store one direction and compute inverse programmatically
- Ensure UI shows both perspectives correctly

### Graph Performance
For networks with >100 nodes:
- Implement graph simplification options
- Show only N degrees of separation from protagonist
- Add filtering by group or relationship type
- Consider virtualization for large datasets

### Data Privacy
This app stores sensitive personal information:
- Ensure proper password hashing (bcrypt)
- Implement proper session management
- Consider data export functionality for user data portability
- Add account deletion with data cleanup

## File Structure Conventions

```
/app                    # Next.js app directory
  /api                 # API routes
  /dashboard           # Dashboard page
  /people              # People management pages
  /groups              # Groups management pages
  /settings            # User settings pages
/components            # React components
  /ui                  # Reusable UI components
  /graphs              # Network graph components
/lib                   # Utility functions
  /prisma              # Prisma client and utilities
  /auth                # Authentication utilities
/locales               # Translation files (i18n)
  en.json              # English translations
  es-ES.json           # Spanish translations
/prisma                # Prisma schema and migrations
/public                # Static assets
```

## Common Patterns

### Protected Routes
Use middleware or HOC to protect routes requiring authentication.

### API Route Structure
```
POST   /api/people          # Create person
GET    /api/people          # List all people (for current user)
GET    /api/people/[id]     # Get single person
PUT    /api/people/[id]     # Update person
DELETE /api/people/[id]     # Delete person
```

### Graph Data Format
Transform Prisma data to graph format:
```typescript
{
  nodes: [{ id, label, group, ... }],
  edges: [{ source, target, type, ... }]
}
```

## Theme Support

The app supports light/dark themes:
- Theme preference stored in User model
- Applied globally using Tailwind's dark mode
- Toggle available in Settings page

## CardDAV Integration

Nametag includes full bidirectional sync with CardDAV servers (Google Contacts, iCloud, Outlook, Nextcloud).

### Architecture

**Core Components**:
- `lib/carddav/vcard.ts` - vCard 4.0 transformation (Person ↔ vCard)
- `lib/carddav/client.ts` - tsdav wrapper with retry logic
- `lib/carddav/sync.ts` - Bidirectional sync engine
- `lib/carddav/retry.ts` - Exponential backoff and error categorization
- `lib/carddav/auto-export.ts` - Auto-export new contacts
- `lib/carddav/discover.ts` - Background discovery of new contacts

**Database Schema**:
- `CardDavConnection` - Server credentials and sync settings
- `CardDavMapping` - Maps Person to vCard (UID, href, etag)
- `CardDavPendingImport` - New contacts discovered on server
- `CardDavConflict` - Tracks sync conflicts for user resolution
- Multi-value tables: `PersonPhone`, `PersonEmail`, `PersonAddress`, `PersonUrl`, `PersonIM`, `PersonLocation`, `PersonCustomField`

**API Endpoints**:
- `POST /api/carddav/connection` - Create connection
- `PUT /api/carddav/connection` - Update connection settings
- `DELETE /api/carddav/connection` - Disconnect
- `POST /api/carddav/connection/test` - Test credentials
- `POST /api/carddav/sync` - Manual bidirectional sync
- `POST /api/carddav/import` - Import selected contacts
- `POST /api/carddav/export-bulk` - Bulk export contacts
- `POST /api/carddav/conflicts/[id]/resolve` - Resolve conflict
- `POST /api/carddav/discover` - Trigger discovery
- `GET /api/carddav/pending-count` - Notification count
- `GET /api/cron/carddav-sync` - Background sync (cron)

**UI Pages**:
- `app/settings/carddav/page.tsx` - Connection settings
- `app/carddav/import/page.tsx` - Import flow
- `app/carddav/export/page.tsx` - Bulk export
- `app/carddav/conflicts/page.tsx` - Conflict resolution

**UI Components**:
- `CardDavConnectionForm.tsx` - Connection config with provider presets
- `ImportContactsList.tsx` - Selectable import with group assignment
- `BulkExportList.tsx` - Selectable export with progress
- `ConflictList.tsx` - Side-by-side conflict resolution
- `PersonPhoneManager.tsx`, `PersonEmailManager.tsx`, etc. - Multi-value field editors
- `PersonCustomFieldManager.tsx` - X- property editor

### Sync Flow

1. **Background Cron** (`/api/cron/carddav-sync`):
   - Runs every N minutes (configurable, default 5min)
   - Syncs all users with `syncEnabled=true`
   - Respects individual `autoSyncInterval` settings
   - Rate limited: 200ms delay between users

2. **Bidirectional Sync**:
   - Fetches changes from server using sync tokens (incremental)
   - Compares ETags and timestamps for conflict detection
   - Creates pending imports for new remote contacts
   - Pushes local changes to server
   - Handles conflicts by creating `CardDavConflict` records

3. **Auto-Export**:
   - Hooked into `POST /api/people` and `PUT /api/people/[id]`
   - Runs in background (non-blocking)
   - Generates UID if missing
   - Creates vCard and uploads to server
   - Creates `CardDavMapping` record

### Error Handling

**Retry Logic** (`withRetry` utility):
- Max 3 attempts with exponential backoff
- Initial delay: 1 second
- Backoff factor: 2x
- Max delay: 10 seconds
- Retries: 5xx errors, timeouts, network errors, 429 rate limiting
- Does not retry: 401/403 auth, 404 not found, malformed data

**Error Categorization**:
- `AUTH` - Authentication failed (401/403)
- `NETWORK` - Network/timeout errors
- `SERVER` - 5xx server errors
- `RATE_LIMIT` - 429 too many requests
- `MALFORMED` - Invalid/corrupted data
- `NOT_FOUND` - 404 resource not found
- `UNKNOWN` - Unexpected errors

Each category has user-friendly error messages.

### vCard Mapping

**Standard Fields**:
- `FN` ↔ Formatted name (name + surname + nickname)
- `N` ↔ Structured name (surname;given;middle;prefix;suffix)
- `TEL` ↔ Phone numbers (multi-value with types)
- `EMAIL` ↔ Email addresses (multi-value with types)
- `ADR` ↔ Addresses (multi-value with structured fields)
- `URL` ↔ Websites (multi-value)
- `IMPP` ↔ IM handles (multi-value with protocols)
- `GEO` ↔ Locations (multi-value with lat/lon)
- `BDAY` ↔ Birthday from important dates
- `ANNIVERSARY` ↔ Other important dates + last contact
- `ORG` ↔ Organization
- `TITLE` ↔ Job title
- `CATEGORIES` ↔ Group names (comma-separated)
- `NOTE` ↔ Notes (markdown preserved)
- `X-*` ↔ Custom fields

**Nametag Extensions**:
- `X-NAMETAG-RELATIONSHIPS` - Relationship graph (JSON)
- `X-NAMETAG-SECOND-LASTNAME` - Spanish naming
- `X-NAMETAG-CONTACT-REMINDER` - Reminder settings
- Plus user-defined X- fields

**Not Synced** (Nametag-only):
- Relationship connections between people
- Group metadata (color, description)
- Contact reminder settings
- Full relationship graph structure

### Configuration

**User Settings** (`CardDavConnection`):
- `syncEnabled` - Enable/disable automatic sync
- `autoExportNew` - Auto-export new Nametag contacts
- `autoSyncInterval` - Sync frequency (60s to 86400s)
- `importMode` - How to handle new remote contacts:
  - `manual` - Review before importing (default)
  - `notify` - Show notification
  - `auto` - Import automatically

**Performance**:
- Incremental sync using sync tokens and ETags
- Batch exports: 50 contacts per batch, 100ms delay
- Rate limiting to respect server limits
- Background processing (non-blocking)

### Conflict Resolution

When both local and remote changed since last sync:
1. Create `CardDavConflict` record with both versions
2. Set mapping `syncStatus='conflict'`
3. User navigates to Conflicts page
4. Side-by-side comparison shown
5. User chooses: Keep Local, Keep Remote, or Merge (future)
6. Resolution applied and sync continues

### Provider Support

**Google Contacts**:
- Requires app-specific password
- Server: `https://www.googleapis.com/.well-known/carddav`

**iCloud**:
- Requires app-specific password
- Server: `https://contacts.icloud.com/`

**Outlook/Office 365**:
- Uses regular password (or app password if 2FA enabled)
- Server: `https://outlook.office365.com/`

**Nextcloud/Radicale**:
- Uses regular password
- Server: User-provided URL

### Testing

See `docs/carddav.md` for:
- Setup guides per provider
- Troubleshooting common issues
- Usage instructions
- Technical details

**Manual Testing**:
1. Connect to each provider
2. Import contacts
3. Export contacts
4. Test bidirectional sync
5. Create conflicts and resolve
6. Test auto-export
7. Test background sync
8. Test error scenarios

## Design Context

### Users
Nametag serves both casual personal users (tracking family, friends, life connections) and intentional relationship managers (professional networking, community building). Users interact with it on their own time. It's a personal tool, not a workplace one. The common thread is people who care enough about their relationships to invest in organizing them.

### Brand Personality
**Warm, personal, calm.** Nametag should feel like a trusted notebook: intimate, unhurried, and deeply human. It is not a corporate CRM. It's closer to a journal than a spreadsheet.

**Voice & tone:** Quiet confidence. Never loud, never salesy, never gamified. Speaks plainly and warmly, like a thoughtful friend reminding you of something important.

**Emotional goals:** Calm confidence (everything is in its place), warm connection (this tool reflects care for people), quiet delight (small moments of polish), effortless control (powerful but never overwhelming).

### Aesthetic Direction
**Visual tone:** The intersection of Apple Contacts and Notion/Linear: native-feeling minimalism with modern SaaS spaciousness and typographic clarity. Content-first, chrome-second. The people are the interface.

**Theme:** Dark mode is the default. Both light and dark should feel equally considered, not a light app with a dark skin bolted on.

**Color direction:** Open to evolution from the current blue palette. Colors should serve the warm, personal, calm personality. Consider softer, less saturated tones or warmer hues that feel inviting rather than corporate. The logo red (#ff2600) is a brand anchor but should be used sparingly in the UI.

**Anti-references:** Corporate CRM dashboards (Salesforce, HubSpot). Bright, busy SaaS products with aggressive CTAs. Anything that feels transactional rather than personal.

### Design Principles

1. **People first, UI second.** Every design decision should make the people in your network more visible, not the interface. Reduce chrome, maximize content.
2. **Calm over clever.** Prefer understated elegance to flashy interactions. Animations should feel natural and purposeful, never attention-seeking. Respect `prefers-reduced-motion`.
3. **Warmth through craft.** The feeling of care comes from precise spacing, considered typography, and thoughtful micro-interactions, not from illustrations or emoji or color splashes.
4. **Effortless depth.** Simple on the surface, powerful underneath. Progressive disclosure over feature walls. The first-time user and the power user should both feel at home.
5. **Consistency is kindness.** Uniform patterns reduce cognitive load. Same spacing, same border radii, same interaction patterns everywhere. Predictability is a feature.

### Accessibility
- Target: WCAG AA compliance
- All interactive elements must have visible focus indicators
- Sufficient color contrast in both light and dark modes
- Keyboard navigation support throughout
- Semantic HTML and ARIA attributes where needed
- Respect `prefers-reduced-motion` for all animations

### Technical Constraints
- System font stack only (no external font loading)
- Tailwind CSS v4 with inline theme configuration in globals.css
- Class-based dark mode (`.dark` on `<html>`)
- CSS custom properties for all color tokens
