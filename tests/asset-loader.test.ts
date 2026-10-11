import assert from 'node:assert/strict';
import test from 'node:test';
import { LatestAssetLoader } from '../src/scene/LatestAssetLoader';

type Asset = { name:string };
function deferred<T>() {
  let resolve!:(value:T)=>void, reject!:(reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
// Drain promise continuations, without wall-clock sleeps or a real fetch/decoder.
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
function harness(abortableFetch=false) {
  const starts:string[]=[],commits:{asset:Asset;key:string}[]=[],released:Asset[]=[],errors:{error:unknown;key:string}[]=[];
  const calls:{key:string;signal:AbortSignal;result:ReturnType<typeof deferred<Asset>>}[]=[];
  let active=0,maxActive=0,aborts=0;
  const loader=new LatestAssetLoader<Asset>({
    start:key=>{starts.push(key);},
    load:(key,signal)=>{
      const result=deferred<Asset>();active++;maxActive=Math.max(maxActive,active);calls.push({key,signal,result});
      if(abortableFetch)signal.addEventListener('abort',()=>{aborts++;result.reject(new DOMException('Superseded','AbortError'));},{once:true});
      return result.promise.finally(()=>{active--;});
    },
    commit:(asset,key)=>{commits.push({asset,key});},
    release:asset=>{released.push(asset);},
    error:(error,key)=>{errors.push({error,key});},
  });
  return {loader,starts,commits,released,errors,calls,get active(){return active;},get maxActive(){return maxActive;},get aborts(){return aborts;}};
}

test('rapid A/B/C requests keep one load active and decode only the latest queued key', async t=>{
  const h=harness();t.after(()=>h.loader.dispose());
  h.loader.request('A');h.loader.request('B');h.loader.request('C');
  assert.deepEqual(h.calls.map(c=>c.key),['A']);assert.equal(h.active,1);assert.equal(h.calls[0].signal.aborted,true);
  const a={name:'decoded A'},c={name:'decoded C'};
  h.calls[0].result.resolve(a);await settle();
  assert.deepEqual(h.calls.map(c=>c.key),['A','C']);assert.equal(h.active,1);assert.equal(h.maxActive,1);
  assert.deepEqual(h.released,[a]);assert.equal(h.commits.length,0);
  h.calls[1].result.resolve(c);await settle();
  assert.deepEqual(h.commits,[{asset:c,key:'C'}]);assert.equal(h.active,0);assert.equal(h.maxActive,1);
  assert.deepEqual(h.starts,['A','C']);assert.deepEqual(h.errors,[]);
});

test('superseded fetch receives abort and its AbortError cannot replace the current status', async t=>{
  const h=harness(true);t.after(()=>h.loader.dispose());
  h.loader.request('first-room');h.loader.request('house');await settle();
  assert.equal(h.aborts,1);assert.equal(h.calls[0].signal.aborted,true);
  assert.deepEqual(h.calls.map(c=>c.key),['first-room','house']);assert.equal(h.maxActive,1);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.released,[]);
  const house={name:'house'};h.calls[1].result.resolve(house);await settle();
  assert.deepEqual(h.commits,[{asset:house,key:'house'}]);assert.equal(h.calls[1].signal.aborted,false);
});

test('a decoder ignoring abort releases its stale asset exactly once and never commits it', async t=>{
  const h=harness();t.after(()=>h.loader.dispose());
  h.loader.request('house');const stale={name:'old house'};
  h.loader.request('first-room');h.calls[0].result.resolve(stale);await settle();
  assert.equal(h.released.length,1);assert.strictEqual(h.released[0],stale);assert.equal(h.commits.length,0);
  const current={name:'current room'};h.calls[1].result.resolve(current);await settle();
  assert.equal(h.released.length,1);assert.strictEqual(h.commits[0].asset,current);
  assert.ok(!h.commits.some(c=>c.asset===stale));
});

test('dispose during unabortable decode releases the result and rejects subsequent requests', async()=>{
  const h=harness();h.loader.request('A');const asset={name:'late decoded A'};
  h.loader.dispose();h.loader.dispose();h.loader.request('B');
  assert.equal(h.calls[0].signal.aborted,true);assert.equal(h.calls.length,1);
  h.calls[0].result.resolve(asset);await settle();
  assert.deepEqual(h.released,[asset]);assert.deepEqual(h.commits,[]);assert.deepEqual(h.errors,[]);
  h.loader.request('C');await settle();assert.equal(h.calls.length,1);assert.equal(h.active,0);
});

test('A → B → A rejects the first A by revision even though its key matches the latest request', async t=>{
  const h=harness();t.after(()=>h.loader.dispose());
  h.loader.request('A');h.loader.request('B');h.loader.request('A');
  const firstA={name:'first A'},secondA={name:'second A'};
  h.calls[0].result.resolve(firstA);await settle();
  assert.deepEqual(h.calls.map(c=>c.key),['A','A']);assert.deepEqual(h.released,[firstA]);assert.deepEqual(h.commits,[]);
  assert.equal(h.calls[1].signal.aborted,false);assert.equal(h.maxActive,1);
  h.calls[1].result.resolve(secondA);await settle();
  assert.deepEqual(h.commits,[{asset:secondA,key:'A'}]);assert.equal(h.released.length,1);
});

test('current failure is reported once and the same key cannot autoretry until a different request', async t=>{
  const h=harness();t.after(()=>h.loader.dispose());
  const failure=new Error('decode failed');h.loader.request('A');h.calls[0].result.reject(failure);await settle();
  assert.deepEqual(h.errors,[{error:failure,key:'A'}]);assert.equal(h.active,0);
  h.loader.request('A');h.loader.request('A');await settle();assert.equal(h.calls.length,1);assert.equal(h.errors.length,1);
  h.loader.request('B');h.calls[1].result.resolve({name:'B'});await settle();
  h.loader.request('A');assert.deepEqual(h.calls.map(c=>c.key),['A','B','A']);
  const recovered={name:'recovered A'};h.calls[2].result.resolve(recovered);await settle();
  assert.strictEqual(h.commits.at(-1)?.asset,recovered);assert.equal(h.errors.length,1);assert.equal(h.maxActive,1);
});

test('late non-abort failure from an obsolete decoder is ignored while the latest request proceeds', async t=>{
  const h=harness();t.after(()=>h.loader.dispose());
  h.loader.request('A');h.loader.request('B');h.calls[0].result.reject(new Error('stale decoder failure'));await settle();
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.calls.map(c=>c.key),['A','B']);
  const b={name:'B'};h.calls[1].result.resolve(b);await settle();assert.deepEqual(h.commits,[{asset:b,key:'B'}]);
});

test('duplicate active and committed keys neither abort nor reload an asset', async t=>{
  const h=harness(true);t.after(()=>h.loader.dispose());
  h.loader.request('A');h.loader.request('A');assert.equal(h.calls[0].signal.aborted,false);assert.equal(h.calls.length,1);
  const a={name:'A'};h.calls[0].result.resolve(a);await settle();h.loader.request('A');await settle();
  assert.equal(h.calls.length,1);assert.equal(h.aborts,0);assert.deepEqual(h.commits,[{asset:a,key:'A'}]);assert.deepEqual(h.released,[]);
});

test('start exception is reported once without starting a fetch or stranding the queue', async t=>{
  const failure=new Error('scene preparation failed'),starts:string[]=[],loads:string[]=[],errors:unknown[]=[],commits:Asset[]=[];
  const loader=new LatestAssetLoader<Asset>({
    start:key=>{starts.push(key);if(key==='A')throw failure;},
    load:async key=>{loads.push(key);return {name:key};},
    commit:asset=>{commits.push(asset);},release:()=>assert.fail('nothing was decoded before start failed'),error:e=>{errors.push(e);},
  });t.after(()=>loader.dispose());
  loader.request('A');await settle();loader.request('A');await settle();
  assert.deepEqual(errors,[failure]);assert.deepEqual(starts,['A']);assert.deepEqual(loads,[]);
  loader.request('B');await settle();assert.deepEqual(loads,['B']);assert.deepEqual(commits,[{name:'B'}]);
});

test('commit exception releases its decoded asset once and leaves the queue usable', async t=>{
  const failure=new Error('scene setup failed'),a={name:'A'},b={name:'B'},released:Asset[]=[],errors:unknown[]=[],committed:Asset[]=[];
  const loader=new LatestAssetLoader<Asset>({
    start:()=>{},load:async key=>key==='A'?a:b,
    commit:(asset,key)=>{if(key==='A')throw failure;committed.push(asset);},
    release:asset=>{released.push(asset);},error:e=>{errors.push(e);},
  });t.after(()=>loader.dispose());
  loader.request('A');await settle();loader.request('A');await settle();
  assert.deepEqual(errors,[failure]);assert.deepEqual(released,[a]);assert.deepEqual(committed,[]);
  loader.request('B');await settle();assert.deepEqual(committed,[b]);assert.deepEqual(released,[a]);
});
