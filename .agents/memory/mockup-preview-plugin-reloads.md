---
name: Mockup preview plugin reloads
description: A workflow restart may be required before a custom preview plugin's generated registry reflects its latest source.
---

After changing the custom Vite preview plugin or its registry-generation logic, restart the component-preview workflow before trusting the generated import map or iframe preview.

**Why:** The running preview server continued serving an old import mapping after the source had been corrected, which made a valid component appear missing until the workflow restarted.

**How to apply:** If the generated mockup registry disagrees with the current plugin source, restart the existing preview workflow once, then rerun typecheck and inspect the preview route.
