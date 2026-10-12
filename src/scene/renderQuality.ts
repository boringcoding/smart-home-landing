import type { UIState } from '../types';

export function renderQuality(quality:UIState['quality'],mobile:boolean,adaptiveReduced=false) {
  const economy=quality==='low';
  const high=quality==='high';
  const adaptive=quality==='auto'&&adaptiveReduced;
  return {
    label:economy?'Экономичный':mobile?(high?'Мобильный · высокое':'Мобильный · сбалансированный'):'Настольный',
    compactTextures:economy,
    // Keep mobile and recovery on the direct-render path without HDR targets.
    postprocessing:!mobile&&!economy,
    // Explicit high quality stays bounded; a phone is not permanently forced to low.
    pixelRatio:economy?1:mobile?(high?2.5:adaptive?1.5:2):(adaptive?1.5:2),
    pixelBudget:economy?650_000:mobile?(high?1_800_000:1_200_000):5_000_000,
    shadowSize:economy?0:(mobile||adaptive)?1024:2048,
    // Stock r181 shadows use RGBA8 packing, without sampled native depth textures.
    shadowFilter:'rgba8-pcf-soft' as const,
    pointLights:mobile||economy?3:6,
    anisotropy:economy?1:mobile?4:8,
    fps:mobile||economy?30:60,
  };
}

export function drawingPixelRatio(profile:ReturnType<typeof renderQuality>,width:number,height:number,nativeDpr:number,mobile:boolean) {
  // Supersample thin siding even on a low-DPI display at the mobile breakpoint.
  const desired=mobile?profile.pixelRatio:Math.min(Math.max(1,nativeDpr),profile.pixelRatio);
  return Math.min(desired,Math.sqrt(profile.pixelBudget/Math.max(1,width*height)));
}
