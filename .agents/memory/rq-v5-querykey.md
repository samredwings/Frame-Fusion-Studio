---
name: React Query v5 queryKey cast
description: Workaround for UseQueryOptions requiring queryKey in react-query v5 with orval-generated hooks
---

Orval generates hooks where the `query` option is typed as `UseQueryOptions<...>` (not `Partial<UseQueryOptions>`). In react-query v5, `UseQueryOptions` requires `queryKey`.
When passing only `{enabled: boolean}` as the query option, TypeScript errors with "Property 'queryKey' is missing".

**Fix:** Cast the options object: `{ query: { enabled: !!id } as never }`

**Why:** The `queryKey` is overridden by orval's generated `getXxxQueryOptions` anyway; the cast is safe.

**How to apply:** Any call site passing only `enabled` to an orval hook's `query` option needs `as never`.
