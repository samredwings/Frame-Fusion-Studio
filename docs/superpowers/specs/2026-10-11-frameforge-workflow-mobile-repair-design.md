# FrameForge reliable media workflow and mobile editor

**Date:** 2026-10-11

**Status:** Draft for user review

**Product:** FrameForge video-processing workspace
**Decision:** Shared media workflow with full mobile editing support

## Problem

FrameForge has a project dashboard, settings page, and five project tools: Frame Editor, Multi-Compare, Blur Studio, FaceSync, and Exports. The current project workspace assumes a wide desktop viewport and separate local file state in multiple tools. On a 390px viewport, global navigation and the tool tabs clip; fixed sidebars leave too little room for the media canvas. Blur drawing uses mouse-only events.

Media state is also fragmented. Frame Editor, Blur Studio, FaceSync, and Exports can each ask for a local video, while saved source rows are not consistently reopened from object storage. Tool changes can discard local `File` state. Frame replacements and FaceSync restorations send base64 images to an API whose Express JSON parser uses its default 100 KB limit. Cloud exports upload to storage but their object paths are kept only in component state, so they disappear from the project UI after navigation or reload.

The existing demo sources for project 1 have `objectPath: null`. Their source metadata is present, but their original video files are not available to reload.

## Goals

1. Upload a project video once and reuse its saved source across editing tools and later visits.
2. Make every existing tool and its primary actions usable on phones, without horizontal clipping.
3. Store new replacement-frame assets in object storage and persist their paths rather than sending large data URLs through JSON.
4. Keep cloud exports associated with their project and available after reload.
5. Give every long operation visible progress, success, retry, and actionable error states.
6. Preserve existing projects and legacy frame-edit data; use additive schema changes only.

## Non-goals

- Replacing the existing database, API framework, object-storage service, or video-processing stack.
- Reimplementing the face-drift, face-detection, frame-extraction, or comparison algorithms.
- Recovering video files whose source records have no object path or whose stored object no longer exists. Those files must be uploaded again.
- Guaranteeing that every phone can render videos of arbitrary length, resolution, or file size.
- Adding authentication or changing the existing storage access model.
- Persisting every transient comparison adjustment or unsaved in-progress operation across a full browser restart.

## Proposed design

### 1. Shared project media state

Add a project-scoped media provider/hook owned by `ProjectWorkspace`. It owns the selected source ID and resolves the selected source to a usable browser `File`/object URL. Keep the existing `/projects/:id` route and put the active tool and selected source ID in optional query parameters so refresh, browser back/forward, and links preserve the workspace context.

- New uploads follow one path: validate the selected video, analyze its metadata, request a presigned storage URL, upload bytes directly to storage, check the PUT response, then create the project source record with the returned `objectPath`.
- Saved sources with an `objectPath` load through the existing storage-object endpoint. The selected source is passed to the active tool instead of asking each tool to keep an unrelated local file.
- Keep the source picker in the workspace shell so it remains reachable on desktop and phone, including while a tool's side panel is collapsed.
- A source without an `objectPath`, or whose stored object cannot be fetched, renders an explicit re-upload action. Attach the replacement file to the existing source record instead of creating a duplicate. It must not show a source as ready when its file is unavailable.
- Multi-Compare chooses from the project's saved comparison sources and may add a source through the same upload path.
- Release object URLs and ignore stale async results when changing source, changing tool, or unmounting. Prompt before leaving work that has not been saved when that work would otherwise be lost.

### 2. Durable frame replacements

For new frame edits, upload the replacement image bytes to object storage before creating the frame-edit record. Add a nullable `replacementObjectPath` field to `frame_edits` and its OpenAPI response/input schemas. New edits must include the selected `sourceId` and object path; the API verifies that source belongs to the project. Retain the old data-URL response field only for compatibility with existing records. On an explicit revert/delete, remove the replacement object before removing its record. Treat an already-missing object as cleaned up; on other storage errors, keep the record and show a retryable error.

Keep `replacementDataUrl` readable for existing records. Image consumers resolve the object path when present and otherwise render the legacy data URL. Do not increase the Express JSON body limit to make large base64 requests pass; the binary belongs in object storage.

Add a nullable `sourceId` to blur-region records and their OpenAPI schemas, with a source foreign key that cascades when that source is removed. New regions are bound to the selected source and validated against the project. Frame Editor, Blur Studio, FaceSync, and Exports must filter edits/regions by source so work on one video is not applied to another. Source-less legacy frame edits and blur regions continue to apply to the project's designated primary source.

FaceSync must report per-frame save failures and partial success instead of silently skipping failed requests. Its new frame edits use the selected source ID and object path.

### 3. Persisted project exports

Add a `project_exports` table with a cascading project reference and metadata only: object path, filename, format, nullable source reference that becomes null if the source is deleted, output size, and creation timestamp. Add an index that supports listing a project's exports in newest-first order. Video bytes remain in the existing object storage service.

Add contract-first OpenAPI operations and generated hooks to list, create, and delete project exports. After uploading a render, create the export record; list records in the Exports tool and allow their stored objects to be fetched/downloaded after navigating away or reloading. Provide a clearly labeled delete action with confirmation. Delete the stored object before removing its record; treat an already-missing object as cleaned up, and if another storage error occurs, keep the record and show a retryable error. Do not delete existing source, edit, or project records as part of this work.

### 4. Mobile-first project workspace

Keep the existing five tools and API behavior while retaining `/projects/:id` as the workspace route. Reorganize navigation and controls for narrow viewports:

- Preserve an always-reachable path to Dashboard and project Settings; use a compact menu/sheet rather than a clipped desktop header. Keep the project source picker visible in the compact workspace header.
- Keep clear tool names and the active tool visible. Use the current tab treatment on wide screens and a compact labeled tool selector on phones.
- Give the active editor the available width. Move source/region/drift panels into collapsible panels or accessible sheets on phones; retain the desktop side panels on wide screens.
- Adapt Multi-Compare to a single active track with direct track switching on narrow screens. Keep synchronized multi-track viewing on larger screens.
- Stack export controls and forms on small screens. Keep primary actions reachable without covering the media canvas or filmstrip.
- Use Pointer Events for blur-region drawing so mouse, touch, and pen work through the same coordinate mapping.
- Set practical touch targets and spacing, prevent horizontal page overflow, use dynamic viewport sizing and safe-area padding, and remove the viewport's `maximum-scale=1` restriction so browser zoom remains available.

### 5. Processing feedback and device limits

Use one consistent operation-state model for upload, loading, extraction, analysis, save, and export. Every request checks its response; every caught error reaches the user with a retry or recovery path. Invalidate the generated React Query keys for all affected source, edit, blur, export, project, and stats views after successful mutations.

Keep all five tools available on mobile. Before expensive processing, show the clip's duration/size and a conservative mobile processing estimate. Offer an explicit lower-resolution/export-quality choice for large jobs, with the original-quality option preserved. If processing fails due to device capacity, preserve source/edits and explain how to retry with a smaller clip or desktop. Do not infer support solely from user-agent strings.

### 6. API and database compatibility

- Treat `lib/api-spec/openapi.yaml` as the API contract source of truth and run code generation after changes.
- Add nullable `replacement_object_path`, nullable `blur_regions.source_id`, and the exports table; retain the legacy `replacement_data_url` field for reads. Delete replacement/export objects when the corresponding record is explicitly deleted; retain the record and show a retryable error if object deletion fails.
- Use the existing Drizzle/Postgres database and object-storage routes. Store file bytes only in object storage and paths/metadata in Postgres.
- Apply additive schema changes without rewriting or deleting existing records. Existing sources with `objectPath: null` remain visible but require a fresh file upload.
- Keep the existing base project route and project/source/blur-region/frame-edit route identifiers stable; new workspace context uses optional query parameters.

## Primary user flow

1. Open or create a project and import one video.
2. The app analyzes it, uploads it to object storage, stores its source metadata/path, and selects it.
3. Switch between Frame Editor, Blur Studio, FaceSync, Multi-Compare, and Exports without reselecting an already-saved source; reloading preserves the selected tool and source.
4. Save frame replacements and blur regions against the correct project/source. Reopening the project reloads saved inputs and edits.
5. Render from the selected source with that source's saved replacements and blur regions.
6. Download the render or save it to cloud. Cloud-saved outputs remain listed and can be downloaded after a reload.

## Acceptance criteria

### Workflow and persistence

- Importing a video verifies both the presigned upload response and the storage PUT response before creating a source record.
- After a successful upload, the source is selectable and loads from storage after a page reload.
- Refreshing or navigating back/forward in a project preserves the active tool and selected source when those query parameters still reference valid records.
- A selected source is reused by Frame Editor, Blur Studio, FaceSync, and Exports. Multi-Compare can load saved comparison sources.
- New frame edits use object paths and a source ID; new blur regions are source-specific; legacy edits using data URLs and source-less regions still render against the primary source.
- A saved frame replacement appears in Frame Editor and is included in the matching source's export, not another source's export.
- Switching sources does not display or apply another source's blur regions or frame replacements.
- Blur regions, FaceSync results, and exports show explicit success/error/partial-success states. A cloud export remains available after navigation and reload.
- Deleting a frame edit or export removes its owned stored object, preventing files from being orphaned by those actions.
- Missing legacy media displays a re-upload path instead of a blank editor.

### Responsive behavior and access

- At 390×844 and 430×932, dashboard, settings, and all five tools have visible, usable navigation and controls with no horizontal page overflow.
- At 1440×900, the current editing workspace remains efficient and its primary controls stay visible.
- Blur-region drawing works with touch/pointer input, and all icon-only controls have accessible names and visible focus.
- Pinch zoom remains enabled. Interactive controls meet a practical minimum 44px target where applicable.
- Active tool/source changes do not leave stale async results or leak object URLs.

### Verification

- Run API-spec codegen, library typecheck, video-editor typecheck/build, and API-server typecheck/build after the implementation.
- Exercise the real project workflow in a browser at desktop and phone viewport sizes: create project, upload a small sample video, switch tools, save a frame edit, add a blur region, render/download, save to cloud, reload, and retrieve the saved source and export.
- Exercise missing-object and failed-upload/API cases and confirm the UI shows recovery steps.
- Add focused automated tests for new source/export persistence contracts using the lightest test approach supported by the workspace; do not add a heavyweight browser framework solely for this change.

## Expected implementation areas

- `artifacts/video-editor/src/components/layout.tsx`
- `artifacts/video-editor/src/pages/dashboard.tsx`
- `artifacts/video-editor/src/pages/project-workspace.tsx`
- `artifacts/video-editor/src/components/video-editor/`
- `artifacts/video-editor/src/hooks/` for shared project media and processing state
- `artifacts/video-editor/index.html` and `artifacts/video-editor/src/index.css`
- `lib/api-spec/openapi.yaml` and generated API client/Zod packages
- `lib/db/src/schema/` for the additive frame-edit path, blur-region source reference, and project-export table
- `artifacts/api-server/src/routes/` for export metadata endpoints

## Risks and mitigations

- **Unavailable demo files:** Metadata-only sample sources cannot be reopened. Keep them intact and clearly request re-upload rather than pretending the media exists.
- **Mobile memory limits:** Preserve a bounded frame count, expose practical resolution/frame-rate settings, and show recoverable errors. Do not promise identical render capacity across phones and desktops.
- **Legacy frame edits:** Read old data URLs during rollout and write new object paths. Avoid an all-at-once data migration.
- **Multiple sources in one project:** Bind new edits and exports to the selected source. Treat source-less legacy frame edits as belonging to the primary source to avoid silently discarding existing edits.
- **API contract drift:** Update OpenAPI first, regenerate hooks and Zod validators, and verify every changed client request against the actual endpoint.
