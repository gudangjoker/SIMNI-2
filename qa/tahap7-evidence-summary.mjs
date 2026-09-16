import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read = async p => JSON.parse(await readFile(p,'utf8'));
const hash = async p => createHash('sha256').update(await readFile(p)).digest('hex');
const manifest=await read('public/build-manifest.json');
const cumulative=await read('test-output/tahap7-final/cumulative-results.json');
if(cumulative.buildId!==manifest.buildId || cumulative.fatal || cumulative.suites.length!==17 || cumulative.suites.some(s=>s.status!=='PASS')) throw Error('Final cumulative suite incomplete or failed');
for(const suite of cumulative.suites) if(await hash('test-output/tahap7-final/'+suite.log)!==suite.logHash) throw Error('Suite evidence changed: '+suite.script);
const files={
  academic:'test-output/academic-4.6.8/results.json',
  lifecycle:'test-output/tahap7-final/lifecycle-browser.json',
  uiux:'test-output/uiux-4.6.8/reconstruction-results.json',
  reflow:'test-output/uiux-4.6.8/reflow/results.json',
  lps:'test-output/lps-template-fidelity/workflow-results.json',
  fidelity:'test-output/lps-template-fidelity/native-fidelity-results.json',
  artifact:'test-output/lps-template-fidelity/final-artifact-audit.json',
  rules:'test-output/tahap7-final/rules-emulator.json',
  assets:'test-output/tahap7-final/asset-worker.json',
  chatRemoval:'test-output/tahap7-final/chat-removal.json',
  cacheGap:'test-output/tahap7-final/cache-gap.json'
};
const evidence={};
for(const [name,file] of Object.entries(files)) {
  const value=await read(file);
  if(value.buildId && value.buildId!==manifest.buildId) throw Error('Evidence uses another build: '+name);
  const checks=value.checks||value.results||[];
  if(value.fatal||value.error||value.fail||value.failures?.length||value.errors?.length||value.external?.length||checks.some(c=>c.status==='FAIL'))throw Error('Failed evidence: '+name);
  evidence[name]={file,sha256:await hash(file),checks:checks.length,buildId:value.buildId||null};
}
const sourceHashes={};
for(const file of ['firebase.json','firebase/database.rules.production.json','edge/worker.js','edge/wrangler.jsonc','scripts/build-hosting.mjs','scripts/verify-hosting.mjs'])sourceHashes[file]=await hash(file);
const result={completedAt:new Date().toISOString(),version:manifest.version,buildId:manifest.buildId,hostingFiles:Object.keys(manifest.files).length,suites:cumulative.suites.length,evidence,sourceHashes,releaseGate:'BLOCKED',openFindings:[{id:'S02',severity:'high',reason:'Operational listeners still reject required collections above 20000 records or 16 MiB; paged backup does not close this gap.'},{id:'S05',severity:'high',reason:'Client-generated committed audit entries do not prove server execution of the referenced operation.'}],limits:['No production deployment or cloud data modification','Baseline for browser upgrade/rollback is verified local 4.7.0, not deployed 4.6.9','No physical-device/APK certification or long-term soak','Chat was removed; no current Chat functional test is claimed']};
result.openFindings.push({id:'S07',severity:'high',reason:'Safe purge deletes active app-shell and unrelated Cache Storage; runtime cache also lacks automatic bounds.'});
await mkdir('test-output/tahap7-final',{recursive:true});await writeFile('test-output/tahap7-final/final-evidence.json',JSON.stringify(result,null,2));console.log(JSON.stringify({version:result.version,buildId:result.buildId,suites:result.suites,releaseGate:result.releaseGate,evidence:result.evidence},null,2));
