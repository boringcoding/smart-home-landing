import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { logDiagnostic, setGraphicsDiagnostics } from '../diagnostics';

/** Mobile edge smoothing without multisampled geometry/shadow buffers. */
export class SceneAntialias {
  depthBits=0;
  // Keep HDR until OutputPass performs ACES + sRGB, then FXAA samples display luminance.
  private readonly hdr=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false});
  private readonly display=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false});
  private readonly output=new OutputPass();
  private readonly fxaa=new ShaderPass(FXAAShader);
  private inspectFramebuffers=true;
  private rendered=false;
  constructor() {
    this.hdr.texture.name='scene-linear-hdr';this.display.texture.name='scene-display-srgb';
    this.output.renderToScreen=false;this.fxaa.renderToScreen=true;
    this.fxaa.material.toneMapped=false;
    // Retain grain detail while smoothing subpixel roof/siding edges.
    this.fxaa.material.fragmentShader=this.fxaa.material.fragmentShader.replace('float _SubpixelBlending = 1.0;','float _SubpixelBlending = 0.65;');
  }
  resize(width:number,height:number) {
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
    if(width!==this.hdr.width||height!==this.hdr.height){
      this.inspectFramebuffers=true;
      logDiagnostic('fxaa.resize',{width,height});
    }
    this.hdr.setSize(width,height);this.display.setSize(width,height);
    this.fxaa.uniforms.resolution.value.set(1/width,1/height);
  }
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera) {
    // Read GPU status only after allocation on the first frame or a resize.
    const inspect=this.inspectFramebuffers;
    if(inspect)logDiagnostic('fxaa.frame.begin',{first:!this.rendered,width:this.hdr.width,height:this.hdr.height});
    renderer.setRenderTarget(this.hdr);
    if(inspect){
      const gl=renderer.getContext();this.depthBits=gl.getParameter(gl.DEPTH_BITS);
      const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const detail={width:this.hdr.width,height:this.hdr.height,status,complete:status===gl.FRAMEBUFFER_COMPLETE,depthBits:this.depthBits,type:'HalfFloat'};
      setGraphicsDiagnostics({fxaaHdrFramebuffer:detail});
      logDiagnostic('fxaa.hdr-framebuffer',detail,detail.complete?'info':'error');
    }
    renderer.render(scene,camera);
    if(inspect)logDiagnostic('fxaa.output.begin');
    this.output.render(renderer,this.display,this.hdr,0,false);
    if(inspect){
      const gl=renderer.getContext(),status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const detail={width:this.display.width,height:this.display.height,status,complete:status===gl.FRAMEBUFFER_COMPLETE,type:'UnsignedByte'};
      setGraphicsDiagnostics({fxaaDisplayFramebuffer:detail});
      logDiagnostic('fxaa.display-framebuffer',detail,detail.complete?'info':'error');
      logDiagnostic('fxaa.resolve.begin');
    }
    this.fxaa.render(renderer,this.hdr,this.display,0,false);
    if(inspect){logDiagnostic('fxaa.frame.complete',{first:!this.rendered});this.inspectFramebuffers=false;this.rendered=true;}
  }
  dispose() {this.hdr.dispose();this.display.dispose();this.output.dispose();this.fxaa.dispose();}
}
