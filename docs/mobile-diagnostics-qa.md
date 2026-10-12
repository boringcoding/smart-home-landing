# Mobile graphics diagnostics — 2026-10-12

The report is available above the scene under **Диагностика 3D**. `?debug=1` opens it immediately. It includes the build revision/time, browser/device environment, GPU and WebGL capabilities, render target status, active profile, resource counts, model fetch/decode/commit/first-frame stages, shader logs and context-loss details. A bounded previous-session report survives reload in sessionStorage. Reports are copied/downloaded only by explicit user action; no automatic upload and no application form/contact/state snapshots.

The early classic bootstrap and native panel are independent from React, Three, model loading and the main module graph. The bootstrap is a same-origin external script compatible with the local server's CSP. Main App loading is asynchronous so import errors can also be reported. Rendering quality settings and assets are unchanged in this update.

## Checks

- `npm test`: 80 tests passed, including 13 recorder tests (bounded history, retained last error, deduplication, synchronous phase persistence, coalesced UI delivery, storage failure/quota, previous-session tail, redaction, cycles and report export).
- `npm run build`: TypeScript and production Vite build passed. `git diff --check` passed.
- Local production server, Chromium, 412 × 915 CSS viewport: full report appears, GPU/profile/FBO/model stages populated, no initial errors. Both render targets complete; mobile Auto stays at 30 fps in this environment.
- Local-only fault control triggered a real `WEBGL_lose_context` event. The report retained `renderer.context.lost`, prior profile/metrics and recovery event after the replacement scene rendered. It auto-expanded and remained usable.
- Reload retained the previous session's two error events, native loss details and last error.
- Separate scratch HTTP fixture returned 503 for the main JavaScript entry. The native panel opened, reported the failed script URL, and downloaded a valid JSON report with `resource.error`. Copy controls reported browser API success; the automation clipboard mirror was empty, so downloaded/text reports supplied the independently verified content.
- No claim of physical Pixel 10 Pro XL reproduction: the next step is the report from that device.
