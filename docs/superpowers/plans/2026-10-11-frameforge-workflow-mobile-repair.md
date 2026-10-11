# FrameForge workflow and mobile repair — implementation plan

**Date:** 2026-10-11

**Source spec:** `docs/superpowers/specs/2026-10-11-frameforge-workflow-mobile-repair-design.md`

**Status:** Ready for user review

## Objective

Implement the approved shared project-media workflow, source-specific saved edits, durable cloud exports, and responsive editing UI for all five tools. Preserve legacy data and the existing stack. No new runtime dependencies are expected.

## Implementation order

### 1. Additive data model and API contracts

**Files**

- `lib/db/src/schema/frame_edits.ts`
- `lib/db/src/schema/blur_regions.ts`
- `lib/db/src/schema/project_exports.ts` (new)
- `lib/db/src/schema/index.ts`
- `lib/api-spec/openapi.yaml`
- Generated files under `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/`
- `artifacts/api-server/src/routes/frame_edits.ts`
- `artifacts/api-server/src/routes/blur_regions.ts`
- `artifacts/api-server/src/routes/exports.ts` (new)
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/lib/objectStorage.ts`

**Steps**

1. Add nullable `replacementObjectPath` to frame edits and nullable `sourceId` to blur regions. Keep `replacementDataUrl` available for legacy reads. Add `project_exports` metadata with project cascade, nullable source reference, export metadata, and a project/newest-first index.
2. Extend the OpenAPI contract for those fields and for list/create/delete project-export operations. Every request body references an entity schema. Keep existing operation IDs stable.
3. Run `pnpm --filter @workspace/api-spec run codegen`; do not edit generated API/Zod files by hand.
4. Implement thin, Zod-validated API handlers. Verify new frame-edit and blur-region source IDs belong to the requested project. Keep frame/region reads project-scoped; return exports newest first.
5. Add a private-object delete helper to `ObjectStorageService`, validating normalized private object paths and treating missing objects as already deleted. Use it only after loading the owning frame-edit/export row scoped to the project. If another storage deletion error occurs, keep the database record and return a retryable error.
6. Push the additive Drizzle changes with `pnpm --filter @workspace/db run push`. Do not use `push-force`; stop and inspect if Drizzle proposes destructive changes.

**Done when**

- Generated client hooks expose the updated contracts without hand-maintained duplicate types.
- Existing data-URL frame edits and source-less blur regions still load.
- New edit/region requests cannot associate a source from another project.
- Export records can be listed, created, and deleted; failed object deletion does not silently remove the record.

### 2. Create shared project media state

**Files**

- `artifacts/video-editor/src/pages/project-workspace.tsx`
- `artifacts/video-editor/src/hooks/use-project-media.tsx` (new)
- `artifacts/video-editor/src/components/video-editor/` (shared source picker/import component)
- `artifacts/video-editor/src/pages/dashboard.tsx` only if the empty-project import entry needs a visible action

**Steps**

1. Move selected-source ownership to a project-scoped provider/hook. Represent the selected source ID and active tool in optional query parameters on `/projects/:id`.
2. Resolve saved `objectPath` values using the existing `useGetStorageObject` API hook. Convert the response to a browser `File`/object URL and revoke URLs on source change and unmount.
3. Consolidate upload behavior: validate a video, read metadata, request the presigned URL, check both the API response and direct PUT response, then create the source record. For a metadata-only or missing-object source, re-upload to that source using `useUpdateSource` instead of creating a duplicate.
4. Retain the uploaded path and form state long enough to retry source-record creation if storage upload succeeds but the metadata request fails. Display progress and actionable errors at each step.
5. Keep the source picker reachable from the workspace header at all viewport sizes. Show a missing/re-upload state for `objectPath: null` records and failed object reads.

**Done when**

- A saved source can be selected, fetched, and reopened after refresh.
- A failed PUT never creates a source record that appears ready.
- Refresh, back, and forward preserve valid tool/source query state; invalid IDs fall back to a valid project state.
- Tool components consume the shared selected media instead of maintaining separate primary-video uploads.

### 3. Bind editing tools to the selected source

**Files**

- `artifacts/video-editor/src/components/video-editor/frame-editor.tsx`
- `artifacts/video-editor/src/components/video-editor/blur-studio.tsx`
- `artifacts/video-editor/src/components/video-editor/face-sync.tsx`
- `artifacts/video-editor/src/components/video-editor/multi-compare.tsx`
- `artifacts/video-editor/src/hooks/` for small focused media/edit helpers as needed

**Steps**

1. Update Frame Editor, Blur Studio, FaceSync, and Exports to use the shared source. Keep tool-specific state only where it belongs.
2. In Frame Editor and FaceSync, upload replacement-frame bytes to storage, then save `replacementObjectPath` and the selected `sourceId`. Resolve saved object paths for previews; fall back to `replacementDataUrl` for legacy rows. Show per-frame save failures and partial success.
3. Add selected `sourceId` when creating/updating blur regions. Replace mouse-only handlers with Pointer Events, pointer capture, and coordinate conversion that works with touch and mouse.
4. Filter frame edits and blur regions by the selected source. Apply source-less legacy rows only to the designated primary source.
5. Make Multi-Compare select from persisted project sources. Keep track selection and alignment state in workspace-level state so changing tools does not clear it; leave comparison offsets session-only across a full browser restart.
6. Invalidate the generated React Query keys after successful mutations and surface API failures instead of silently ignoring them.

**Done when**

- Switching sources never shows or applies another source's frame edits or blur regions.
- Reopening Frame Editor and Blur Studio restores the selected source and saved edits.
- FaceSync reports saved, failed, and partial frame counts and does not associate new edits with a null source.
- Blur-region drawing works with touch and mouse input.
- Switching away from Multi-Compare and back does not discard the current session's tracks or offsets.

### 4. Persist and manage exports

**Files**

- `artifacts/video-editor/src/components/video-editor/exports.tsx`
- `artifacts/api-server/src/routes/exports.ts`
- `lib/api-spec/openapi.yaml`
- `lib/db/src/schema/project_exports.ts`

**Steps**

1. Build export input from the shared selected source and only its frame edits and blur regions.
2. Add original-quality and lower-resolution/export-quality choices. Keep limits and expected processing cost visible before starting a heavy render.
3. Check the storage PUT response, then create the project export record with source, format, filename, object path, and output size. Retain the object path in retry state if record creation fails so retry does not repeat the render.
4. List cloud exports from the API and let users download them after navigation or reload.
5. Add a clearly labeled delete action with confirmation. Delete the stored object before its record; treat 404 as already deleted and keep the record on other storage errors.

**Done when**

- Download works for a freshly rendered output.
- Cloud-saved outputs remain listed and retrievable after reload.
- Exports do not include another source's frame edits or blur regions.
- A failed cloud-save metadata request gives a retry path without silently losing the completed render.
- Deleting an export cannot leave a hidden UI success when storage deletion failed.

### 5. Rework navigation and responsive workspace layout

**Files**

- `artifacts/video-editor/src/components/layout.tsx`
- `artifacts/video-editor/src/pages/project-workspace.tsx`
- `artifacts/video-editor/src/pages/dashboard.tsx`
- `artifacts/video-editor/src/pages/project-settings.tsx`
- `artifacts/video-editor/src/index.css`
- `artifacts/video-editor/index.html`
- Tool component styles listed in step 3

**Steps**

1. Keep Dashboard and Settings reachable through a compact mobile header/menu; remove the single-row header overflow.
2. Keep desktop tabs on wide screens and use a compact labeled selector on phones. Keep the active tool and project source visible.
3. At phone widths, make editor work areas full width and move source/region/drift panels into accessible drawers, sheets, or collapsible panels. Stack Exports controls; show one active Multi-Compare track with direct switching.
4. Use dynamic viewport sizing and safe-area padding. Prevent horizontal page overflow and remove `maximum-scale=1` so users can zoom.
5. Make icon controls keyboard-accessible, add visible focus, and target at least 44px for touch controls where applicable.
6. Keep desktop layout efficient; do not merely scale all desktop columns down.

**Done when**

- Dashboard, Settings, and each editor tool fit 390×844 and 430×932 without horizontal page overflow.
- The 1440×900 workspace retains a usable desktop layout.
- Every tool action is reachable on touch and keyboard; opening a drawer does not cover required primary actions.

### 6. Verify end-to-end reliability

**Verification**

1. Add a dependency-free Node smoke script under `artifacts/api-server/scripts/` using built-in `fetch`/`assert`. It creates a disposable project, exercises source-scoped blur/frame-edit and export list/create/delete contracts, verifies storage reads/deletes, and cleans up all test records and objects in `finally`.
2. Use a short disposable video fixture in the running app to exercise: upload → refresh/reopen → switch tools → save frame edit → draw/save blur → export/download → cloud save → reload/download/delete.
3. Exercise missing-object, no-object-path, failed PUT, failed API save, and object-delete failure cases; confirm that each error is visible and recoverable.
4. Use browser interaction and screenshots at 390×844, 430×932, and 1440×900. Confirm tool navigation, source picker, drawers, touch-region drawing, compare track switching, export actions, and no horizontal overflow.
5. Run:
   - `pnpm --filter @workspace/api-spec run codegen`
   - `pnpm run typecheck:libs`
   - `pnpm --filter @workspace/db run push`
   - `pnpm run typecheck`
   - `pnpm --filter @workspace/api-server run build`
   - `pnpm --filter @workspace/video-editor run build`
6. Restart the existing `artifacts/api-server: API Server` and `artifacts/video-editor: web` workflows once after implementation changes. Check workflow and browser logs after restart.
7. Run the API/storage smoke check with `node artifacts/api-server/scripts/verify-frameforge-workflow.mjs` against the running development API.

**Done when**

- The smoke script cleans up its test project and stored objects even when an assertion fails.
- Typechecks/builds pass and both workflows start cleanly.
- The full workflow passes on desktop and the critical editing/export interactions work at phone viewport sizes.

## Dependencies and scope controls

- No new runtime dependencies are planned. Use existing React, Radix, TanStack Query, FFmpeg, generated API, Drizzle, and object-storage packages.
- API contract changes precede UI callers; regenerate Orval output before frontend or route types are updated.
- Shared source state precedes per-tool integration; source-specific edit/blur behavior precedes export filtering.
- Database changes are additive. Never run `push-force` or rewrite legacy rows without pausing for review.
- The sample sources with null object paths remain visible and require the user to attach/re-upload the original video.
