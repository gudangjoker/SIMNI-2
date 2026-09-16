import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const { default: worker } = await import('../edge/worker.js');
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'local-test-key'};
const privateBytes=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
const env={FIREBASE_PROJECT_ID:'demo-simni-assets',FIREBASE_DATABASE_URL:'https://database.qa.invalid',FIREBASE_SERVICE_ACCOUNT_EMAIL:'qa@demo.invalid',FIREBASE_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+privateBytes+'\n-----END PRIVATE KEY-----',SIMNI_ALLOWED_ORIGINS:'https://simni.qa.invalid',CLOUDINARY_CLOUD_NAME:'qa-cloud',CLOUDINARY_API_KEY:'qa-key',CLOUDINARY_API_SECRET:'qa-secret',CLOUDINARY_UPLOAD_PRESET:'qa-signed'};
const base64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function token(overrides={}) {
  const now=Math.floor(Date.now()/1000),unsigned=base64({alg:'RS256',kid:jwk.kid})+'.'+base64({aud:env.FIREBASE_PROJECT_ID,iss:'https://securetoken.google.com/'+env.FIREBASE_PROJECT_ID,sub:'owner',iat:now,exp:now+600,...overrides});
  return unsigned+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(unsigned))).toString('base64url');
}
const validToken=await token({email:'unggaran.sditbm@gmail.com'});let role='superuser',deletes=0, adminMode=false;
const adminStore=new Map(); let userPatches=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
  const value=String(url);
  if(value.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) return Response.json({keys:[jwk]});
  if(value==='https://oauth2.googleapis.com/token') return Response.json({access_token:'local-oauth',expires_in:3600});
  if(value===env.FIREBASE_DATABASE_URL+'/users/owner.json') return Response.json({status:'active',role,workspaceId:adminMode?'ws_superuser':'ws1',classId:'3A',activeAcademicYearId:'2026-2027'});
  if(adminMode && value.startsWith(env.FIREBASE_DATABASE_URL+'/')) {
    const url=new URL(value), p=url.pathname.slice(1,-5);
    if(init.method==='GET') return Response.json(adminStore.get(p)||null);
    if(init.method==='PUT') { assert.equal(init.headers['if-match'],'null_etag'); assert.equal(init.headers.Authorization,'Bearer local-oauth'); if(adminStore.has(p)) return new Response(null,{status:412}); const data=JSON.parse(init.body);adminStore.set(p,data);return Response.json(data); }
    if(init.method==='PATCH') {
      if(url.searchParams.has('auth')) { assert.equal(url.searchParams.get('auth'),validToken); assert.equal(init.headers.Authorization,undefined); userPatches++; }
      else assert.equal(init.headers.Authorization,'Bearer local-oauth');
      for(const [key,value] of Object.entries(JSON.parse(init.body))) value===null?adminStore.delete(key):adminStore.set(key,value);
      return new Response(null,{status:204});
    }
  }
  if(value==='https://api.cloudinary.com/v1_1/qa-cloud/raw/destroy') {deletes++;assert.ok(init.body.get('signature'));return Response.json({result:'ok'});}
  throw Error('Unexpected external request blocked: '+value);
};
const evidence={buildId:JSON.parse(await readFile('public/build-manifest.json','utf8')).buildId,checks:[],network:'All fetch calls intercepted locally; no real cloud requests'};
async function request(route,body={},jwt=validToken,origin='https://simni.qa.invalid') {
  return worker.fetch(new Request('https://worker.qa.invalid'+route,{method:'POST',headers:{origin,authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify(body)}),env);
}
async function test(name,fn){await fn();evidence.checks.push({name,status:'PASS'});console.log('PASS',name);}
const payload={purpose:'document',fileSize:100,mime:'application/pdf'};
try {
  await test('Signed document upload survives backend separation',async()=>{const r=await request('/v1/cloudinary/sign',payload);assert.equal(r.status,200);const b=await r.json();assert.match(b.signature,/^[a-f0-9]{40}$/);assert.match(b.publicId,/^simni\/ws1\/2026-2027\/document\//);});
  await test('Wrong origin rejected',async()=>assert.equal((await request('/v1/cloudinary/sign',payload,validToken,'https://other.qa.invalid')).status,400));
  await test('Expired signed token rejected',async()=>assert.equal((await request('/v1/cloudinary/sign',payload,await token({exp:1}))).status,403));
  await test('Wrong Firebase project rejected',async()=>assert.equal((await request('/v1/cloudinary/sign',payload,await token({aud:'other-project'}))).status,403));
  await test('Invalid signature rejected',async()=>assert.equal((await request('/v1/cloudinary/sign',payload,validToken.slice(0,validToken.lastIndexOf('.')+1)+'AAAA')).status,403));
  await test('VIP cannot upload asset',async()=>{role='vip';try{assert.notEqual((await request('/v1/cloudinary/sign',payload)).status,200);}finally{role='superuser';}});
  await test('Oversized and invalid MIME uploads rejected',async()=>{for(const bad of [{...payload,fileSize:9*1024*1024},{...payload,mime:'application/javascript'}])assert.notEqual((await request('/v1/cloudinary/sign',bad)).status,200);});
  await test('Scoped cleanup retained',async()=>{assert.equal((await request('/v1/cloudinary/delete',{purpose:'document',publicId:'simni/ws1/2026-2027/document/a',resourceType:'raw'})).status,200);assert.equal(deletes,1);});
  await test('Cross workspace cleanup rejected before deletion',async()=>{assert.notEqual((await request('/v1/cloudinary/delete',{purpose:'document',publicId:'simni/ws2/2026-2027/document/a'})).status,200);assert.equal(deletes,1);});
  await test('Former Chat endpoints unavailable',async()=>{for(const route of ['/v1/session/sync','/v1/media/upload','/v1/push'])assert.equal((await request(route)).status,404);});
  await test('Administrative HTTP adapter uses caller token for mutation and server token for receipts',async()=>{
    adminMode=true;
    const body={operationId:'op_http_adapter_00001',action:'annual_reset',targetId:'attendance',expectedYear:'2026-2027',updates:{Presensi:null}};
    const first=await request('/v1/admin/commit',body);assert.equal(first.status,200);assert.equal((await first.json()).receipt.authority,'server-executed-rtdb-ack');
    const second=await request('/v1/admin/commit',body);assert.equal((await second.json()).replayed,true);assert.equal(userPatches,1);
    assert.equal((await request('/v1/admin/status',{operationId:body.operationId})).status,200);
  });
}catch(e){evidence.error=e.stack;console.error(e);process.exitCode=1;}finally{globalThis.fetch=originalFetch;await mkdir('test-output/tahap7-final',{recursive:true});await writeFile('test-output/tahap7-final/asset-worker.json',JSON.stringify(evidence,null,2));}
