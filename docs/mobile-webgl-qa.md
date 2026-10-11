# Mobile WebGL recovery — 2026-10-11

Reported device: Pixel 10 Pro XL; the user reported repeated graphics-context loss. A physical Pixel was not available. The exact GPU/driver failure has not been reproduced on that device.

## Changes

- Mobile/coarse-pointer canvases select the conservative renderer before creation: no MSAA, no shadow passes, DPR at most 1, drawing-buffer budget 1 million pixels, maximum 30 rendered frames per second. Selecting high quality cannot bypass the mobile limits.
- Mobile and recovery modes use the mobile GLBs. Texture allocation estimate drops from 14 to 6 MiB for the whole house, with identical geometry and curtain morph data; see `mobile-model-audit.json`.
- Fourteen logical lighting channels remain independent. Actual point lights are pooled: at most 3 electrical lights on mobile / 6 on desktop, with the selected room/group prioritized. Off lights do not participate in rendering. One daylight fill follows the room, and inactive TV textures stop updating.
- The previous GLB, its GPU resources, and decoded ImageBitmaps are released before replacement. Superseded downloads abort; decoding is serialized both within a scene and across recovery remounts.
- The first context loss triggers one safe-mode remount of the 3D scene, preserving App state. Further loss presents a manual retry. A sessionStorage flag retains safe quality on page reload; retries never reload the page. The old context is explicitly released on unmount.

## Verification

- `npm test`: **61/61 passed**, including stale/aborted loads, A→B→A races, cross-mount decoder serialization, rejected callbacks, light budgets, and all existing automation/water state tests.
- `npm run build`: TypeScript and production Vite build passed.
- Local production build in the in-app Chromium browser at **412 × 915**: initial mobile model rendered with antialias=false, DPR=1, shadowCalls=0, and 4 active point lights in the default room.
- Local-only `?diagnostics=1` control invoked **real `WEBGL_lose_context`** through the renderer. The first loss created a fresh canvas/model automatically. The selected Morning scenario and its light levels survived. The second loss stayed at the manual fallback; clicking retry restored the scene and preserved settings. Exactly one canvas remained.
- Reload retained conservative quality. Rapid switching through whole floor, living room, office, bathroom, bedroom, then the electrical plan completed without loading/error overlays or console warnings/errors. Full-house and first-room mobile files both rendered. Raw observations: `mobile-webgl-session.json`.

The viewport test verifies budgets and recovery behavior, not physical Pixel performance or that device's browser driver. Rendering remains to be confirmed by the user on the reported phone.
