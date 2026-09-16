import '../features/backup/backup-core.js';
import '../js/auth/access-policy-core.js';
import '../js/database/workspace-paths-core.js';

const core = globalThis.SIMNIBackupCore;
const policy = globalThis.SIMNIAccessPolicy;
const paths = globalThis.SIMNIWorkspacePaths;
const error = (message, extra = {}) => Object.assign(new Error(message), { definiteRejection: true }, extra);
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

export async function recoverAdminOperation(io, identity, operationId) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(operationId || '')) throw error('operationId tidak valid.');
    const workspace = identity.profile.workspaceId;
    const operationPath = `administrativeOperations/${workspace}/${operationId}`;
    const existing = await io.readServer(operationPath);
    if (!existing) throw error('Operasi belum ditemukan; permintaan mungkin masih berlangsung. Identitas retry tetap disimpan.', { pending: true, operationId });
    if (existing.uid !== identity.claims.sub) throw error('Operasi tidak ditemukan.');
    if (existing.state === 'completed') return { ok: true, receipt: existing.receipt, replayed: true };
    if (existing.state === 'failed') throw error(existing.message || 'Operasi sebelumnya ditolak.');
    const markerPath = `administrativeCommitMarkers/${workspace}/${operationId}`;
    const marker = await io.readServer(markerPath);
    // The unpredictable nonce is stored only in a server-private reservation.
    // Its matching marker is written atomically WITH the data, never separately.
    if (marker?.nonce !== existing.nonce || !existing.receipt) throw error('Hasil operasi belum pasti. Simpan operationId ini; perubahan tidak diulang otomatis.', { pending: true, operationId });
    try {
        await io.patchServer({ [`auditLogs/${workspace}/${operationId}`]: existing.receipt, [operationPath]: { ...existing, state: 'completed' }, [markerPath]: null });
    } catch (_) { throw error('Data tersimpan; konfirmasi receipt belum tersedia. Coba periksa status kembali.', { pending: true, operationId, dataCommitted: true }); }
    return { ok: true, receipt: existing.receipt, replayed: true };
}

// Mutations use the caller's Firebase ID token, so RTDB rules remain authoritative
// for all data validation. Only receipts use server credentials. No client is
// allowed to submit a receipt or arbitrary privileged server patch.
export async function executeAdminOperation(io, identity, body) {
    const { claims, profile } = identity;
    const { operationId, action, targetId = '' } = body || {};
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(operationId || '')) throw error('operationId tidak valid.');
    if (!['backup_restore', 'annual_reset', 'annual_archive', 'year_rollover'].includes(action)) throw error('Aksi administratif tidak didukung.');
    if (action !== 'backup_restore' && profile.role !== 'superuser') throw error('Aksi hanya tersedia bagi Superuser.');
    if (!key(profile.workspaceId) || !key(profile.activeAcademicYearId)) throw error('Scope server tidak valid.');
    const operationPath = `administrativeOperations/${profile.workspaceId}/${operationId}`;
    const requestHash = await core.sha256(body);
    const existing = await io.readServer(operationPath);
    if (existing) {
        if (existing.uid !== claims.sub || existing.requestHash !== requestHash) throw error('operationId sudah dipakai untuk permintaan lain.');
        return recoverAdminOperation(io, identity, operationId);
    }
    if (body.expectedYear !== profile.activeAcademicYearId) throw error('Tahun aktif berubah. Muat ulang sebelum melanjutkan.');
    let updates = {};
    if (action === 'annual_archive') {
        const p = body.archive;
        if (!key(targetId) || !p || p.archiveId !== targetId || p.scope?.workspaceId !== profile.workspaceId || p.scope?.academicYearId !== profile.activeAcademicYearId || p.scope?.classId !== profile.classId || p.scope?.role !== profile.role) throw error('Scope arsip ditolak.');
        if (!p.database || p.integrity?.hash !== await core.sha256(p.database)) throw error('Hash arsip ditolak oleh server.');
        // RTDB drops empty/null children and coerces numeric-key objects. Preserve
        // exact JSON in bounded string chunks, below RTDB's per-string limit.
        const serialized = JSON.stringify(p.database), chunks = [];
        for (let offset = 0; offset < serialized.length; offset += 262144) chunks.push(serialized.slice(offset, offset + 262144));
        const stored = { ...p, database: { chunks }, databaseEncoding: 'json-chunks-v1', authority: 'server-verified-sha256', createdBy: claims.sub, workspaceId: profile.workspaceId, academicYearId: profile.activeAcademicYearId, classId: profile.classId, role: profile.role };
        const snapshotBytes = new TextEncoder().encode(JSON.stringify(stored)).byteLength;
        if (snapshotBytes > core.MAX_FILE_BYTES) throw error('Arsip melebihi batas ukuran.');
        const root = `workspaces/${profile.workspaceId}/archives`;
        const index = await io.readUser(`${root}/_index/${profile.activeAcademicYearId}`) || {};
        const others = Object.entries(index).filter(([id]) => id !== targetId);
        if (others.length >= 20 || others.reduce((n, [, p]) => n + Number(p.snapshotBytes || 0), snapshotBytes) > 128 * 1024 * 1024) throw error('Batas arsip tercapai.');
        const { database, ...metadata } = stored;
        updates[`${root}/${profile.activeAcademicYearId}/${targetId}`] = stored;
        updates[`${root}/_index/${profile.activeAcademicYearId}/${targetId}`] = { ...metadata, snapshotBytes };
    } else if (action === 'year_rollover') {
        if (profile.role !== 'superuser' || claims.email !== 'unggaran.sditbm@gmail.com' || profile.workspaceId !== 'ws_superuser') throw error('Rollover hanya tersedia bagi owner.');
        const current = profile.activeAcademicYearId;
        if (!/^\d{4}-\d{4}$/.test(targetId) || Number(targetId.slice(0, 4)) !== Number(current.slice(0, 4)) + 1 || Number(targetId.slice(5)) !== Number(targetId.slice(0, 4)) + 1 || !/^[1-6][A-Z]$/.test(body.superuserClassId || '')) throw error('Tahun/kelas rollover tidak valid.');
        const users = await io.readUser('users') || {};
        const readiness = await io.readUser(`rollovers/${current}/readiness`) || {};
        const now = new Date().toISOString();
        for (const [email, role, workspaceId, classId] of [['unggaran.sditbm@gmail.com', 'superuser', 'ws_superuser', body.superuserClassId], ['anur.auliya01@gmail.com', 'vip', 'ws_pjok', 'PJOK']]) {
            const entry = Object.entries(users).find(([, p]) => p.email === email);
            const uid = entry?.[0], p = entry?.[1], ready = readiness[uid];
            if (!uid || p.role !== role || p.workspaceId !== workspaceId || p.activeAcademicYearId !== current || !ready?.verified || ready.workspaceId !== workspaceId || ready.academicYearId !== current || !/^[a-f0-9]{64}$/.test(ready.archiveHash || '')) throw error('Readiness kedua akun belum sesuai.');
            updates[`workspaces/${workspaceId}/academicYears/${current}`] = null;
            updates[`workspaces/${workspaceId}/settings/identity`] = null;
            updates[`workspaces/${workspaceId}/academicYears/${targetId}/meta`] = { schemaVersion: 3, academicYearId: targetId, initializedAt: now, initializedBy: claims.sub, status: 'active' };
            updates[`users/${uid}/activeAcademicYearId`] = targetId;
            updates[`users/${uid}/classId`] = classId;
            updates[`assignments/${targetId}/${uid}`] = { uid, email, role, workspaceId, classId, academicYearId: targetId, assignedAt: now, assignedBy: claims.sub };
        }
        updates['system/academicYear/activeYearId'] = targetId;
        updates['system/academicYear/updatedAt'] = now;
        updates['system/academicYear/updatedBy'] = claims.sub;
        updates[`rollovers/${current}/state`] = 'completed';
        updates[`rollovers/${current}/completedAt`] = now;
        updates[`rollovers/${current}/completedBy`] = claims.sub;
    } else {
        const values = body.updates;
        if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) throw error('Perubahan administratif kosong.');
        for (const [logical, value] of Object.entries(values)) {
            if (logical.split('/').some(s => !s || /[.#$\[\]]/.test(s) || ['__proto__', 'constructor', 'prototype'].includes(s))) throw error('Path administratif tidak valid.');
            if (!policy.hasFeature(profile.role, policy.featureForLogicalPath(logical))) throw error('Path di luar izin akun.');
            if (action === 'annual_reset' && (value !== null || !core.DATA_PATHS.includes(logical))) throw error('Reset hanya boleh mengosongkan koleksi yang diizinkan.');
            updates[paths.resolveLogicalPath(logical, { ...profile, status: 'active' })] = value;
        }
    }
    if (new TextEncoder().encode(JSON.stringify(updates)).byteLength > core.MAX_IMPORT_BYTES) throw error('Operasi melebihi batas 32 MiB.');
    const receipt = { operationId, uid: claims.sub, email: claims.email || '', role: profile.role, workspaceId: profile.workspaceId, academicYearId: profile.activeAcademicYearId, action, targetId: String(targetId).slice(0, 100), requestHash, appliedUpdatesHash: await core.sha256(updates), pathCount: Object.keys(updates).length, timestamp: Date.now(), status: 'committed', authority: 'server-executed-rtdb-ack' };
    const nonce = crypto.randomUUID();
    const markerPath = `administrativeCommitMarkers/${profile.workspaceId}/${operationId}`;
    const reservation = { uid: claims.sub, requestHash, action, state: 'pending', createdAt: Date.now(), academicYearId: profile.activeAcademicYearId, nonce, receipt };
    if (!await io.reserve(operationPath, reservation)) throw error('Operasi sedang diproses. Periksa ulang dengan operationId yang sama.', { pending: true, operationId });
    try {
        // A successful RTDB PATCH is the server acknowledgement of the actual
        // atomic data mutation. A receipt cannot be written before this returns.
        await io.patchUser({ ...updates, [markerPath]: { uid: claims.sub, nonce } });
    } catch (e) {
        if (e.definiteRejection) {
            try { await io.patchServer({ [operationPath]: { ...reservation, state: 'failed', message: e.message } }); }
            catch (_) { throw error('Penolakan database belum dapat dicatat. Simpan operationId untuk pemeriksaan.', { pending: true, operationId }); }
            throw e;
        }
        throw error('Konfirmasi database belum diterima; operasi tidak diulang otomatis.', { pending: true, operationId });
    }
    try {
        // Receipt and idempotency completion are themselves committed atomically.
        await io.patchServer({ [`auditLogs/${profile.workspaceId}/${operationId}`]: receipt, [operationPath]: { ...reservation, state: 'completed' }, [markerPath]: null });
    } catch (_) { throw error('Data telah dikonfirmasi database, tetapi receipt belum terkonfirmasi. Jangan mengulang perubahan.', { pending: true, operationId, dataCommitted: true }); }
    return { ok: true, receipt, replayed: false };
}
