/** Derive mobile assets by resizing embedded PNGs only.
 * Preserves compressed geometry bytes, node/material identities, all morphs and animations.
 * Run after the usual desktop export/optimization, with the shared heavy queue free.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import type { Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

sharp.concurrency(1);
sharp.cache({ memory:16, files:0, items:8 });
const cap=512;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const align4=(n:number)=>(n+3)&~3;
const unpack=(buffer:Buffer)=>{
  assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);
  assert.equal(buffer.readUInt32LE(8),buffer.byteLength);
  const jsonLength=buffer.readUInt32LE(12);assert.equal(buffer.readUInt32LE(16),0x4e4f534a);
  const data=JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8'));
  assert.equal(buffer.readUInt32LE(24+jsonLength),0x004e4942);
  const bin=buffer.subarray(28+jsonLength,28+jsonLength+buffer.readUInt32LE(20+jsonLength));
  return {data,bin};
};
const pack=(data:any,bin:Buffer)=>{
  const raw=Buffer.from(JSON.stringify(data));const json=Buffer.alloc(align4(raw.length),0x20);raw.copy(json);
  const padded=Buffer.alloc(align4(bin.length));bin.copy(padded);
  const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+padded.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);
  const binHead=Buffer.alloc(8);binHead.writeUInt32LE(padded.length,0);binHead.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([head,json,binHead,padded]);
};
function imageMemory(width:number,height:number){
  let bytes=0,w=width,h=height;
  for(;;){bytes+=w*h*4;if(w===1&&h===1)break;w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));}
  return bytes;
}
function geometryAudit(document:Document){
  const root=document.getRoot();let triangles=0,primitives=0,morphVertexCount=0,morphFloatBytesMin=0;
  let gpuAccessorBytes=0;const used=new Set();const morphs=[];
  for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
    primitives++;if(p.getMode()===4)triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3;
    for(const a of [...p.listAttributes(),...(p.getIndices()?[p.getIndices()!]:[])])used.add(a);
    if(p.listTargets().length){
      const count=p.getAttribute('POSITION')!.getCount();morphVertexCount+=count;
      const slots=p.listTargets()[0].getAttribute('NORMAL')?2:1;
      const bytes=count*slots*16*p.listTargets().length;morphFloatBytesMin+=bytes;
      morphs.push({name:mesh.getName(),vertices:count,targets:p.listTargets().map(t=>t.getName()),minRGBA32FBytes:bytes});
    }
  }
  for(const a of root.listAccessors())if(used.has(a))gpuAccessorBytes+=a.getArray()?.byteLength??0;
  return {nodes:root.listNodes().length,meshes:root.listMeshes().length,materials:root.listMaterials().length,triangles,primitives,geometryAttributeBytes:gpuAccessorBytes,morphVertexCount,morphFloatBytesMin,morphs};
}
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const reports=[];
for(const name of ['first-room','house']){
  const inputPath=`public/models/${name}.glb`,outputPath=`public/models/${name}-mobile.glb`;
  const original=await readFile(inputPath),sourceHash=hash(original);const {data,bin}=unpack(original);
  const before=structuredClone(data);const replacements:{start:number;end:number;raw:Buffer;padded:Buffer;view:number}[]=[];
  const textures=[];
  for(const [index,image] of data.images.entries()){
    assert.ok(Number.isInteger(image.bufferView),'All mobile textures must be embedded');
    const view=data.bufferViews[image.bufferView];assert.equal(view.buffer,0);
    const start=view.byteOffset??0;const imageBytes=bin.subarray(start,start+view.byteLength);const meta=await sharp(imageBytes).metadata();
    assert.ok(meta.width&&meta.height);let output=imageBytes;
    if(meta.width>cap||meta.height>cap){
      assert.equal(image.mimeType,'image/png','Only lossless PNG source maps are resized');
      output=await sharp(imageBytes).resize({width:cap,height:cap,fit:'inside',withoutEnlargement:true,kernel:'lanczos3'}).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
      const padded=Buffer.alloc(align4(output.length));output.copy(padded);
      replacements.push({start,end:align4(start+view.byteLength),raw:output,padded,view:image.bufferView});
    }
    const m=await sharp(output).metadata();
    textures.push({index,name:image.name,mime:image.mimeType,before:{width:meta.width,height:meta.height,encodedBytes:imageBytes.length,rgba8WithMipmapsBytes:imageMemory(meta.width,meta.height)},mobile:{width:m.width!,height:m.height!,encodedBytes:output.length,rgba8WithMipmapsBytes:imageMemory(m.width!,m.height!)},resized:output!==imageBytes});
  }
  replacements.sort((a,b)=>a.start-b.start);
  for(let i=1;i<replacements.length;i++)assert.ok(replacements[i-1].end<=replacements[i].start);
  const shifted=(offset:number)=>offset+replacements.filter(r=>r.end<=offset).reduce((n,r)=>n+r.padded.length-(r.end-r.start),0);
  const chunks:Buffer[]=[];let cursor=0;
  for(const r of replacements){chunks.push(bin.subarray(cursor,r.start),r.padded);cursor=r.end;}
  chunks.push(bin.subarray(cursor));const resizedBin=Buffer.concat(chunks);
  for(const [index,view] of data.bufferViews.entries()){
    if(view.buffer===0){const oldOffset=view.byteOffset??0;view.byteOffset=shifted(oldOffset);const r=replacements.find(r=>r.view===index);if(r)view.byteLength=r.raw.length;}
    const ext=view.extensions?.EXT_meshopt_compression;
    if(ext?.buffer===0)ext.byteOffset=shifted(ext.byteOffset??0);
  }
  data.buffers[0].byteLength=before.buffers[0].byteLength+resizedBin.length-bin.length;
  const output=pack(data,resizedBin);
  // Exact binary preservation, not similarity: source geometry and decoder payloads cannot change.
  for(const [index,view] of before.bufferViews.entries()){
    const now=data.bufferViews[index];
    if(view.buffer===0&&!before.images.some((im:any)=>im.bufferView===index)){
      const a=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),b=resizedBin.subarray(now.byteOffset??0,(now.byteOffset??0)+now.byteLength);assert.equal(hash(a),hash(b),`bufferView ${index} changed`);
    }
    const a=view.extensions?.EXT_meshopt_compression,b=now.extensions?.EXT_meshopt_compression;
    if(a?.buffer===0)assert.equal(hash(bin.subarray(a.byteOffset??0,(a.byteOffset??0)+a.byteLength)),hash(resizedBin.subarray(b.byteOffset??0,(b.byteOffset??0)+b.byteLength)),`compressed payload ${index} changed`);
  }
  for(const key of ['nodes','meshes','accessors','animations','materials','textures','samplers','scenes','extensionsUsed','extensionsRequired'])assert.deepEqual(data[key],before[key],`${key} changed`);
  await writeFile(outputPath,output);
  // Sequential decode verifies the rebuilt BIN offsets and all morph/accessor arrays.
  const originalDoc=await io.readBinary(original),mobileDoc=await io.read(outputPath);
  const oldAccessors=originalDoc.getRoot().listAccessors(),newAccessors=mobileDoc.getRoot().listAccessors();assert.equal(newAccessors.length,oldAccessors.length);
  for(let i=0;i<oldAccessors.length;i++){
    const a=oldAccessors[i].getArray(),b=newAccessors[i].getArray();assert.ok(a&&b);assert.equal(hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)),hash(new Uint8Array(b.buffer,b.byteOffset,b.byteLength)),`decoded accessor ${i} differs`);
  }
  assert.equal(hash(await readFile(inputPath)),sourceHash,'Desktop source modified');
  const geometry=geometryAudit(mobileDoc),imageBytesBefore=textures.reduce((n,t)=>n+t.before.rgba8WithMipmapsBytes,0),imageBytesMobile=textures.reduce((n,t)=>n+t.mobile.rgba8WithMipmapsBytes,0);
  reports.push({name,source:inputPath,mobile:outputPath,sourceSha256:sourceHash,mobileSha256:hash(output),sourceBytes:original.length,mobileBytes:output.length,textureCount:textures.length,imageBytesBefore,imageBytesMobile,imageReductionPercent:Math.round((1-imageBytesMobile/imageBytesBefore)*10000)/100,textures,geometry,validation:{allDecodedAccessorsIdentical:true,meshoptPayloadsIdentical:true,nodesMaterialsAnimationsAndMorphMetadataIdentical:true,desktopSourceUnchanged:true}});
  sharp.cache(false);
  console.log(`${name}: ${original.length} → ${output.length} bytes; images ${(imageBytesBefore/1048576).toFixed(2)} → ${(imageBytesMobile/1048576).toFixed(2)} MiB RGBA8+mips; geometry identical`);
}
await mkdir('docs',{recursive:true});
await writeFile('docs/mobile-model-audit.json',JSON.stringify({created:new Date().toISOString(),passed:true,textureMaxDimension:cap,textureEncoding:'Embedded PNG, same material color factors, Lanczos3 downsampling only; no new decoder/extension.',geometryPolicy:'No simplification, quantization or material merging; original compressed bytes and decoded accessors retained exactly.',assumptions:['RGBA8 textures with full mip chain, one GPU image per glTF texture, excluding browser decode copies and sampler variants.','Geometry attribute byte counts sum referenced accessors; driver padding, sharing, shader programs, render targets and runtime procedural geometry are not included.','Three.js morph positions/normals use RGBA32F array textures; minimum estimate excludes row padding to GPU maxTextureSize.','Texture memory reduction does not establish the cause or resolution of device context loss; physical Pixel verification remains required.'],reports},null,2)+'\n');

// Keep the resource manifest aware of the derived profiles without replacing desktop metrics.
const budgetPath='docs/resource-budgets.json';
const budget=JSON.parse(await readFile(budgetPath,'utf8'));
budget.mobileProfiles=reports.map(r=>({name:r.name+'-mobile',bytes:r.mobileBytes,sourceBytes:r.sourceBytes,triangles:r.geometry.triangles,nodes:r.geometry.nodes,textureMaxDimension:cap,estimatedImageRGBA8MipBytes:r.imageBytesMobile,geometryUnchanged:true}));
budget.mobileAudit='mobile-model-audit.json';
await writeFile(budgetPath,JSON.stringify(budget,null,2)+'\n');
