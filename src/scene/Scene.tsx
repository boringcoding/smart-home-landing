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

type Device = {id:string;type:string;system:SystemId;room:string;nodes:string[];position:number[];sourcePosition?:number[];streamBottomPosition?:number[];sensorPosition?:number[];puddlePosition?:number[];cabinetNodes?:string[];inspectionBounds?:{min:number[];max:number[]};[key:string]:unknown};
type Room = {id:string;label:string;center:number[];bounds?:{min:number[];max:number[]}};
type Registry = {rooms:Room[];devices:Device[];cameras:unknown;architectureGroups:Record<string,string[]>;resources?:unknown;environment?:{groundY?:number}};
const v3 = (a:number[]) => new THREE.Vector3(a[0],a[1],a[2]);
const smooth = (a:number,b:number,dt:number,speed=5) => THREE.MathUtils.lerp(a,b,1-Math.exp(-speed*dt));
// Shared across React remounts: an in-flight decoder must finish before its replacement starts.
const decoder = new SerialDecoder();

export default function Scene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    const element=host.current!;
    element.dataset.environment=JSON.stringify({userAgent:navigator.userAgent,dpr:devicePixelRatio,startedAt:new Date().toISOString()});
    let disposed=false,raf=0,model:THREE.Group|null=null,registry:Registry|null=null,assetKey='',loadedBytes=0,loadMs=0;
    const isMobile=() => element.clientWidth<700 || matchMedia('(pointer: coarse)').matches;
    let low=isMobile()||latest.current.ui.quality==='low',lastQuality='',mobileViewport=isMobile(),autoDegraded=false;
    // Decide before allocating the WebGL drawing buffer, including the first frame.
    const mobileAssets=low;
    let diagnosticRequest=latest.current.diagnosticContextLossRequest??0;
    let renderer:THREE.WebGLRenderer;
    const started=performance.now();
    try { renderer=new THREE.WebGLRenderer({antialias:!low,alpha:false,powerPreference:low?'default':'high-performance'}); }
    catch { latest.current.onStatus?.('error','Ваш браузер не смог запустить 3D. Настройки систем и сохранение заявки доступны.'); return; }
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
    renderer.shadowMap.enabled=!low;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.localClippingEnabled=true;
    renderer.setClearColor('#e9ece3');
    renderer.domElement.setAttribute('aria-label','Трёхмерная модель дома. Перетаскивайте для вращения, используйте кнопки видов и комнат для навигации.');
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('tabindex','0');
    element.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e9ece3',38,85);
    const camera=new THREE.PerspectiveCamera(38,1,.08,120);camera.position.set(9,9,12);
    let mainCalls=0,shadowCalls=0,mainTriangles=0;
    const renderDirect=renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect=(renderCamera,...args)=>{
      const callsBefore=renderer.info.render.calls,trianglesBefore=renderer.info.render.triangles;
      renderDirect(renderCamera,...args);
      if(renderCamera===camera){mainCalls+=renderer.info.render.calls-callsBefore;mainTriangles+=renderer.info.render.triangles-trianglesBefore;}else{shadowCalls+=renderer.info.render.calls-callsBefore;}
    };
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(1.3,.7,1.3);controls.enableDamping=true;controls.dampingFactor=.075;
    controls.minDistance=4.5;controls.maxDistance=28;controls.minPolarAngle=.2;controls.maxPolarAngle=1.31;
    controls.enablePan=false;controls.zoomSpeed=.55;controls.rotateSpeed=.6;
    controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;if(mobileViewport!==isMobile()){mobileViewport=isMobile();lastQuality='';}camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:2,Math.sqrt((low?1_000_000:5_000_000)/(w*h))));renderer.setSize(w,h);};
    const observer=new ResizeObserver(resize);observer.observe(element);resize();
    const hemisphere=new THREE.HemisphereLight('#e9efff','#a59a83',1.15);scene.add(hemisphere);
    const sun=new THREE.DirectionalLight('#fff3dc',3.1);sun.position.set(9,12,3);sun.castShadow=!low;
    Object.assign(sun.shadow.camera,{left:-10,right:10,top:11,bottom:-11,near:.5,far:40});
    sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
    const windowLight=new THREE.PointLight('#e2edff',12,7,2);windowLight.position.set(3.5,1.55,1.45);scene.add(windowLight);
    const screenLight=new THREE.PointLight('#8caeff',0,4,2);screenLight.position.set(-1.0,1.2,1.3);scene.add(screenLight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#dedfd4',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.924;ground.receiveShadow=true;scene.add(ground);
    const electrical=createElectricalLayer();scene.add(electrical.root);
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
    let previousVideoTime=-2;
    const tvMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,emissive:0xffffff,emissiveIntensity:.6,map:tvTexture,emissiveMap:tvTexture});
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
    let loadStarted=0;
    const modelLoader=new LatestAssetLoader<GLTF>({
      start:()=>{
        latest.current.onStatus?.('loading');loadStarted=performance.now();loadedBytes=0;
        // Release the current GLB before downloading/decoding its replacement.
        // The loading overlay hides the gap and peak memory stays at one model.
        if(model){scene.remove(model);release(model);model=null;}
        scene.remove(selection);release(selection);selection=new THREE.Group();scene.add(selection);
        nodes.clear();deviceNodes.clear();dynamicMaterials.clear();baseRotations.clear();baseScales.clear();
        renderer.renderLists.dispose();
      },
      load:async(key,signal)=>{
        const response=await fetch(`${import.meta.env.BASE_URL}models/${key}.glb`,{signal});
        if(!response.ok)throw new Error(`Model HTTP ${response.status}`);
        const buffer=await response.arrayBuffer();signal.throwIfAborted();
        loadedBytes=buffer.byteLength;
        // Parsing cannot be cancelled; LatestAssetLoader serializes it and disposes stale results.
        return decoder.run(()=>loader.parseAsync(buffer,`${import.meta.env.BASE_URL}models/`),signal);
      },
      release:result=>release(result.scene),
      commit:(result,key)=>{
        model=result.scene;assetKey=key.replace(/-mobile$/,'');
        const originalMaterials=new Set<THREE.Material>();
        model.traverse(o=>{
          nodes.set(o.name,o);baseRotations.set(o.name,o.quaternion.clone());baseScales.set(o.name,o.scale.clone());
          if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;
            // Three 0.186 shared shadow uniforms can re-upload a disposed map.
            // Per-mesh shadow materials keep those uniforms within the GLB lifetime.
            o.customDepthMaterial=new THREE.MeshDepthMaterial();
            o.customDepthMaterial.name=`${o.name}:shadow-depth`;
            o.customDistanceMaterial=new THREE.MeshDistanceMaterial();
            o.customDistanceMaterial.name=`${o.name}:shadow-distance`;
            const original=Array.isArray(o.material)?o.material:[o.material];
            original.forEach(m=>originalMaterials.add(m));
            const materials=original.map(m=>m.clone()) as THREE.MeshStandardMaterial[];o.material=Array.isArray(o.material)?materials:materials[0];
            dynamicMaterials.set(o.name,materials);
            for(const m of materials){if(m.transparent){o.castShadow=false;m.depthWrite=false;}m.clipShadows=true;}
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
        scene.add(model);lastView='';lastSelection='';loadMs=performance.now()-loadStarted;latest.current.onStatus?.('ready');
      },
      error:error=>{if(!disposed&&!lost){console.warn('3D model loading failed',error);latest.current.onStatus?.('error','Модель не загрузилась. Проверьте соединение и повторите загрузку сцены. Комплектация и настройки сохранены.');}},
    });
    const requestModel=()=>{
      if(!registry||disposed||lost)return;
      const {ui}=latest.current;
      const key=ui.view==='house'||ui.room!=='living'?'house':'first-room';
      modelLoader.request(key+((low||mobileAssets)?'-mobile':''));
    };
    const registryAbort=new AbortController();
    fetch(`${import.meta.env.BASE_URL}scene-registry.json`,{signal:registryAbort.signal}).then(r=>{if(!r.ok)throw Error('Реестр сцены недоступен');return r.json()}).then((r:Registry)=>{if(disposed)return;registry=r;ground.position.y=(r.environment?.groundY??-.914)-.01;
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
      requestModel();}).catch(e=>{if(!disposed&&!lost)latest.current.onStatus?.('error',String(e))});
    const applyView=()=>{
      const {ui}=latest.current,key=ui.view+':'+ui.room+':'+ui.system+':'+ui.cameraRevision+':'+ui.electrical?.enabled+':'+ui.electrical?.selectedId+':'+Math.round(camera.aspect*100);
      if(key===lastView||!model||!registry)return;lastView=key;
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
        camera.fov=72;camera.near=.025;camera.updateProjectionMatrix();
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
      camera.fov=waterInspection?62:electricalFocus&&(ui.room==='entry'||ui.room==='bathroom')?58:38;camera.near=.08;camera.updateProjectionMatrix();controls.enableZoom=true;controls.minPolarAngle=.2;controls.maxPolarAngle=1.45;
      cameraMove={from:camera.position.clone(),targetFrom:controls.target.clone(),to:pos,target,t:ui.reducedMotion?1:0};
      controls.minDistance=house ? 10 : (waterInspection||ui.electrical?.enabled) ? .55 : 4.5;controls.maxDistance=house?30:waterInspection?7:22;
    };
    const setGlow=(name:string,value:number,color:string)=>{for(const m of dynamicMaterials.get(name)??[]){if(m.emissive){m.emissive.set(color);m.emissiveIntensity=value*1.8;}}};
    const updateDevices=(dt:number,now:number)=>{
      const {state,ui}=latest.current,d=state.devices,day=state.demo.daylight;
      electrical.update(state,ui,assetKey,low?3:6);
      sun.intensity=smooth(sun.intensity,day*3.2,dt);hemisphere.intensity=smooth(hemisphere.intensity,.18+day*.85,dt);
      // One daylight fill follows the inspected room instead of four permanently active lights.
      const room=registry?.rooms.find(room=>room.id===ui.room&&room.id!=='living');
      const closed=d.curtainsByRoom[room?.id??'living']?.current??0;
      windowLight.position.set(room?.center[0]??3.5,room?2.14:1.55,room?.center[2]??1.45);
      windowLight.intensity=smooth(windowLight.intensity,day*(room?11:20)*(1-.93*closed),dt);windowLight.visible=windowLight.intensity>.02;
      inspectionLight.intensity=ui.view==='interior'?2.0:ui.view==='engineering'&&ui.system==='water'&&ui.room==='living'&&!ui.electrical?.enabled?1.4:0;inspectionLight.position.copy(camera.position);inspectionLight.visible=inspectionLight.intensity>0;
      screenLight.intensity=d.media.playing?2.5:0;screenLight.visible=!low&&d.media.playing&&(ui.room==='living'||ui.view==='house');
      const livingLight=state.config.systems.lighting&&state.config.rooms.includes('living')?1:0;
      const exteriorLight=state.config.systems.lighting&&state.config.rooms.includes('entry')?1:0;
      setGlow('light_main_fixture',livingLight*state.electrical.lights.L07,'#ffe3ac');setGlow('light_local_fixture',livingLight*state.electrical.lights.L08,'#ffe3ac');
      setGlow('light_decor_fixture',livingLight*state.electrical.lights.L08,'#ffd09c');setGlow('light_exterior_fixture',exteriorLight*state.electrical.lights.L13,'#ffe4b5');
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
      const videoFrame=d.media.playing?Math.floor((ui.reducedMotion?0:now)/(low?250:150)):-1;
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
    const contextLost=(e:Event)=>{e.preventDefault();if(disposed||lost)return;lost=true;modelLoader.dispose();registryAbort.abort();latest.current.onStatus?.('context-lost','Браузер остановил 3D. Настройки дома сохранены.');};
    renderer.domElement.addEventListener('wheel',inspectZoom,{passive:false});renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onClick);renderer.domElement.addEventListener('keydown',keydown);
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    const applyQuality=()=>{
      sun.castShadow=!low;renderer.shadowMap.enabled=!low;
      if(low){sun.shadow.dispose();sun.shadow.map=null;sun.shadow.mapPass=null;}
      resize();
    };
    const animate=(now:number)=>{
      if(disposed)return;raf=requestAnimationFrame(animate);
      if(document.hidden||lost){last=now;return;}
      const requestedDiagnostic=latest.current.diagnosticContextLossRequest??0;
      if(requestedDiagnostic!==diagnosticRequest){diagnosticRequest=requestedDiagnostic;renderer.forceContextLoss();return;}
      const elapsed=now-last;if(low&&elapsed<1000/30-.75)return;
      const dt=Math.min(elapsed/1000,.1);last=now;
      const {ui}=latest.current;
      if(lastQuality!==ui.quality){lastQuality=ui.quality;low=isMobile()||ui.quality==='low'||(ui.quality==='auto'&&autoDegraded);applyQuality();}
      requestModel();
      applyView();updateDevices(dt,now);
      if(cameraMove){cameraMove.t=Math.min(1,cameraMove.t+dt/.9);const t=cameraMove.t, ease=t*t*(3-2*t);camera.position.lerpVectors(cameraMove.from,cameraMove.to,ease);controls.target.lerpVectors(cameraMove.targetFrom,cameraMove.target,ease);if(t>=1)cameraMove=null;}
      controls.update();if(latest.current.ui.view==='interior')inspectionLight.position.copy(camera.position);mainCalls=0;shadowCalls=0;mainTriangles=0;renderer.render(scene,camera);
      if(model&&elapsed<500)frames.push(elapsed);if(frames.length>180)frames.shift();
      if(now-metricAt>1500&&model){metricAt=now;const sorted=[...frames].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]??16.7,p95=sorted[Math.floor(sorted.length*.95)]??16.7;
        const metrics={fps:Math.round(1000/median),p95:Math.round(p95*10)/10,triangles:mainTriangles,calls:mainCalls,shadowCalls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,jsHeapBytes:(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??null,profile:low?'Экономичный':'Настольный',pixelRatio:renderer.getPixelRatio(),antialias:renderer.getContext().getContextAttributes()?.antialias??false,shadows:renderer.shadowMap.enabled,pointLights:electrical.activePointLights+Number(windowLight.visible)+Number(inspectionLight.visible)+Number(screenLight.visible),modelFile:assetKey+((low||mobileAssets)?'-mobile':''),loadedBytes,loadMs:Math.round(loadMs),elapsedSeconds:Math.round((now-started)/1000),asset:assetKey};
        latest.current.onMetrics?.(metrics);element.dataset.metrics=JSON.stringify(metrics);
        const samples=JSON.parse(element.dataset.samples??'[]');samples.push(metrics);element.dataset.samples=JSON.stringify(samples.slice(-480));
        if(ui.quality==='auto'&&!low){slowSamples=p95>40?slowSamples+1:0;if(slowSamples>=3){autoDegraded=true;low=true;applyQuality();}}
      }
    };raf=requestAnimationFrame(animate);
    return()=>{
      disposed=true;modelLoader.dispose();registryAbort.abort();cancelAnimationFrame(raf);observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      renderer.domElement.removeEventListener('wheel',inspectZoom);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onClick);renderer.domElement.removeEventListener('keydown',keydown);
      controls.dispose();scene.remove(electrical.root);electrical.dispose();release(scene);sun.shadow.dispose();tvTexture.dispose();tvMaterial.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[]);
  return <div className="three-scene" ref={host} style={{width:'100%',height:'100%',position:'absolute',inset:0}} />;
}
