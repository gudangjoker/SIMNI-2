// Diagnostic of a known release blocker, NOT a passing safety test.
import { readFile, writeFile } from 'node:fs/promises';
globalThis.window=globalThis;
const {purgeSafeCaches}=await import('../js/database/local-cache.js');
const manifest=JSON.parse(await readFile('public/build-manifest.json','utf8'));
const candidates=['simni-app-'+manifest.version,'simni-runtime-'+manifest.version,'unrelated-app-cache'];
const deleted=[];
// These objects are entirely in-memory fixtures; no browser storage is touched.
globalThis.caches={keys:async()=>candidates,open:async()=>({keys:async()=>[],match:async()=>null}),delete:async name=>{deleted.push(name);return true;}};
await purgeSafeCaches();
const result={buildId:manifest.buildId,kind:'KNOWN_BLOCKER_DIAGNOSTIC',finding:'S07',status:deleted.includes(candidates[0])&&deleted.includes(candidates[2])?'REPRODUCED':'NOT_REPRODUCED',fixtureCacheNames:candidates,deletedCacheNames:deleted,impact:'The safe purge function removes active app-shell and unrelated caches, not only SIMNI runtime entries.',scope:'Only synthetic Cache API objects in a Node process; no real browser data touched'};
await writeFile('test-output/tahap7-final/cache-gap.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
