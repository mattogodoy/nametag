# Bulk Actions for People List

## Overview

Add multi-select and bulk actions to the people list: delete, add to groups, and set relationship to user.

## Decisions

- **Selection UI**: Checkbox per row, always visible. Select-all checkbox in header.
- **Select all across pages**: Gmail-style banner ("Select all N people") after checking header checkbox.
- **Action bar**: Floating sticky bar at bottom of viewport, visible when items are selected.
- **Group assignment**: Additive only (union). No removal via bulk action.
- **Relationship assignment**: Overwrites existing relationship-to-user for all selected people.
- **Architecture**: Client wrapper component around server-rendered list. Bulk actions via modals + new API endpoints.

## Component Architecture

The people list page (`app/people/page.tsx`) stays as a server component. It renders a new `PeopleListClient` client component, passing people array, groups, relationship types, pagination info, and total count.

### PeopleListClient

Manages:
- **Selection state**: `Set<string>` of selected person IDs + `selectAll: boolean` for cross-page selection.
- **Floating action bar**: Visible when `selectedIds.size > 0`. Shows count + action buttons.
- **"Select all N people" banner**: Appears after checking header checkbox.

When "select all across pages" is active, the component sets a flag rather than fetching all IDs upfront. IDs are resolved server-side when an action is triggered (API accepts `personIds: string[]` or `selectAll: true`).

### Modal Components

- `BulkDeleteModal` — orphan detection + CardDAV confirmation
- `BulkGroupAssignModal` — reuses `GroupsSelector`
- `BulkRelationshipModal` — relationship type dropdown

## API Design

### POST /api/people/bulk

Single endpoint with `action` field to dispatch.

#### Bulk Delete

```json
{
  "action": "delete",
  "personIds": ["id1", "id2"],
  "selectAll": false,
  "deleteOrphans": true,
  "orphanIds": ["id3", "id4"],
  "deleteFromCardDav": false
}
```

#### Bulk Add to Groups

```json
{
  "action": "addToGroups",
  "personIds": ["id1", "id2"],
  "selectAll": false,
  "groupIds": ["group1", "group2"]
}
```

#### Bulk Set Relationship

```json
{
  "action": "setRelationship",
  "personIds": ["id1", "id2"],
  "selectAll": false,
  "relationshipTypeId": "rel-123"
}
```

All actions return `{ success: true, affectedCount: number }`.

### POST /api/people/bulk/orphans

Called before showing the delete modal to compute aggregate orphan list.

```json
Request:  { "personIds": ["id1", "id2"] }  // OR selectAll: true
Response: { "orphans": [{ "id": "...", "fullName": "..." }], "hasCardDavSync": true }
```

Deduplicates orphans — a person is only an orphan if they'd lose all connections after the entire bulk delete (excluding other people being deleted from the relationship count).

## Bulk Delete Flow

Multi-step modal confirmation:

1. **Loading**: Spinner while calling `POST /api/people/bulk/orphans`.
2. **Summary + Orphans**: "You are about to delete N people" with names. If orphans found: list them with checkbox "Also delete these orphans?"
3. **CardDAV** (only if configured): Checkbox "Also delete from CardDAV server?" Applies to primary selection and orphans.
4. **Confirm**: Red "Delete" button. Calls bulk endpoint. Soft-delete preserved (30-day recovery).

## Bulk Add to Groups Modal

- Header: "Add N people to groups"
- Reuses `GroupsSelector` component (colored pills, inline group creation)
- "Add" button calls bulk endpoint
- Already-in-group is a no-op per person (no duplicates)
- Success toast, page refresh

## Bulk Set Relationship Modal

- Header: "Set relationship for N people"
- Dropdown of user's relationship types
- "Apply" button calls bulk endpoint
- Overwrites existing relationship-to-user for all selected
- Success toast, page refresh

## Floating Action Bar

Sticky to bottom of viewport. Contains:
- Selection count: "N selected" or "All N people selected"
- Buttons: "Add to Groups", "Set Relationship", "Delete" (red, rightmost)
- Clear selection button (x)
- Slide-up transition on first selection, slide-down on clear
