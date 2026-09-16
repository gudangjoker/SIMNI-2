import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const storage=new Map(), calls=[];
globalThis.window={location:{origin:'https://qa.invalid'},SIMNIEdgeDeployment:{edgeBaseUrl:'https://qa.invalid'}};
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.qaAuth={currentUser:{uid:'qa',getIdToken:async()=> 'mock-only'}};
let mode='gateway';
globalThis.fetch=async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    if(mode==='gateway') return new Response('Bad gateway',{status:502});
    if(mode==='pending') return Response.json({ok:false,pending:true,message:'pending'},{status:409});
    if(mode==='denied') return Response.json({ok:false,message:'schema rejected'},{status:400});
    return Response.json({ok:true,receipt:{status:'committed'},replayed:true});
};
const source=(await readFile('js/services/edge-service.js','utf8')).replace(/import \{ auth \} from [^;]+;/,'const auth = globalThis.qaAuth;');
const {commitAdministrativeOperation:commit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const payload={action:'annual_reset',targetId:'all',expectedYear:'2026-2027',updates:{Presensi:null}};
const checks=[];
async function test(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
await test('Gateway 502 retains retry ID across subsequent request',async()=>{await assert.rejects(commit(payload));const id=calls.at(-1).body.operationId;assert.equal(storage.size,1);mode='pending';await assert.rejects(commit(payload));assert.equal(calls.at(-1).body.operationId,id);assert.equal(storage.size,1);});
await test('Confirmed replay clears persisted retry without new ID',async()=>{const id=calls.at(-1).body.operationId;mode='success';await commit(payload);assert.equal(calls.at(-1).body.operationId,id);assert.equal(storage.size,0);});
await test('Definite schema rejection permits corrected payload',async()=>{mode='denied';await assert.rejects(commit(payload));assert.equal(storage.size,0);});
await test('Changed pending payload checks status instead of executing mutation',async()=>{mode='gateway';await assert.rejects(commit(payload));mode='success';await assert.rejects(commit({...payload,updates:{Jurnal:null}}),/Periksa data terbaru/);assert.ok(calls.at(-1).url.endsWith('/status'));assert.equal(storage.size,0);});
await mkdir('test-output/three-findings',{recursive:true});await writeFile('test-output/three-findings/admin-client.json',JSON.stringify({checks,scope:'Production client service, mocked HTTP and Web Storage'},null,2));
