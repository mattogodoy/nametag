# Mobile Quirks Bug Bash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mobile experience to parity with desktop by fixing the specific quirks (sideways scroll, off-screen elements, undersized targets, iOS focus-zoom, cramped spacing) without redesigning patterns.

**Architecture:** Three-phase: (1) audit at 320/375/430 producing a punch list inside this plan, (2) systemic CSS/component fixes in `globals.css` and shared primitives that resolve whole categories at once, (3) per-page cleanup walking the remaining issues page by page in priority order. A real-device verification pass closes the loop.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, Chrome DevTools device emulation. No new tests added — this is layout/CSS work; existing Playwright suite catches functional regressions.

**Spec:** `docs/superpowers/specs/2026-05-04-mobile-quirks-bug-bash-design.md`

---

## File map

**Modified files (Phase 2 systemic pass — concrete from static analysis)**
- `app/globals.css` — `html { overflow-x: clip }`, mobile input font-size rule, optional safe-area utility class
- `components/ui/Modal.tsx` — close-button touch target (`p-1` → 44px); panel respects safe-area inset bottom
- `components/ui/ConfirmationModal.tsx` — panel respects safe-area inset bottom
- `components/PhotoSourceModal.tsx` — bespoke modal: backdrop `p-4` + safe-area
- `components/PhotoCropModal.tsx` — bespoke modal: same treatment
- `components/Navigation.tsx` — top inset for nav bar, right+top inset for mobile drawer
- `components/PeopleListClient.tsx` — bound `overflow-x-auto` wrapper, sort-arrow touch targets (Phase 3 also touches this for filter wrap)
- `components/ConflictList.tsx` — bound `overflow-x-auto` wrapper
- `components/PersonCompare.tsx` — bound `overflow-x-auto` wrappers (×2)
- `components/PersonVCardRawView.tsx` — bound `overflow-x-auto` wrapper
- `components/billing/PaymentHistoryTable.tsx` — bound `overflow-x-auto` wrapper
- `components/GraphFilterHelpModal.tsx` — `w-6 h-6` `?` trigger button → 44px touch target

**Modified files (Phase 3 per-page) — exact set determined by audit findings**
The Phase 3 tasks below reference this list as a starting point; the audit may add more.

---

## Audit Findings

> Filled in during Task 1. Format: one bullet per issue. `[ ] [page] [category] description → suggested fix`. Tasks 10–20 reference these by line number.

*(empty — populated during Task 1)*

---

## Task 1: Phase 1 — Audit

**Files:**
- Modify: `docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md` (this file — the "Audit Findings" section)

This task produces no code changes. It produces a structured punch list inside this plan.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait for `Local: http://localhost:3000` to appear.

- [ ] **Step 2: Set up Chrome DevTools mobile emulation**

Open `http://localhost:3000` in Chrome, log in if needed, open DevTools (Cmd+Opt+I), click the device-toolbar toggle (Cmd+Shift+M). Use the "Responsive" preset and prepare to switch widths between 320, 375, and 430 px.

- [ ] **Step 3: Walk every user-facing page at 375px first, recording issues**

Visit each route below, scroll the page, open menus/modals, focus form inputs. For each issue, append a bullet to the "Audit Findings" section above using the format:

```
- [ ] [page] [category] short description → suggested fix
```

Where `[category]` is one of: `overflow`, `touch-target`, `font-size`, `off-screen`, `spacing`, `modal`, `safe-area`.

Routes to walk:

- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/dashboard`
- `/people`, `/people/new`, `/people/[any-id]`, `/people/[any-id]/edit`, `/people/duplicates`, `/people/merge`
- `/groups`, `/groups/new`, `/groups/[any-id]`, `/groups/[any-id]/edit`
- `/journal`, `/journal/new`, `/journal/[any-id]`, `/journal/[any-id]/edit`
- `/relationship-types`
- `/settings/profile`, `/settings/appearance`, `/settings/security`, `/settings/carddav`, `/settings/account`, `/settings/about`
- `/carddav/import`, `/carddav/export`, `/carddav/conflicts` (skip if no CardDAV connection)

For each page also: open every modal (bulk delete/group/relationship, photo crop, graph filter help), confirm the table sort order, focus a text input, focus a select, focus a textarea.

- [ ] **Step 4: Repeat the walk at 320 px**

Switch DevTools width to 320. Re-walk only pages that showed issues at 375, plus the dashboard and people list. Append any new findings.

- [ ] **Step 5: Repeat the walk at 430 px**

Switch to 430. Walk the same subset. Append any new findings.

- [ ] **Step 6: Sort and deduplicate the punch list**

Group findings by page header in the "Audit Findings" section. Remove duplicates. Each remaining bullet is one fix.

- [ ] **Step 7: Commit the populated audit**

```bash
git add docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md
git commit -m "docs(mobile): record Phase 1 audit findings"
```

---

## Task 2: Phase 2 — globals.css systemic CSS

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the systemic mobile rules at the bottom of `app/globals.css`**

After the existing `body { ... }` rule, append:

```css
/* Mobile safety net: catch stray horizontal overflow at the page level.
   Uses `clip` so it does not establish a containing block for fixed/sticky. */
html {
  overflow-x: clip;
}

/* Prevent iOS Safari from zooming on focus when an input renders text under 16px. */
@media (max-width: 640px) {
  input,
  select,
  textarea {
    font-size: 16px;
  }
}
```

(Components use Tailwind's arbitrary-value syntax, e.g. `pt-[env(safe-area-inset-top)]`, when they need safe-area insets — no global utility class is required.)

- [ ] **Step 2: Verify in the browser at 375px**

Reload the dev server (`npm run dev` if not running). Open any page in Chrome DevTools at 375px width. Try to scroll horizontally on the page body — it should not scroll. Focus a `text-sm` input on `/login`. The viewport should NOT zoom on focus (iOS-only behavior, but you can sanity-check by inspecting computed styles: the input's `font-size` should resolve to `16px` at this width).

- [ ] **Step 3: Run the type check**

```bash
npm run typecheck
```

Expected: pass (no TS changes, but confirm no project-level breakage).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(mobile): add page overflow guard, iOS focus-zoom fix, and safe-area utilities"
```

---

## Task 3: Phase 2 — bound `overflow-x-auto` wrappers

**Files:**
- Modify: `components/PeopleListClient.tsx:259-261`
- Modify: `components/ConflictList.tsx:236-238`
- Modify: `components/PersonCompare.tsx:405-407`
- Modify: `components/PersonCompare.tsx:621-623`
- Modify: `components/PersonVCardRawView.tsx:91-93`
- Modify: `components/billing/PaymentHistoryTable.tsx:81-83`

The pattern: add `max-w-full` to the `overflow-x-auto` wrapper so its width is bounded by the parent card, not allowed to expand the page.

- [ ] **Step 1: PeopleListClient — bound the table wrapper**

In `components/PeopleListClient.tsx`, find:

```tsx
      {/* Table */}
      <div className="bg-surface shadow-sm rounded-lg overflow-hidden border border-border">
        <div className="overflow-x-auto">
```

Change the inner `<div>` to:

```tsx
        <div className="overflow-x-auto max-w-full">
```

- [ ] **Step 2: ConflictList — bound the table wrapper**

In `components/ConflictList.tsx`, find the line with `<div className="overflow-x-auto">` near line 237 and change it to `<div className="overflow-x-auto max-w-full">`.

- [ ] **Step 3: PersonCompare — bound both wrappers**

In `components/PersonCompare.tsx`, change both occurrences of `<div className="overflow-x-auto">` (around lines 406 and 622) to `<div className="overflow-x-auto max-w-full">`.

- [ ] **Step 4: PersonVCardRawView — bound the `<pre>` wrapper**

In `components/PersonVCardRawView.tsx` around line 92, find:

```tsx
          <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground whitespace-pre">
```

Change to:

```tsx
          <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto max-w-full text-xs font-mono text-foreground whitespace-pre">
```

- [ ] **Step 5: PaymentHistoryTable — bound the wrapper**

In `components/billing/PaymentHistoryTable.tsx` around line 82, change `<div className="overflow-x-auto">` to `<div className="overflow-x-auto max-w-full">`.

- [ ] **Step 6: Visually verify in DevTools at 375px**

Reload the dev server. Visit `/people` — the table should scroll horizontally inside its card, but the page should not scroll horizontally. Visit `/carddav/conflicts` if you have any conflicts; otherwise skip. Visit any person detail page and click "Show vCard" if available — the `<pre>` should scroll inside its card. Visit `/settings/billing` — payment history (if any) should scroll inside its card.

- [ ] **Step 7: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add components/PeopleListClient.tsx components/ConflictList.tsx components/PersonCompare.tsx components/PersonVCardRawView.tsx components/billing/PaymentHistoryTable.tsx
git commit -m "fix(mobile): bound overflow-x-auto wrappers so scroll stays inside cards"
```

---

## Task 4: Phase 2 — shared modal primitives (close-button touch target, safe-area)

**Files:**
- Modify: `components/ui/Modal.tsx:117-137`
- Modify: `components/ui/Modal.tsx:104-108`
- Modify: `components/ui/ConfirmationModal.tsx:42-43`

The `Modal.tsx` close button is currently `p-1` with a `w-6 h-6` SVG, which is 40×40px — under the 44px threshold. The panel uses `p-4` backdrop + `max-h-[90vh]` but does not respect safe-area at the bottom.

`ConfirmationModal.tsx` doesn't render a close button (it has explicit Cancel/Confirm buttons), so only the panel safe-area applies.

- [ ] **Step 1: Modal close button — bump to 44px hit area**

In `components/ui/Modal.tsx`, find the close button (around line 117):

```tsx
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1 rounded-lg hover:bg-surface-elevated"
            aria-label={closeAriaLabel || 'Close modal'}
          >
```

Change className to:

```tsx
            className="text-muted hover:text-foreground transition-colors p-1 rounded-lg hover:bg-surface-elevated min-h-11 min-w-11 flex items-center justify-center"
```

This makes the button at least 44×44px while keeping the visual centering of the icon.

- [ ] **Step 2: Modal panel — respect bottom safe-area**

In `components/ui/Modal.tsx`, find the panel `<div>` (around line 107):

```tsx
        className={`bg-surface rounded-lg w-full ${sizeClasses[size]} shadow-xl max-h-[90vh] overflow-y-auto`}
```

Change to:

```tsx
        className={`bg-surface rounded-lg w-full ${sizeClasses[size]} shadow-xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]`}
```

- [ ] **Step 3: ConfirmationModal panel — respect bottom safe-area**

In `components/ui/ConfirmationModal.tsx`, find the panel `<div>` (around line 42):

```tsx
      <div className="bg-surface rounded-lg max-w-md w-full p-6">
```

Change to:

```tsx
      <div className="bg-surface rounded-lg max-w-md w-full p-6 pb-[calc(theme(spacing.6)+env(safe-area-inset-bottom))]">
```

- [ ] **Step 4: Visually verify**

Reload the dev server. Open any modal (e.g., go to `/dashboard`, click the `?` graph filter help button — that opens a `Modal`). At 375px width, the close button should feel "tappable" (target ≥44px). Inspect with DevTools — its bounding box should be at least 44×44.

Open a `ConfirmationModal` instance — e.g., select multiple people on `/people` and click "Delete selected" to open `BulkDeleteModal`. Verify the panel renders correctly.

- [ ] **Step 5: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Modal.tsx components/ui/ConfirmationModal.tsx
git commit -m "fix(mobile): enlarge modal close button and add bottom safe-area padding"
```

---

## Task 5: Phase 2 — bespoke photo modals (PhotoSourceModal, PhotoCropModal)

**Files:**
- Modify: `components/PhotoSourceModal.tsx:104`
- Modify: `components/PhotoCropModal.tsx:101`

Both modals don't use the shared `Modal` primitive. They have `bg-surface rounded-lg shadow-xl w-full max-w-md mx-4`. The `mx-4` already gives a 16px gutter, so the panel is bounded. We just need bottom safe-area.

- [ ] **Step 1: PhotoSourceModal — add bottom safe-area**

In `components/PhotoSourceModal.tsx`, find the panel `<div>` around line 104:

```tsx
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4">
```

Change to:

```tsx
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 pb-[env(safe-area-inset-bottom)]">
```

- [ ] **Step 2: PhotoCropModal — same treatment**

In `components/PhotoCropModal.tsx`, find the panel `<div>` around line 101:

```tsx
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4">
```

Change to:

```tsx
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 pb-[env(safe-area-inset-bottom)]">
```

- [ ] **Step 3: Visually verify in DevTools at 375px**

Reload the dev server. Visit `/people/[any-id]/edit`. Open the photo source modal (click the photo placeholder), then the crop modal (after selecting a photo). Verify each renders within viewport bounds and the close buttons are reachable.

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add components/PhotoSourceModal.tsx components/PhotoCropModal.tsx
git commit -m "fix(mobile): photo modals respect bottom safe-area inset"
```

---

## Task 6: Phase 2 — Navigation safe-area (top + drawer)

**Files:**
- Modify: `components/Navigation.tsx` — find `<nav className="bg-surface border-b border-border">` (currently around line 79)
- Modify: `components/Navigation.tsx` — find the drawer `<div ... className="md:hidden fixed top-0 right-0 bottom-0 ...">` (currently around line 171)

The top nav (`<nav>`) sits at the top of every page. On notched iPhones, content can clip into the safe-area inset. The drawer slides in from the right; its top should also clear the inset.

- [ ] **Step 1: Add top safe-area to the nav root**

In `components/Navigation.tsx`, find the `<nav>` element (around line 75):

```tsx
    <nav className="bg-surface border-b border-border">
```

Change to:

```tsx
    <nav className="bg-surface border-b border-border pt-[env(safe-area-inset-top)]">
```

- [ ] **Step 2: Add safe-area to the drawer panel**

In `components/Navigation.tsx`, find the drawer panel (around line 171):

```tsx
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="md:hidden fixed top-0 right-0 bottom-0 w-[90%] max-w-md bg-surface shadow-xl z-50 transform transition-transform duration-300 ease-in-out"
          >
```

Change className to:

```tsx
            className="md:hidden fixed top-0 right-0 bottom-0 w-[90%] max-w-md bg-surface shadow-xl z-50 transform transition-transform duration-300 ease-in-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
```

- [ ] **Step 3: Visually verify in DevTools**

Reload the dev server. At 375px width, open the hamburger drawer. Use DevTools' "iPhone 14 Pro" preset (which simulates the notch via `viewport-fit=cover`) to confirm the drawer header has top breathing room. Note: full notch simulation requires a real device — Phase 4 will catch anything DevTools misses.

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add components/Navigation.tsx
git commit -m "fix(mobile): nav and drawer respect safe-area insets"
```

---

## Task 7: Phase 2 — touch targets for icon-only controls

**Files:**
- Modify: `components/GraphFilterHelpModal.tsx:18-25` (`?` trigger)
- Modify: `components/PeopleListClient.tsx:276-279` and 5 sibling sort-arrow `<Link>`s
- Inspect: `components/Navigation.tsx:104-110` (hamburger — already `p-3` ≈ 48px, verify only)
- Inspect: `components/PersonActionsMenu.tsx` (verify trigger size)

The `?` button in `GraphFilterHelpModal` is `w-6 h-6` = 24×24px — well below 44px. The table sort-arrow links inside `PeopleListClient` thead use `flex items-center gap-1 hover:text-foreground` with no padding — small tap targets.

- [ ] **Step 1: Enlarge the `?` button**

In `components/GraphFilterHelpModal.tsx`, find the trigger (around line 18):

```tsx
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex w-6 h-6 items-center justify-center rounded-full border border-foreground/40 bg-surface-elevated text-base font-bold text-muted hover:text-foreground hover:border-foreground transition-colors shrink-0"
        aria-label={t('graph.filterHelp.ariaLabel')}
        title={t('graph.filterHelp.ariaLabel')}
      >
        ?
      </button>
```

Change className to keep the visual size on desktop but ensure a 44px hit area on mobile:

```tsx
        className="inline-flex w-6 h-6 sm:w-6 sm:h-6 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 items-center justify-center rounded-full border border-foreground/40 bg-surface-elevated text-base font-bold text-muted hover:text-foreground hover:border-foreground transition-colors shrink-0"
```

(The `min-h-11 min-w-11` applies on mobile; `sm:min-h-0 sm:min-w-0` reverts to the visual 24×24 on desktop.)

- [ ] **Step 2: Enlarge sort-arrow tap targets in PeopleListClient**

In `components/PeopleListClient.tsx`, the `<th>` cells contain `<Link>` elements like:

```tsx
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('name')} className="flex items-center gap-1 hover:text-foreground">
                    {tc.name}
                    {sortBy === 'name' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
```

The `<Link>` itself has zero padding. Add `py-2 -my-2` (vertical hit area without changing visual layout) and `min-h-11 sm:min-h-0`. Replace each occurrence of `className="flex items-center gap-1 hover:text-foreground"` on the sort-header `<Link>` elements with:

```tsx
                  <Link href={buildSortUrl('name')} className="flex items-center gap-1 hover:text-foreground py-2 -my-2 min-h-11 sm:min-h-0">
```

(Repeat for the surname, nickname, relationship, group, and lastContact links — six total.)

- [ ] **Step 3: Verify Navigation hamburger is already large enough**

In `components/Navigation.tsx` around line 104, inspect:

```tsx
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-md text-foreground hover:bg-surface-elevated transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
```

`p-3` (12px) + `w-6 h-6` (24px) + `p-3` = 48px. **Already meets 44px.** No change needed.

- [ ] **Step 4: Inspect PersonActionsMenu trigger**

Open `components/PersonActionsMenu.tsx`. Find the trigger button (the kebab/ellipsis menu opener — search for `aria-label` and "menu" near the top of the JSX). If it's smaller than 44×44 on mobile, add `min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`. If it already has padding ≥ 12px on a 24px icon, leave alone.

- [ ] **Step 5: Visually verify in DevTools at 375px**

Reload the dev server. Visit `/dashboard` — click the `?` button (graph filter help) and confirm the visual size hasn't changed but the hit area is larger (use DevTools "Inspect" and hover the element — its rendered box should be 44×44). Visit `/people` — hover/tap the column headers; each should feel "tappable."

- [ ] **Step 6: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/GraphFilterHelpModal.tsx components/PeopleListClient.tsx components/PersonActionsMenu.tsx
git commit -m "fix(mobile): ensure icon-only controls have 44px touch targets"
```

(Drop `components/PersonActionsMenu.tsx` from the `git add` if Step 4 found no change needed.)

---

## Task 8: Phase 2 — form-control text-base sm:text-sm sweep

**Files:**
- Inspect (and possibly modify): every `.tsx` file containing a `<input>`, `<select>`, or `<textarea>` whose `className` includes `text-sm`

The global CSS rule from Task 2 already enforces 16px on form controls below 640px width — this is the iOS focus-zoom fix at the CSS layer. This task is the belt-and-suspenders pass: where the markup explicitly says `text-sm` on a form control, switch to `text-base sm:text-sm` so the source matches the rendered behaviour and renders compact again on desktop.

- [ ] **Step 1: Find form-control candidates**

Run from the repo root:

```bash
grep -RE '<(input|select|textarea)\b[^>]*className="[^"]*\btext-sm\b' app components --include="*.tsx" -l
```

The output is the candidate file list. For each file, find the matching `<input>`/`<select>`/`<textarea>` whose `className` literally contains `text-sm` (don't change `<label>` or `<span>` elements — only form controls themselves).

- [ ] **Step 2: Replace `text-sm` with `text-base sm:text-sm` on each control**

For each match, change the class list. Example — `components/PeopleListClient.tsx` filter selects:

```tsx
          <select
            value={groupFilter}
            onChange={(e) => handleFilterChange('group', e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          >
```

becomes:

```tsx
          <select
            value={groupFilter}
            onChange={(e) => handleFilterChange('group', e.target.value)}
            className="px-3 py-1.5 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          >
```

Apply the same `text-sm` → `text-base sm:text-sm` substitution to every form-control match.

- [ ] **Step 3: Visually verify in DevTools at 375px and ≥640px**

Reload the dev server. At 375px, focus a previously-affected select (e.g., the group filter on `/people`). Its computed font-size should be 16px. At 1024px (or any width ≥640), the same select's font-size should be 14px (Tailwind's `text-sm`).

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): form controls render at 16px on phones, text-sm on desktop"
```

---

## Task 9: Phase 2 — re-audit at 375px

**Files:**
- Modify: `docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md` (Audit Findings section)

After the systemic pass, re-walk the audit-flagged pages at 375px. Many issues should be resolved by the systemic fixes; cross those off. Update the punch list with only the issues that remain.

- [ ] **Step 1: Restart the dev server with a clean build**

```bash
# stop any running dev server, then:
npm run dev
```

- [ ] **Step 2: Walk pages that had findings**

For each `[ ]` item in the "Audit Findings" section above:
- Visit the page in DevTools at 375px width.
- Reproduce the issue (focus the input, scroll the table, etc.).
- If resolved, change the bullet to `[x]` and append `(resolved by Phase 2)`.
- If not resolved, leave as `[ ]` — it becomes a Phase 3 task.

- [ ] **Step 3: Commit the re-audit notes**

```bash
git add docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md
git commit -m "docs(mobile): mark Phase 1 findings resolved by Phase 2 systemic pass"
```

---

## Task 10: Phase 3 — Dashboard

**Files:**
- Inspect: `app/dashboard/page.tsx`
- Modify: depends on audit findings — common suspects are `app/dashboard/page.tsx` (greeting + upcoming events list) and `components/UnifiedNetworkGraph.tsx`

- [ ] **Step 1: Re-open the dashboard at 320, 375, and 430 px**

Visit `http://localhost:3000/dashboard`. Test each remaining `[ ]` finding under the "dashboard" header in the Audit Findings section. Common things to verify:
- The network-graph canvas does not push the page wider than viewport. The graph container should use `w-full`; if it's missing, add to `app/dashboard/page.tsx` where `<UnifiedNetworkGraph />` is wrapped.
- Upcoming-event rows wrap rather than truncate awkwardly: each row's `flex justify-between` should hold; verify long names don't break layout.
- Greeting heading does not wrap into 4+ lines on a long name. If it does, switch `text-2xl` to `text-xl sm:text-2xl` on the greeting `<h1>`.

- [ ] **Step 2: Apply specific fixes from the audit findings**

For each remaining `[ ]` item under "dashboard" in the Audit Findings section, apply the suggested fix. If a finding has no clear suggested fix, ask the spec author or leave a comment in the plan.

- [ ] **Step 3: Re-verify at all three widths**

Repeat the visual walk at 320, 375, and 430 px. Mark each fixed item `[x]` in the Audit Findings section.

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): dashboard layout fixes for narrow viewports"
```

(Skip the commit if no changes were needed; mark the task complete.)

---

## Task 11: Phase 3 — People list

**Files:**
- Modify: `components/PeopleListClient.tsx:228-256` (filter row, bulk action header)
- Inspect: `app/people/page.tsx`

Known suspect from static analysis: the filter row `<div className="mb-4 flex items-center justify-between">` (line 228) places the showing-count and the two `<select>`s on one line with `flex items-center justify-between`. At narrow widths this can squeeze or push elements off-screen.

- [ ] **Step 1: Wrap the filter row on narrow viewports**

In `components/PeopleListClient.tsx`, find:

```tsx
      {/* Showing count and filters */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted">
          {tt.showing}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={groupFilter}
```

Change the outer `<div>` to wrap on narrow widths:

```tsx
      {/* Showing count and filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {tt.showing}
        </span>
        <div className="flex flex-wrap items-center gap-2">
```

(Two changes: `flex-wrap` and `gap-2` on the outer; `flex-wrap` on the inner.)

- [ ] **Step 2: Inspect the bulk-action header**

When items are selected, the bulk-action UI appears. Search the file for the conditional that renders bulk actions (typically gated on `selectedIds.length > 0` or similar). Verify it wraps on narrow viewports. If it uses `flex items-center justify-between` without `flex-wrap`, add `flex-wrap gap-2`.

- [ ] **Step 3: Apply remaining audit fixes**

Walk the remaining `[ ]` items under "people-list" in Audit Findings. Apply the suggested fixes.

- [ ] **Step 4: Visually verify at 320, 375, 430**

Visit `/people` at each width. Confirm: filter selects wrap to a second line cleanly, table itself scrolls horizontally inside its bounded card, no page-level horizontal scroll. Select a person; the bulk action header should fit or wrap.

- [ ] **Step 5: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/PeopleListClient.tsx
git commit -m "fix(mobile): people list filters and bulk header wrap on narrow viewports"
```

---

## Task 12: Phase 3 — Person detail (`/people/[id]`)

**Files:**
- Inspect: `app/people/[id]/page.tsx`
- Inspect: `components/PersonPhoto.tsx`, `components/UserRelationshipCard.tsx`, `components/RelationshipManager.tsx`, `components/JournalSection.tsx`

- [ ] **Step 1: Walk the page at 320, 375, 430**

Visit `/people/[any-id]` for a person with: a long name, a photo, multiple phones/emails/addresses, several relationships, several journal entries. Verify:
- Photo + name header doesn't crowd the actions menu (`PersonActionsMenu` trigger).
- Multi-value sections (phones, emails, addresses, URLs) stack cleanly. Each row should wrap if the value is a long URL or long email.
- Journal section, relationship cards, and the embedded graph each fit within the page width.
- Long URLs render with `break-words` or `truncate` — they should not push the layout.

- [ ] **Step 2: Apply audit findings + visual fixes**

For each remaining `[ ]` item under "person-detail" in Audit Findings, apply the suggested fix. Common fixes:
- Long URL not breaking: add `break-all` or `break-words` to the `<a>` element.
- Photo+actions row not wrapping: change the wrapper to `flex flex-wrap`.
- Embedded graph too wide: ensure its container is `w-full`.

- [ ] **Step 3: Re-verify**

Repeat the walk. Mark fixed items `[x]`.

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): person detail page layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 13: Phase 3 — Person new/edit forms

**Files:**
- Inspect: `app/people/new/page.tsx`, `app/people/[id]/edit/page.tsx`
- Inspect: `components/PersonForm.tsx` (and child form components in `components/person-form/`)
- Inspect: `components/GroupsSelector.tsx`, `components/ImportantDatesManager.tsx`, `components/fields/*`

- [ ] **Step 1: Walk both routes at 320, 375, 430**

Visit `/people/new` and `/people/[any-id]/edit`. Verify:
- All form inputs render text at 16px (the systemic fix from Task 2 should cover this).
- `GroupsSelector` chips wrap to multiple lines instead of overflowing.
- `ImportantDatesManager` rows fit; date inputs don't overflow.
- Phone/email/address managers (multi-value) don't overflow.
- The submit button is reachable without horizontal scroll.

- [ ] **Step 2: Apply audit findings + visual fixes**

Common fixes:
- Chip rows not wrapping: change `flex` to `flex flex-wrap gap-2`.
- Inline label+input rows that wrap badly on mobile: change to `flex-col sm:flex-row`.

- [ ] **Step 3: Re-verify**

Mark fixed items `[x]`.

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): person form layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 14: Phase 3 — Journal

**Files:**
- Inspect: `app/journal/page.tsx`, `app/journal/new/page.tsx`, `app/journal/[id]/page.tsx`, `app/journal/[id]/edit/page.tsx`
- Inspect: `components/MarkdownEditor.tsx`, `components/JournalFilters.tsx`, `components/JournalTimeline.tsx`, `components/JournalEntryForm.tsx`

The `MarkdownEditor` toolbar is a known mobile-friction suspect (icon row that may overflow).

- [ ] **Step 1: Walk all four routes at 320, 375, 430**

Visit `/journal`, `/journal/new`, `/journal/[any-id]`, `/journal/[any-id]/edit`. Verify:
- `MarkdownEditor` toolbar fits or wraps cleanly. If it overflows, add `flex-wrap` to its container or convert to a horizontally-scrollable strip with `overflow-x-auto max-w-full`.
- Filters in `JournalFilters` wrap cleanly.
- Timeline cards don't overflow.

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): journal pages layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 15: Phase 3 — Groups

**Files:**
- Inspect: `app/groups/page.tsx`, `app/groups/new/page.tsx`, `app/groups/[id]/page.tsx`, `app/groups/[id]/edit/page.tsx`
- Inspect: `components/GroupForm.tsx`, `components/GroupMembersManager.tsx`

Lighter than people pages. Spot-check.

- [ ] **Step 1: Walk all four routes at 320, 375, 430**

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): groups pages layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 16: Phase 3 — Relationship-types

**Files:**
- Inspect: `app/relationship-types/page.tsx`
- Inspect: `components/RelationshipTypeForm.tsx`

- [ ] **Step 1: Walk the route at 320, 375, 430**

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): relationship-types page layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 17: Phase 3 — Settings

**Files:**
- Inspect: `app/settings/layout.tsx`
- Inspect: `components/SettingsNav.tsx`
- Inspect: each settings sub-page form component (Profile, Appearance, Security, CardDAV, Account, About — Billing in SaaS mode)

`SettingsNav` already has a mobile dropdown variant (`md:hidden`) and a desktop sidebar (`hidden md:block`) — so the nav itself is mobile-aware. Sub-page forms are the area to walk.

- [ ] **Step 1: Walk each settings tab at 320, 375, 430**

Visit each: `/settings/profile`, `/settings/appearance`, `/settings/security`, `/settings/carddav`, `/settings/account`, `/settings/about`. (And `/settings/billing` if you're in SaaS mode locally.) Verify forms fit, inputs respect 16px (covered by Task 2), submit buttons reachable.

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): settings forms layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 18: Phase 3 — Auth pages

**Files:**
- Inspect: `app/login/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/verify-email/page.tsx`
- Inspect: shared components used in those pages

Mostly resolved by the Task 2 systemic input-size fix.

- [ ] **Step 1: Walk all five routes at 320, 375, 430**

For each: focus an input. Verify no zoom-on-focus (computed font-size ≥ 16px). Verify the submit button is reachable. Verify links wrap cleanly (long Spanish/German translations of "Forgot password?" can be wide).

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): auth pages layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 19: Phase 3 — CardDAV pages

**Files:**
- Inspect: `app/carddav/import/page.tsx`, `app/carddav/export/page.tsx`, `app/carddav/conflicts/page.tsx`
- Inspect: `components/ImportContactsList.tsx`, `components/BulkExportList.tsx`, `components/ConflictList.tsx`

The conflict list already had its `overflow-x-auto` wrapper bounded in Task 3. Import/export selectables remain to be verified.

- [ ] **Step 1: Walk the three routes at 320, 375, 430**

(Skip if you don't have a local CardDAV connection — note in the plan that this task was partially deferred.)

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): carddav pages layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 20: Phase 3 — Edge pages (Duplicates, Merge)

**Files:**
- Inspect: `app/people/duplicates/page.tsx`, `app/people/merge/page.tsx`
- Inspect: `components/DuplicatesList.tsx`, `components/PersonCompare.tsx`

Both use side-by-side comparison layouts that need to remain horizontally scrollable inside their cards. The `overflow-x-auto` wrappers are already bounded in Task 3.

- [ ] **Step 1: Walk both routes at 320, 375, 430**

(Skip if you have no duplicates — note in the plan.)

- [ ] **Step 2: Apply audit findings + visual fixes**

- [ ] **Step 3: Re-verify**

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add <files-changed>
git commit -m "fix(mobile): duplicates and merge pages layout for narrow viewports"
```

(Skip if no changes.)

---

## Task 21: Phase 4 — Real-device verification

**Files:**
- Modify: `docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md` (Audit Findings — final pass)

This task is owner-driven (the user, not the implementing agent). The agent's job here is to (a) deploy the branch to a place the user can hit on their phone, (b) gather feedback, (c) close out or queue follow-up fixes.

- [ ] **Step 1: Get the branch onto the user's phone**

If a Vercel/preview deployment auto-builds, share the preview URL. Otherwise: confirm the user's local machine is reachable from their phone (same Wi-Fi), start `npm run dev` with `-H 0.0.0.0` (or `next dev -H 0.0.0.0`), and share `http://<lan-ip>:3000`.

- [ ] **Step 2: Owner walks the priority pages on a real iPhone**

Owner visits at minimum:
- Dashboard
- People list
- Person detail (an existing person)
- Person new (the form)
- Journal
- Settings → Profile, Settings → CardDAV (if connected)

Owner notes anything that didn't surface in DevTools. Common real-device issues:
- Notch overlap on the top nav (safe-area).
- On-screen keyboard hiding the submit button.
- iOS URL-bar resize jitter.
- Safe-area corners on home-indicator-bottom phones.
- Touch gestures conflicting with content (e.g., swipe-back accidentally triggered).

- [ ] **Step 3: Record final findings in the Audit Findings section**

Add a new sub-header `### Phase 4 — Real device` and bullet each issue.

- [ ] **Step 4: Address remaining findings**

For each Phase 4 finding: either fix immediately (if small) or open a follow-up issue. Commit each fix with an explanatory message.

- [ ] **Step 5: Confirm done criteria are met**

Re-read the spec's Done Criteria section. Walk through each:
- No page-level horizontal scroll at 320/375/430. ✓
- All interactive elements ≥ 44×44 on mobile. ✓
- All form inputs ≥ 16px on mobile. ✓
- Modal panels respect `max-w-[calc(100vw-2rem)]` and bottom safe-area. ✓
- Audit punch list complete. ✓
- Phase 4 reports no remaining issues (or all are tracked as follow-ups). ✓

- [ ] **Step 6: Commit final notes**

```bash
git add docs/superpowers/plans/2026-05-04-mobile-quirks-bug-bash.md
git commit -m "docs(mobile): close Phase 4 real-device verification"
```

---

## Notes

- **No new tests.** Per the spec, this is layout/CSS work; the existing Playwright suite catches functional regressions. Each task uses visual verification in DevTools as its check.
- **Per-task commits.** Each fix is a separate commit so a single regression is easy to bisect/revert. The full work can land as one PR or as a series — the spec is agnostic.
- **Phase 3 task scope can be empty.** If the audit (Task 1) plus the systemic pass (Tasks 2–7) resolves all issues for a given page, the Phase 3 task for that page should be marked complete with no commits.
- **`overflow-x: clip` browser support.** Modern browsers (Safari 16+, Chrome 90+, Firefox 90+). Older browsers fall back to default `visible`, meaning the safety net doesn't apply but nothing breaks.
