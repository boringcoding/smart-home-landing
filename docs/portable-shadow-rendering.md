# Mobile normal-quality shadows — 2026-10-12

## Evidence and limits

The user reports that direct mobile Auto/High still fail on the Pixel 10 Pro XL, while Economy works. Removing mobile HDR/FXAA was therefore insufficient. The earlier device report lost its context before GLB decode, with only the startup ground/light scene submitted. Full model maps and anisotropy had not yet reached the GPU.

Normal mobile rendering differs from Economy at that point in two relevant ways: supersampled drawing-buffer size and a directional shadow map. Three 0.186.1 PCF uses a native depth texture with hardware comparison/linear filtering and `sampler2DShadow`. This is a plausible compatibility trigger, not a confirmed diagnosis of the PowerVR driver. A returned `renderer.render()` does not establish GPU completion.

## Rendering change

Mobile Auto/High retain the full model textures, anisotropy 4, 1024² cached shadow map and the existing 2×/2.5× bounded drawing resolution. Their shadow backend now uses `BasicShadowMap` with nine weighted ordinary depth samples and software depth comparisons. The native comparison sampler/filtering path is not compiled for mobile. Shadow filtering remains on the GPU; this is not a CPU renderer. Desktop retains its existing PCF path.

The project-owned shader adapter changes only the directional/spot Basic branch. It retains shadow bias, map bounds, reversed-depth comparison and intensity. It checks the supported Three revision and exact source contract, failing explicitly after an incompatible dependency change. The approach follows the [Three r186 custom soft-shadow example](https://github.com/mrdoob/three.js/blob/r186/examples/webgl_shadowmap_pcss.html), while using a smaller fixed filter. Basic still uses a native depth texture; this is not evidence that every possible depth-texture driver issue is avoided.

A separate confirmed defect repeatedly reset the canvas drawing buffer even when dimensions were unchanged: `setPixelRatio` calls `setSize`, followed by another explicit `setSize`. Resizing now uses one `setDrawingBufferSize` call only when logical size or ratio changes. New postprocessing targets are still sized independently when the canvas is unchanged.

Diagnostics include the active `shadowFilter` (`software-pcf-9`, `hardware-pcf` or `off`) in pipeline events and metrics. No device reports are uploaded automatically.

## Validation

- 101 automated tests pass, including shader contract/normalization/idempotency and buffer resize regression checks. TypeScript and production build pass.
- Local Chromium on Apple M2, 448 × 850 viewport: Auto uses full house (8,811,760 bytes), DPR 2, 1024 shadows, `software-pcf-9`, no postprocessing; High keeps the same materials/shadow map with DPR 2.5. Both held 30 fps in the checked samples, with no shader/console errors.
- Inspected exterior and interior; changed rooms, switched High → Economy → High, resized to a 1440 × 900 desktop viewport and back. Desktop switched to 2048 hardware PCF with FXAA, then mobile returned to software filtering and direct rendering. One canvas remained; diagnostics recorded zero errors.
- The fresh startup recorded one actual drawing-buffer resize, not repeated allocations from initialization/ResizeObserver/profile application. Subsequent recorded resizes corresponded to actual quality or viewport changes.
- The camera view cache now includes the mobile breakpoint so a proportional resize updates its framing too.

Physical Pixel verification is still required; browser viewport emulation does not reproduce its GPU. The hardware-shadow path is a compatibility hypothesis, not a confirmed driver defect or a verified physical-device fix.
