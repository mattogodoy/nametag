# Relationship Direction Clarity - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make relationship direction unambiguous across the entire app by using sentence-based labels ("John is Alice's Parent") instead of the current ambiguous format ("John - Parent").

**Architecture:** Pure presentation-layer changes. The data model (directed edges with inverse types) is already correct. We add i18n sentence templates and update three UI surfaces: relationship list, graph tooltips, and relationship forms. No schema or API changes.

**Tech Stack:** React (Next.js), next-intl for i18n, D3.js for graph, Tailwind CSS for styling.

**Design doc:** `docs/plans/2026-03-01-relationship-direction-clarity-design.md`

---

### Task 1: Add i18n Sentence Templates to All Locale Files

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/es-ES.json`
- Modify: `locales/de-DE.json`
- Modify: `locales/ja-JP.json`
- Modify: `locales/nb-NO.json`

**Step 1: Add translation keys to English locale**

In `locales/en.json`, inside the `"people"` object (near the existing `"addRelationship"` key around line 672), add these new keys:

```json
"isRelationshipOf": "{name} is {personName}'s {type}",
"isYourRelationship": "{name} is your {type}",
"formPreview": "{name} is {personName}'s {type}",
"formPreviewYour": "{name} is your {type}",
"formPreviewSelectPerson": "Select a person",
"formPreviewSelectType": "Select a type"
```

**Step 2: Add translation keys to Spanish locale**

In `locales/es-ES.json`, add the equivalent keys:

```json
"isRelationshipOf": "{name} es {type} de {personName}",
"isYourRelationship": "{name} es tu {type}",
"formPreview": "{name} es {type} de {personName}",
"formPreviewYour": "{name} es tu {type}",
"formPreviewSelectPerson": "Selecciona una persona",
"formPreviewSelectType": "Selecciona un tipo"
```

**Step 3: Add translation keys to German locale**

In `locales/de-DE.json`:

```json
"isRelationshipOf": "{name} ist {personName}s {type}",
"isYourRelationship": "{name} ist dein(e) {type}",
"formPreview": "{name} ist {personName}s {type}",
"formPreviewYour": "{name} ist dein(e) {type}",
"formPreviewSelectPerson": "Person auswahlen",
"formPreviewSelectType": "Typ auswahlen"
```

**Step 4: Add translation keys to Japanese locale**

In `locales/ja-JP.json`:

```json
"isRelationshipOf": "{name}は{personName}の{type}です",
"isYourRelationship": "{name}はあなたの{type}です",
"formPreview": "{name}は{personName}の{type}です",
"formPreviewYour": "{name}はあなたの{type}です",
"formPreviewSelectPerson": "人物を選択",
"formPreviewSelectType": "タイプを選択"
```

**Step 5: Add translation keys to Norwegian locale**

In `locales/nb-NO.json`:

```json
"isRelationshipOf": "{name} er {personName}s {type}",
"isYourRelationship": "{name} er din {type}",
"formPreview": "{name} er {personName}s {type}",
"formPreviewYour": "{name} er din {type}",
"formPreviewSelectPerson": "Velg en person",
"formPreviewSelectType": "Velg en type"
```

**Step 6: Build the project to verify no JSON syntax errors**

Run: `npm run build`
Expected: Build succeeds without locale parsing errors.

**Step 7: Commit**

```bash
git add locales/
git commit -m "feat(i18n): add relationship direction sentence templates for all locales"
```

---

### Task 2: Update Relationship List Display in RelationshipManager

**Files:**
- Modify: `components/RelationshipManager.tsx` (lines 270-294)

**Context:** The relationship list currently renders `Name - Type` format. The component receives `personName` as a prop (line 38). Relationships come from `relationshipsTo` — people who point TO the current person. So `rel.person` is the source person, and the person being viewed is the target.

The reading is: `rel.person` (source) is `personName`'s (target) `rel.relationshipType.label` (type).

**Step 1: Write a test for the sentence format rendering**

Create test file `tests/components/RelationshipManager.test.tsx`. Test that the component renders the sentence format:

```tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import RelationshipManager from '@/components/RelationshipManager';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const messages = {
  people: {
    isRelationshipOf: '{name} is {personName}\'s {type}',
    addRelationship: 'Add Relationship',
    noRelationshipsYet: 'No relationships yet.',
    relationshipType: 'Relationship Type',
    person: 'Person',
    searchForPerson: 'Search',
    notes: 'Notes',
    optionalNotes: 'Optional notes',
    adding: 'Adding...',
    edit: 'Edit',
    delete: 'Delete',
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    confirmDelete: 'Confirm Delete',
  },
};

describe('RelationshipManager sentence format', () => {
  it('renders relationship as sentence with person names', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RelationshipManager
          personId="alice-id"
          personName="Alice"
          relationships={[
            {
              id: 'rel-1',
              personId: 'john-id',
              relationshipTypeId: 'parent-type',
              notes: null,
              person: { id: 'john-id', name: 'John', surname: 'Doe', nickname: null },
              relationshipType: { id: 'parent-type', name: 'PARENT', label: 'Parent', color: '#F59E0B', inverseId: 'child-type' },
            },
          ]}
          availablePeople={[]}
          relationshipTypes={[]}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText(/John Doe is Alice's Parent/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx jest tests/components/RelationshipManager.test.tsx --no-coverage`
Expected: FAIL - the sentence text is not rendered (current format is `Name - Type`).

**Step 3: Update the relationship list rendering**

In `components/RelationshipManager.tsx`, replace the current list item content (lines 276-294) that shows `Name • Badge`:

Replace this block:
```tsx
<div className="flex items-center gap-2 flex-wrap">
  <Link
    href={`/people/${rel.personId}`}
    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
  >
    {formatFullName(rel.person)}
  </Link>
  <span className="text-muted">•</span>
  <span
    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
    style={{
      backgroundColor: rel.relationshipType?.color
        ? `${rel.relationshipType.color}20`
        : '#E5E7EB',
      color: rel.relationshipType?.color || '#374151',
    }}
  >
    {rel.relationshipType?.label || 'Unknown'}
  </span>
</div>
```

With:
```tsx
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-foreground">
    <Link
      href={`/people/${rel.personId}`}
      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
    >
      {formatFullName(rel.person)}
    </Link>
    {' '}
    {t('isRelationshipOf', {
      name: '',
      personName: personName,
      type: '',
    }).split('{name}')[0] ? null : null}
  </span>
</div>
```

Actually, since next-intl supports rich text interpolation but the sentence structure varies by language, the cleanest approach is to use the translation string directly and render it as a single text span. Use the `t.rich()` function to embed the link inside the sentence:

```tsx
<div className="flex items-center gap-1 flex-wrap text-foreground">
  {t.rich('isRelationshipOf', {
    name: (chunks) => (
      <Link
        href={`/people/${rel.personId}`}
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        {formatFullName(rel.person)}
      </Link>
    ),
    personName: personName,
    type: (chunks) => (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{
          backgroundColor: rel.relationshipType?.color
            ? `${rel.relationshipType.color}20`
            : '#E5E7EB',
          color: rel.relationshipType?.color || '#374151',
        }}
      >
        {rel.relationshipType?.label || 'Unknown'}
      </span>
    ),
  })}
</div>
```

**Important:** For `t.rich()` to work, the i18n keys need to use `<name>` and `<type>` tags instead of `{name}` and `{type}` for the rich parts. Update the locale keys accordingly:

```json
"isRelationshipOf": "<name>{nameText}</name> is {personName}'s <type>{typeText}</type>"
```

Wait — actually `next-intl`'s `t.rich()` works with tag-based interpolation. But it may be simpler to avoid `t.rich()` complexity and instead build the sentence programmatically using a simpler approach:

**Revised approach - use the translation for the connecting words only, not the full sentence:**

Add a simpler translation key:
```json
"relationshipSentence_prefix": "is",
"relationshipSentence_suffix": "'s"
```

No — this breaks for non-English languages where word order differs entirely.

**Final approach: Use `t()` with plain interpolation and render as a single string, then add the link and badge separately but in sentence order.**

The cleanest solution: update the locale strings to use `<name>` and `<type>` XML tags for `t.rich()`:

In all locale files, change the key format:
- EN: `"isRelationshipOf": "<name></name> is {personName}'s <type></type>"`
- ES: `"isRelationshipOf": "<name></name> es <type></type> de {personName}"`

Then in the component:
```tsx
{t.rich('isRelationshipOf', {
  name: () => (
    <Link href={`/people/${rel.personId}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
      {formatFullName(rel.person)}
    </Link>
  ),
  personName: personName,
  type: () => (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{
      backgroundColor: rel.relationshipType?.color ? `${rel.relationshipType.color}20` : '#E5E7EB',
      color: rel.relationshipType?.color || '#374151',
    }}>
      {rel.relationshipType?.label || 'Unknown'}
    </span>
  ),
})}
```

**Step 4: Update locale files to use rich text tags**

In all 5 locale files, update the `isRelationshipOf` key:

- EN: `"isRelationshipOf": "<name></name> is {personName}'s <type></type>"`
- ES: `"isRelationshipOf": "<name></name> es <type></type> de {personName}"`
- DE: `"isRelationshipOf": "<name></name> ist {personName}s <type></type>"`
- JA: `"isRelationshipOf": "<name></name>は{personName}の<type></type>です"`
- NO: `"isRelationshipOf": "<name></name> er {personName}s <type></type>"`

**Step 5: Run the test**

Run: `npx jest tests/components/RelationshipManager.test.tsx --no-coverage`
Expected: PASS

**Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add components/RelationshipManager.tsx locales/ tests/components/
git commit -m "feat: show relationships as sentences in person details page

Addresses GitHub #89 - relationship list now shows 'John is Alice's Parent'
instead of ambiguous 'John - Parent' format."
```

---

### Task 3: Add Dynamic Preview Sentence to Relationship Creation Form

**Files:**
- Modify: `components/RelationshipManager.tsx` (lines 334-404, the add modal)

**Context:** The add relationship modal has two dropdowns: Relationship Type (line 344) and Person (line 363). We need to add a preview sentence below the form fields that updates as the user fills in the form. The form creates a relationship FROM the selected person TO the current person, so the sentence reads: "[Selected Person] is [Current Person]'s [Selected Type]".

**Step 1: Write a test for the form preview sentence**

In `tests/components/RelationshipManager.test.tsx`, add:

```tsx
describe('RelationshipManager form preview', () => {
  it('shows dynamic preview sentence when form fields are filled', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RelationshipManager
          personId="alice-id"
          personName="Alice"
          relationships={[]}
          availablePeople={[
            { id: 'john-id', name: 'John', surname: 'Doe', nickname: null },
          ]}
          relationshipTypes={[
            { id: 'parent-type', name: 'PARENT', label: 'Parent', color: '#F59E0B', inverseId: 'child-type' },
          ]}
        />
      </NextIntlClientProvider>
    );

    // Open the add modal
    fireEvent.click(screen.getByText('Add Relationship'));

    // After selecting person and type, preview should appear
    // (exact interaction depends on PersonAutocomplete component)
    // The preview text should be visible in the form
    expect(screen.getByText(/is Alice's/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/components/RelationshipManager.test.tsx --no-coverage`
Expected: FAIL

**Step 3: Add the preview sentence to the add modal**

In the add modal form (around line 388, just before the button row), add a preview sentence component. The preview needs to:

1. Look up the selected person name from `formData.relatedPersonId` in the `availablePeople` (or `currentUser`) list
2. Look up the selected type label from `formData.relationshipTypeId` in the `relationshipTypes` list
3. Render the sentence using `t('formPreview', { name, personName, type })`

Add this JSX before the button row (before line 389):

```tsx
{/* Dynamic preview sentence */}
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
  {(() => {
    const selectedPerson = formData.relatedPersonId
      ? (currentUser && formData.relatedPersonId === currentUser.id
          ? formatFullName(currentUser)
          : availablePeople.find(p => p.id === formData.relatedPersonId)
            ? formatFullName(availablePeople.find(p => p.id === formData.relatedPersonId)!)
            : t('formPreviewSelectPerson'))
      : t('formPreviewSelectPerson');
    const selectedType = formData.relationshipTypeId
      ? relationshipTypes.find(rt => rt.id === formData.relationshipTypeId)?.label || t('formPreviewSelectType')
      : t('formPreviewSelectType');

    if (currentUser && formData.relatedPersonId === currentUser.id) {
      return t('formPreviewYour', {
        name: selectedPerson,
        type: selectedType,
      });
    }
    return t('formPreview', {
      name: selectedPerson,
      personName: personName,
      type: selectedType,
    });
  })()}
</div>
```

Also update the locale keys for `formPreview` and `formPreviewYour` to use plain interpolation (no rich text tags needed here since this is plain text, no links):

- EN: `"formPreview": "{name} is {personName}'s {type}"`
- ES: `"formPreview": "{name} es {type} de {personName}"`
- etc. (as defined in Task 1)

**Step 4: Run the test**

Run: `npx jest tests/components/RelationshipManager.test.tsx --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add components/RelationshipManager.tsx tests/components/
git commit -m "feat: add dynamic preview sentence to relationship creation form

Addresses GitHub #13 - form now shows a live preview like
'John is Alice's Parent' as the user fills in the dropdowns."
```

---

### Task 4: Add Dynamic Preview Sentence to PersonForm (New Person Creation)

**Files:**
- Modify: `components/PersonForm.tsx` (lines 589-632 for user relationship, lines 635-682 for known-through relationship)

**Context:** PersonForm has two relationship sections:
1. "Relationship to You" (line 589-632): When `knownThroughId === 'user'`, shows a dropdown for the relationship type to the logged-in user.
2. "Relationship to [Name]" (line 635-682): When connected through another person, shows the relationship type to that person.

Both need a preview sentence below the dropdown.

**Step 1: Write tests for PersonForm preview sentences**

Create `tests/components/PersonForm-relationship-preview.test.tsx` testing that:
- When creating a person with direct relationship to user, preview shows "{name} is your {type}"
- When creating a person connected through another person, preview shows "{name} is {knownThrough}'s {type}"

**Step 2: Run test to verify it fails**

Run: `npx jest tests/components/PersonForm-relationship-preview.test.tsx --no-coverage`
Expected: FAIL

**Step 3: Add preview sentence to "Relationship to You" section**

After the `<select>` element (line 631), before the closing `</div>` (line 632), add:

```tsx
{formData.relationshipToUserId && (
  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
    {t('formPreviewYour', {
      name: formData.name || t('formPreviewSelectPerson'),
      type: relationshipTypes.find(rt => rt.id === formData.relationshipToUserId)?.label || t('formPreviewSelectType'),
    })}
  </p>
)}
```

**Step 4: Add preview sentence to "Relationship to [Known Person]" section**

After the existing help text (line 678-680), add:

```tsx
{formData.relationshipToUserId && (
  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
    {t('formPreview', {
      name: formData.name || t('formPreviewSelectPerson'),
      personName: knownThroughName,
      type: relationshipTypes.find(rt => rt.id === formData.relationshipToUserId)?.label || t('formPreviewSelectType'),
    })}
  </p>
)}
```

**Step 5: Run the test**

Run: `npx jest tests/components/PersonForm-relationship-preview.test.tsx --no-coverage`
Expected: PASS

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add components/PersonForm.tsx tests/components/
git commit -m "feat: add relationship preview to person creation form

Shows live sentence preview when selecting relationship type
during new person creation."
```

---

### Task 5: Add Edge Hover Tooltip to Graph

**Files:**
- Modify: `components/UnifiedNetworkGraph.tsx` (lines 229-270 for edge rendering, lines 301-337 for hover behavior)
- Modify: `lib/graph-utils.ts` (add source/target label fields to GraphEdge)

**Context:** The graph currently shows edge labels on node hover (lines 259-270 create text elements, lines 316-322 toggle their visibility). We need to enhance this so that hovering over an edge (or when edge labels appear during node hover) shows the full sentence tooltip like "John is Alice's Parent".

The current `GraphEdge` interface (line 17-22 of UnifiedNetworkGraph.tsx) has `source`, `target`, `type`, `color`. We need to add `sourceLabel` and `targetLabel` fields so the tooltip can construct the sentence.

**Step 1: Extend the GraphEdge interface**

In `lib/graph-utils.ts`, add `sourceLabel` and `targetLabel` to the `GraphEdge` interface:

```typescript
export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  color: string;
  sourceLabel?: string;
  targetLabel?: string;
}
```

**Step 2: Update graph edge creation functions to include labels**

In `lib/graph-utils.ts`, update `relationshipToGraphEdge` (line 80) and `inverseRelationshipToGraphEdge` (line 108) to include the person labels. This requires the functions to receive person name data.

Since the functions currently receive a `Relationship` type that doesn't include person names, we need to update the graph API endpoints to include names in the edge data. Alternatively, pass the node labels map to the graph component and look up names there.

**Simpler approach:** Update `relationshipToGraphEdge` and `inverseRelationshipToGraphEdge` to accept broader types that include person data, then populate `sourceLabel` and `targetLabel`.

The person graph endpoint (`app/api/people/[id]/graph/route.ts`) and dashboard graph endpoint (`app/api/dashboard/graph/route.ts`) already have access to person data when building edges. Update these endpoints to set `sourceLabel` and `targetLabel` on each edge.

In the person graph endpoint (around line 155-168), after creating edges via `relationshipToGraphEdge` and `inverseRelationshipToGraphEdge`, enrich each edge with labels from the node map:

```typescript
// After building all edges, enrich with labels
const nodeLabels = new Map<string, string>();
nodes.forEach(n => nodeLabels.set(n.id, n.label));

const enrichedEdges = [...dedupedEdges.values()].map(e => ({
  ...e,
  sourceLabel: nodeLabels.get(typeof e.source === 'string' ? e.source : e.source) || '',
  targetLabel: nodeLabels.get(typeof e.target === 'string' ? e.target : e.target) || '',
}));
```

Do the same in the dashboard graph endpoint.

**Step 3: Update the GraphEdge interface in UnifiedNetworkGraph.tsx**

Add `sourceLabel` and `targetLabel` to the interface at line 17:

```typescript
interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  color: string;
  sourceLabel?: string;
  targetLabel?: string;
}
```

**Step 4: Update edge label text to show sentence on hover**

In `UnifiedNetworkGraph.tsx`, update the edge label text (line 270) to show the full sentence when data is available:

```typescript
.text((d) => {
  if (d.sourceLabel && d.targetLabel) {
    // Full sentence: "John is Alice's Parent"
    return `${d.sourceLabel} → ${d.targetLabel}: ${d.type.toLowerCase()}`;
  }
  return d.type.toLowerCase();
});
```

Actually, since we want the tooltip to read as a proper sentence, use the "is [target]'s [type]" pattern. But since the graph component doesn't have access to `next-intl` translations in D3 code, we should keep it simple with a format like:

```
"Source → Type → Target"
```

Or better, pass a pre-formatted tooltip string from the API:

**Revised approach:** Add a `tooltip` field to `GraphEdge` and populate it in the API endpoints where we have access to names:

```typescript
// In graph API endpoint, after building edges
const enrichedEdges = [...dedupedEdges.values()].map(e => {
  const sourceName = nodeLabels.get(e.source) || '';
  const targetName = nodeLabels.get(e.target) || '';
  return {
    ...e,
    sourceLabel: sourceName,
    targetLabel: targetName,
  };
});
```

In the graph component, display `"${sourceLabel} is ${targetLabel}'s ${type}"`. For i18n in the graph component, since it's a client component, use `useTranslations`:

```typescript
const t = useTranslations('people');
// ...
.text((d) => {
  const sourceName = d.sourceLabel || getNodeLabel(d.source);
  const targetName = d.targetLabel || getNodeLabel(d.target);
  // Since D3 text callbacks don't have React context, pre-compute tooltip strings
});
```

**Best approach: Pre-compute tooltip text in React, pass to D3.**

Before the D3 rendering, create a tooltip map:

```typescript
const edgeTooltips = new Map<string, string>();
edges.forEach(e => {
  const src = typeof e.source === 'string' ? e.source : e.source;
  const tgt = typeof e.target === 'string' ? e.target : e.target;
  const srcLabel = e.sourceLabel || nodes.find(n => n.id === src)?.label || '';
  const tgtLabel = e.targetLabel || nodes.find(n => n.id === tgt)?.label || '';
  edgeTooltips.set(`${src}-${tgt}`, t('isRelationshipOf', {
    name: srcLabel,
    personName: tgtLabel,
    type: e.type,
  }));
});
```

Then in the D3 edge label:
```typescript
.text((d) => {
  const key = `${getNodeId(d.source)}-${getNodeId(d.target)}`;
  return edgeTooltips.get(key) || d.type.toLowerCase();
});
```

**Step 5: Write a test for graph edge tooltips**

In `tests/api/dashboard-graph.test.ts`, add a test verifying that edge data includes `sourceLabel` and `targetLabel` fields.

**Step 6: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add lib/graph-utils.ts components/UnifiedNetworkGraph.tsx app/api/people/[id]/graph/route.ts app/api/dashboard/graph/route.ts tests/
git commit -m "feat: add sentence tooltips to graph edge labels

Hovering a node now shows edge labels as full sentences like
'John is Alice's Parent' instead of just 'parent'."
```

---

### Task 6: Investigate and Fix Graph Direction Bug

**Files:**
- Modify: `app/api/people/[id]/graph/route.ts` (if bug found)
- Modify: `app/api/dashboard/graph/route.ts` (if bug found)
- Modify: `lib/graph-utils.ts` (if bug found)

**Context:** The user reported that sometimes the person details graph shows the wrong direction for parent/child: "[parent person] -> child -> [child person]" when it should be "[parent person] -> parent -> [child person]". The Relationships section shows it correctly. With the new tooltip sentences, any direction bugs will be immediately visible.

**Step 1: Set up test data**

Start the dev server and create test data:
- Create person Alice
- Create person John
- Add relationship: John is Alice's Parent

**Step 2: Verify the Relationships section**

Navigate to Alice's person details page. The Relationships section should show: "John is Alice's Parent". Verify this is correct.

**Step 3: Verify the graph**

On the same page, hover over edges in the graph. Check that:
- The edge from John to Alice shows: "John is Alice's Parent" (tooltip)
- The edge from Alice to John shows: "Alice is John's Child" (tooltip)
- No edge shows the incorrect direction like "John → Child → Alice"

**Step 4: If bug is found, trace the data flow**

Check the API response at `/api/people/[alice-id]/graph`:
- Verify `edges` array has correct `source`, `target`, `type` combinations
- Check if deduplication (`dedupedEdges.set(...)`) is overwriting correct edges

**Step 5: Fix any issues found**

Common potential issues:
1. Deduplication map key collision overwriting a correct edge
2. Related person's `relationshipsFrom` producing duplicate edges with different types
3. Missing inverse relationship type causing fallback to incorrect label

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 7: Commit (if changes were made)**

```bash
git add -A
git commit -m "fix: correct graph edge direction for asymmetric relationships

Fixes the bug where parent/child edges showed the wrong direction label
in the person details graph."
```

---

### Task 7: Manual End-to-End Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Verify relationship list sentence format**

- Navigate to a person's details page with relationships
- Confirm each relationship shows as a sentence: "John is Alice's Parent"
- Verify the colored badge is embedded in the sentence
- Verify the person name is a clickable link

**Step 3: Verify graph tooltips**

- On the person details page, hover over nodes in the graph
- Verify edge labels appear as full sentences
- Check both asymmetric (Parent/Child) and symmetric (Friend/Sibling) relationships
- Navigate to the dashboard and repeat

**Step 4: Verify form preview**

- On a person's page, click "Add Relationship"
- Select a relationship type and person
- Verify the preview sentence appears and updates dynamically
- Test with the "You" user as the selected person (special case)

**Step 5: Verify person creation preview**

- Navigate to create a new person
- Select "Known through: You" and pick a relationship type
- Verify the preview sentence appears
- Test "Known through: [Other Person]" flow

**Step 6: Verify i18n**

- Switch language to Spanish (es-ES) in settings
- Repeat steps 2-5 and verify sentence structure follows Spanish grammar
- Spot-check German, Japanese, and Norwegian if possible

**Step 7: Run full test suite one final time**

Run: `npm test`
Expected: All tests pass.

**Step 8: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: cleanup after relationship direction clarity verification"
```
