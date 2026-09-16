import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { subscribeLivePages } from '../js/database/live-pages.js';
const result={checks:[],startedAt:new Date().toISOString()};
async function test(name, fn){await fn();result.checks.push({name,status:'PASS'});console.log('PASS',name);}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await delay(10);}throw Error('Condition timed out');}

try {
globalThis.window=globalThis;
const {purgeSafeCaches}=await import('../js/database/local-cache.js');
await test('S07 purge preserves active app, old app and unrelated caches',async()=>{
 const names=['simni-app-4.7.1','simni-app-4.7.0','unrelated','simni-runtime-4.7.0','simni-runtime-4.7.1'],deleted=[];
 globalThis.caches={keys:async()=>names,open:async()=>({keys:async()=>[]}),delete:async n=>{deleted.push(n);return true;}};
 await purgeSafeCaches();assert.deepEqual(deleted,['simni-runtime-4.7.0','simni-runtime-4.7.1']);
});
const entries=new Map();let quotaFailure=false, fakeNow=Date.now();
const cache={keys:async()=>[...entries.keys()].map(url=>new Request(url)),match:async r=>entries.get(r.url)?.clone(),delete:async r=>entries.delete(r.url),put:async(r,v)=>{if(quotaFailure)throw Error('Quota exceeded');entries.set(r.url,v);}};
const sw=await readFile('sw.js','utf8');
const context=vm.createContext({console,URL,Request,Response,Headers,Blob,TextEncoder,Map,Set,Promise,Date:class extends Date {static now(){return fakeNow;}},setTimeout,clearTimeout,importScripts(){},SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},self:{SIMNI_VERSION_MANIFEST:{appVersion:'qa',cacheVersion:'qa'},registration:{scope:'https://qa.invalid/'},addEventListener(){}},caches:{open:async()=>cache},fetch:async()=>new Response('network image',{headers:{'Content-Type':'image/png'}})});
// Use the production policy/functions, excluding unrelated install configuration.
const functions=sw.slice(sw.indexOf('const RUNTIME_CACHE_POLICY'),sw.indexOf('/*',sw.indexOf('async function storeRuntimeAsset')));
const runtime=sw.slice(sw.indexOf('async function staleWhileRevalidateRuntimeAsset'),sw.indexOf('/*',sw.indexOf('async function staleWhileRevalidateRuntimeAsset')));
// The function contains comments: locate its end by the following INSTALL marker.
const runtimeEnd=sw.lastIndexOf('/*',sw.indexOf(' * INSTALL EVENT'));
vm.runInContext('const RUNTIME_CACHE_NAME="simni-runtime-qa";const isSuccessfulResponse=r=>r.ok;const offlineResponse=()=>new Response("offline",{status:503});\n'+functions+'\n'+sw.slice(sw.indexOf('async function staleWhileRevalidateRuntimeAsset'),runtimeEnd),context);
await test('S07 concurrent insertions enforce 64 entries',async()=>{
 const store=vm.runInContext('storeRuntimeAsset',context);
 await Promise.all(Array.from({length:80},(_,i)=>store(cache,new Request('https://qa.invalid/'+i+'.png'),new Response('pixel'))));
 assert.equal(entries.size,64);
});
await test('S07 byte cap and expiration are enforced',async()=>{
 const store=vm.runInContext('storeRuntimeAsset',context);
 await Promise.all([0,1,2].map(i=>store(cache,new Request('https://qa.invalid/large'+i),new Response(new Uint8Array(7*1024*1024)))));
 const total=[...entries.values()].reduce((n,r)=>n+Number(r.headers.get('x-simni-cache-bytes')),0);assert.ok(total<=16*1024*1024);
 fakeNow+=8*86400000;await store(cache,new Request('https://qa.invalid/fresh'),new Response('fresh'));assert.equal(entries.size,1);
});
await test('S07 quota failure does not discard the network response',async()=>{
 quotaFailure=true;const fn=vm.runInContext('staleWhileRevalidateRuntimeAsset',context);
 const response=await fn(new Request('https://qa.invalid/quota'));assert.equal(await response.text(),'network image');quotaFailure=false;
});

let data=Object.fromEntries(Array.from({length:25001},(_,i)=>['k'+String(i).padStart(6,'0'),{value:'x'.repeat(720),index:i}]));
const listeners=new Set();let maxSeen=0,pagesSnapshot=null,errors=[];
function snap(constraints){let keys=Object.keys(data).sort();for(const c of constraints){if(c.type==='start')keys=keys.filter(k=>k>c.value);if(c.type==='end')keys=keys.filter(k=>k<=c.value);}const limit=constraints.find(c=>c.type==='limit')?.value;keys=keys.slice(0,limit);maxSeen=Math.max(maxSeen,keys.length);return {val:()=>Object.fromEntries(keys.map(k=>[k,data[k]])),forEach:fn=>keys.forEach(k=>fn({key:k,val:()=>data[k]}))};}
const sdk={orderByKey:()=>({type:'order'}),startAfter:value=>({type:'start',value}),endAt:value=>({type:'end',value}),limitToFirst:value=>({type:'limit',value}),query:(_, ...constraints)=>constraints,onValue:(constraints,success,failure)=>{const listener={constraints,success,failure};listeners.add(listener);queueMicrotask(()=>{if(listeners.has(listener))success(snap(constraints));});return()=>listeners.delete(listener);}};
let stop;
await test('S02 collection above 25000 records and 16 MiB becomes complete in bounded live pages',async()=>{
 assert.ok(new TextEncoder().encode(JSON.stringify(data)).length>16*1024*1024);
 stop=subscribeLivePages(sdk,{},snapshot=>pagesSnapshot=snapshot,error=>errors.push(error),{debounceMs:1});
 await until(()=>pagesSnapshot?.pagedComplete);assert.equal(Object.keys(pagesSnapshot.val()).length,25001);assert.ok(pagesSnapshot.pageCount>1);assert.ok(maxSeen<=1001);assert.deepEqual(errors,[]);
});
await test('S02 edits, insertion across boundaries and deletion remain complete',async()=>{
 pagesSnapshot=null;delete data.k001000;data.k001000a={value:'inserted'};data.k024999={value:'changed'};
 for(const l of [...listeners])l.success(snap(l.constraints));await until(()=>pagesSnapshot!==null);
 assert.equal(pagesSnapshot.val().k001000,undefined);assert.equal(pagesSnapshot.val().k001000a.value,'inserted');assert.equal(pagesSnapshot.val().k024999.value,'changed');assert.equal(Object.keys(pagesSnapshot.val()).length,25001);
});
await test('S02 failed range never publishes a partial healthy collection',async()=>{
 pagesSnapshot=null;const l=[...listeners][0];l.failure(Error('Denied'));for(const other of [...listeners].slice(1))other.success(snap(other.constraints));await delay(40);assert.equal(pagesSnapshot,null);assert.equal(errors.length,1);
 l.success(snap(l.constraints));await until(()=>pagesSnapshot!==null);assert.equal(Object.keys(pagesSnapshot.val()).length,25001);
});
await test('S02 teardown removes all subscriptions and pending publications',async()=>{stop();assert.equal(listeners.size,0);pagesSnapshot=null;await delay(40);assert.equal(pagesSnapshot,null);});
}catch(e){result.error=e.stack;process.exitCode=1;console.error(e);}finally{await mkdir('test-output/three-findings',{recursive:true});await writeFile('test-output/three-findings/local-contracts.json',JSON.stringify(result,null,2));}
