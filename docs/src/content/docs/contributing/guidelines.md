---
title: Code Guidelines
description: Coding standards and conventions for Nametag contributors.
sidebar:
  order: 4
---

These standards are enforced in code review and, in several cases, in CI. Read them before opening a PR.

## TypeScript type safety

Never use `any` as a type. Always define specific types for everything.

- Use proper TypeScript types and interfaces.
- Avoid type assertions unless absolutely necessary.
- The GitHub Actions workflow fails the build if `any` types are detected.
- If you truly don't know the type, use `unknown` and narrow it with type guards.

## Internationalization (i18n)

Every user-facing string must be translated in all supported languages.

- Supported languages live in `/locales/*.json`. Discover the current set with `ls locales/*.json` rather than assuming a fixed list, since new languages can be added over time.
- When adding any text visible to users, add a translation key to every file under `/locales/`. Key trees must stay at parity across all locale files, a missing key in any file is a bug.
- Never hardcode strings in components.
- Use `useTranslations` in client components, or `getTranslations` in server components.
- Use descriptive, namespaced keys (`people.form.name`, not `ppl.f.n`).
- Use interpolation for dynamic values: `t('greeting', { name: 'John' })`.

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

For the full walkthrough of adding a brand new language (locale file, `lib/locale.ts`, `i18n.ts`, `LanguageSelector`, API route, tests), see the "Adding a New Language" section of [CONTRIBUTING.md](https://github.com/mattogodoy/nametag/blob/master/CONTRIBUTING.md) in the repository.

## Soft-delete filtering

Every Prisma read query on a soft-deletable model must include `deletedAt: null` in its `where` clause.

Soft-deletable models: `Person`, `Group`, `Relationship`, `RelationshipType`, `ImportantDate`.

- This applies to `findMany`, `findFirst`, `findUnique`, `count`, and `aggregate` queries.
- Nested includes on soft-deletable relations (for example `relationshipsFrom`, `importantDates`) must also add `where: { deletedAt: null }`.
- The only exceptions are trash and restore routes, and delete helpers that intentionally operate on deleted records.
- When adding a new query on any of these models, always ask: should this exclude soft-deleted records?

## OpenAPI specification

Every API endpoint change must be reflected in the OpenAPI spec under `lib/openapi/`.

- When adding a new API route, add the corresponding path entry to the spec generation.
- When modifying request or response schemas, update the spec to match.
- When removing an API route, remove it from the spec too.
- Use `zodBody()` for request bodies backed by a Zod schema in `lib/validations.ts`.
- Use `jsonBody()` for simpler, inline request bodies.
- Run `npx vitest run tests/api/openapi-spec.test.ts` to verify the spec is valid.

## Testing

- **Vitest** for unit tests.
- **Playwright** for end-to-end tests.
- Run `npm run verify` before opening a PR. It runs lint, typecheck, unit tests, and a production build.
- Run `npm run verify:all` for larger changes. It adds the full Playwright E2E suite, matching what CI runs.

## Code style

ESLint and Prettier catch most formatting issues automatically.

- TypeScript for all code, no `any` types (see above).
- Functional React components with hooks.
- Tailwind CSS for styling, no inline styles or CSS modules.
- Follow existing patterns in the codebase.
- Keep components small and focused.
- Write meaningful variable and function names.
- All user-facing strings must use translations, never hardcoded text.

**File organization:**

- Components in `/components`.
- Pages in `/app`.
- API routes in `/app/api`.
- Utilities in `/lib`.
- Types alongside the code that uses them.
- Translations in `/locales`, one file per language.

## PR workflow

1. **Create a feature branch** from `master`:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make your changes**, following the code style above.

3. **Test your changes:**

   ```bash
   npm run verify       # recommended: lint, typecheck, unit tests, build
   npm run verify:all   # optional, recommended for larger changes: adds E2E
   ```

4. **Commit with clear, conventional messages:**

   ```bash
   git commit -m "feat: add birthday reminder notifications"
   git commit -m "fix: resolve duplicate person creation"
   git commit -m "docs: update API documentation"
   ```

   See [Versioning & Releases](/contributing/versioning/) for the full conventional commits reference.

5. **Push and open a PR:**

   ```bash
   git push origin feature/your-feature-name
   ```

**PR guidelines:**

- Keep PRs focused on a single feature or fix.
- Link related issues.
- Add a clear description of what changed and why.
- Include screenshots for UI changes.
- Make sure all checks pass (lint, typecheck, tests, build). These run automatically via GitHub Actions.
- Run `npm run verify` locally before pushing to catch issues early.
- Update documentation if the change affects it.

## Next steps

- [Development Setup](/contributing/development/) for getting a local environment running.
- [Architecture](/contributing/architecture/) for how the codebase fits together.
- [Versioning & Releases](/contributing/versioning/) for commit conventions and release process.
