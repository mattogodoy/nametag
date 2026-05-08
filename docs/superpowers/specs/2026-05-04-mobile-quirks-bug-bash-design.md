# Mobile Quirks Bug Bash — Design

**Date:** 2026-05-04
**Status:** Design — pending implementation plan
**Scope:** Tactical mobile fix sweep. Same UI as today, sized and bounded correctly for phones.

## Problem

The web app "sort of works" on mobile but feels noticeably worse than the desktop experience:

- Pages can be scrolled sideways and reveal blank space.
- Buttons and links sometimes sit off-screen or under the iOS notch.
- Tap targets, text, and spacing are tuned for desktop and feel cramped or undersized on a phone.
- Form inputs trigger iOS Safari focus-zoom, breaking apparent layout.

The goal is to bring the mobile experience to parity in feel and reliability — without redesigning patterns. Same components, same pages, same flows; just correctly responsive.

## Goal

A user opening Nametag on a phone (iPhone SE through iPhone Pro Max) should encounter:

- No page-level horizontal scroll on any user-facing page.
- All interactive elements with hit areas ≥44×44px.
- All form inputs at ≥16px so iOS Safari does not zoom on focus.
- Modal panels and the navigation bar respecting safe-area insets.
- Spacing and type that feel intentional on a phone, not a desktop UI shrunk down.

## Non-Goals

Calling these out so the work doesn't drift into a redesign:

- Replacing the People table with a card list, accordion, or any other mobile-specific layout.
- Redesigning the network graph for touch or hiding it on mobile.
- Adding a bottom-tab navigation, swipe gestures, or PWA install support.
- Any visual redesign — colors, typography, spacing tokens stay as-is except where minimum-size requirements force a tweak.
- Tablet-specific (mid-width) layouts.

## Approach

Three-phase: audit → systemic pass → per-page cleanup. The systemic pass is expected to resolve the bulk of issues by fixing root causes once instead of N times.

### Phase 1 — Audit

A single focused pass across every user-facing page, at three phone widths in Chrome DevTools' device toolbar:

- **320px** (iPhone 5 / older small Android) — smallest realistic width.
- **375px** (iPhone SE 2nd/3rd gen) — primary target.
- **430px** (iPhone 14/15 Pro Max) — larger phone width.

For each page, record any of:

- Page-level horizontal scroll or "blank space" when scrolling sideways.
- Interactive elements smaller than 44×44px.
- Form inputs/selects/textareas under 16px.
- Off-screen elements (controls clipped, modal close buttons under the notch).
- Cramped padding/typography that obviously degrades the experience.
- Modal/overlay sizing problems.

The audit produces a punch list grouped by page and category, recorded as a checklist in the implementation plan.

### Phase 2 — Systemic pass

A single PR that lands the global fixes. Each is small; the value is consistency across the app.

1. **Page-level horizontal-scroll guard.** Add `html { overflow-x: clip }` to `app/globals.css`. Use `clip` not `hidden` — `clip` does not establish a containing block for fixed/sticky descendants. Safety net for stray bleeds; root causes still get fixed individually.

2. **iOS focus-zoom fix.** Under `@media (max-width: 640px)`, set `input, select, textarea { font-size: 16px }` so Mobile Safari does not zoom on focus.

3. **Form-control text size at component level.** Where Tailwind `text-sm` is used on form controls, switch to `text-base sm:text-sm` so phones get 16px and desktop keeps the compact size. Belt-and-suspenders with #2; preferred where we control the markup.

4. **Touch-target minimums for icon-only controls.** Sweep icon-only buttons and links and ensure they hit `min-h-11 min-w-11` (44px) with content centered, on mobile. Confirmed targets:
   - `components/Navigation.tsx` — hamburger button (currently `p-3`, ~48px — likely already OK; verify), modal close button.
   - `components/PeopleListClient.tsx` — table sort-arrow links and per-row action triggers.
   - All modal close buttons in the modal sweep below.
   - Action menus (`PersonActionsMenu`, etc.) — verify trigger size.

   For text+icon buttons, existing padding usually clears 44px — leave alone.

5. **Bound `overflow-x-auto` wrappers.** Audit every `overflow-x-auto` container and confirm the wrapper has `max-w-full` and an explicit constrained parent so the scroll context is the wrapper, not the page. Known sites:
   - `components/PeopleListClient.tsx` (people table — primary suspect for the "blank space" symptom)
   - `components/ConflictList.tsx`
   - `components/PersonCompare.tsx` (×2 occurrences)
   - `components/PersonVCardRawView.tsx`
   - `components/billing/PaymentHistoryTable.tsx`

6. **Safe-area insets.** Add `env(safe-area-inset-*)` padding to:
   - `components/Navigation.tsx` — top nav (top inset).
   - The mobile menu drawer (right inset, top inset for the close button area).
   - Modal panels (bottom inset).

7. **Modal base.** Sweep existing modals and verify each panel uses `max-w-[calc(100vw-2rem)]`, content area is `overflow-y-auto`, bottom respects safe-area:
   - `components/BulkDeleteModal.tsx`
   - `components/BulkGroupAssignModal.tsx`
   - `components/BulkRelationshipModal.tsx`
   - `components/GraphFilterHelpModal.tsx`
   - `components/PhotoCropModal.tsx`
   - `components/PhotoSourceModal.tsx`

After Phase 2, re-audit at 375px to confirm category-level fixes worked and update the punch list.

### Phase 3 — Per-page cleanup

Walk what remains in priority order. Each page likely has 0–2 issues left after the systemic pass; PRs are small.

1. **Dashboard (`/dashboard`)** — verify `UnifiedNetworkGraph` canvas sizes to viewport width without overflow; upcoming-event rows wrap rather than truncate badly; greeting does not push the header.
2. **People list (`/people`)** — filter selects (group + relationship) wrap to their own row instead of overflowing; bulk-action header (when items selected) fits or wraps cleanly. Table itself stays a horizontally-scrollable table inside its bounded wrapper.
3. **Person detail (`/people/[id]`)** — photo/name header doesn't crowd actions menu; multi-value sections (phones, emails, addresses, URLs) stack cleanly; long URLs and long names don't push horizontal width; embedded graph fits.
4. **Person new/edit forms (`/people/new`, `/people/[id]/edit`)** — `GroupsSelector` chips wrap; `ImportantDatesManager` rows fit; photo cropper modal usable; autocompletes don't overflow.
5. **Journal (`/journal`, `/journal/[id]`, `/journal/new`)** — `MarkdownEditor` toolbar fits or wraps; filters/timeline don't overflow.
6. **Groups (`/groups`, `/groups/[id]`, `/groups/new`, `/groups/[id]/edit`)** — list + `GroupMembersManager` spot-check.
7. **Relationship-types (`/relationship-types`)** — light page; spot check.
8. **Settings (`/settings/*`)** — `SettingsNav` tab bar on mobile (does it overflow? scroll horizontally? wrap?); then sweep each tab's form.
9. **Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`)** — small forms; mostly resolved by systemic input-size fix.
10. **CardDAV (`/carddav/import`, `/carddav/export`, `/carddav/conflicts`)** — `ConflictList` already covered by overflow wrapper fix; verify import/export selectables.
11. **Edge pages (`/people/duplicates`, `/people/merge`)** — `DuplicatesList` and `PersonCompare` use side-by-side layouts that need to remain horizontally scrollable inside their card. Lowest priority.

### Phase 4 — Real-device verification

Owner (the user, not Claude) loads the app on a real iPhone and walks at minimum:

- Dashboard
- People list
- Person detail (an existing person)
- Person new (the form)
- Journal
- Settings → Profile, Settings → CardDAV (if connected)

Notes anything that didn't surface in DevTools — typically: notch overlap, on-screen keyboard hiding the submit button, iOS URL-bar resize jitter, safe-area on the home indicator. Any issues become a final punch list.

## Done Criteria

- At 320, 375, and 430px viewports, no user-facing page produces a horizontal page scroll. Local `overflow-x-auto` containers may still scroll within their card.
- Every interactive element has a hit area of at least 44×44px on mobile.
- Every form input renders text at ≥16px on mobile.
- Every modal panel respects `max-w-[calc(100vw-2rem)]` and bottom safe-area.
- The audit punch list (Phase 1) has every item checked off.
- The real-device verification pass (Phase 4) reports no remaining issues.

## Verification

- **Per-PR:** visual verification at 320/375/430 in DevTools before requesting review.
- **After Phase 2:** re-run the audit at 375; confirm category fixes resolved their predicted issues; update punch list.
- **After Phase 3:** Phase 4 real-device walk by the owner.
- **No new e2e tests required.** This is layout/CSS work; the existing Playwright suite catches functional regressions.

## Risks

- **`overflow-x: clip` browser support.** Well-supported in modern browsers (Safari 16+, Chrome 90+, Firefox 90+). Older Safari falls back to default behavior — acceptable for a personal-use app, but note for the implementation plan.
- **Touch-target minimums on desktop.** Applied carelessly, `min-h-11 min-w-11` would grow desktop icon buttons. Apply only on mobile (`<sm`) or at the component level where we know the control is icon-only.
- **Input font-size shifts.** Bumping mobile inputs to 16px may cause small visual shifts in tightly-packed forms. Visually verify each form during Phase 3.
- **Global overflow guard hides regressions.** It's a safety net, not a fix — Phase 1's audit is the source of truth for actual root causes.

## Out of Scope (recap)

- People table → card layout.
- Network-graph mobile redesign.
- Bottom-tab navigation, swipe gestures, PWA install.
- Visual redesign (colors, typography, spacing tokens beyond minimum-size adjustments).
- Tablet-specific (mid-width) layouts.
