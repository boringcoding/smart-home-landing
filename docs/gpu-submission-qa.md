# GPU submission and startup verification

## Follow-up: receiver sampling isolated

The subsequent Pixel report for `0101029e` confirms the same failure twice with
an empty GPU queue between stages:

| Batch | Attempt 1 | Attempt 2 |
| --- | --- | --- |
| Full materials, DPR 2.5, anisotropy 4 | GPU complete; no GL errors | GPU complete; no GL errors |
| RGBA8 shadow generation, 103 draws | GPU complete; no GL errors | GPU complete; no GL errors |
| Main frame using the completed shadow map | Context lost; no GPU acknowledgement | Context lost; no GPU acknowledgement |

This excludes texture upload, model complexity, the drawing-buffer resolution and
shadow-map production as the operation at which these two runs failed. The failure
is isolated to the shadow-enabled receiver program. Shader errors with empty logs
still do not identify the exact GPU instruction or prove that Glass is at fault.

The targeted compatibility change is in `explicitShadowSampling.ts`: only the
depth lookup in `texture2DCompare` changes from `texture2D(depths, uv)` to
`textureLod(depths, uv, 0.0)`. The pinned renderer's shadow target uses one image
level, Nearest for both filters, ClampToEdge, no mipmaps and no anisotropic filter.
Both lookups therefore select the same base-level texel. All 16 actual PCF Soft
lookups, weights, depth comparisons, bias and intensity remain unchanged. Albedo
sampling, texture resolutions, DPR and shadow-map size are untouched.

Explicit LOD avoids implicit derivative selection in the receiver's conditional
shadow lookup, including code reached after clipping discard. This is a targeted
driver-path workaround, **not proof that undefined derivatives caused the GPU
reset**: this non-mipmapped texture need not use derivatives in the first place.
See [GLSL ES 3.00](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf),
texture lookup and uniform/non-uniform control flow sections.

The optional localhost-only `?validateShadows=1` fixture compares the stock and
explicit-LOD receiver pixels in the existing renderer/context. It runs after a
completed model frame while normal frame submission is suspended; production
Pages does not run this fixture. The result is recorded as
`shadow-sampling.validation`. Physical Pixel verification is still required.

Validation of the targeted change (Apple M2 / ANGLE Metal / Chromium 155):

- 112 automated tests passed; TypeScript and production build passed.
- Both RGBA8 comparison fixtures passed: 32,768 pixels, zero changed RGB or alpha
  pixels, maximum channel delta 0. Checksums were `5ccc8cf9` (unclipped) and
  `aff3615d` (divergent/clipped) for both variants. The fixtures included 5,174 and
  5,313 partially shadowed pixels respectively; they were not empty renders.
- Mobile High at DPR 2.5 completed material, shadow-map and receiver GPU batches.
  Interior, animated curtains, rapid Economy/High switching and whole-house views
  completed with no reported graphics errors. These are desktop-GPU checks with a
  mobile viewport, not a physical Pixel result.

## Historical baseline before staged startup (19761bce)

The Pixel 10 Pro XL failure is **not yet confirmed fixed on the physical device**.
The preceding device report tested build `19761bce` (Three r181, RGBA8 PCF Soft).
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
