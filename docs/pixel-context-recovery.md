# Pixel context recovery — 2026-10-12

## Evidence from the two device reports

- Both reports were produced by build 9ab72b20 on the user's Pixel 10 Pro XL / Chrome 155.
- The first attempt failed before a context was created: Chromium's native reason was `Web page caused context loss and was blocked`.
- The second attempt obtained a PowerVR D-Series DXT-48-1536 context. Both FXAA targets reported framebuffer complete, and the first empty frame returned. The context was lost shortly afterwards, during the GLB response body, before GLB decode/commit. At loss only 12 geometries and 5 textures existed; no model geometry had reached the GPU.
- Recovery immediately attempted another context; Chromium rejected it with its page-block message. The blocked attempt was incorrectly reported as a generic load failure.

This localizes the observed failure to startup rendering, not model download/decode or model texture size. It does not identify a particular GPU instruction or prove which driver operation caused the reset. `floatLinear: false` is recorded, but is not by itself proof that half-float targets are unsupported in WebGL2.

## Change

Mobile Auto/High now render directly to the canvas without HDR/FXAA offscreen targets. Full model textures, bounded supersampling (2× / 2.5×), cached 1024 shadows and camera depth settings are preserved. Economy restores DPR 1 / anisotropy 1 and always disables postprocessing. Pipeline changes are applied when the profile changes, and displaced targets are disposed.

A single pre-created canvas captures native `webglcontextcreationerror` before Three replaces the reason with a generic constructor error. Explicit Chromium page blocks produce a separate status with browser reload instructions; no scene retry is offered in that state. GPU data is cleared between attempts so an unsuccessful replacement context does not appear to have the preceding context's capabilities.

Initialization now registers resource disposal incrementally; synchronous setup failure releases the already created renderer, observer and controls. Disposal does not request another artificial loss on an already lost context.

Chromium's browser-initiated reload/navigation can unblock a domain. A JavaScript scene restart cannot clear that browser state. Source: [Chromium WebContentsImpl](https://chromium.googlesource.com/chromium/src/+/176855dcc8b016411806e6b5380f39b061aba57f/content/browser/web_contents/web_contents_impl.cc). No security flags or browser protections are changed.

## Validation

- 91 automated tests pass; TypeScript and production build pass.
- At 448 × 850 CSS viewport in local Chromium, Auto/High use direct rendering, full models, 24-bit depth, 1024 shadows, DPR 2 / 2.5, one canvas and no postprocessing. High exterior held 30 fps in this environment. Economy uses DPR 1, no shadows, no postprocessing and compact textures.
- A scratch HTTP fixture returned the real Chromium rejection text through `webglcontextcreationerror`: the blocked UI appeared, native reason was retained, no model/canvas appeared, one initialization and zero retries occurred.
- A scratch fixture threw during ResizeObserver setup: the report recorded setup failure, the canvas was removed and cleanup had no errors.
- A real local WEBGL_lose_context test recovered into direct Economy with one canvas, no cleanup errors and zero FXAA frames. The original loss remained in the report.
- These are local browser checks, not validation on the physical Pixel. The next phone run must confirm the startup workaround.
