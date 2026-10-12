import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/** Mobile edge smoothing without multisampled geometry/shadow buffers. */
export class SceneAntialias {
  depthBits=0;
  // Keep HDR until OutputPass performs ACES + sRGB, then FXAA samples display luminance.
  private readonly hdr=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false});
  private readonly display=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false});
  private readonly output=new OutputPass();
  private readonly fxaa=new ShaderPass(FXAAShader);
  constructor() {
    this.hdr.texture.name='scene-linear-hdr';this.display.texture.name='scene-display-srgb';
    this.output.renderToScreen=false;this.fxaa.renderToScreen=true;
    this.fxaa.material.toneMapped=false;
    // Retain grain detail while smoothing subpixel roof/siding edges.
    this.fxaa.material.fragmentShader=this.fxaa.material.fragmentShader.replace('float _SubpixelBlending = 1.0;','float _SubpixelBlending = 0.65;');
  }
  resize(width:number,height:number) {
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
    this.hdr.setSize(width,height);this.display.setSize(width,height);
    this.fxaa.uniforms.resolution.value.set(1/width,1/height);
  }
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera) {
    renderer.setRenderTarget(this.hdr);
    if(!this.depthBits)this.depthBits=renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS);
    renderer.render(scene,camera);
    this.output.render(renderer,this.display,this.hdr,0,false);
    this.fxaa.render(renderer,this.hdr,this.display,0,false);
  }
  dispose() {this.hdr.dispose();this.display.dispose();this.output.dispose();this.fxaa.dispose();}
}
