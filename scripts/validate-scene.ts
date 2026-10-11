import { readFile, writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import assert from 'node:assert/strict';

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const registry=JSON.parse(await readFile('public/scene-registry.json','utf8'));
const finishes=JSON.parse(await readFile('docs/interior-finishes.json','utf8'));
const rainChainGuids=new Set<string>(finishes.rainChains.archivedSourceGuids);
assert.equal(rainChainGuids.size,8,'Eight source rain-chain segments must be archived');
assert.equal(String(registry.schemaVersion),'1.0');assert.ok(registry.modelId);
const ids=new Set<string>();for(const group of [registry.rooms,registry.devices])for(const item of group){assert.ok(item.id);assert.ok(!ids.has(item.id),`Duplicate id ${item.id}`);ids.add(item.id);}
const rooms=new Set(registry.rooms.map((r:any)=>r.id));
const reports=[];
for(const name of ['first-room','house']){
  const buffer=await readFile(`public/models/${name}.glb`);const document=await io.readBinary(buffer);
  const root=document.getRoot(),nodes=root.listNodes(),nodeNames=new Set(nodes.map(n=>n.getName())),clips=new Set(root.listAnimations().map(a=>a.getName()));
  for(const node of nodes){
    const extra=node.getExtras(),sourceGuids=Array.isArray(extra.sourceGuids)?extra.sourceGuids:[];
    assert.ok(!extra.sourceArchive,`${name}: source archive exported`);
    assert.ok(extra.component!=='rain-chain'&&!rainChainGuids.has(String(extra.ifcGuid))&&!sourceGuids.some(g=>rainChainGuids.has(String(g))),`${name}: rain chain remains in exported geometry`);
  }
  let triangles=0;for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives()){const count=primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')?.getCount()??0;if(primitive.getMode()===4)triangles+=count/3;}
  for(const device of registry.devices){
    if(name==='first-room'&&device.room!=='living'&&device.nodes.every((n:string)=>!nodeNames.has(n)))continue;
    assert.ok(rooms.has(device.room),`${device.id}: invalid room`);assert.ok(device.nodes.length,`${device.id}: no nodes`);
    for(const node of device.nodes)assert.ok(nodeNames.has(node),`${name}: missing node ${node} for ${device.id}`);
    for(const clip of device.clips??[])assert.ok(clips.has(typeof clip==='string'?clip:clip.name),`${name}: missing clip ${JSON.stringify(clip)}`);
    if(Array.isArray(device.range)&&device.range.length===2)assert.ok(device.range[0]<device.range[1]);
  }
  const curtainMorphs=[];
  for(const device of registry.devices.filter((d:any)=>d.system==='curtains')){
    for(const curtainName of device.nodes.filter((n:string)=>n.startsWith('curtains_'))){
      const node=nodes.find(n=>n.getName()===curtainName);
      if(!node&&name==='first-room'&&device.room!=='living')continue;
      assert.ok(node,`${name}: missing curtain ${curtainName}`);
      assert.equal(node.getExtras().room,device.room,`${curtainName}: wrong room`);
      const primitives=node.getMesh()?.listPrimitives();assert.ok(primitives?.length,`${curtainName}: missing mesh`);
      const closedMin=[Infinity,Infinity,Infinity],closedMax=[-Infinity,-Infinity,-Infinity];
      const openMin=[Infinity,Infinity,Infinity],openMax=[-Infinity,-Infinity,-Infinity];
      const matrix=node.getWorldMatrix();let moved=0,pinnedHeaderVertices=0;
      const tieback=node.getExtras().curtainMechanism==='fixed-header-tieback';
      const lowerClosedX:number[]=[],lowerOpenX:number[]=[],lowerHalfX:number[]=[];
      const world=(v:number[])=>[matrix[0]*v[0]+matrix[4]*v[1]+matrix[8]*v[2]+matrix[12],matrix[1]*v[0]+matrix[5]*v[1]+matrix[9]*v[2]+matrix[13],matrix[2]*v[0]+matrix[6]*v[1]+matrix[10]*v[2]+matrix[14]];
      for(const primitive of primitives){
        const base=primitive.getAttribute('POSITION');assert.ok(base,`${curtainName}: missing positions`);
        const target=primitive.listTargets().find(t=>t.getName()==='Open');assert.ok(target,`${curtainName}: missing named Open target`);
        const delta=target.getAttribute('POSITION');assert.ok(delta,`${curtainName}: Open has no displacement`);
        assert.equal(delta.getCount(),base.getCount(),`${curtainName}: morph vertex count mismatch`);
        for(let i=0;i<base.getCount();i++){
          const b=base.getElement(i,[]),d=delta.getElement(i,[]);assert.ok([...b,...d].every(Number.isFinite),`${curtainName}: nonfinite endpoint`);
          const c=world(b),o=world(b.map((v,k)=>v+d[k]));
          if(tieback){
            const headingY=3.37983503-Math.tan(Math.PI/12)*Math.abs(c[0]-.000002);
            if(Math.abs(c[1]-headingY)<.0003){assert.ok(o.every((v,k)=>Math.abs(v-c[k])<.0003),`${curtainName}: fixed heading moved`);pinnedHeaderVertices++;}
            if(c[1]<1.2){lowerClosedX.push(c[0]);lowerOpenX.push(o[0]);lowerHalfX.push((c[0]+o[0])/2);}
          }
          if(d.some(v=>Math.abs(v)>1e-7))moved++;
          for(let k=0;k<3;k++){closedMin[k]=Math.min(closedMin[k],c[k]);closedMax[k]=Math.max(closedMax[k],c[k]);openMin[k]=Math.min(openMin[k],o[k]);openMax[k]=Math.max(openMax[k],o[k]);}
        }
      }
      const closed=closedMax.map((v,k)=>v-closedMin[k]),open=openMax.map((v,k)=>v-openMin[k]);
      const widthAxis=closed[0]>closed[2]?0:2;
      assert.ok(moved>20,`${curtainName}: Open is static`);
      assert.ok(closed[widthAxis]>.35&&closed[1]>.5,`${curtainName}: implausible closed dimensions`);
      if(tieback){
        assert.ok(node.getExtras().manualTieback===true&&node.getExtras().automated===false,`${curtainName}: manual tieback metadata required`);
        assert.ok(pinnedHeaderVertices>80,`${curtainName}: missing stationary angled heading`);
        const span=(values:number[])=>Math.max(...values)-Math.min(...values);
        const full=span(lowerClosedX),opened=span(lowerOpenX),half=span(lowerHalfX);
        assert.ok(opened<full*.5&&half>opened+.1&&half<full-.1,`${curtainName}: lower cloth must gather smoothly to sides at 0/50/100%`);
        assert.ok(Math.abs(openMax[1]-closedMax[1])<.003,`${curtainName}: heading leaves roof slope`);
      }else{
        assert.ok(open[widthAxis]<closed[widthAxis]*.65&&open[widthAxis]>.05,`${curtainName}: cloth does not gather at Open=1`);
        assert.ok(Math.abs(open[1]-closed[1])<.03,`${curtainName}: opening changes curtain height`);
      }
      const sourceWindowGuids=(node.getExtras().sourceWindowGuids??[node.getExtras().sourceWindowGuid]) as string[];
      curtainMorphs.push({name:curtainName,room:device.room,curtainMechanism:node.getExtras().curtainMechanism,sourceWindowGuids,closedBounds:{min:closedMin,max:closedMax},openBounds:{min:openMin,max:openMax},movingVertices:moved});
    }
  }
  if(name==='house'){
    assert.equal(curtainMorphs.length,8,'House must have eight moving panels for five windows');
    assert.equal(curtainMorphs.filter(c=>c.curtainMechanism==='fixed-header-tieback').length,2,'Panorama must have two soft cloth tieback curtains');
    assert.equal(new Set(curtainMorphs.flatMap(c=>c.sourceWindowGuids)).size,5,'Curtains must cover five distinct IFC windows');
  }
  const ceilingRooms=new Set(nodes.filter(n=>n.getExtras().category==='ceiling').map(n=>n.getExtras().room));
  assert.equal(ceilingRooms.size,5,`${name}: five independently hideable room ceilings required`);
  const floorMaterials=root.listMaterials().filter(m=>/^Floor \| oak aya [1-4]$/.test(m.getName()));
  assert.equal(floorMaterials.length,4,`${name}: four shared-texture board tint variants required`);
  assert.equal(new Set(floorMaterials.map(m=>m.getBaseColorTexture())).size,1,`${name}: floor variants must reuse one albedo image`);
  for(const material of floorMaterials)assert.ok(material.getBaseColorFactor()[0]>.75&&material.getBaseColorFactor()[0]<.81,`${name}: floor tint multiplier lost in export`);
  assert.ok(root.listMaterials().some(m=>m.getName()==='Door | pale timber'),`${name}: interior door finish missing`);
  assert.ok(!nodes.some(n=>n.getName().startsWith('curtains_bathroom')),`${name}: bathroom must not have curtains`);
  const privacyGlass=root.listMaterials().find(m=>m.getName()==='Glass | frosted privacy');
  assert.ok(privacyGlass&&privacyGlass.getRoughnessFactor()>.9&&privacyGlass.getBaseColorFactor()[3]>.9,`${name}: bathroom milky privacy glass missing`);
  const tv=nodes.find(n=>n.getName()==='tv_screen');assert.ok(tv&&tv.getExtras().component==='tv-screen-plane',`${name}: single TV face required`);
  const tvPrimitives=tv.getMesh()?.listPrimitives();assert.equal(tvPrimitives?.length,1,`${name}: TV must have one material primitive`);
  const tvUV=tvPrimitives![0].getAttribute('TEXCOORD_0');assert.ok(tvUV);
  for(let i=0;i<tvUV.getCount();i++)assert.ok(tvUV.getElement(i,[]).every(v=>v>=-.0001&&v<=1.0001),`${name}: TV UVs must cover one image`);
  assert.ok(root.listMaterials().some(m=>m.getName()==='Dining | matte white'),`${name}: white dining finish missing`);
  assert.ok(!nodes.some(n=>/^(lamp_base|lamp_stem|plant_|sofa_cushion_)/.test(n.getName())),`${name}: removed living decor exported`);
  const leak=registry.devices.find((d:any)=>d.id==='leak');
  for(const key of ['sourcePosition','streamBottomPosition','puddlePosition','sensorPosition'])assert.ok(leak[key]?.length===3&&leak[key].every(Number.isFinite),`${name}: missing water coordinate ${key}`);
  assert.ok(nodes.some(n=>n.getName()===leak.cabinetNodes[0]),`${name}: sink cabinet must remain independently inspectable`);
  assert.equal(nodes.find(n=>n.getName()==='leak_water')?.getExtras().baseRadiusM,1,`${name}: puddle must have unit base radius`);

  for(const accessor of root.listAccessors()){const arr=accessor.getArray();if(arr)for(let i=0;i<arr.length;i++)assert.ok(Number.isFinite(arr[i]),`Nonfinite accessor ${accessor.getName()}`);}
  reports.push({name,bytes:buffer.length,nodes:nodes.length,triangles,animations:[...clips],deviceReferences:'valid',morphs:'valid',finiteGeometry:true,rainChainSegmentsVisible:0,curtainMorphs,ceilingRooms:[...ceilingRooms],embeddedTextures:root.listTextures().length,extensions:root.listExtensionsUsed().map(e=>e.extensionName)});
}
await writeFile('docs/scene-validation.json',JSON.stringify({passed:true,created:new Date().toISOString(),reports},null,2));console.log(JSON.stringify(reports,null,2));
