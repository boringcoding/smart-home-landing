# Mobile quality follow-up — 2026-10-12

The user confirmed that the previous update loads on Pixel 10 Pro XL, but its image quality was unacceptable. The earlier DPR=1, no-AA, no-shadow mobile fallback had become the default. This follow-up restores useful image quality while retaining serialized decoding, resource disposal, bounded lighting, and context-loss recovery.

## Rendering

| Profile | Maximum render scale | Pixel budget | Texture set | Sun shadow |
|---|---:|---:|---|---:|
| Mobile Auto | 2× (1.5× after sustained slow frames) | 1.2 MP | Original | 1024² |
| Mobile High | 2.5× | 1.8 MP | Original | 1024² |
| Economy / recovery | 1.25× | 0.65 MP | Compact | Off |

Mobile keeps hardware MSAA disabled. Edge smoothing uses linear HDR16F → OutputPass (ACES + sRGB) → RGBA8 → FXAA, with a depth24 offscreen buffer. The targets are resized within the pixel budget and disposed with the scene. The conservative mobile frame cap and three-light electrical pool remain. Sun shadows update only when a model/view, curtain, valve, or quality setting changes, with a maximum update rate of about 8 Hz during motion.

Original 1024px interior maps and anisotropic filtering (up to 4× mobile) restore floor/lining detail. Exterior texture and geometry were unchanged by the previous asset reduction; their visible stippling was addressed by supersampling, smoothing, and improved depth precision. The house-view near plane is now 0.5 m; interior/close inspections retain their short near planes.

The quality selector is directly beneath the scene. High now has an effective mobile profile. The old sessionStorage safe flag v1 is ignored; v2 is set only by a real context loss. Manual choices persist for the tab, and choosing Auto/High exits safe quality without resetting the house.

## Checks

- `npm test`: **67/67 passed**, including mobile/desktop adaptation, high/economy behavior, and pixel budgets across 90 viewport/DPR combinations. Production TypeScript/Vite build passed.
- Local Chromium viewport **412×915**: Auto rendered at 2× with FXAA, original GLB textures, depthBits=24, and a 1024² sun shadow. Steady frames reused the shadow map (shadowCalls=0) while the shadow remained visible. Local sample: 30 FPS / p95 33.4 ms after settling.
- High increased the actual canvas to 927×975 (2.5×); Economy used 1.25×, compact assets, and no shadow. Returning to Auto restored full assets/shadows without console warnings/errors.
- Compared exterior screenshots and inspected the interior: thin siding/deck edges no longer show the previous stippling, and the ground shadow and material detail are visible.
- Invoked a real `WEBGL_lose_context` through the local diagnostic control. A new scene loaded in economy mode, exactly one canvas remained, and the Morning scenario/light levels survived. Manual Auto selection restored image quality and removed the recovery notice.

These are local browser observations, not physical Pixel benchmarks. The user confirmed loading on the previous release; quality and stability of this version on that phone require their follow-up.
