import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { stat, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Never join unrelated nodes: visibility groups and permanent device IDs are a contract.
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const result=[];
for (const name of ['first-room','house']) {
  const source=path.resolve(`public/models/${name}.glb`);
  await mkdir('assets/uncompressed',{recursive:true});
  const backup=path.resolve(`assets/uncompressed/${name}.glb`);
  await copyFile(source,backup);
  const document=await io.read(backup);
  const names=document.getRoot().listNodes().map(n=>n.getName());
  await document.transform(dedup(),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));
  const after=document.getRoot().listNodes().map(n=>n.getName());
  for(const name of names)if(!after.includes(name))throw new Error(`Optimization removed named node ${name}`);
  await io.write(source,document);
  const bytes=(await stat(source)).size,originalBytes=(await stat(backup)).size;
  result.push({name,bytes,originalBytes,compression:'EXT_meshopt_compression',nodes:after.length});
}
await writeFile('docs/resource-budgets.json',JSON.stringify({created:new Date().toISOString(),models:result,textureCompression:'Embedded small PNG textures; no external texture/decoder requests. Meshopt decoder bundled in application.',note:'FPS and load-time budgets require device measurements; file sizes alone do not prove performance.'},null,2));
console.log(JSON.stringify(result,null,2));
