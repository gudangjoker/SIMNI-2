import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { executeAdminOperation, recoverAdminOperation } from '../edge/admin-operations.js';
import { subscribeLivePages } from '../js/database/live-pages.js';
const require = createRequire(new URL('../test-output/tahap7-tools/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app');
const core = createRequire(import.meta.url)('../features/lps/lps-core.js');
const projectId = 'demo-simni-tahap7';
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw Error('Demo project only');
const evidence = { projectId, checks: [], buildId: JSON.parse(await readFile('public/build-manifest.json', 'utf8')).buildId };
let env;
async function test(name, fn) { try { await fn(); evidence.checks.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (error) { evidence.checks.push({ name, status: 'FAIL', error: error.message }); process.exitCode = 1; console.error('FAIL', name, error.message); } }
try {
    env = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9190, rules: await readFile('firebase/database.rules.production.json', 'utf8') } });
    await env.clearDatabase();
    const owner = env.authenticatedContext('owner', { email: 'unggaran.sditbm@gmail.com' }).database();
    const other = env.authenticatedContext('other', { email: 'other@qa.invalid' }).database();
    const base = 'workspaces/ws_superuser/academicYears/2026-2027';
    await env.withSecurityRulesDisabled(async context => {
        await context.database().ref('users').set({ owner: { status: 'active', role: 'superuser', workspaceId: 'ws_superuser', activeAcademicYearId: '2026-2027', classId: '3A' }, other: { status: 'active', role: 'vip', workspaceId: 'ws_pjok', activeAcademicYearId: '2026-2027', classId: 'PJOK' } });
    });
    await test('Unauthenticated database read denied', () => assertFails(env.unauthenticatedContext().database().ref(base).get()));
    await test('Cross workspace write denied', () => assertFails(other.ref(base + '/notes/n1').set({ Catatan: 'invalid access' })));
    const note = { ID_Catatan: 'n1', Tanggal: '2026-09-13', ID_Siswa: 's1', NISN: '1200000001', Nama: 'Siswa sintetis', Catatan: 'Catatan sah', Kelas: '3A' };
    await test('Valid note accepted', () => assertSucceeds(owner.ref(base + '/notes/n1').set(note)));
    await test('Oversized note denied', () => assertFails(owner.ref(base + '/notes/n1').set({ ...note, Catatan: 'x'.repeat(5001) })));
    await test('Valid HTTPS document accepted', () => assertSucceeds(owner.ref(base + '/documents/d1').set({ nama_file: 'Dokumen sintetis', url_file: 'https://example.invalid/a.pdf', public_id: 'local/d1', bytes: 100 })));
    await test('Scalar LPS template denied', () => assertFails(owner.ref(base + '/lps/templates/t1').set('malformed')));
    await test('Malformed LPS object denied', () => assertFails(owner.ref(base + '/lps/templates/t1').set({ arbitrary: true })));
    await test('Malformed LPS report denied', () => assertFails(owner.ref(base + '/lps/reports/r1').set({ arbitrary: true })));
    for (const period of ['lps_mid_s1', 'blp_final_s1']) {
        const template = core.createDefaultTemplate({ nama_kelas: 'Kelas 3A', tahun_pelajaran: '2026-2027' }, period);
        await test(`${period}: actual default template accepted`, () => assertSucceeds(owner.ref(base + '/lps/templates/' + template.templateId).set(template)));
        template.sections[0].title = 'Judul hasil edit guru';
        await test(`${period}: editable template accepted`, () => assertSucceeds(owner.ref(base + '/lps/templates/' + template.templateId).set(template)));
        const report = { reportId: 'r1', templateId: template.templateId, templateSnapshot: template, studentSnapshot: { studentId: '1200000001', name: 'Siswa sintetis' }, reportType: template.reportType, status: 'draft' };
        await test(`${period}: draft report accepted`, () => assertSucceeds(owner.ref(base + '/lps/reports/r1').set(report)));
        report.status = 'final'; report.hash = 'a'.repeat(64);
        await test(`${period}: final report accepted`, () => assertSucceeds(owner.ref(base + '/lps/reports/r1').set(report)));
        await test(`${period}: nested revision snapshot accepted`, () => assertSucceeds(owner.ref(base + '/lps/revisions/r1/r001_test').set(report)));
    }
    await test('Archive index reservation accepted', () => assertSucceeds(owner.ref('workspaces/ws_superuser/archives/_index/2026-2027/a1').set({ archiveId: 'a1', pending: true })));

    // The original S05 exploit must now be rejected by real RTDB rules.
    const operationId = 'op_unexecuted_' + Date.now();
    let accepted = false;
    try {
        await owner.ref('auditLogs/ws_superuser/' + operationId).set({ operationId, action: 'annual_reset', uid: 'owner', email: 'unggaran.sditbm@gmail.com', role: 'superuser', workspaceId: 'ws_superuser', academicYearId: '2026-2027', timestamp: { '.sv': 'timestamp' }, status: 'committed', details: { fixtureOnly: true } });
        accepted = true;
    } catch (_) {}
    const originalNoteStillExists = (await owner.ref(base + '/notes/n1').get()).exists();
    await test('S05: client cannot forge a committed audit receipt', async () => { assert.equal(accepted, false); assert.equal(originalNoteStillExists, true); });
    await test('Server reservations cannot be read or written by client', async () => { await assertFails(owner.ref('administrativeOperations/ws_superuser/secret').get()); await assertFails(owner.ref('administrativeOperations/ws_superuser/secret').set({state:'completed'})); });
    const privileged = async fn => { let result; await env.withSecurityRulesDisabled(async context => { result = await fn(context.database()); }); return result; };
    let userPatches = 0, loseReceipt = false;
    const io = {
        readServer: path => privileged(async db => (await db.ref(path).get()).val()),
        readUser: async path => (await owner.ref(path).get()).val(),
        reserve: (path, value) => privileged(async db => (await db.ref(path).transaction(current => current === null ? value : undefined)).committed),
        patchUser: async updates => { userPatches++; try { await owner.ref().update(updates); } catch (e) { e.definiteRejection = true; throw e; } },
        patchServer: updates => { if (loseReceipt) throw Error('MOCK_RECEIPT_OFFLINE'); return privileged(db => db.ref().update(updates)); }
    };
    const identity = { claims: { sub:'owner', email:'unggaran.sditbm@gmail.com' }, profile: { status:'active', role:'superuser', workspaceId:'ws_superuser', classId:'3A', activeAcademicYearId:'2026-2027' } };
    const body = { operationId:'op_emulator_reset_0001', action:'annual_reset', targetId:'notes', expectedYear:'2026-2027', updates:{Catatan:null} };
    await test('S05: actual reset and server receipt succeed under production data rules', async () => { const result = await executeAdminOperation(io, identity, body); assert.equal(result.receipt.status,'committed'); assert.equal((await owner.ref(base+'/notes').get()).exists(),false); assert.equal((await owner.ref('auditLogs/ws_superuser/'+body.operationId).get()).val().authority,'server-executed-rtdb-ack'); });
    await test('S05: completed replay does not perform another data write', async () => { const n=userPatches; assert.equal((await executeAdminOperation(io, identity, body)).replayed,true); assert.equal(userPatches,n); });
    await test('S05: schema-invalid restore produces no success receipt', async () => { const bad={...body,operationId:'op_emulator_bad_00001',action:'backup_restore',updates:{Catatan:{n1:{Catatan:'invalid'}}}}; await assert.rejects(executeAdminOperation(io,identity,bad)); assert.equal((await owner.ref('auditLogs/ws_superuser/'+bad.operationId).get()).exists(),false); });
    await test('S05: lost receipt recovers from atomic marker under production rules', async () => { const b={...body,operationId:'op_emulator_recover_01'}; loseReceipt=true; await assert.rejects(executeAdminOperation(io,identity,b), e=>e.pending); loseReceipt=false; const n=userPatches; assert.equal((await recoverAdminOperation(io,identity,b.operationId)).receipt.status,'committed'); assert.equal(userPatches,n); });
    await test('S02: real RTDB numeric key ordering and inserts remain complete across live ranges', async () => {
        const sample=Object.fromEntries(Array.from({length:35},(_,i)=>[String(i),{value:i}]));
        await privileged(db=>db.ref(base+'/attendance').set(sample));
        const sdk={query:(r,...constraints)=>constraints.reduce((q,f)=>f(q),r),orderByKey:()=>r=>r.orderByKey(),startAfter:key=>r=>r.startAfter(key),endAt:key=>r=>r.endAt(key),limitToFirst:n=>r=>r.limitToFirst(n),onValue:(r,next,error)=>{r.on('value',next,error);return()=>r.off('value',next);}};
        let latest, failure;const stop=subscribeLivePages(sdk,owner.ref(base+'/attendance'),s=>latest=s.val(),e=>failure=e,{pageSize:5});
        const until=async fn=>{for(let i=0;i<200;i++){if(failure)throw failure;if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('live range timeout');};
        try {await until(()=>latest&&Object.keys(latest).length===35);assert.deepEqual({...latest},sample);await privileged(db=>db.ref(base+'/attendance/100').set({value:100}));await until(()=>latest?.['100']);assert.equal(Object.keys(latest).length,36);} finally {stop();}
    });
    await test('S05: server archive payload and index satisfy production rules', async () => {
        const database={Siswa:{},Presensi:[],Nilai_TP:{'0':null,'1':{nilai:0}}};
        const archive={archiveId:'qa_archive',scope:{workspaceId:'ws_superuser',academicYearId:'2026-2027',classId:'3A',role:'superuser'},database,integrity:{hash:await globalThis.SIMNIBackupCore.sha256(database)}};
        const result=await executeAdminOperation(io,identity,{operationId:'op_emulator_archive1',action:'annual_archive',targetId:'qa_archive',expectedYear:'2026-2027',archive});
        assert.equal(result.receipt.action,'annual_archive');
        const stored=await io.readServer('workspaces/ws_superuser/archives/2026-2027/qa_archive');assert.equal(stored.authority,'server-verified-sha256');
        const repo=await readFile('js/database/repository.js','utf8');
        const decode=vm.runInNewContext('('+repo.slice(repo.indexOf('function normalizeArchiveCompatibility('),repo.indexOf('async function readAnnualArchive(')).trim()+')');
        const decoded=decode(stored);assert.equal(await globalThis.SIMNIBackupCore.sha256(decoded.database),archive.integrity.hash);assert.equal(JSON.stringify(decoded.database),JSON.stringify(database));
    });
    await test('S05: real rollover updates both accounts atomically and emits server receipt', async () => {
        await privileged(async db=>{
            await db.ref('users').set({owner:{uid:'owner',email:'unggaran.sditbm@gmail.com',...identity.profile},vip:{uid:'vip',email:'anur.auliya01@gmail.com',status:'active',role:'vip',workspaceId:'ws_pjok',classId:'PJOK',activeAcademicYearId:'2026-2027'}});
            await db.ref('rollovers/2026-2027').set({state:'ready',readiness:{owner:{verified:true,workspaceId:'ws_superuser',academicYearId:'2026-2027',archiveHash:'a'.repeat(64)},vip:{verified:true,workspaceId:'ws_pjok',academicYearId:'2026-2027',archiveHash:'b'.repeat(64)}}});
        });
        const result=await executeAdminOperation(io,identity,{operationId:'op_emulator_rollover1',action:'year_rollover',targetId:'2027-2028',expectedYear:'2026-2027',superuserClassId:'4A'});
        assert.equal(result.receipt.action,'year_rollover');assert.equal(await io.readServer('users/owner/activeAcademicYearId'),'2027-2028');assert.equal(await io.readServer('users/vip/activeAcademicYearId'),'2027-2028');assert.equal(await io.readServer(base),null);
    });

} catch (error) { evidence.fatal = error.stack; process.exitCode = 1; console.error(error); }
finally { if (env) await env.cleanup(); await mkdir('test-output/tahap7-final', { recursive: true }); await writeFile('test-output/tahap7-final/rules-emulator.json', JSON.stringify(evidence, null, 2)); }
