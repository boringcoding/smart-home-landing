# GPU submission and startup verification

## Status, 2026-10-12

The Pixel 10 Pro XL failure is **not yet confirmed fixed on the physical device**.
The latest device report tested build `19761bce` (Three r181, RGBA8 PCF Soft).
Economy rendered successfully; High still lost its WebGL context. Do not describe
desktop or viewport-emulated results as a successful Pixel test.

The first full-model render returned after 910 ms, without a shader error. The
context-lost event followed 764 ms later. The retry reported empty shader logs for
LineBasicMaterial and two sides of Glass. These are not proof of a faulty material:
context loss is asynchronous and transparent glass is normally drawn last.

Both native depth shadows and packed RGBA shadows have now failed on the phone.
Full and Economy GLBs have identical geometry/material definitions; two base-color
PNGs differ in resolution. No evidence currently establishes a GPU memory leak,
a particular shader defect, or insufficient phone hardware.

## Change

`GpuSubmissionFence` places a WebGL2 fence after a render and flushes commands.
Following animation frames poll with zero timeout. Until the GPU acknowledges the
batch, no new render or drawing-buffer resize is submitted. There is at most one
frame in flight. No blocking `finish()` is used. Hidden-tab time is excluded from
the 15-second completion timeout; sync objects are released on completion/cleanup.

Mobile Auto and High prepare a new model/view in three sequential batches:

1. Render the full materials at the selected resolution with shadows disabled.
2. Generate the shadow map through the normal Three render lifecycle, skipping
   main-camera `renderBufferDirect` calls for this batch.
3. Render the final frame with the completed shadow map, without regenerating it.

Each batch must receive a GPU acknowledgement before the next begins. The loading
overlay remains until the final acknowledgement. This separates the initial work
and distinguishes material rendering, shadow production and shadow sampling in a
future failure report. It does not establish which operation caused prior resets.

The final quality profile, model, texture resolution, lighting, shadow filter and
map size are unchanged. Animated curtains still invalidate the shadow cache. A
view/quality change invalidates preparation; stale completions cannot mark the new
configuration ready. Adaptive changes are applied after the previous GPU batch.

Diagnostics now distinguish `*.submitted` from `renderer.gpu.complete` and
`model.gpu.ready`. Reports retain the pending batch, last acknowledged batch,
CPU submission time, observed acknowledgement delay and completed frame count.
The acknowledgement delay includes RAF scheduling and is not a GPU timer query.
GL errors are sampled only after startup/preparation acknowledgements.

## Local verification

- 109 tests passed, including eight tests for the fence lifecycle, bounded polling,
  context loss, timeout and background-tab pauses. Type check and production build passed.
- Apple M2 / Chromium, cold start at 448 × 850, native antialias disabled: full
  `first-room.glb`, DPR 2.5, 139,304 triangles, 1024 RGBA8 shadow target. GPU acknowledged
  294 main / 0 shadow draws, then 0 main / 103 shadow draws, then 294 main / 0 shadow
  draws. No GL or shader errors; normal animation at 30 FPS.
- Desktop and mobile profile transitions, curtain animation and interior views
  checked. A controlled context loss automatically recreated one canvas at the
  same selected High quality; this tests application recovery, not a driver reset.

The next physical-device report must be interpreted using acknowledged stages,
not the return from `renderer.render()` or the last object submitted.
