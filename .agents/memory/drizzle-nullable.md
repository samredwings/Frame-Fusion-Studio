---
name: Drizzle nullable columns
description: Drizzle ORM column types with defaults are nullable in TypeScript inference
---

Drizzle columns defined as `.default(value)` without `.notNull()` infer as `T | null` in TypeScript, not `T`.
Example: `real("x").default(0)` → TypeScript type is `number | null`.

**Why:** Drizzle correctly reflects that the column can be NULL until a row is inserted with the default applied.

**How to apply:** Always use `?? fallback` (e.g. `?? 0` for numbers, `?? ""` for strings) when accessing nullable columns in component code. Add `.notNull()` to the Drizzle column definition if the value should always be present.
