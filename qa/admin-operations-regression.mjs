import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { executeAdminOperation, recoverAdminOperation } from '../edge/admin-operations.js';
const identity = { claims: { sub: 'owner', email: 'unggaran.sditbm@gmail.com' }, profile: { status: 'active', role: 'superuser', workspaceId: 'ws_superuser', classId: '3A', activeAcademicYearId: '2026-2027' } };
const core = globalThis.SIMNIBackupCore;
const evidence = { checks: [], scope: 'Production operation engine, local in-memory IO, no network' };
function fixture() {
    const store = new Map(), events = []; let mode = '';
    const apply = updates => { for (const [path, value] of Object.entries(updates)) value === null ? store.delete(path) : store.set(path, structuredClone(value)); };
    const io = {
        readServer: async path => structuredClone(store.get(path) || null), readUser: async path => structuredClone(store.get(path) || null),
        reserve: async (path, value) => { if (store.has(path)) return false; store.set(path, structuredClone(value)); return true; },
        patchUser: async updates => { events.push('data'); if (mode === 'denied') throw Object.assign(Error('rules denied'), { definiteRejection: true }); if (mode === 'offline') throw Error('offline'); apply(updates); if (mode === 'lost-ack') throw Error('ack lost'); },
        patchServer: async updates => { events.push('receipt'); if (mode === 'receipt-failure') throw Error('receipt offline'); apply(updates); }
    };
    return { io, store, events, mode: value => mode = value };
}
const body = (id = 'op_synthetic_00000001') => ({ operationId: id, action: 'annual_reset', targetId: 'all', expectedYear: '2026-2027', updates: { Presensi: null } });
async function test(name, fn) { try { await fn(); evidence.checks.push({ name, status: 'PASS' }); console.log('PASS', name); } catch (e) { evidence.checks.push({ name, status: 'FAIL', error: e.stack }); process.exitCode = 1; console.error('FAIL', name, e); } }
await test('Receipt follows actual mutation; completed retry never mutates twice', async () => {
    const f = fixture(); const r = await executeAdminOperation(f.io, identity, body());
    assert.deepEqual(f.events, ['data', 'receipt']); assert.equal(r.receipt.status, 'committed');
    assert.equal((await executeAdminOperation(f.io, identity, body())).replayed, true); assert.equal(f.events.length, 2);
    assert.equal([...f.store.keys()].some(p => p.startsWith('administrativeCommitMarkers/')), false);
});
await test('ID reuse with changed payload rejected before data mutation', async () => { const f = fixture(); await executeAdminOperation(f.io, identity, body()); await assert.rejects(executeAdminOperation(f.io, identity, { ...body(), updates: { Jurnal: null } }), /permintaan lain/); assert.equal(f.events.filter(e => e === 'data').length, 1); });
await test('Rules rejection cannot issue a committed receipt', async () => { const f = fixture(); f.mode('denied'); await assert.rejects(executeAdminOperation(f.io, identity, body()), /rules denied/); assert.equal([...f.store.keys()].some(p => p.startsWith('auditLogs/')), false); });
await test('Unknown request outcome stays pending and never auto-repeats', async () => { const f = fixture(); f.mode('offline'); await assert.rejects(executeAdminOperation(f.io, identity, body()), e => e.pending); f.mode(''); await assert.rejects(executeAdminOperation(f.io, identity, body()), e => e.pending); assert.deepEqual(f.events, ['data']); });
for (const mode of ['lost-ack', 'receipt-failure']) await test(`${mode}: server recovers receipt from atomic nonce marker without reapplying data`, async () => {
    const f = fixture(); f.mode(mode); await assert.rejects(executeAdminOperation(f.io, identity, body()), e => e.pending); f.mode('');
    const r = await recoverAdminOperation(f.io, identity, body().operationId); assert.equal(r.receipt.status, 'committed'); assert.equal(f.events.filter(e => e === 'data').length, 1);
});
await test('Guessed marker cannot turn pending operation into committed receipt', async () => { const f = fixture(); f.mode('offline'); await assert.rejects(executeAdminOperation(f.io, identity, body())); f.store.set('administrativeCommitMarkers/ws_superuser/' + body().operationId, { uid: 'owner', nonce: 'guessed' }); await assert.rejects(recoverAdminOperation(f.io, identity, body().operationId), e => e.pending); assert.equal([...f.store.keys()].some(p => p.startsWith('auditLogs/')), false); });
await test('Wrong user cannot recover another receipt', async () => { const f = fixture(); await executeAdminOperation(f.io, identity, body()); await assert.rejects(recoverAdminOperation(f.io, { ...identity, claims: { sub: 'intruder' } }, body().operationId), /tidak ditemukan/); });
await test('Scope, path injection, reset payload and VIP reset denied', async () => {
    for (const b of [{ ...body(), expectedYear: '2025-2026' }, { ...body(), updates: { '../users': null } }, { ...body(), updates: { Presensi: { forged: true } } }]) { const f = fixture(); await assert.rejects(executeAdminOperation(f.io, identity, b)); assert.equal(f.events.length, 0); }
    await assert.rejects(executeAdminOperation(fixture().io, { ...identity, profile: { ...identity.profile, role: 'vip' } }, body()), /Superuser/);
});
await test('Archive hash independently verified on server', async () => {
    const f = fixture(), database = { Siswa: {} }; const archive = { archiveId: 'a1', scope: { workspaceId: 'ws_superuser', academicYearId: '2026-2027', classId: '3A', role: 'superuser' }, database, integrity: { hash: await core.sha256(database) } };
    const b = { ...body(), action: 'annual_archive', targetId: 'a1', archive }; delete b.updates;
    await assert.rejects(executeAdminOperation(f.io, identity, { ...b, archive: { ...archive, integrity: { hash: 'a'.repeat(64) } } }), /Hash arsip/);
    assert.equal((await executeAdminOperation(f.io, identity, b)).receipt.action, 'annual_archive');
});
await mkdir('test-output/three-findings', { recursive: true });
await writeFile('test-output/three-findings/admin-operations.json', JSON.stringify(evidence, null, 2));
