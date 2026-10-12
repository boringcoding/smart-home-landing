# Packed shadow compatibility path — 2026-10-12

## Device evidence

The new device report identifies build 9b90924b, so the raw-depth software-PCF change was active. Economy rendered the model successfully. After the user's explicit High selection the empty scene continued for about 4.6 seconds while the full GLB downloaded. Its first render then took about 1.3 seconds, reported an unlinked/uncompiled shader with empty logs, and lost the GPU context shortly afterwards. Both statuses can also be a consequence of GPU reset; this does not establish a GLSL syntax error or identify a particular driver defect.

Direct GLB inspection found identical geometry, morphs, material definitions and features in full/mobile variants. Only two image sizes differ (1024² versus 512²). The High frame adds the shadow caster pass, including morphing/clipped curtains. Reducing all PBR materials is not justified by this evidence.

The previous change removed hardware shadow comparisons but still used native depth textures. This update removes that remaining path by pinning Three 0.181.2 and matching 0.181.0 types: its stock `PCFSoftShadowMap` stores packed RGBA depth in an ordinary unsigned-byte color texture with a depth renderbuffer. The custom r186 shader patch is removed. Custom depth materials explicitly use `RGBADepthPacking`, as required by the stock receiver. No dependency sources are edited.

Upstream source: [r181 shadow renderer](https://github.com/mrdoob/three.js/blob/r181/src/renderers/webgl/WebGLShadowMap.js), [r182 native depth implementation](https://github.com/mrdoob/three.js/blob/r182/src/renderers/webgl/WebGLShadowMap.js).

Full textures, PBR finishes, geometry, camera settings, 1024 mobile shadows, anisotropy 4 and bounded 2×/2.5× resolution are retained. Desktop also uses the same stock packed backend with its 2048 shadow map. Pinning an earlier renderer is a compatibility change, not proof of a particular hardware bug.

## Failure information and recovery

Shader errors now include the active object, material type, main/shadow pass, clipping and morph flags, shader source lengths and context-loss status. Loss events retain the last submitted draw. First-frame events and metrics expose the actual shadow target dimensions, color format/type and whether a native depth texture exists. These records remain local and contain no form/contact data.

The previous report also exposed a recovery defect: a persisted economy startup consumed the new page's retry allowance, while native restore could not restart the retired loader. Recovery now has one attempt per page, preserves the selected quality, and offers an explicit economy alternative. Quality changes on a failed scene remount it. Browser-block status still prevents retries.

## Validation

- 101 automated tests pass; TypeScript and production build pass. The new renderer contract test executes the dependency's shadow allocation/material-selection code with a renderer stub and verifies RGBA8, no sampled depth texture, packed custom depths and clipping.
- In local Chromium (Apple M2) at 448 × 850, repeated Economy → High rendered the full first-room GLB (6,948,928 bytes), 139,304 triangles, DPR 2.5 and 1024 shadows. Live target metadata confirms RGBA/UnsignedByte and `nativeDepthTexture: false`; default depth remains 24 bits.
- Desktop resizing also retained the full house, 2048 RGBA8 shadows, FXAA, 24-bit depth and 60 fps in the checked local sample.
- Cutaway, interior and moving/closed curtains rendered without shader errors. Auto retains full materials and DPR 2.
- Two deliberate context losses verified: the first automatically remounts once in High; the second stops with High still selected and separate same-quality/economy actions. Choosing Auto on the stopped scene restores one canvas and the full model. No shader or cleanup errors occurred in these checks.

The physical Pixel still needs to confirm compatibility; desktop viewport emulation cannot reproduce its GPU. Previous phone failures are not represented as passing tests.
