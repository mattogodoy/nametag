# Relationship Direction Clarity

## Problem

Users cannot tell which direction a relationship goes. The display format `Name - Type` is ambiguous: "John - Parent" could mean "John is this person's parent" or "John has a parent (this person)." This confusion appears in:

- The relationship list on person details pages (GitHub issue #89)
- The relationship creation form (GitHub issue #13)
- Graph edge labels and arrows

## Convention

All relationship displays follow one universal rule:

> **[Source Person] is [Target Person]'s [Relationship Type]**

This maps directly to the existing data model where `personId` (source) has `relationshipType` toward `relatedPersonId` (target). No schema changes needed.

## Changes

### 1. Relationship List (Person Details Page)

**Current**: `John Doe - Parent` (ambiguous)

**New**: `John Doe is Alice's Parent` (sentence format)

- `RelationshipManager.tsx` replaces `Name - Badge` with a sentence
- The component already receives `personName` (the person being viewed)
- The colored relationship type badge stays, embedded in the sentence
- i18n: Sentence templates in all 5 locale files

### 2. Graph Edge Tooltip

**Current**: Hovering a node highlights edges with short labels. No edge-level tooltip.

**New**: Hovering an edge shows a tooltip with the full sentence.

- `UnifiedNetworkGraph.tsx` adds edge hover detection
- Tooltip displays: `"John is Alice's Parent"`
- Edge labels on the graph remain short (just the type name)
- Graph arrow direction unchanged (already correct)

### 3. Relationship Creation/Edit Form

**Current**: Two dropdowns (Person, Type) with no direction context.

**New**: Same dropdowns, plus a dynamic sentence preview.

- Preview updates in real-time as user selects person and type
- Shows: `"John is Alice's Parent"`
- Partial previews when only one field is filled: `"[Select person] is Alice's Parent"`
- Distinct visual style (highlighted box) to separate from form fields

### 4. New Person Form (User Relationship)

When creating a new person with a relationship to the logged-in user, the preview reads:

- `"[New Person] is your Parent"` (uses "your" since it's the user's direct relationship)

## i18n

All 5 supported languages need sentence templates:

| Language | Sentence Pattern |
|----------|-----------------|
| English (en) | `{name} is {personName}'s {type}` |
| Spanish (es-ES) | `{name} es {type} de {personName}` |
| German (de-DE) | `{name} ist {personName}s {type}` |
| Japanese (ja-JP) | `{name}は{personName}の{type}です` |
| Norwegian (nb-NO) | `{name} er {personName}s {type}` |

Each locale needs templates for:
1. Relationship list sentence
2. Graph tooltip sentence
3. Form preview with person name
4. Form preview with "your" (user relationship)

## Out of Scope

- Database schema changes (already correct)
- Relationship type definitions (already support inverses)
- Graph arrow direction changes
- API route changes

## Bug Investigation

During implementation, investigate and fix: graph sometimes showing wrong direction for parent/child on person details page while the Relationships section shows it correctly. The new tooltips will make any issues immediately visible.

## References

- [GitHub Issue #13](https://github.com/mattogodoy/nametag/issues/13) - Relationship direction clarity in forms
- [GitHub Issue #89](https://github.com/mattogodoy/nametag/issues/89) - How to read relationship direction
