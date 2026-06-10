---
name: Orval mutation signatures
description: How orval generates mutation hook variable names vs query hook signatures in this workspace
---

Orval-generated mutation hooks take `{id: number, data: BodyType<...>}` for project-scoped mutations — NOT `{projectId: number, data: ...}`.
For nested resources: `{id: number, regionId: number, data: ...}` or `{id: number, regionId: number}` for deletes.
Query hooks take the resource id as the first positional argument: `useListBlurRegions(projectId)`.

**Why:** The generated parameter name matches the OpenAPI path parameter name (`{id}` in `/projects/{id}/blur-regions`), not a semantic name.

**How to apply:** Always check `lib/api-client-react/src/generated/api.ts` grep for the mutation name before writing call sites. The pattern is: path param names become the object keys.
