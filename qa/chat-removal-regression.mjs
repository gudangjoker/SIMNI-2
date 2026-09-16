import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const policy = require('../js/auth/access-policy-core.js');
const manifest = JSON.parse(await readFile('public/build-manifest.json','utf8'));
const result = { buildId: manifest.buildId, version: manifest.version, checks: [] };
const read = p => readFile(p,'utf8');
async function test(name, fn) { await fn(); result.checks.push({name,status:'PASS'}); console.log('PASS',name); }
async function absent(p) { try { await stat(p); assert.fail('Removed path still exists: '+p); } catch(e) { if(e.code !== 'ENOENT') throw e; } }
try {
  await test('Chat source and generated hosting assets absent',async()=>{
    for(const prefix of ['', 'public/']) for(const f of ['chat','firebase-messaging-sw.js','js/auth/chat-unlock.js','js/services/chat-notifications.js']) await absent(prefix+f);
    for(const f of ['firebase-firestore.js','firebase-messaging.js']) await absent('public/vendor/firebase/'+f);
    assert.ok(!Object.keys(manifest.files).some(f=>/chat|messaging|firestore/i.test(f)));
  });
  await test('Both roles denied Chat; academic access retained',()=>{
    for(const role of ['superuser','vip']) { assert.equal(policy.hasFeature(role,'chat'),false); assert.equal(policy.hasFeature(role,'gadm'),true); }
    assert.equal(policy.hasFeature('superuser','lps'),true);
  });
  await test('Menus, auth and service worker contain no Chat execution',async()=>{
    for(const f of ['index.html','js/auth/auth.js','sw.js']) assert.doesNotMatch(await read('public/'+f),/\.\/chat\/|data-requires-feature="chat"|ChatNotifications|ChatAccountUnlock|firebase-messaging|firebase-firestore/i,f);
    assert.doesNotMatch(await read('public/sw.js'),/['"](?:push|notificationclick)['"]/);
  });
  await test('Every local production import and SW precache asset resolves',async()=>{
    for(const f of Object.keys(manifest.files).filter(f=>/\.(js|mjs)$/.test(f)&&!f.startsWith('vendor/'))) {
      const src=await read('public/'+f);
      for(const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)) await stat(path.resolve('public',path.dirname(f),m[1]));
    }
    const sw=await read('public/sw.js');const precache=sw.slice(sw.indexOf('const PRECACHE_PATHS'),sw.indexOf('const PRECACHE_URLS'));
    for(const m of precache.matchAll(/'\.\/([^']+)'/g)) await stat('public/'+m[1]);
  });
  await test('Cloudinary kept with generic configuration and no Chat backend',async()=>{
    const worker=await read('edge/worker.js'),client=await read('public/js/services/edge-service.js');
    assert.match(worker,/verifyFirebaseIdToken/);assert.match(worker,/authoritativeProfile/);
    assert.match(worker,/\/v1\/cloudinary\/sign/);assert.match(worker,/\/v1\/cloudinary\/delete/);
    assert.doesNotMatch(worker,/chat|firestore|firebase.messaging|\/v1\/push|\/v1\/media|\/v1\/session/i);
    assert.match(client,/simni-edge-url/);assert.doesNotMatch(client,/SIMNIChatDeployment|simni-chat-edge-url/);
    const config=JSON.parse(await read('edge/wrangler.jsonc'));assert.equal(config.name,'simni-assets-gateway');assert.equal(config.r2_buckets,undefined);
    assert.equal(JSON.parse(await read('firebase.json')).firestore,undefined);
    await absent('public/edge');
  });
  await test('Backup scope no longer advertises Chat',()=>{
    const core=require('../features/backup/backup-core.js');const recovery=core.getSubsystemRecoveryManifest();
    assert.equal(recovery.summary.totalSubsystems,4);assert.equal(recovery.subsystems.chat,undefined);
  });
} catch(e) { result.error=e.stack; process.exitCode=1; console.error(e); }
await mkdir('test-output/tahap7-final',{recursive:true});
await writeFile('test-output/tahap7-final/chat-removal.json',JSON.stringify(result,null,2));
