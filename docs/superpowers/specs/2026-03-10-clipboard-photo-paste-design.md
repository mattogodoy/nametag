# Clipboard Paste for Person Photos

## Overview

Replace the current "click avatar → file picker" flow with a photo source modal that supports three input methods: file browse, drag-and-drop, and clipboard paste. The modal feeds into the existing crop flow.

## Flow

1. User clicks avatar (camera icon) → PhotoSourceModal opens
2. User picks an image via one of:
   - **Click / browse** — opens file picker (same accept types as today)
   - **Drag & drop** — drop image onto the modal
   - **Paste** — Ctrl/Cmd+V anywhere while modal is open
3. Image is validated (type + size, same rules as today)
4. Modal closes → PhotoCropModal opens with the image
5. Rest of the flow unchanged (crop → preview → upload on submit)

## New Component: PhotoSourceModal

- Reuses the existing modal pattern from the project (dialog/overlay)
- Drop zone area with dashed border, icon, and text: "Drag and drop, paste, or click to browse"
- Visual feedback: border color change on drag-over
- Hidden file input triggered on click (same accept and size limits)
- Global paste event listener added on mount, removed on unmount
- Extracts image from clipboardData.items (type image/*)
- Validates format and size, shows toast on error (reuses existing toast pattern)
- Returns a File or Blob to the parent, which feeds it into PhotoCropModal

## Changes to PersonForm.tsx

- Remove the inline file input + label wrapping the avatar
- On avatar click: open PhotoSourceModal instead
- PhotoSourceModal's callback replaces handlePhotoSelect as the entry point
- The rest of the state machine (cropImageSrc → PhotoCropModal → pendingPhotoBlob) stays the same

## What doesn't change

- PhotoCropModal — untouched
- lib/photo-storage.ts — untouched (server-side processing)
- API endpoints — untouched
- Validation rules (10MB, JPEG/PNG/GIF/WebP) — same, just enforced in the new modal too
