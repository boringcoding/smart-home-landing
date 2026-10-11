import assert from 'node:assert/strict';
import test from 'node:test';
import { SerialDecoder } from '../src/scene/SerialDecoder';

function deferred<T>() {
  let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('independent scene clients share one decoder even when the first mount is disposed', async()=>{
  const decoder=new SerialDecoder(),firstClient=new AbortController(),secondClient=new AbortController();
  const first=deferred<string>(),second=deferred<string>(),started:string[]=[];
  let active=0,maxActive=0;
  const task=(name:string,result:ReturnType<typeof deferred<string>>)=>async()=>{
    started.push(name);active++;maxActive=Math.max(maxActive,active);
    try{return await result.promise;}finally{active--;}
  };
  const a=decoder.run(task('old mount',first),firstClient.signal);await settle();
  firstClient.abort();
  const b=decoder.run(task('new mount',second),secondClient.signal);await settle();
  assert.deepEqual(started,['old mount']);assert.equal(active,1);
  first.resolve('old asset');assert.equal(await a,'old asset');await settle();
  assert.deepEqual(started,['old mount','new mount']);assert.equal(active,1);assert.equal(maxActive,1);
  second.resolve('new asset');assert.equal(await b,'new asset');assert.equal(active,0);
});

test('a queued cancelled decode never starts and the following request still runs', async()=>{
  const decoder=new SerialDecoder(),running=new AbortController(),cancelled=new AbortController(),current=new AbortController();
  const pending=deferred<number>(),started:string[]=[];
  const a=decoder.run(()=>{started.push('A');return pending.promise;},running.signal);await settle();
  const b=decoder.run(async()=>{started.push('B');return 2;},cancelled.signal);
  const rejected=assert.rejects(b,(error:unknown)=>error instanceof DOMException&&error.name==='AbortError');
  const c=decoder.run(async()=>{started.push('C');return 3;},current.signal);
  cancelled.abort();await settle();assert.deepEqual(started,['A']);
  pending.resolve(1);assert.equal(await a,1);await rejected;assert.equal(await c,3);
  assert.deepEqual(started,['A','C']);
});

test('a failed decode does not block the next independent client', async()=>{
  const decoder=new SerialDecoder(),failure=new Error('decoder failure'),pending=deferred<number>(),started:string[]=[];
  const a=decoder.run(()=>{started.push('A');return pending.promise;},new AbortController().signal);
  const rejected=assert.rejects(a,error=>error===failure);
  const b=decoder.run(async()=>{started.push('B');return 2;},new AbortController().signal);
  await settle();assert.deepEqual(started,['A']);pending.reject(failure);await rejected;
  assert.equal(await b,2);assert.deepEqual(started,['A','B']);
});

test('abort after decode starts returns the same owned result instead of discarding it', async()=>{
  const decoder=new SerialDecoder(),controller=new AbortController(),pending=deferred<{texture:object}>();
  let started=false;const result=decoder.run(()=>{started=true;return pending.promise;},controller.signal);await settle();
  assert.equal(started,true);controller.abort();const asset={texture:{}};pending.resolve(asset);
  // The stale loader needs this identity to dispose GPU/CPU resources correctly.
  assert.strictEqual(await result,asset);
});

test('an already aborted signal skips work and preserves the caller abort reason', async()=>{
  const decoder=new SerialDecoder(),controller=new AbortController(),reason=new Error('obsolete mount');controller.abort(reason);
  let invoked=false;const value=decoder.run(async()=>{invoked=true;return 1;},controller.signal);
  await assert.rejects(value,error=>error===reason);assert.equal(invoked,false);
  assert.equal(await decoder.run(async()=>2,new AbortController().signal),2);
});
