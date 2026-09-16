import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const manifest=await read('public/build-manifest.json');
const cumulative=await read('test-output/tahap7-final/cumulative-results.json');
if(cumulative.buildId!==manifest.buildId || cumulative.fatal || cumulative.suites.length!==20 || cumulative.suites.some(s=>s.status!=='PASS')) throw Error('Cumulative evidence incomplete');
for(const s of cumulative.suites) if(await hash('test-output/tahap7-final/'+s.log)!==s.logHash) throw Error('Log changed: '+s.script);
const files={academic:'test-output/academic-4.6.8/results.json',lifecycle:'test-output/tahap7-final/lifecycle-browser.json',uiux:'test-output/uiux-4.6.8/reconstruction-results.json',reflow:'test-output/uiux-4.6.8/reflow/results.json',lps:'test-output/lps-template-fidelity/workflow-results.json',fidelity:'test-output/lps-template-fidelity/native-fidelity-results.json',artifact:'test-output/lps-template-fidelity/final-artifact-audit.json',rules:'test-output/tahap7-final/rules-emulator.json',assets:'test-output/tahap7-final/asset-worker.json',noChat:'test-output/tahap7-final/chat-removal.json',cacheAndCapacity:'test-output/three-findings/local-contracts.json',admin:'test-output/three-findings/admin-operations.json',adminClient:'test-output/three-findings/admin-client.json'};
const evidence={};
for(const [name,file] of Object.entries(files)) {
    const v=await read(file),checks=v.checks||v.results||[];
    if(name==='fidelity' && checks.length!==27) throw Error('Incomplete XLSX fidelity evidence');
    if(v.buildId && v.buildId!==manifest.buildId) throw Error('Other build: '+name);
    if(v.fatal||v.error||v.fail||v.failures?.length||v.errors?.length||v.external?.length||checks.some(c=>c.status==='FAIL')) throw Error('Failed evidence: '+name);
    evidence[name]={file,sha256:await hash(file),checks:checks.length};
}
const sourceHashes={};
for(const file of ['firebase.json','firebase/database.rules.production.json','edge/worker.js','edge/admin-operations.js','edge/wrangler.jsonc','js/services/edge-service.js','js/database/live-pages.js','js/database/sync.js','js/database/local-cache.js','js/database/repository.js','features/backup/backup-core.js','js/auth/access-policy-core.js','js/database/workspace-paths-core.js','sw.js','scripts/build-hosting.mjs','scripts/verify-hosting.mjs','test-output/three-findings-worker-build/worker.js']) sourceHashes[file]=await hash(file);
let bytes=0;for(const file of Object.keys(manifest.files))bytes+=(await stat('public/'+file)).size;
const result={completedAt:new Date().toISOString(),version:manifest.version,buildId:manifest.buildId,hostingFiles:Object.keys(manifest.files).length,hostingBytes:bytes,suites:20,evidence,sourceHashes,localGate:'PASS',findings:['S07','S02','S05'].map(id=>({id,status:'RESOLVED_LOCALLY'})),deployment:'NOT_PERFORMED_FOR_4.7.2',deploymentDependencies:['New assets/admin Worker with secrets and confirmed URL','RTDB rules before Hosting','Administrative maintenance for old clients'],limits:['Active year still materialized in memory for legacy UI; live queries bounded by record count and split on received byte size','Cache snapshot 32 MiB and total 96 MiB remain; online writes survive cache persistence refusal','Unknown commit with no provable marker stays pending for operator review','No cloud capacity/CPU, physical-device/APK, production-write or long-term-soak certification','Lifecycle baseline is local 4.7.0, not deployed 4.6.9']};
await mkdir('test-output/three-findings',{recursive:true});await writeFile('test-output/three-findings/final-evidence.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
