---
name: Async UI task cancellation
description: Safe patterns for long-running browser media processing in React
---

Long-running browser media work must not start side effects from a React state updater. Give each analysis or restoration run an operation identity, invalidate it on reset or new input, and ignore results from older runs.

**Why:** React may invoke state updaters more than once, and users can select a new file or reset while MediaPipe/canvas work is still pending. Without guards, old results can overwrite the current project state.

**How to apply:** Use pure state updaters for state calculation only; keep asynchronous work in the callback body, guard progress/result updates with the current operation identity, and invalidate that identity on reset.