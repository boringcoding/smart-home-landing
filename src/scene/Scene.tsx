import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SceneProps, SystemId } from '../types';
import { LEAK_SENSOR_AMOUNT } from '../state';
import { createElectricalLayer } from './ElectricalLayer';
import { LatestAssetLoader } from './LatestAssetLoader';
import { SerialDecoder } from './SerialDecoder';
import { SceneAntialias } from './SceneAntialias';
import { classifyWebGLCreationFailure } from './webglFailure';
import { drawingPixelRatio, renderQuality } from './renderQuality';
import { resizeDrawingBuffer } from './drawingBuffer';
import { GpuSubmissionFence } from './GpuSubmissionFence';
import { logDiagnostic, setGraphicsDiagnostics, setMetricsDiagnostics } from '../diagnostics';

type Device = {id:string;type:string;system:SystemId;room:string;nodes:string[];position:number[];sourcePosition?:number[];streamBottomPosition?:number[];sensorPosition?:number[];puddlePosition?:number[];cabinetNodes?:string[];inspectionBounds?:{min:number[];max:number[]};[key:string]:unknown};
type Room = {id:string;label:string;center:number[];bounds?:{min:number[];max:number[]}};
type Registry = {rooms:Room[];devices:Device[];cameras:unknown;architectureGroups:Record<string,string[]>;resources?:unknown;environment?:{groundY?:number}};
const v3 = (a:number[]) => new THREE.Vector3(a[0],a[1],a[2]);
const smooth = (a:number,b:number,dt:number,speed=5) => THREE.MathUtils.lerp(a,b,1-Math.exp(-speed*dt));
// Shared across React remounts: an in-flight decoder must finish before its replacement starts.
const decoder = new SerialDecoder();
let sceneSequence=0;
const errorDetail=(error:unknown)=>error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error);

export default function Scene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    const element=host.current!;
    const sceneId=++sceneSequence;
    const logScene=(stage:string,detail:Record<string,unknown>={},level:'info'|'warn'|'error'='info')=>logDiagnostic(stage,{sceneId,...detail},level);
    element.dataset.environment=JSON.stringify({userAgent:navigator.userAgent,dpr:devicePixelRatio,startedAt:new Date().toISOString()});
    let disposed=false,raf=0,model:THREE.Group|null=null,registry:Registry|null=null,assetKey='',loadedBytes=0,loadMs=0;
    let renderFailed=false,firstFrame=true,awaitingModelFrame=false,lastMetrics:Record<string,unknown>|null=null,loadingKey='';
    const isMobile=() => element.clientWidth<700 || matchMedia('(pointer: coarse)').matches;
    let lastQuality='',mobileViewport=isMobile(),autoDegraded=false;
    let profile=renderQuality(latest.current.ui.quality,mobileViewport);
    let shadowsDirty=true,lastShadowAt=0,curtainShadowState='';
    let diagnosticRequest=latest.current.diagnosticContextLossRequest??0,diagnosticLossPending=false;
    let renderer:THREE.WebGLRenderer;
    let drawObject:THREE.Object3D|null=null,drawGeometry:THREE.BufferGeometry|null=null;
    let drawMaterial:(THREE.Material & {map?:THREE.Texture|null;depthPacking?:number})|null=null,drawPass='';
    type PreparationPass='materials'|'shadow-map'|'shadowed-frame';
    type Submission={generation:number;configuration:string;pass:PreparationPass|'frame';model:string;firstFrame:boolean;firstModelFrame:boolean;submitCpuMs?:number;calls?:number;shadowCalls?:number};
    let generation=0,preparation:PreparationPass|null=null,submissionPass:Submission['pass']='frame';
    let submittedFrames=0,completedFrames=0,lastGpuWaitMs=0,skippedGpuFrames=0;
    let pendingSubmission:Submission|null=null,lastGpuCompletion:Record<string,unknown>|null=null;
    const describeDraw=()=>drawMaterial&&drawGeometry&&drawObject?{
      pass:drawPass,object:drawObject.name,material:drawMaterial.name,materialType:drawMaterial.type,
      clippingPlanes:drawMaterial.clippingPlanes?.length??0,clipIntersection:drawMaterial.clipIntersection,
      morphPositions:drawGeometry.morphAttributes.position?.length??0,morphNormals:drawGeometry.morphAttributes.normal?.length??0,
      map:!!drawMaterial.map,side:drawMaterial.side,depthPacking:drawMaterial.depthPacking??null,
    }:null;
    const disposers:Array<()=>void>=[];
    const disposeResources=()=>{
      if(disposed)return;
      disposed=true;cancelAnimationFrame(raf);
      for(const dispose of disposers.reverse()){
        try{dispose();}catch(error){logScene('scene.cleanup.error',{error:errorDetail(error)},'warn');}
      }
    };
    const started=performance.now();
    logScene('scene.init',{quality:latest.current.ui.quality,mobile:mobileViewport,profile:profile.label,width:element.clientWidth,height:element.clientHeight,nativeDpr:devicePixelRatio});
    setGraphicsDiagnostics({sceneId,contextLost:false,contextStatusMessage:'',nativeContextRestored:false,creationFailure:null,gpu:null,contextAttributes:null,limits:null,extensions:null,viewport:null,quality:latest.current.ui.quality,profile:profile.label,renderProfile:profile,shadowFilter:null,postprocessing:null,smoothing:null,fxaaHdrFramebuffer:null,fxaaDisplayFramebuffer:null,gpuPreparation:null,gpuQueueLimit:1});
    setMetricsDiagnostics({sceneId,phase:'initializing'});
    logScene('renderer.create.begin');
    // Capture the browser's original rejection before Three replaces it with a
    // generic constructor error. Reuse this single canvas, never probe a second context.
    const canvas=document.createElement('canvas');
    const creationMessages:string[]=[];
    const contextCreationError=(event:Event)=>{
      const message=(event as WebGLContextEvent).statusMessage??'';
      if(message&&!creationMessages.includes(message))creationMessages.push(message.slice(0,2000));
      logScene('renderer.context.creation-error',{statusMessage:message},'error');
    };
    canvas.addEventListener('webglcontextcreationerror',contextCreationError);
    try { renderer=new THREE.WebGLRenderer({canvas,antialias:!mobileViewport&&latest.current.ui.quality!=='low',alpha:false,powerPreference:mobileViewport?'default':'high-performance'}); }
    catch (error) {
      const failure=classifyWebGLCreationFailure(creationMessages,error);
      logScene('renderer.create.error',{...failure,error:errorDetail(error)},'error');
      setGraphicsDiagnostics({creationFailure:failure});
      latest.current.onStatus?.(failure.kind==='blocked'?'blocked':'error',failure.message);
      return;
    } finally {canvas.removeEventListener('webglcontextcreationerror',contextCreationError);}
    disposers.push(()=>{renderer.dispose();if(!renderer.getContext().isContextLost())renderer.forceContextLoss();canvas.remove();});
    try {
    // Three r181 requires WebGL2; its published type still includes WebGL1.
    const gl=renderer.getContext() as WebGL2RenderingContext,contextAttributes=gl.getContextAttributes();
    const gpuFence=new GpuSubmissionFence<Submission>(gl);
    disposers.push(()=>gpuFence.dispose());
    const visibilityChanged=()=>{if(document.hidden)gpuFence.pause();else gpuFence.resume();};
    document.addEventListener('visibilitychange',visibilityChanged);
    disposers.push(()=>document.removeEventListener('visibilitychange',visibilityChanged));
    const prepareModel=(reason:string)=>{
      generation++;
      preparation=mobileViewport&&profile.shadowSize>0?'materials':null;
      awaitingModelFrame=true;
      logScene('renderer.preparation.begin',{generation,reason,model:loadingKey||assetKey,passes:preparation?['materials','shadow-map','shadowed-frame']:['frame'],profile:profile.label});
      setGraphicsDiagnostics({gpuPreparation:{generation,pass:preparation??'frame',complete:false},gpuQueueLimit:1});
      latest.current.onStatus?.('loading','Подготавливаем материалы и освещение');
    };
    logScene('renderer.create.complete',{contextAttributes});
    renderer.debug.onShaderError=(context,program,vertex,fragment)=>{
      logScene('renderer.shader.error',{
        model:loadingKey||assetKey,profile:profile.label,
        contextLost:context.isContextLost(),draw:describeDraw(),
        vertexSourceLength:context.getShaderSource(vertex)?.length??null,fragmentSourceLength:context.getShaderSource(fragment)?.length??null,
        linked:context.getProgramParameter(program,context.LINK_STATUS),
        vertexCompiled:context.getShaderParameter(vertex,context.COMPILE_STATUS),fragmentCompiled:context.getShaderParameter(fragment,context.COMPILE_STATUS),
        programLog:context.getProgramInfoLog(program)?.slice(0,6000),vertexLog:context.getShaderInfoLog(vertex)?.slice(0,6000),fragmentLog:context.getShaderInfoLog(fragment)?.slice(0,6000),
      },'error');
    };
    try {
      const debug=gl.getExtension('WEBGL_debug_renderer_info');
      const graphics={sceneId,threeRevision:THREE.REVISION,contextAttributes,
        gpu:{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)},
        limits:{maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),maxViewportDims:Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array),maxTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),maxVertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),maxSamples:'MAX_SAMPLES' in gl?gl.getParameter(gl.MAX_SAMPLES):null,defaultDepthBits:gl.getParameter(gl.DEPTH_BITS),maxAnisotropy:renderer.capabilities.getMaxAnisotropy()},
        extensions:{colorBufferFloat:!!gl.getExtension('EXT_color_buffer_float'),floatLinear:!!gl.getExtension('OES_texture_float_linear'),parallelShaderCompile:!!gl.getExtension('KHR_parallel_shader_compile'),debugRendererInfo:!!debug},
      };
      setGraphicsDiagnostics(graphics);logScene('renderer.capabilities',graphics);
    } catch(error){logScene('renderer.capabilities.error',{error:errorDetail(error)},'warn');}
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
    renderer.shadowMap.enabled=profile.shadowSize>0;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.localClippingEnabled=true;
    renderer.setClearColor('#e9ece3');
    renderer.domElement.setAttribute('aria-label','Трёхмерная модель дома. Перетаскивайте для вращения, используйте кнопки видов и комнат для навигации.');
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('tabindex','0');
    element.appendChild(renderer.domElement);
    let smoothing:SceneAntialias|null=null;
    disposers.push(()=>smoothing?.dispose());
    const updatePipeline=()=>{
      const enablePostprocessing=profile.postprocessing&&!contextAttributes?.antialias&&renderer.extensions.has('EXT_color_buffer_float');
      if(enablePostprocessing&&!smoothing)smoothing=new SceneAntialias();
      else if(!enablePostprocessing&&smoothing){renderer.setRenderTarget(null);smoothing.dispose();smoothing=null;}
      const pipeline={smoothing:smoothing?'FXAA':contextAttributes?.antialias?'MSAA':profile.pixelRatio>1?'supersampling':'none',postprocessing:!!smoothing,profile:profile.label,shadowFilter:profile.shadowSize?profile.shadowFilter:'off'};
      setGraphicsDiagnostics({...pipeline,...(!smoothing?{fxaaHdrFramebuffer:null,fxaaDisplayFramebuffer:null}:{})});
      logScene('renderer.pipeline',pipeline);
    };
    updatePipeline();
    const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e9ece3',38,85);
    const camera=new THREE.PerspectiveCamera(38,1,.2,100);camera.position.set(9,9,12);
    const renderChoice=()=>{const u=latest.current.ui;return [u.quality,u.view,u.room,u.system,u.cameraRevision,!!u.electrical?.enabled,u.electrical?.selectedId,mobileViewport,Math.round(camera.aspect*100)].join(':');};
    let mainCalls=0,shadowCalls=0,mainTriangles=0;
    const renderDirect=renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect=(renderCamera,...args)=>{
      // Run shadow preparation through Three's normal render lifecycle, with
      // its own light/clipping state. Only omit main draws for this one pass.
      if(submissionPass==='shadow-map'&&renderCamera===camera)return;
      const callsBefore=renderer.info.render.calls,trianglesBefore=renderer.info.render.triangles;
      // Retain references only; serialize on failure, without allocating a
      // diagnostic object for each of the hundreds of draws every frame.
      drawGeometry=args[1];drawMaterial=args[2];drawObject=args[3];drawPass=renderCamera===camera?'main':'shadow';
      renderDirect(renderCamera,...args);
      if(renderCamera===camera){mainCalls+=renderer.info.render.calls-callsBefore;mainTriangles+=renderer.info.render.triangles-trianglesBefore;}else if(renderCamera===sun.shadow.camera){shadowCalls+=renderer.info.render.calls-callsBefore;}
    };
    const controls=new OrbitControls(camera,renderer.domElement);disposers.push(()=>controls.dispose());
    controls.target.set(1.3,.7,1.3);controls.enableDamping=true;controls.dampingFactor=.075;
    controls.minDistance=4.5;controls.maxDistance=28;controls.minPolarAngle=.2;controls.maxPolarAngle=1.31;
    controls.enablePan=false;controls.zoomSpeed=.55;controls.rotateSpeed=.6;
    controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    const resize=()=>{
      const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;
      if(mobileViewport!==isMobile()){mobileViewport=isMobile();lastQuality='';}
      // Never replace the drawing buffer while its previous frame is in flight.
      if(gpuFence.hasPending)return;
      const ratio=drawingPixelRatio(renderQuality(latest.current.ui.quality,mobileViewport,autoDegraded),w,h,devicePixelRatio,mobileViewport);
      const changed=resizeDrawingBuffer(renderer,w,h,ratio);
      // A new postprocessing pipeline still needs sizing when the canvas size is unchanged.
      smoothing?.resize(w*ratio,h*ratio);
      if(!changed)return;
      camera.aspect=w/h;camera.updateProjectionMatrix();
      const viewport={width:w,height:h,pixelRatio:ratio,bufferWidth:renderer.domElement.width,bufferHeight:renderer.domElement.height};
      setGraphicsDiagnostics({viewport});logScene('renderer.resize.complete',viewport);
    };
    const observer=new ResizeObserver(resize);disposers.push(()=>observer.disconnect());observer.observe(element);resize();
    const hemisphere=new THREE.HemisphereLight('#e9efff','#a59a83',1.15);scene.add(hemisphere);
    const sun=new THREE.DirectionalLight('#fff3dc',3.1);disposers.push(()=>sun.shadow.dispose());sun.position.set(9,12,3);sun.castShadow=profile.shadowSize>0;
    const shadowTarget=()=>sun.shadow.map?{width:sun.shadow.map.width,height:sun.shadow.map.height,colorType:sun.shadow.map.texture.type,colorFormat:sun.shadow.map.texture.format,nativeDepthTexture:!!sun.shadow.map.depthTexture}:null;
    Object.assign(sun.shadow.camera,{left:-10,right:10,top:11,bottom:-11,near:.5,far:40});
    sun.shadow.mapSize.set(profile.shadowSize||1024,profile.shadowSize||1024);sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
    const windowLight=new THREE.PointLight('#e2edff',12,7,2);windowLight.position.set(3.5,1.55,1.45);scene.add(windowLight);
    const screenLight=new THREE.PointLight('#8caeff',0,4,2);screenLight.position.set(-1.0,1.2,1.3);scene.add(screenLight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#dedfd4',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.924;ground.receiveShadow=true;scene.add(ground);
    const electrical=createElectricalLayer();scene.add(electrical.root);disposers.push(()=>{scene.remove(electrical.root);electrical.dispose();});
    // A low-power viewing fill keeps finishes readable when inspecting enclosed rooms.
    const inspectionLight=new THREE.PointLight('#fff5e5',0,7,2);scene.add(inspectionLight);
    const engineering=new THREE.Group();engineering.name='engineering-proposal';scene.add(engineering);
    const heatMat=new THREE.MeshBasicMaterial({color:'#ed9253',transparent:true,opacity:.8});
    for(let i=0;i<7;i++){
      const pts=[new THREE.Vector3(-.8+i*.55,.035,.05),new THREE.Vector3(-.8+i*.55,.035,2.6)];
      engineering.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),1,.018,5,false),heatMat));
    }
    // Water geometry is anchored to the actual sink assembly in the registry.
    const stream=new THREE.Mesh(new THREE.CylinderGeometry(.009,.015,1,10),new THREE.MeshStandardMaterial({color:'#79b6c3',transparent:true,opacity:.72,roughness:.12,depthWrite:false}));stream.visible=false;scene.add(stream);
    const runoff=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:'#73a8b5',transparent:true,opacity:.58,roughness:.15,depthWrite:false,side:THREE.DoubleSide}));runoff.visible=false;scene.add(runoff);
    let waterAnchor:Device|undefined,puddleScaleAtSensor=1,streamConfigured=false;
    const tvCanvas=document.createElement('canvas');tvCanvas.width=512;tvCanvas.height=288;
    const tvContext=tvCanvas.getContext('2d')!;const tvTexture=new THREE.CanvasTexture(tvCanvas);tvTexture.colorSpace=THREE.SRGBColorSpace;tvTexture.flipY=false;
    disposers.push(()=>tvTexture.dispose());
    let previousVideoTime=-2;
    const tvMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,emissive:0xffffff,emissiveIntensity:.6,map:tvTexture,emissiveMap:tvTexture});
    disposers.push(()=>tvMaterial.dispose());
    const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
    const nodes=new Map<string,THREE.Object3D>(), deviceNodes=new Map<SystemId,THREE.Object3D[]>();
    const dynamicMaterials=new Map<string,THREE.MeshStandardMaterial[]>();
    const baseRotations=new Map<string,THREE.Quaternion>(),baseScales=new Map<string,THREE.Vector3>();
    const cutPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),.82);
    let cabinetCut:THREE.Plane[]=[];
    let selection=new THREE.Group();scene.add(selection);
    let cameraMove:{from:THREE.Vector3;targetFrom:THREE.Vector3;to:THREE.Vector3;target:THREE.Vector3;t:number}|null=null;
    let lastView='',lastSelection='',lost=false,frames:number[]=[],last=performance.now(),metricAt=last,slowSamples=0;
    const release=(group:THREE.Object3D)=>{
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
      group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geometries.add(o.geometry);const ownedMaterials=[...(Array.isArray(o.material)?o.material:[o.material]),...(o.customDepthMaterial?[o.customDepthMaterial]:[]),...(o.customDistanceMaterial?[o.customDistanceMaterial]:[])];for(const m of ownedMaterials){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture&&value!==tvTexture)textures.add(value);}}});
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>{if(m!==tvMaterial)m.dispose();});
      const bitmaps=new Set<ImageBitmap>();
      textures.forEach(t=>{if(typeof ImageBitmap!=='undefined'&&t.source.data instanceof ImageBitmap)bitmaps.add(t.source.data);t.dispose();});
      bitmaps.forEach(bitmap=>bitmap.close());
    };
    disposers.push(()=>{scene.remove(electrical.root);release(scene);});
    let loadStarted=0,loadAttempt=0;
    const modelLoader=new LatestAssetLoader<GLTF>({
      start:key=>{
        loadingKey=key;loadAttempt++;
        generation++;preparation=null;awaitingModelFrame=false;
        logScene('model.load.begin',{attempt:loadAttempt,model:key,previousModel:assetKey||null});
        latest.current.onStatus?.('loading');loadStarted=performance.now();loadedBytes=0;
        // Release the current GLB before downloading/decoding its replacement.
        // The loading overlay hides the gap and peak memory stays at one model.
        if(model){scene.remove(model);release(model);model=null;}
        shadowsDirty=true;
        scene.remove(selection);release(selection);selection=new THREE.Group();scene.add(selection);
        nodes.clear();deviceNodes.clear();dynamicMaterials.clear();baseRotations.clear();baseScales.clear();
        renderer.renderLists.dispose();
      },
      load:async(key,signal)=>{
        const attempt=loadAttempt;let phase='fetch';
        try {
          logScene('model.fetch.begin',{attempt,model:key});
          const response=await fetch(`${import.meta.env.BASE_URL}models/${key}.glb`,{signal});
          logScene('model.fetch.response',{attempt,model:key,status:response.status,ok:response.ok,contentType:response.headers.get('content-type'),contentLength:response.headers.get('content-length')});
          if(!response.ok)throw new Error(`Model HTTP ${response.status}`);
          phase='body';const buffer=await response.arrayBuffer();signal.throwIfAborted();
          loadedBytes=buffer.byteLength;
          logScene('model.fetch.complete',{attempt,model:key,bytes:buffer.byteLength});
          // Parsing cannot be cancelled; LatestAssetLoader serializes it and disposes stale results.
          phase='decode-queue';logScene('model.decode.queued',{attempt,model:key});
          return await decoder.run(async()=>{
            phase='decode';const decodeStarted=performance.now();
            logScene('model.decode.begin',{attempt,model:key});
            const result=await loader.parseAsync(buffer,`${import.meta.env.BASE_URL}models/`);
            logScene('model.decode.complete',{attempt,model:key,ms:Math.round(performance.now()-decodeStarted),stale:signal.aborted});
            return result;
          },signal);
        } catch(error){logScene(signal.aborted?'model.load.cancelled':'model.load.error',{attempt,model:key,phase,error:errorDetail(error)},signal.aborted?'info':'error');throw error;}
      },
      release:result=>{logScene('model.decoded.release',{attempt:loadAttempt,model:loadingKey,disposed});release(result.scene);},
      commit:(result,key)=>{
        logScene('model.commit.begin',{attempt:loadAttempt,model:key});
        model=result.scene;assetKey=key.replace(/-mobile$/,'');
        const originalMaterials=new Set<THREE.Material>();
        model.traverse(o=>{
          nodes.set(o.name,o);baseRotations.set(o.name,o.quaternion.clone());baseScales.set(o.name,o.scale.clone());
          if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;
            // Keep clipping/morph shadow variants within the GLB lifetime.
            // The pinned renderer reads packed RGBA, not a sampled DepthTexture.
            o.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
            o.customDepthMaterial.name=`${o.name}:shadow-depth`;
            o.customDistanceMaterial=new THREE.MeshDistanceMaterial();
            o.customDistanceMaterial.name=`${o.name}:shadow-distance`;
            const original=Array.isArray(o.material)?o.material:[o.material];
            original.forEach(m=>originalMaterials.add(m));
            const materials=original.map(m=>m.clone()) as THREE.MeshStandardMaterial[];o.material=Array.isArray(o.material)?materials:materials[0];
            dynamicMaterials.set(o.name,materials);
            for(const m of materials){if(m.transparent){o.castShadow=false;m.depthWrite=false;}m.clipShadows=true;for(const value of Object.values(m)){if(value instanceof THREE.Texture)value.anisotropy=Math.min(profile.anisotropy,renderer.capabilities.getMaxAnisotropy());}}
          }
        });
        originalMaterials.forEach(material=>material.dispose());
        for(const device of registry!.devices){
          const found=device.nodes.map(n=>nodes.get(n)).filter((n):n is THREE.Object3D=>Boolean(n));
          deviceNodes.set(device.system,[...(deviceNodes.get(device.system)??[]),...found]);
          for(const node of found){node.userData.system=device.system;node.userData.deviceRoom=device.room;node.traverse(child=>{child.userData.system=device.system;child.userData.deviceRoom=device.room});}
        }
        const television=nodes.get('tv_screen');if(television instanceof THREE.Mesh){const old=Array.isArray(television.material)?television.material:[television.material];old.forEach(m=>m.dispose());television.material=tvMaterial;}
        const puddle=nodes.get('leak_water');
        if(puddle&&waterAnchor?.sensorPosition){
          const bounds=new THREE.Box3().setFromObject(puddle),center=puddle.getWorldPosition(new THREE.Vector3()),sensor=v3(waterAnchor.sensorPosition);
          const halfX=Math.max(.01,(bounds.max.x-bounds.min.x)/2),halfZ=Math.max(.01,(bounds.max.z-bounds.min.z)/2);
          puddleScaleAtSensor=Math.hypot((sensor.x-center.x)/halfX,(sensor.z-center.z)/halfZ);
        }
        scene.add(model);shadowsDirty=true;lastView='';lastSelection='';loadMs=performance.now()-loadStarted;
        logScene('model.commit.ready',{attempt:loadAttempt,model:key,nodes:nodes.size,bytes:loadedBytes,loadMs:Math.round(loadMs)});
        prepareModel('model-commit');
      },
      error:(error,key)=>{if(!disposed&&!lost&&!renderFailed){logScene('model.failed',{attempt:loadAttempt,model:key,error:errorDetail(error)},'error');latest.current.onStatus?.('error','Модель не загрузилась. Проверьте соединение и повторите загрузку сцены. Комплектация и настройки сохранены.');}},
    });
    const requestModel=()=>{
      if(!registry||disposed||lost||renderFailed)return;
      const {ui}=latest.current;
      const key=ui.view==='house'||ui.room!=='living'?'house':'first-room';
      modelLoader.request(key+(profile.compactTextures?'-mobile':''));
    };
    disposers.push(()=>modelLoader.dispose());
    const registryAbort=new AbortController();disposers.push(()=>registryAbort.abort());
    logScene('registry.fetch.begin');
    fetch(`${import.meta.env.BASE_URL}scene-registry.json`,{signal:registryAbort.signal}).then(r=>{logScene('registry.fetch.response',{status:r.status,ok:r.ok});if(!r.ok)throw Error('Реестр сцены недоступен');return r.json()}).then((r:Registry)=>{if(disposed||lost||renderFailed)return;registry=r;logScene('registry.ready',{rooms:r.rooms.length,devices:r.devices.length});ground.position.y=(r.environment?.groundY??-.914)-.01;
      const television=r.devices.find(d=>d.id==='tv_living');if(television)screenLight.position.copy(v3(television.position)).add(new THREE.Vector3(.25,0,0));
      waterAnchor=r.devices.find(d=>d.id==='leak');
      if(waterAnchor?.sourcePosition&&waterAnchor.streamBottomPosition){
        const source=v3(waterAnchor.sourcePosition),bottom=v3(waterAnchor.streamBottomPosition),direction=source.clone().sub(bottom);
        stream.position.copy(source).add(bottom).multiplyScalar(.5);stream.scale.y=direction.length();stream.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        const end=v3(waterAnchor.puddlePosition??waterAnchor.position),along=end.clone().sub(bottom).setY(0).normalize(),side=new THREE.Vector3(along.z,0,-along.x).multiplyScalar(.027);
        const start=bottom.clone().setY(end.y+.004),finish=end.clone().setY(end.y+.004);
        const corners=[start.clone().add(side),start.clone().sub(side),finish.clone().add(side),finish.clone().sub(side)];
        runoff.geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,2,1,3].flatMap(i=>corners[i].toArray()),3));runoff.geometry.computeVertexNormals();streamConfigured=true;
      }
      if(waterAnchor?.inspectionBounds){
        const {min,max}=waterAnchor.inspectionBounds;
        // Open only the lower sink-cabinet volume, retaining the basin and worktop.
        const lo=[min[0]-.006,min[1]+.085,min[2]-.006],hi=[max[0]+.006,Math.min(max[1],min[1]+.67),max[2]+.012];
        cabinetCut=[new THREE.Plane(new THREE.Vector3(1,0,0),-hi[0]),new THREE.Plane(new THREE.Vector3(-1,0,0),lo[0]),new THREE.Plane(new THREE.Vector3(0,1,0),-hi[1]),new THREE.Plane(new THREE.Vector3(0,-1,0),lo[1]),new THREE.Plane(new THREE.Vector3(0,0,1),-hi[2]),new THREE.Plane(new THREE.Vector3(0,0,-1),lo[2])];
      }
      requestModel();}).catch(error=>{if(!disposed&&!lost&&!renderFailed){logScene('registry.error',{error:errorDetail(error)},'error');latest.current.onStatus?.('error',String(error));}});
    const applyView=()=>{
      const {ui}=latest.current,key=ui.view+':'+ui.room+':'+ui.system+':'+ui.cameraRevision+':'+ui.electrical?.enabled+':'+ui.electrical?.selectedId+':'+mobileViewport+':'+Math.round(camera.aspect*100);
      if(key===lastView||!model||!registry)return;
      const previousView=lastView;lastView=key;shadowsDirty=true;
      if(mobileViewport&&profile.shadowSize>0&&previousView)prepareModel('view-change');
      const house=ui.view==='house',engineer=ui.view==='engineering',interior=ui.view==='interior',waterInspection=engineer&&ui.system==='water'&&ui.room==='living'&&!ui.electrical?.enabled;
      const electricalFocus=ui.electrical?.enabled&&ui.electrical.selectedId?electrical.focus(ui.electrical.selectedId):null;
      cutPlane.constant=ui.electrical?.enabled?(electricalFocus?.cutHeight??1.25):.82;
      model.traverse(o=>{
        let owner:THREE.Object3D|null=o;while(owner&&!owner.userData.category)owner=owner.parent;
        const category=owner?.userData.category??'',name=(owner?.name??o.name).toLowerCase();
        const roof=category==='roof'||name==='roof'||(registry!.architectureGroups.roof??[]).includes(o.name);
        if(roof)o.visible=house||interior;
        if(category==='ceiling')o.visible=house||interior;
        if(owner?.userData.component==='pile')o.visible=false;
        if((category==='window'||category==='door')&&owner?.userData.facade==='south')o.visible=house||interior;
        if(o instanceof THREE.Mesh){
          const wall=category==='wall'||name.startsWith('wall_')||(registry!.architectureGroups.walls??[]).includes(o.name);
          const sinkCabinet=waterAnchor?.cabinetNodes?.includes(owner?.name??o.name)??false;
          const facade=owner?.userData.facade??(name.includes('south')?'south':name.includes('east')?'east':'');
          const curtainInCutaway=name.startsWith('curtains_living_panorama')&&ui.system!=='curtains';
          const clip=!house&&!interior&&(curtainInCutaway||wall&&(engineer||ui.room!=='living'||facade==='south'||facade==='east'));
          for(const m of Array.isArray(o.material)?o.material:[o.material]){const planes=waterInspection&&sinkCabinet?cabinetCut:clip?[cutPlane]:[];if(m.clippingPlanes?.length!==planes.length){m.clippingPlanes=planes;m.clipIntersection=planes===cabinetCut;m.needsUpdate=true;}}
        }
      });
      engineering.visible=engineer&&ui.system!=='water'&&!ui.electrical?.enabled;
      let pos=new THREE.Vector3(11,11,13),target=new THREE.Vector3(0,.6,.8);
      if(interior){
        const room=registry.rooms.find(r=>r.id===ui.room)??registry.rooms[0];
        const viewpoints:Record<string,{eye:number[];look:number[]}>= {
          living:{eye:[-.4,1.48,2.35],look:[2.5,1.45,.25]},
          bedroom_west:{eye:[-.65,1.46,-.98],look:[-2.8,1.45,-2.6]},
          bedroom_east:{eye:[.66,1.46,-.98],look:[2.9,1.45,-2.65]},
          bathroom:{eye:[-3.30,1.48,-.05],look:[-2.08,.90,1.24]},
          entry:{eye:[-1.91,1.44,1.99],look:[-2.95,1.04,2.72]},
        };
        if(room.id==='living'&&ui.system==='curtains')viewpoints.living={eye:[.45,1.50,-.03],look:[.6,1.82,2.95]};
        if(room.id==='living'&&ui.system==='media'){const tv=registry.devices.find(d=>d.id==='tv_living');if(tv)viewpoints.living={eye:[tv.position[0]+2.8,1.47,tv.position[2]+.05],look:tv.position};}
        if(room.id==='bathroom'&&ui.system==='curtains')viewpoints.bathroom={eye:[-1.97,1.46,0],look:[-3.7,1.15,.58]};
        const point=viewpoints[room.id];pos.copy(point?v3(point.eye):v3(room.center).setY(1.46));
        const direction=(point?v3(point.look):v3(room.center).add(new THREE.Vector3(0,.5,-1))).sub(pos).normalize();
        // A tiny orbit radius gives stationary look-around without crossing walls.
        target.copy(pos).addScaledVector(direction,.005);
        camera.fov=72;camera.near=.025;camera.far=50;camera.updateProjectionMatrix();
        cameraMove=null;camera.position.copy(pos);controls.target.copy(target);
        controls.minDistance=.005;controls.maxDistance=.005;controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI-.15;controls.enableZoom=false;
        return;
      }
      if(house){pos.set(13,8.5,17);target.set(0,.7,1.3);}
      else if(ui.room==='living'){pos.set(7,6.4,8);target.set(1.2,.75,1.2);
        if(waterInspection&&waterAnchor){target.copy(v3(waterAnchor.position)).setY(.30).add(new THREE.Vector3(-.03,0,.05));pos.set(waterAnchor.position[0],1.0,waterAnchor.position[2]+.59);}
        if(ui.system==='curtains'){pos.set(.7,3.8,5.6);target.set(3.55,1.05,1.45);}
        if(ui.system==='media'){const tv=registry.devices.find(d=>d.id==='tv_living');if(tv){target.copy(v3(tv.position));pos.copy(target).add(new THREE.Vector3(4.0,1.6,.3));}}
      }
      else{const room=registry.rooms.find(r=>r.id===ui.room);if(room){target.copy(v3(room.center));target.y=.6;pos.copy(target).add(new THREE.Vector3(4.5,8,6));}}
      if(ui.electrical?.enabled){
        const focus=electricalFocus;
        if(focus){pos.copy(focus.position);target.copy(focus.target);}
        else if(ui.room==='all'){pos.set(9,12,14);target.set(0,.5,1.3);}
      }
      if(isMobile()){pos.sub(target).multiplyScalar(ui.electrical?.enabled&&ui.room==='all'?1.22:1.12).add(target);}
      camera.fov=waterInspection?62:electricalFocus&&(ui.room==='entry'||ui.room==='bathroom')?58:38;camera.near=house ? .5 : (waterInspection||electricalFocus) ? .08 : .2;camera.far=100;camera.updateProjectionMatrix();controls.enableZoom=true;controls.minPolarAngle=.2;controls.maxPolarAngle=1.45;
      cameraMove={from:camera.position.clone(),targetFrom:controls.target.clone(),to:pos,target,t:ui.reducedMotion?1:0};
      controls.minDistance=house ? 10 : (waterInspection||ui.electrical?.enabled) ? .55 : 4.5;controls.maxDistance=house?30:waterInspection?7:22;
    };
    const setGlow=(name:string,value:number,color:string)=>{for(const m of dynamicMaterials.get(name)??[]){if(m.emissive){m.emissive.set(color);m.emissiveIntensity=value*1.8;}}};
    const updateDevices=(dt:number,now:number)=>{
      const {state,ui}=latest.current,d=state.devices,day=state.demo.daylight;
      electrical.update(state,ui,assetKey,profile.pointLights);
      sun.intensity=smooth(sun.intensity,day*3.2,dt);hemisphere.intensity=smooth(hemisphere.intensity,.18+day*.85,dt);
      // One daylight fill follows the inspected room instead of four permanently active lights.
      const room=registry?.rooms.find(room=>room.id===ui.room&&room.id!=='living');
      const closed=d.curtainsByRoom[room?.id??'living']?.current??0;
      windowLight.position.set(room?.center[0]??3.5,room?2.14:1.55,room?.center[2]??1.45);
      windowLight.intensity=smooth(windowLight.intensity,day*(room?11:20)*(1-.93*closed),dt);windowLight.visible=windowLight.intensity>.02;
      inspectionLight.intensity=ui.view==='interior'?2.0:ui.view==='engineering'&&ui.system==='water'&&ui.room==='living'&&!ui.electrical?.enabled?1.4:0;inspectionLight.position.copy(camera.position);inspectionLight.visible=inspectionLight.intensity>0;
      screenLight.intensity=d.media.playing?2.5:0;screenLight.visible=!mobileViewport&&!profile.compactTextures&&d.media.playing&&(ui.room==='living'||ui.view==='house');
      const livingLight=state.config.systems.lighting&&state.config.rooms.includes('living')?1:0;
      const exteriorLight=state.config.systems.lighting&&state.config.rooms.includes('entry')?1:0;
      setGlow('light_main_fixture',livingLight*state.electrical.lights.L07,'#ffe3ac');setGlow('light_local_fixture',livingLight*state.electrical.lights.L08,'#ffe3ac');
      setGlow('light_decor_fixture',livingLight*state.electrical.lights.L08,'#ffd09c');setGlow('light_exterior_fixture',exteriorLight*state.electrical.lights.L13,'#ffe4b5');
      const nextCurtainState=[...Object.values(d.curtainsByRoom).map(value=>Math.round(value.current*100)),Math.round(d.water.valve.current*100)].join(',');
      if(nextCurtainState!==curtainShadowState){curtainShadowState=nextCurtainState;shadowsDirty=true;}
      for(const device of registry?.devices??[]){if(device.system!=='curtains')continue;const mechanism=d.curtainsByRoom[device.room];if(!mechanism)continue;
        for(const name of device.nodes){const node=nodes.get(name);node?.traverse(n=>{if(n instanceof THREE.Mesh&&n.morphTargetInfluences&&n.morphTargetDictionary?.Open!==undefined)n.morphTargetInfluences[n.morphTargetDictionary.Open]=1-mechanism.current;});}
      }
      const water=nodes.get('leak_water');if(water){water.visible=d.water.amount>0;const base=baseScales.get('leak_water')!;const size=puddleScaleAtSensor*Math.sqrt(d.water.amount/LEAK_SENSOR_AMOUNT);water.scale.set(base.x*size,base.y,base.z*size);}
      stream.visible=streamConfigured&&d.water.inflow;stream.scale.x=stream.scale.z=.4+d.water.valve.current*.6;
      runoff.visible=streamConfigured&&d.water.amount>0;
      const valve=nodes.get('water_valve_handle');if(valve){valve.quaternion.copy(baseRotations.get(valve.name)!);valve.rotateY((1-d.water.valve.current)*Math.PI/2);}
      for(const m of dynamicMaterials.get('leak_sensor_indicator')??[]){m.color.set(d.water.latched?'#cf351e':'#5d8c60');m.emissive.copy(m.color);m.emissiveIntensity=d.water.latched?.8:.1;}
      setGlow('security_sensor_entry',state.devices.security.event!=='none'&&!d.security.acknowledged?1:.08,'#df7753');
      heatMat.opacity=d.climate.mode==='heating'?.8:.24;heatMat.color.set(d.climate.mode==='heating'?'#ed9253':'#bdb7a9');
      const videoFrame=d.media.playing?Math.floor((ui.reducedMotion?0:now)/(mobileViewport?250:150)):-1;
      if(videoFrame!==previousVideoTime){previousVideoTime=videoFrame;const videoTime=ui.reducedMotion?0:now;tvContext.fillStyle=d.media.playing?'#243d41':'#111b20';tvContext.fillRect(0,0,512,288);
        if(d.media.playing){const gradient=tvContext.createLinearGradient(0,0,0,288);gradient.addColorStop(0,'#b7c9c4');gradient.addColorStop(.65,'#dae1c5');gradient.addColorStop(1,'#5d7466');tvContext.fillStyle=gradient;tvContext.fillRect(0,0,512,288);for(let layer=0;layer<3;layer++){tvContext.fillStyle=['#779d8a','#527e70','#284e49'][layer];tvContext.beginPath();tvContext.moveTo(0,288);for(let x=0;x<=512;x+=8){tvContext.lineTo(x,150+layer*35-Math.sin(x*.012+videoTime*.00003+layer)*35-Math.cos(x*.029+layer)*18)}tvContext.lineTo(512,288);tvContext.fill();}tvContext.fillStyle='#f5f7e4';tvContext.font='14px sans-serif';tvContext.fillText('ТИХИЙ ВЕЧЕР',22,30);}
        else{tvContext.fillStyle='#475654';tvContext.font='16px sans-serif';tvContext.fillText('SMART HOUSE',175,150);}tvTexture.needsUpdate=true;tvMaterial.emissiveIntensity=d.media.playing?.65:.025;
      }
      const selected=ui.system+':'+ui.view+':'+ui.room;
      if(selected!==lastSelection){lastSelection=selected;scene.remove(selection);release(selection);selection=new THREE.Group();
        for(const node of deviceNodes.get(ui.system)??[]){if(node.name==='leak_water'||(ui.room!=='all'&&node.userData.deviceRoom!==ui.room))continue;const box=new THREE.Box3().setFromObject(node);if(!box.isEmpty()){box.expandByScalar(.025);const helper=new THREE.Box3Helper(box,0x93a174);helper.material=new THREE.LineBasicMaterial({color:'#8b9b68',transparent:true,opacity:.48});selection.add(helper);}}
        scene.add(selection);
      }
      selection.visible=ui.view!=='house'&&ui.view!=='interior'&&!ui.hideUI&&!ui.electrical?.enabled;
    };
    const startOrbit=()=>{cameraMove=null};controls.addEventListener('start',startOrbit);
    let pointerDown={x:0,y:0};
    const onDown=(e:PointerEvent)=>{pointerDown={x:e.clientX,y:e.clientY}};
    const onClick=(e:PointerEvent)=>{if(Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5||!model)return;const r=renderer.domElement.getBoundingClientRect(),p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(p,camera);const first=ray.intersectObjects([model,...(latest.current.ui.electrical?.enabled?electrical.pickTargets:[])],true).find(hit=>{let ancestor:THREE.Object3D|null=hit.object;while(ancestor){if(!ancestor.visible)return false;ancestor=ancestor.parent;}if(hit.object instanceof THREE.Mesh){const materials=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];const m=materials[hit.face?.materialIndex??0],planes=m?.clippingPlanes;if(planes?.length){const outside=(plane:THREE.Plane)=>plane.distanceToPoint(hit.point)<0;if(m.clipIntersection?planes.every(outside):planes.some(outside))return false;}}return true;});if(first?.object.userData.electricalId){latest.current.onElectricalSelect?.(first.object.userData.electricalId);return;}if(first?.object.userData.system)latest.current.onSelect?.(first.object.userData.system,first.object.userData.deviceRoom);};
    const keydown=(e:KeyboardEvent)=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();cameraMove=null;
      const inside=latest.current.ui.view==='interior';
      const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
      if(e.key==='ArrowLeft')spherical.theta-=.14;if(e.key==='ArrowRight')spherical.theta+=.14;
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        const pitch=(e.key==='ArrowUp'?-1:1)*(inside?-1:1)*.1;
        spherical.phi=THREE.MathUtils.clamp(spherical.phi+pitch,controls.minPolarAngle,controls.maxPolarAngle);
      }
      if(inside&&(e.key==='+'||e.key==='-')){camera.fov=THREE.MathUtils.clamp(camera.fov+(e.key==='+'?-4:4),45,90);camera.updateProjectionMatrix();}
      else{if(e.key==='+')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);if(e.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);}
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));if(e.key==='Home')lastView='';
    };
    const inspectZoom=(e:WheelEvent)=>{if(latest.current.ui.view!=='interior')return;e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+Math.sign(e.deltaY)*3,45,90);camera.updateProjectionMatrix();};
    const contextLost=(e:Event)=>{
      e.preventDefault();if(disposed||lost)return;lost=true;
      logScene('renderer.context.lost',{statusMessage:(e as WebGLContextEvent).statusMessage??'',diagnosticRequest:diagnosticLossPending,profile:profile.label,model:loadingKey||assetKey,contextAttributes,lastMetrics,pendingSubmission,lastGpuCompletion,lastDraw:describeDraw(),memory:{...renderer.info.memory}},'error');
      setGraphicsDiagnostics({contextLost:true,contextStatusMessage:(e as WebGLContextEvent).statusMessage??''});
      modelLoader.dispose();registryAbort.abort();latest.current.onStatus?.('context-lost','Браузер остановил 3D. Настройки дома сохранены.');
    };
    // App owns recovery/remount; a native restore must not restart this retired loader.
    const contextRestored=()=>{if(!disposed){logScene('renderer.context.restored',{profile:profile.label,model:loadingKey||assetKey,awaitingAppRemount:true});setGraphicsDiagnostics({nativeContextRestored:true});}};
    renderer.domElement.addEventListener('wheel',inspectZoom,{passive:false});renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onClick);renderer.domElement.addEventListener('keydown',keydown);
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
    disposers.push(()=>{
      renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);
      renderer.domElement.removeEventListener('wheel',inspectZoom);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onClick);renderer.domElement.removeEventListener('keydown',keydown);
    });
    const applyQuality=()=>{
      const old=profile;profile=renderQuality(latest.current.ui.quality,mobileViewport,autoDegraded);
      logScene('renderer.quality',{quality:latest.current.ui.quality,mobile:mobileViewport,autoDegraded,profile});
      setGraphicsDiagnostics({profile:profile.label,quality:latest.current.ui.quality,renderProfile:profile});
      updatePipeline();
      sun.castShadow=profile.shadowSize>0;renderer.shadowMap.enabled=profile.shadowSize>0;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      if(old.shadowSize!==profile.shadowSize||old.shadowFilter!==profile.shadowFilter){
        sun.shadow.dispose();sun.shadow.map=null;sun.shadow.mapPass=null;
        sun.shadow.mapSize.set(profile.shadowSize||1024,profile.shadowSize||1024);
        // A new map/sampler type must exist before the next main pass, even
        // when the normal animated-shadow throttle has not elapsed yet.
        renderer.shadowMap.needsUpdate=true;lastShadowAt=-Infinity;
      }
      if(old.anisotropy!==profile.anisotropy){const textures=new Set<THREE.Texture>();for(const materials of dynamicMaterials.values())for(const material of materials)for(const value of Object.values(material))if(value instanceof THREE.Texture&&value!==tvTexture)textures.add(value);for(const texture of textures){texture.anisotropy=Math.min(profile.anisotropy,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}}
      shadowsDirty=true;frames=[];slowSamples=0;resize();
      if(model)prepareModel('quality-change');
    };
    const animate=(now:number)=>{
      if(disposed||renderFailed)return;raf=requestAnimationFrame(animate);
      let phase='update';
      try {
      if(document.hidden||lost){last=now;return;}
      phase='gpu-completion';
      const completion=gpuFence.poll();
      if(completion.status==='pending'){skippedGpuFrames++;return;}
      if(completion.status==='error'){
        logScene('renderer.gpu.error',{...completion,pendingSubmission,lastGpuCompletion,lastDraw:describeDraw()},'error');
        // Context loss is handled by the DOM event (including the one retry).
        if(completion.reason==='context-lost'){cancelAnimationFrame(raf);return;}
        throw new Error(`GPU completion failed: ${completion.reason}`);
      }
      if(completion.status==='complete'&&completion.metadata){
        const finished=completion.metadata;pendingSubmission=null;completedFrames++;
        lastGpuWaitMs=Math.round(completion.elapsedMs??0);
        lastGpuCompletion={...finished,waitMs:lastGpuWaitMs,submittedFrames,completedFrames,errors:completion.errors??[]};
        // Read GL errors only during preparation, after completion; never force
        // a synchronous getError round trip for every animation frame.
        if(finished.pass!=='frame'||finished.firstFrame||finished.firstModelFrame){
          const errors:number[]=[];for(let i=0;i<8;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;errors.push(error);}
          lastGpuCompletion.errors=errors;
          if(errors.length){logScene('renderer.gpu.gl-error',lastGpuCompletion,'error');throw new Error('GPU reported an error during preparation');}
        }
        if(completion.errors?.length){logScene('renderer.gpu.gl-error',lastGpuCompletion,'error');throw new Error('GPU reported an error after rendering');}
        const current=finished.generation===generation&&finished.configuration===renderChoice();
        if(finished.pass!=='frame'||finished.firstFrame||finished.firstModelFrame)logScene('renderer.gpu.complete',{...lastGpuCompletion,current,shadowTarget:shadowTarget()});
        if(current){
          if(finished.pass==='materials')preparation='shadow-map';
          else if(finished.pass==='shadow-map')preparation='shadowed-frame';
          else if(finished.firstModelFrame){
            preparation=null;awaitingModelFrame=false;
            logScene('model.gpu.ready',{generation,model:finished.model,profile:profile.label,shadowTarget:shadowTarget(),waitMs:lastGpuWaitMs});
            setGraphicsDiagnostics({gpuPreparation:{generation,pass:finished.pass,complete:true}});
            latest.current.onStatus?.('ready');
          }
        }
      }
      phase='update';
      const requestedDiagnostic=latest.current.diagnosticContextLossRequest??0;
      if(requestedDiagnostic!==diagnosticRequest){diagnosticRequest=requestedDiagnostic;diagnosticLossPending=true;logScene('renderer.context.loss-requested',{source:'local-diagnostic-control'});renderer.forceContextLoss();return;}
      const elapsed=now-last;if(profile.fps===30&&elapsed<1000/30-.75)return;
      const dt=Math.min(elapsed/1000,.1);last=now;
      const {ui}=latest.current;
      resize();
      if(lastQuality!==ui.quality){lastQuality=ui.quality;applyQuality();}
      requestModel();
      applyView();updateDevices(dt,now);
      if(cameraMove){cameraMove.t=Math.min(1,cameraMove.t+dt/.9);const t=cameraMove.t, ease=t*t*(3-2*t);camera.position.lerpVectors(cameraMove.from,cameraMove.to,ease);controls.target.lerpVectors(cameraMove.targetFrom,cameraMove.target,ease);if(t>=1)cameraMove=null;}
      controls.update();if(latest.current.ui.view==='interior')inspectionLight.position.copy(camera.position);mainCalls=0;shadowCalls=0;mainTriangles=0;
      if(!preparation&&shadowsDirty&&profile.shadowSize>0&&now-lastShadowAt>120){renderer.shadowMap.needsUpdate=true;shadowsDirty=false;lastShadowAt=now;}
      phase='render';
      submissionPass=preparation??'frame';
      if(submissionPass==='materials'){renderer.shadowMap.enabled=false;renderer.shadowMap.needsUpdate=false;}
      else if(submissionPass==='shadow-map'){renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;}
      else if(submissionPass==='shadowed-frame'){renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=false;}
      else renderer.shadowMap.enabled=profile.shadowSize>0;
      const submission:Submission={generation,configuration:renderChoice(),pass:submissionPass,model:loadingKey||assetKey,firstFrame,firstModelFrame:awaitingModelFrame&&(submissionPass==='shadowed-frame'||submissionPass==='frame')};
      pendingSubmission=submission;
      if(submissionPass!=='frame')logScene('renderer.gpu.submit.begin',submission);
      if(firstFrame)logScene('renderer.first-frame.begin',{profile:profile.label,smoothing:!!smoothing,shadowFilter:profile.shadowSize?profile.shadowFilter:'off'});
      if(submission.firstModelFrame)logScene('model.first-frame.begin',{attempt:loadAttempt,model:loadingKey,profile:profile.label});
      const submitStarted=performance.now();
      if(smoothing)smoothing.render(renderer,scene,camera);else renderer.render(scene,camera);
      if(submissionPass==='shadow-map'){shadowsDirty=false;lastShadowAt=now;}
      submission.submitCpuMs=Math.round(performance.now()-submitStarted);submission.calls=mainCalls;submission.shadowCalls=shadowCalls;
      submittedFrames++;
      const submitted=gpuFence.submit(submission);
      submissionPass='frame';
      if(submitted.status==='error'){
        logScene('renderer.gpu.submit.error',{...submitted,lastDraw:describeDraw()},'error');
        if(submitted.reason==='context-lost'){cancelAnimationFrame(raf);return;}
        throw new Error(`GPU fence failed: ${submitted.reason}`);
      }
      if(firstFrame){logScene('renderer.first-frame.submitted',{contextLost:gl.isContextLost(),shadowTarget:shadowTarget(),memory:{...renderer.info.memory}});firstFrame=false;}
      if(submission.firstModelFrame)logScene('model.first-frame.submitted',{attempt:loadAttempt,model:loadingKey,contextLost:gl.isContextLost(),shadowTarget:shadowTarget(),calls:mainCalls,triangles:mainTriangles,memory:{...renderer.info.memory}});
      if(preparation)return;
      phase='metrics';
      if(model&&elapsed<500)frames.push(elapsed);if(frames.length>180)frames.shift();
      if(now-metricAt>1500&&model){metricAt=now;const sorted=[...frames].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]??16.7,p95=sorted[Math.floor(sorted.length*.95)]??16.7;
        const metrics={fps:Math.round(1000/median),p95:Math.round(p95*10)/10,triangles:mainTriangles,calls:mainCalls,shadowCalls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,jsHeapBytes:(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??null,profile:profile.label,pixelRatio:renderer.getPixelRatio(),antialias:renderer.getContext().getContextAttributes()?.antialias??false,smoothing:smoothing?'FXAA':renderer.getContext().getContextAttributes()?.antialias?'MSAA':renderer.getPixelRatio()>1?'supersampling':'none',postprocessing:!!smoothing,depthBits:smoothing?.depthBits??renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS),shadowMapSize:profile.shadowSize,shadowTarget:shadowTarget(),shadowFilter:profile.shadowSize?profile.shadowFilter:'off',shadows:renderer.shadowMap.enabled,pointLights:electrical.activePointLights+Number(windowLight.visible)+Number(inspectionLight.visible)+Number(screenLight.visible),modelFile:assetKey+(profile.compactTextures?'-mobile':''),loadedBytes,loadMs:Math.round(loadMs),elapsedSeconds:Math.round((now-started)/1000),asset:assetKey};
        lastMetrics={...metrics,submittedFrames,completedFrames,lastGpuWaitMs,skippedGpuFrames,pendingSubmission,lastGpuCompletion};setMetricsDiagnostics({sceneId,...lastMetrics});
        latest.current.onMetrics?.(metrics);element.dataset.metrics=JSON.stringify(metrics);
        const samples=JSON.parse(element.dataset.samples??'[]');samples.push(metrics);element.dataset.samples=JSON.stringify(samples.slice(-480));
        if(ui.quality==='auto'&&!autoDegraded){slowSamples=p95>(mobileViewport?55:40)?slowSamples+1:0;if(slowSamples>=4){autoDegraded=true;lastQuality='';}}
      }
      } catch(error){
        if(disposed||lost||renderFailed)return;
        renderFailed=true;cancelAnimationFrame(raf);modelLoader.dispose();registryAbort.abort();
        logScene('renderer.loop.error',{phase,error:errorDetail(error),profile:profile.label,model:loadingKey||assetKey,lastMetrics,memory:{...renderer.info.memory}},'error');
        latest.current.onStatus?.('error','Ошибка графики остановила 3D. Скопируйте диагностику или повторите загрузку сцены. Настройки сохранены.');
      }
    };raf=requestAnimationFrame(animate);
    logScene('scene.ready-for-frames');
    return()=>{
      logScene('scene.cleanup.begin',{lost,renderFailed,model:loadingKey||assetKey,memory:{...renderer.info.memory},intentionalContextRelease:true});
      disposeResources();
      logScene('scene.cleanup.complete',{intentionalContextRelease:true});
    };
    } catch(error){
      logScene('scene.setup.error',{error:errorDetail(error)},'error');
      disposeResources();
      latest.current.onStatus?.('error','Не удалось подготовить 3D. Скопируйте диагностику или повторите запуск сцены.');
    }
  },[]);
  return <div className="three-scene" ref={host} style={{width:'100%',height:'100%',position:'absolute',inset:0}} />;
}
