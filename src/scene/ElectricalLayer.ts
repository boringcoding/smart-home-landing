import * as THREE from 'three';
import type { HomeState, UIState } from '../types';
import { ELECTRICAL_POINTS, ELECTRICAL_ROUTES, LIGHT_GROUPS, type ElectricalPoint, type Vec3 } from '../electrical/plan';

const vector=(p:Vec3)=>new THREE.Vector3(...p);
const colors={socket:'#b67b51',switch:'#877399',light:'#b89942',ethernet:'#4c87a7',sensor:'#548c7f',panel:'#526f65',load:'#b67b51',curtain:'#877399',emergency:'#548c7f'};
const routeColors={power:'#ba7649',lighting:'#c8a242',signal:'#9b72b7',ethernet:'#438ec0',rs485:'#419e91'};
const existingFixtures=new Set(['L07','L08','L13']);

export function createElectricalLayer(){
  const root=new THREE.Group();root.name='electrical-design';
  const white=new THREE.MeshStandardMaterial({color:'#eeede6',roughness:.72});
  const charcoal=new THREE.MeshStandardMaterial({color:'#404844',roughness:.8});
  const inset=new THREE.MeshStandardMaterial({color:'#d2d4cc',roughness:.85});
  const blue=new THREE.MeshStandardMaterial({color:'#3b6476',roughness:.8});
  const pointGroups=new Map<string,THREE.Group>();
  const labels=new Map<string,THREE.Sprite>();
  const lamps=new Map<string,{light:THREE.PointLight;surface:THREE.MeshStandardMaterial}>();
  const routeLines=new Map<string,THREE.Line>();
  const pickTargets:THREE.Object3D[]=[];
  const warm=new THREE.Color();
  const unitBox=new THREE.BoxGeometry(1,1,1),disc=new THREE.CylinderGeometry(1,1,1,20),circle=new THREE.CircleGeometry(1,12);
  const ownedTextures:THREE.Texture[]=[];
  const addBox=(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const mesh=new THREE.Mesh(unitBox,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const addDisc=(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,r:number,depth=.004)=>{const mesh=new THREE.Mesh(disc,material);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.scale.set(r,depth,r);parent.add(mesh);return mesh;};
  const addHole=(parent:THREE.Object3D,x:number,y:number,z:number,r=.003)=>{const mesh=new THREE.Mesh(circle,charcoal);mesh.position.set(x,y,z);mesh.scale.setScalar(r);parent.add(mesh);};
  function plate(parent:THREE.Object3D,point:ElectricalPoint,sockets:number,ports:number){
    const count=Math.max(1,sockets||ports||point.keys?.length||1),vertical=point.mounting?.includes('vertical')||point.id==='R13'||point.id==='R14';
    const width=vertical?.081:count*.072+.009,height=vertical?count*.072+.009:.081;
    addBox(parent,white,0,0,.005,width,height,.014);
    for(let i=0;i<count;i++){
      const x=vertical?0:(i-(count-1)/2)*.072,y=vertical?((count-1)/2-i)*.072:0;
      if(sockets){addDisc(parent,inset,x,y,.014,.025);addDisc(parent,white,x,y,.017,.022);addHole(parent,x-.009,y,.020);addHole(parent,x+.009,y,.020);addBox(parent,charcoal,x,y+.022,.019,.008,.003,.002);addBox(parent,charcoal,x,y-.022,.019,.008,.003,.002);}
      else if(ports){addBox(parent,inset,x,y,.014,.059,.059,.006);addBox(parent,blue,x,y,.019,.018,.016,.005);addBox(parent,charcoal,x,y-.006,.022,.010,.009,.002);}
      else{addBox(parent,inset,x,y,.014,.062,.062,.006);addBox(parent,white,x,y,.018,.057,.056,.006);addBox(parent,charcoal,x,y-.02,.022,.012,.002,.001);}
    }
  }
  function label(point:ElectricalPoint){
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=76;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=point.status==='planned'?colors[point.kind]:'#9a8c73';ctx.beginPath();ctx.roundRect(3,3,186,70,18);ctx.fill();
    ctx.font='600 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.fillText(point.id,96,39);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;ownedTextures.push(texture);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,transparent:true,sizeAttenuation:false}));sprite.scale.set(.060,.025,1);sprite.renderOrder=30;sprite.userData.electricalId=point.id;pickTargets.push(sprite);
    sprite.position.copy(vector(point.position!)).add(new THREE.Vector3(0,.15,0));root.add(sprite);labels.set(point.id,sprite);
  }
  for(const point of ELECTRICAL_POINTS){
    if(!point.position)continue;
    const group=new THREE.Group();group.name=`electrical_${point.id}`;root.add(group);pointGroups.set(point.id,group);
    const normal=vector(point.normal);if(normal.lengthSq()<.1)normal.set(0,0,1);normal.normalize();
    const mounts=point.mounts?.length?point.mounts:[{position:point.position,normal:point.normal,sockets:point.sockets,ports:point.ports}];
    for(const mount of mounts){
      const face=new THREE.Group();face.position.copy(vector(mount.position)).addScaledVector(vector(mount.normal),.006);face.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),vector(mount.normal).normalize());group.add(face);
      if(point.kind==='socket'||point.kind==='switch'||point.kind==='ethernet')plate(face,point,mount.sockets??0,mount.ports??0);
      else if(point.kind==='panel'){
        addBox(face,charcoal,0,0,-.04,.51,1.05,.12);addBox(face,white,0,0,.026,.48,1.01,.025);
        for(let row=0;row<3;row++){addBox(face,inset,0,.32-row*.28,.042,.42,.20,.007);for(let col=0;col<8;col++){addBox(face,charcoal,-.17+col*.048,.32-row*.28,.052,.022,.05,.014);}}
      }else if(point.kind==='light'){
        const material=new THREE.MeshStandardMaterial({color:'#fff4dc',roughness:.65,emissive:'#ffe0af',emissiveIntensity:0});
        if(!existingFixtures.has(point.lightGroup??point.id)){
          if(['L08','L11','L14'].includes(point.id)){addBox(face,charcoal,0,0,0,.48,.035,.025);addBox(face,material,0,0,.017,.46,.02,.006);}
          else{addDisc(face,charcoal,0,0,0,point.id==='L06'?.18:.125,.035);addDisc(face,material,0,0,.024,point.id==='L06'?.168:.114,.008);}
        }
        const lamp=new THREE.PointLight('#ffe0af',0,point.id==='L12'||point.id==='L13'?8:5.5,2);lamp.position.copy(vector(point.position)).addScaledVector(normal,.15);root.add(lamp);lamps.set(point.lightGroup??point.id,{light:lamp,surface:material});
      }else if(point.kind==='sensor'){
        addBox(face,white,0,0,.018,.071,.071,.035);addBox(face,charcoal,0,.003,.037,.033,.023,.002);addDisc(face,blue,0,-.02,.039,.003,.001);
      }else if(point.kind==='emergency'){
        addBox(face,white,0,0,.025,.18,.08,.05);addBox(face,inset,0,0,.052,.14,.04,.004);
      }else{addBox(face,white,0,0,.008,.065,.065,.018);addDisc(face,charcoal,0,0,.019,.013,.003);}
    }
    group.traverse(o=>{o.userData.electricalId=point.id;});pickTargets.push(group);
    // Larger hit area for small mechanisms, exposed only in the electrical view.
    const hit=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.copy(vector(point.position));hit.userData.electricalId=point.id;hit.name='electrical-hit';group.add(hit);
    label(point);
  }
  for(const route of ELECTRICAL_ROUTES){
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.points.map(vector)),new THREE.LineBasicMaterial({color:routeColors[route.kind],transparent:true,opacity:.72,depthTest:true}));line.name=route.id;line.visible=false;root.add(line);routeLines.set(route.id,line);
  }
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.10,.009,8,40),new THREE.MeshBasicMaterial({color:'#e2ac54',depthTest:false,transparent:true,opacity:.92}));halo.renderOrder=31;root.add(halo);halo.visible=false;
  function matches(point:ElectricalPoint,ui:UIState){
    const e=ui.electrical;if(!e)return true;
    const layer=e.layer;
    const kinds:Record<string,string[]>= {sockets:['socket','load','panel','curtain'],lighting:['light','emergency'],switches:['switch'],network:['ethernet','panel'],sensors:['sensor','emergency'],all:[],routes:[]};
    return (ui.room==='all'||point.room===ui.room||(point.room==='exterior'&&ui.room==='entry'))&&(!e.circuit||point.circuits.includes(e.circuit))&&(!kinds[layer]?.length||kinds[layer].includes(point.kind));
  }
  return {
    root,pickTargets,
    update(state:HomeState,ui:UIState,asset:string){
      const e=ui.electrical,mode=Boolean(e?.enabled);
      warm.setRGB(1,THREE.MathUtils.lerp(.64,.93,(state.devices.lighting.kelvin-2700)/3800),THREE.MathUtils.lerp(.34,1,(state.devices.lighting.kelvin-2700)/3800));
      for(const p of ELECTRICAL_POINTS){
        const g=pointGroups.get(p.id);if(!g)continue;
        const inAsset=asset==='house'||p.room==='living';
        const visible=inAsset&&(mode?matches(p,ui):p.status==='planned'&&p.kind!=='panel'&&p.kind!=='load'&&p.kind!=='curtain');
        g.visible=visible;
        const hit=g.children.find(c=>c.name==='electrical-hit');if(hit)hit.visible=mode&&visible;
        const sprite=labels.get(p.id);if(sprite)sprite.visible=visible&&mode&&Boolean(e?.labels)&&(ui.room!=='all'||e?.layer!=='all'||e?.selectedId===p.id);
      }
      for(const group of LIGHT_GROUPS){
        const lamp=lamps.get(group.id);if(!lamp)continue;
        const value=state.electrical.lights[group.id]??0;
        lamp.light.visible=asset==='house'||group.room==='living';
        lamp.light.color.copy(warm);lamp.surface.emissive.copy(warm);
        lamp.light.intensity=value*(group.id==='L14'?1.5:group.id==='L06'?30:group.id==='L07'?22:group.id==='L08'?8:group.id==='L12'||group.id==='L13'?20:14);
        lamp.surface.emissiveIntensity=value*1.5;
      }
      for(const route of ELECTRICAL_ROUTES){
        const line=routeLines.get(route.id)!;
        const relevant=route.pointIds.some(id=>{const p=ELECTRICAL_POINTS.find(p=>p.id===id);return p&&matches(p,ui)});
        const layerMatch=!e||e.layer==='all'||e.layer==='routes'||e.layer==='network'&&route.kind==='ethernet'||e.layer==='lighting'&&route.kind==='lighting'||e.layer==='switches'&&route.kind==='signal'||e.layer==='sockets'&&route.kind==='power'||e.layer==='sensors'&&['signal','rs485'].includes(route.kind);
        line.visible=mode&&Boolean(e?.routes||e?.layer==='routes')&&relevant&&layerMatch&&(!e?.circuit||route.circuits.includes(e.circuit))&&(!e?.selectedId||route.pointIds.includes(e.selectedId));
      }
      const selected=ELECTRICAL_POINTS.find(p=>p.id===e?.selectedId);
      halo.visible=mode&&Boolean(selected?.position);if(selected?.position){halo.position.copy(vector(selected.position)).addScaledVector(vector(selected.normal),.035);halo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),vector(selected.normal).normalize());}
    },
    focus(id:string){
      const p=ELECTRICAL_POINTS.find(p=>p.id===id);if(!p?.position)return null;
      const target=vector(p.position),normal=vector(p.normal).normalize();
      const compact=p.room==='bathroom'||p.room==='entry';
      const offset=Math.abs(normal.y)>.5?new THREE.Vector3(1.4,1.8,1.7):normal.multiplyScalar(compact?1.15:1.75).add(compact?new THREE.Vector3(0,.45,0):new THREE.Vector3(.4,.7,.2));
      return {target,position:target.clone().add(offset),cutHeight:Math.max(1.35,Math.min(2.7,p.position[1]+.3))};
    },
    dispose(){
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}else if(o instanceof THREE.Sprite)materials.add(o.material);});
      for(const lamp of lamps.values())materials.add(lamp.surface);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());
    },
  };
}
