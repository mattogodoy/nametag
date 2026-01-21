# Contributing to Nametag

Thanks for your interest in contributing! This guide will help you get set up and understand how to work on Nametag.

## Development Setup

Nametag supports two development environments. Choose the one that works best for you:

- **Dev Container** (Option A) - Easiest for new contributors, one-click setup
- **Local Development** (Option B) - Best for daily development, faster iteration

### Option A: Dev Container (Recommended for New Contributors)

Perfect for getting started quickly with zero configuration. Works on any OS and even in GitHub Codespaces.

**Prerequisites:**

- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Docker Desktop (running)

**Setup:**

1. Fork and clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/nametag.git
cd nametag
```

2. Open in VS Code:

```bash
code .
```

3. When prompted, click **"Reopen in Container"** (or press F1 → "Dev Containers: Reopen in Container")

4. Wait for the container to build and setup to complete (this happens automatically):
   - Installs Node.js dependencies
   - Generates Prisma client
   - Runs database migrations
   - Seeds the database with demo data

5. Start the dev server:

```bash
npm run dev
```

6. Access the app at `http://localhost:3000`

**Demo credentials:**

- Email: `demo@nametag.one`
- Password: `password123`

**Benefits:**

- Consistent environment across all developers
- No local Node.js installation required
- Works on Windows, macOS, and Linux identically
- Can develop in browser via GitHub Codespaces
- All tools and extensions pre-configured

### Option B: Local Development (Best for Daily Development)

Faster iteration and better debugging experience. Requires Node.js installed locally, but only runs database services in Docker.

**Prerequisites:**

- Node.js 20+
- Docker and Docker Compose
- Git

**Setup:**

1. Fork and clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/nametag.git
cd nametag
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment file:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `CRON_SECRET` - Generate with `openssl rand -base64 16`

The default values for `DATABASE_URL` and `REDIS_URL` will work with the Docker services.

4. Start database services only:

```bash
docker-compose -f docker-compose.services.yml up -d
```

This starts:

- PostgreSQL database on port 5432
- Redis on port 6379

5. Set up the database:

```bash
./scripts/setup-db.sh
```

This runs migrations, generates Prisma client, and seeds the database with demo data.

6. Start the dev server:

```bash
npm run dev
```

7. Access the app at `http://localhost:3000`

**Demo credentials:**

- Email: `demo@nametag.one`
- Password: `password123`

**Benefits:**

- Native performance (no Docker overhead for Node.js)
- Instant hot-reload
- Better debugging with native Node.js
- Full control over the development environment
- Faster test execution

**Common commands:**

```bash
# Stop database services
docker-compose -f docker-compose.services.yml down

# Start services
docker-compose -f docker-compose.services.yml up -d

# View database logs
docker-compose -f docker-compose.services.yml logs -f db

# Reset database
npx prisma migrate reset
```

### Troubleshooting

**Dev Container issues:**

- Ensure Docker Desktop is running
- Try "Dev Containers: Rebuild Container" from command palette (F1)
- Check that ports 3000, 5432, and 6379 are not already in use

**Local Development issues:**

- Verify Node.js version: `node --version` (should be 20+)
- Ensure Docker services are running: `docker-compose -f docker-compose.services.yml ps`
- Check database connection: `npx prisma db execute --stdin <<< "SELECT 1"`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Database connection errors:**

- Verify services are healthy: `docker ps`
- Check `.env` file has correct `DATABASE_URL` and `REDIS_URL`
- Try restarting services: `docker-compose -f docker-compose.services.yml restart`

**Port conflicts:**

- Check what's using a port: `lsof -i :3000` (or :5432, :6379)
- Change port in `.env` or stop conflicting service

## Development Workflow

### Working with the Database

**Making schema changes:**

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name describe_your_change

# 3. Generate Prisma Client (usually automatic, but sometimes needed)
npx prisma generate
```

**Useful database commands:**

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (deletes all data!)
npx prisma migrate reset

# Seed database
npx prisma db seed
```

### Running Tests

```bash
# Unit tests (watch mode)
npm run test

# Unit tests (single run)
npm run test:run

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

### Code Quality

```bash
# Run linter
npm run lint

# Type check
npm run typecheck

# Build (catches many issues)
npm run build

# Quick verification (runs lint, typecheck, unit tests, and build)
npm run verify

# Full verification including E2E tests (same as CI/CD)
npm run verify:all
```

**Before submitting a PR**, it's recommended to run `npm run verify` (or `npm run verify:all` for complete testing) to catch issues early and save CI/CD time.

### Debugging

**Dev Container:**

- View terminal output in VS Code
- Use VS Code's built-in debugger
- Use Prisma Studio to inspect data: `npx prisma studio`
- Check browser console for frontend issues

**Local Development:**

- Check database logs: `docker-compose -f docker-compose.services.yml logs -f db`
- Use your IDE's Node.js debugger
- Use Prisma Studio to inspect data: `npx prisma studio`
- Add console.logs or breakpoints
- Check browser console for frontend issues

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and changelog generation.

**Format:**

```text
<type>[optional scope]: <description>

[optional body]
```

**Types:**

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation only
- `style:` - Formatting, semicolons, etc.
- `refactor:` - Code restructuring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples:**

```bash
feat: add CSV export for contacts
fix: resolve birthday reminder timezone issue
docs: update API documentation
refactor: simplify graph rendering logic
```

**Breaking changes** (triggers major version bump):

```bash
feat!: redesign authentication system

BREAKING CHANGE: Users must re-authenticate after upgrade
```

See [VERSIONING.md](docs/VERSIONING.md) for more details.

## How to Contribute

### Reporting Bugs

Before creating a bug report, search existing issues to avoid duplicates.

Include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment (OS, browser, Node version)

### Suggesting Features

Feature requests are welcome! Please describe:

- What problem it solves
- Who would benefit from it
- Possible implementation approach (optional)

### Submitting Pull Requests

1. **Create a feature branch** from `master`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

2. **Make your changes** following our code style (see below)

3. **Test your changes**:

```bash
# Quick verification (recommended - runs lint, typecheck, unit tests, and build)
npm run verify

# Full verification including E2E tests (optional but recommended for larger changes)
npm run verify:all
```

4. **Commit with clear messages**:

```bash
git commit -m "feat: add birthday reminder notifications"
git commit -m "fix: resolve duplicate person creation"
git commit -m "docs: update API documentation"
```

5. **Push and create a PR**:

```bash
git push origin feature/your-feature-name
```

Then open a pull request on GitHub.

**PR Guidelines:**

- Keep PRs focused on a single feature or fix
- Link to related issues
- Add a clear description of what changed and why
- Include screenshots for UI changes
- Ensure all checks pass (lint, typecheck, tests, build) - these run automatically via GitHub Actions
- Run `npm run verify` locally before pushing to catch issues early
- Update documentation if needed
- See [docs/PR_WORKFLOW.md](docs/PR_WORKFLOW.md) for detailed PR verification process

## Internationalization (i18n)

Nametag supports multiple languages. **All user-facing strings must be translated.**

### Supported Languages

- English (`en`) - Default language
- Spanish (`es-ES`)

### Adding or Changing Strings

**IMPORTANT**: When adding new features or modifying existing ones, you MUST update all translation files.

1. **Add translation keys to all locale files**:
   - `/locales/en.json` - English translations
   - `/locales/es-ES.json` - Spanish translations

2. **Use the translation hook in components**:

   ```typescript
   import { useTranslations } from 'next-intl';

   export default function MyComponent() {
     const t = useTranslations('namespace');

     return <h1>{t('title')}</h1>;
   }
   ```

3. **Organize translations with namespaces**:

   ```json
   {
     "people": {
       "form": {
         "name": "Name",
         "email": "Email"
       }
     }
   }
   ```

4. **Use interpolation for dynamic values**:

   ```typescript
   // In locale file:
   "greeting": "Hello, {name}!"

   // In component:
   t('greeting', { name: 'John' })
   ```

### Translation Guidelines

- **Never hardcode user-facing strings** in components
- Keep translation keys descriptive (e.g., `people.form.name` not `ppl.f.n`)
- Use the same key structure across all locale files
- Test in all languages before submitting PR
- If you don't speak Spanish, use an AI translation tool or ask for help

### Common Translation Patterns

**Error messages**:

```json
"errors": {
  "invalidEmail": "Please enter a valid email",
  "required": "This field is required"
}
```

**Success messages**:

```json
"success": {
  "saved": "Changes saved successfully"
}
```

**Form labels**:

```json
"form": {
  "name": "Name",
  "email": "Email"
}
```

### Adding a New Language

Want to add support for a new language to Nametag? Follow this guide.

#### Prerequisites

Before starting, ensure you have:

- Fluency in the target language or access to reliable translation resources (preferrably you are a native speaker)
- The correct locale code for your language (format: `language-COUNTRY`, e.g., `fr-FR`, `de-DE`, `pt-BR`)
- The flag icon code from the [flag-icons library](https://flagicons.lipis.dev/)

#### Step 1: Create Translation File

Create a new JSON file in `/locales/{locale-code}.json`:

```bash
# Example for French (France)
cp locales/en.json locales/fr-FR.json
```

Translate all strings in the new file. Keep the same structure and keys as the English version.

#### Step 2: Update Locale Configuration

Edit `/lib/locale.ts`:

**Add to SUPPORTED_LOCALES array** (around line 7):

```typescript
export const SUPPORTED_LOCALES = ["en", "es-ES", "ja-JP", "fr-FR"] as const;
//                                                        ^^^^^^^ Add your locale
```

**Add language mapping in `normalizeLocale()` function** (around line 48):

```typescript
if (languageCode === "ja") {
  return "ja-JP";
}

// Add your language mapping
if (languageCode === "fr") {
  return "fr-FR";
}
```

**Add language mapping in `detectBrowserLocale()` function** (around line 148):

```typescript
if (languageCode === "ja") {
  return "ja-JP";
}

// Add your language mapping
if (languageCode === "fr") {
  return "fr-FR";
}
```

#### Step 3: Update i18n Configuration

Edit `/i18n.ts`:

**Add language code mapping** (around line 48):

```typescript
if (languageCode === "ja") {
  locale = "ja-JP";
  break;
}

// Add your language mapping
if (languageCode === "fr") {
  locale = "fr-FR";
  break;
}
```

#### Step 4: Update LanguageSelector Component

Edit `/components/LanguageSelector.tsx`:

**Update TypeScript types** (line 9):

```typescript
interface LanguageSelectorProps {
  currentLanguage: "en" | "es-ES" | "ja-JP" | "fr-FR";
  //                                          ^^^^^^^ Add your locale
}
```

**Add to LANGUAGES array** (around line 12):

```typescript
const LANGUAGES = [
  { code: "en" as const, name: "English", flag: "gb" },
  { code: "es-ES" as const, name: "Español (España)", flag: "es" },
  { code: "ja-JP" as const, name: "日本語", flag: "jp" },
  { code: "fr-FR" as const, name: "Français (France)", flag: "fr" },
  //                                                    ^^^^ Flag code from flag-icons
];
```

**Add to labelMap** (around line 18):

```typescript
const labelMap = {
  en: "en",
  "es-ES": "esES",
  "ja-JP": "jaJP",
  "fr-FR": "frFR", // Convert hyphen to camelCase: fr-FR → frFR
} as const;
```

**Update handleLanguageChange type** (line 28):

```typescript
const handleLanguageChange = async (newLanguage: 'en' | 'es-ES' | 'ja-JP' | 'fr-FR') => {
  //                                                                          ^^^^^^^ Add your locale
```

#### Step 5: Update API Route

Edit `/app/api/user/language/route.ts`:

**Update error message** (around line 27):

```typescript
return NextResponse.json(
  { error: "Invalid language. Supported languages: en, es-ES, ja-JP, fr-FR" },
  //                                                                 ^^^^^^^ Add your locale
  { status: 400 },
);
```

#### Step 6: Add Language Names to All Translation Files

Add your language name to **ALL** locale files under `settings.appearance.language`:

**In `/locales/en.json`**:

```json
"language": {
  "title": "Language",
  "description": "Choose your preferred language",
  "en": "English",
  "esES": "Español (España)",
  "jaJP": "日本語",
  "frFR": "Français (France)"
}
```

**In `/locales/es-ES.json`**:

```json
"language": {
  "title": "Idioma",
  "description": "Elige tu idioma preferido",
  "en": "English",
  "esES": "Español (España)",
  "jaJP": "日本語",
  "frFR": "Français (France)"
}
```

**In `/locales/ja-JP.json`**:

```json
"language": {
  "title": "言語",
  "description": "お好みの言語を選択してください",
  "en": "English",
  "esES": "Español (España)",
  "jaJP": "日本語",
  "frFR": "Français (France)"
}
```

**And in your new locale file** (e.g., `/locales/fr-FR.json`):

```json
"language": {
  "title": "Langue",
  "description": "Choisissez votre langue préférée",
  "en": "English",
  "esES": "Español (España)",
  "jaJP": "日本語",
  "frFR": "Français (France)"
}
```

#### Step 7: Add Tests

Edit `/tests/lib/locale.test.ts`:

Add test cases for your new language:

```typescript
// In isSupportedLocale tests
it('should return true for "fr-FR"', () => {
  expect(isSupportedLocale("fr-FR")).toBe(true);
});

// In normalizeLocale tests
it('should pass through "fr-FR"', () => {
  expect(normalizeLocale("fr-FR")).toBe("fr-FR");
});

it('should map "fr" to "fr-FR"', () => {
  expect(normalizeLocale("fr")).toBe("fr-FR");
});

// In detectBrowserLocale tests
it("should detect French from Accept-Language header", async () => {
  const { headers } = await import("next/headers");
  vi.mocked(headers).mockResolvedValue({
    get: vi.fn().mockReturnValue("fr-FR,fr;q=0.9,en;q=0.8"),
  } as any);

  const locale = await detectBrowserLocale();

  expect(locale).toBe("fr-FR");
});

it('should map "fr" to "fr-FR"', async () => {
  const { headers } = await import("next/headers");
  vi.mocked(headers).mockResolvedValue({
    get: vi.fn().mockReturnValue("fr,en;q=0.9"),
  } as any);

  const locale = await detectBrowserLocale();

  expect(locale).toBe("fr-FR");
});
```

#### Important Notes

**Locale Code Format:**

- Use the format `language-COUNTRY` (e.g., `fr-FR`, `pt-BR`, `zh-CN`)
- Language code: lowercase, 2 letters (ISO 639-1)
- Country code: uppercase, 2 letters (ISO 3166-1 alpha-2)
- Exception: English uses just `en` without country code

**LabelMap Convention:**

- Convert locale codes to camelCase for labelMap keys
- Remove hyphens: `fr-FR` → `frFR`, `pt-BR` → `ptBR`
- Used for accessing translations in the LanguageSelector component

**Flag Icons:**

- Find your flag code at [flagicons.lipis.dev](https://flagicons.lipis.dev/)
- Usually the lowercase country code (e.g., `fr`, `de`, `jp`)
- Exception: Great Britain uses `gb` instead of `uk`

**Translation Quality:**

- Ensure all strings are properly translated (no English fallbacks)
- Test the app in the new language to verify context
- Pay attention to:
  - Proper capitalization for the target language
  - Gender-specific forms (if applicable)
  - Pluralization rules
  - Date/time format preferences
  - Cultural appropriateness

#### Testing Your Translation

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Navigate to Settings → Appearance → Language**

3. **Select your new language** and verify:
   - Language appears in the selector
   - Flag icon displays correctly
   - All UI text is translated
   - No English strings remain
   - Forms, buttons, and error messages are translated
   - Date formatting is appropriate

4. **Run tests:**

   ```bash
   npm run test
   ```

5. **Build the application:**
   ```bash
   npm run build
   ```

#### Submitting Your Translation

1. Create a feature branch:

   ```bash
   git checkout -b feat/add-{language}-translation
   ```

2. Commit your changes:

   ```bash
   git commit -m "feat: add {Language} translation"
   ```

3. Push and create a Pull Request:

   ```bash
   git push origin feat/add-{language}-translation
   ```

4. In your PR description:
   - Mention that you've added support for {Language}
   - Confirm all 7 files have been updated
   - Note if you're a native speaker or used translation tools
   - Include screenshots of the language selector with your language

#### Getting Help

If you need assistance:

- For translation help: Use AI tools like ChatGPT, DeepL, or Google Translate
- For technical help: Open an issue or discussion on GitHub
- For locale code questions: Check [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) and [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

## Code Style

We use ESLint and Prettier for code formatting. Most issues are caught automatically.

**General guidelines:**

- TypeScript for all code (no `any` types unless absolutely necessary)
- Functional React components with hooks
- Tailwind CSS for styling (no inline styles or CSS modules)
- Follow existing patterns in the codebase
- Keep components small and focused
- Write meaningful variable and function names
- **All user-facing strings must use translations (never hardcode text)**

**File organization:**

- Components go in `/components`
- Pages go in `/app`
- API routes go in `/app/api`
- Utilities go in `/lib`
- Types go alongside the code that uses them
- Translations go in `/locales` (one file per language)

**React patterns:**

```typescript
// Use functional components with hooks
export default function MyComponent({ prop }: Props) {
  const [state, setState] = useState<string>('');

  return (
    <div className="...">
      {/* ... */}
    </div>
  );
}

// Use TypeScript interfaces for props
interface Props {
  prop: string;
}
```

**API routes:**

```typescript
// Always validate input
const body = await request.json();
const validated = schema.parse(body);

// Always handle errors
try {
  // ...
} catch (error) {
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
```

## Project Structure

```text
/app                          # Next.js app directory (routes)
  /api                        # API endpoints
    /people                   # Person CRUD operations
    /groups                   # Group CRUD operations
    /relationships            # Relationship CRUD operations
    /billing                  # Stripe integration
    /cron                     # Scheduled jobs
  /dashboard                  # Dashboard page
  /people                     # People management pages
  /groups                     # Groups management pages
  /settings                   # Settings pages
  /login, /register, etc.     # Auth pages

/components                   # React components
  /ui                         # Reusable UI components (buttons, inputs, etc.)
  /billing                    # Billing-specific components
  /graphs                     # D3.js network graph components

/lib                          # Utility functions and shared code
  /auth                       # Authentication utilities (NextAuth config)
  /prisma                     # Prisma client singleton
  /billing                    # Stripe and subscription logic
  /rate-limit                 # Rate limiting with Redis
  /email                      # Email sending (Resend)

/locales                      # Translation files (i18n)
  en.json                     # English translations
  es-ES.json                  # Spanish translations

/prisma                       # Database schema and migrations
  /migrations                 # Migration files
  schema.prisma               # Database schema

/scripts                      # Utility scripts
  setup-db.sh                 # Database setup script
  backup-database.sh          # Backup script
  restore-database.sh         # Restore script

/docs                         # Documentation and screenshots
/public                       # Static assets
```

## Tech Stack Overview

Understanding the stack helps when contributing:

- **Next.js 15**: React framework with App Router (file-based routing)
- **TypeScript**: Type safety across the codebase
- **Tailwind CSS**: Utility-first CSS framework
- **PostgreSQL**: Primary database
- **Prisma**: Type-safe database ORM
- **Redis**: Rate limiting and caching
- **NextAuth.js**: Authentication (credentials provider)
- **next-intl**: Internationalization (i18n) with support for English and Spanish
- **Resend**: Transactional emails
- **Stripe**: Payment processing (subscription billing)
- **D3.js**: Network graph visualization
- **Vitest**: Unit testing
- **Playwright**: E2E testing

## Common Tasks

### Adding a new API endpoint

1. Create file in `/app/api/your-endpoint/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` functions as needed
3. Validate input with Zod schemas
4. Use Prisma for database operations
5. Return `NextResponse.json()`

### Adding a new page

1. Create file in `/app/your-page/page.tsx`
2. Export default async function for server component
3. Use `auth()` to check authentication
4. Fetch data server-side when possible
5. Use client components (`'use client'`) only when needed (interactivity)

### Adding a database field

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_field_name`
3. Update TypeScript types if needed
4. Update relevant components/API routes

### Working with graphs

The network graphs use D3.js force-directed layouts. Key files:

- `/components/graphs/NetworkGraph.tsx` - Main graph component
- `/lib/graph-utils.ts` - Graph transformation utilities

## Questions or Issues?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
