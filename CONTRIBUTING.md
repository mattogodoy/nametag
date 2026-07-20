# Contributing to Nametag

Thanks for your interest in contributing! This guide covers how to report issues, propose changes, and submit pull requests. For hands-on setup instructions and code guidelines, see the docs site:

- [Development setup guide](https://docs.nametag.one/contributing/development/) - Dev Container and local development options, running tests, and common commands
- [Code guidelines](https://docs.nametag.one/contributing/guidelines/) - code style, project structure, commit message format, and PR verification steps

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

2. **Make your changes** following our [code guidelines](https://docs.nametag.one/contributing/guidelines/)

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

## Adding a New Language

Want to add support for a new language to Nametag? Follow this guide.

### Prerequisites

Before starting, ensure you have:

- Fluency in the target language or access to reliable translation resources (preferrably you are a native speaker)
- The correct locale code for your language (format: `language-COUNTRY`, e.g., `fr-FR`, `de-DE`, `pt-BR`)
- The flag icon code from the [flag-icons library](https://flagicons.lipis.dev/)

### Step 1: Create Translation File

Create a new JSON file in `/locales/{locale-code}.json`:

```bash
# Example for French (France)
cp locales/en.json locales/fr-FR.json
```

Translate all strings in the new file. Keep the same structure and keys as the English version.

### Step 2: Update Locale Configuration

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

### Step 3: Update i18n Configuration

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

### Step 4: Update LanguageSelector Component

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
  "fr-FR": "frFR", // Convert hyphen to camelCase: fr-FR to frFR
} as const;
```

**Update handleLanguageChange type** (line 28):

```typescript
const handleLanguageChange = async (newLanguage: 'en' | 'es-ES' | 'ja-JP' | 'fr-FR') => {
  //                                                                          ^^^^^^^ Add your locale
```

### Step 5: Update API Route

Edit `/app/api/user/language/route.ts`:

**Update error message** (around line 27):

```typescript
return NextResponse.json(
  { error: "Invalid language. Supported languages: en, es-ES, ja-JP, fr-FR" },
  //                                                                 ^^^^^^^ Add your locale
  { status: 400 },
);
```

### Step 6: Add Language Names to All Translation Files

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

### Step 7: Add Tests

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

### Important Notes

**Locale Code Format:**

- Use the format `language-COUNTRY` (e.g., `fr-FR`, `pt-BR`, `zh-CN`)
- Language code: lowercase, 2 letters (ISO 639-1)
- Country code: uppercase, 2 letters (ISO 3166-1 alpha-2)
- Exception: English uses just `en` without country code

**LabelMap Convention:**

- Convert locale codes to camelCase for labelMap keys
- Remove hyphens: `fr-FR` to `frFR`, `pt-BR` to `ptBR`
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

### Testing Your Translation

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

### Submitting Your Translation

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

### Getting Help

If you need assistance:

- For translation help: Use AI tools like ChatGPT, DeepL, or Google Translate
- For technical help: Open an issue or discussion on GitHub
- For locale code questions: Check [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) and [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

## Questions or Issues?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
