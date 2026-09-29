import { auth } from '../database/firebase-client.js';
import SIMNIFirebaseClient from '../database/firebase-client.js';
import { ref, get, set, update } from '../../vendor/firebase/firebase-database.js';

const CLASSES = Object.freeze(['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6A','6B']);
const FEATURES = Object.freeze(['students','attendance','grades','journal','notes','gadm','lps','settings','backup','archive']);

function preset() {
    return {
        students: 'manage',
        attendance: 'manage',
        grades: 'manage',
        journal: 'manage',
        notes: 'manage',
        gadm: 'manage',
        lps: 'none',
        settings: 'manage',
        backup: 'none',
        archive: 'none',
        export: true
    };
}

export async function listAccounts() {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi Firebase diperlukan.');
    const db = SIMNIFirebaseClient.database;
    const snap = await get(ref(db, 'accessControl'));
    const c = snap.exists() ? snap.val() : {};
    const activeYear = c.activeYear || '2026-2027';
    const users = c.users || {};
    const requests = c.requests || {};
    const drafts = c.drafts || {};
    const audit = Object.entries(c.audit || {}).map(([operationId, a]) => ({ operationId, ...a })).sort((a, b) => (a.at || 0) - (b.at || 0)).slice(0, 100);
    const operations = Object.entries(c.operations || {}).filter(([, o]) => o?.result?.pending).map(([operationId, o]) => ({ operationId, ...o.result }));
    const items = CLASSES.map(classId => ({
        classId,
        slotId: `kelas-${classId.toLowerCase()}`,
        workspaceId: `ws_kelas${classId.toLowerCase()}`,
        systemOwned: classId === '3A',
        ...(c.slots?.[activeYear]?.[classId] || {})
    }));
    const invitations = Object.values(c.invitations || {}).map(({ tokenHash, ...inv }) => inv);

    return {
        ok: true,
        revision: c.revision || 1,
        enabled: c.registration?.enabled === true,
        activeYear,
        users,
        requests,
        drafts,
        audit,
        operations,
        features: FEATURES,
        preset: preset(),
        items,
        invitations
    };
}

export async function accountCommand(action, payload = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi Firebase diperlukan.');
    const db = SIMNIFirebaseClient.database;
    const now = Date.now();

    if (action === 'registration') {
        await update(ref(db, 'accessControl/registration'), {
            enabled: payload.enabled === true,
            updatedAt: now,
            updatedBy: user.uid
        });
        return { ok: true };
    }

    if (action === 'approve') {
        const { uid, classId, permissions } = payload;
        const yearSnap = await get(ref(db, 'accessControl/activeYear'));
        const activeYear = yearSnap.exists() ? yearSnap.val() : '2026-2027';
        const updates = {};
        updates[`accessControl/users/${uid}/status`] = 'active';
        updates[`accessControl/users/${uid}/classId`] = classId;
        updates[`accessControl/users/${uid}/workspaceId`] = `ws_kelas${classId.toLowerCase()}`;
        updates[`accessControl/users/${uid}/activeAcademicYearId`] = activeYear;
        updates[`accessControl/users/${uid}/permissions`] = permissions || preset();
        updates[`accessControl/slots/${activeYear}/${classId}/assignedUid`] = uid;
        updates[`accessControl/requests/${uid}/status`] = 'approved';
        await update(ref(db), updates);
        return { ok: true };
    }

    if (action === 'reject') {
        const { uid, reason } = payload;
        const updates = {};
        updates[`accessControl/users/${uid}/status`] = 'rejected';
        updates[`accessControl/requests/${uid}/status`] = 'rejected';
        if (reason) updates[`accessControl/requests/${uid}/reason`] = reason;
        await update(ref(db), updates);
        return { ok: true };
    }

    if (action === 'status') {
        const { uid, status } = payload;
        await update(ref(db, `accessControl/users/${uid}`), { status });
        return { ok: true };
    }

    if (action === 'unassign') {
        const { uid } = payload;
        const userSnap = await get(ref(db, `accessControl/users/${uid}`));
        const cls = userSnap.exists() ? userSnap.val().classId : '';
        const yearSnap = await get(ref(db, 'accessControl/activeYear'));
        const activeYear = yearSnap.exists() ? yearSnap.val() : '2026-2027';
        const updates = {};
        updates[`accessControl/users/${uid}/classId`] = null;
        updates[`accessControl/users/${uid}/status`] = 'unassigned';
        if (cls) updates[`accessControl/slots/${activeYear}/${cls}/assignedUid`] = null;
        await update(ref(db), updates);
        return { ok: true };
    }

    if (action === 'permissions') {
        const { uid, permissions } = payload;
        await update(ref(db, `accessControl/users/${uid}/permissions`), permissions);
        return { ok: true };
    }

    if (action === 'delete') {
        const { uid } = payload;
        const updates = {};
        updates[`accessControl/users/${uid}`] = null;
        updates[`accessControl/requests/${uid}`] = null;
        await update(ref(db), updates);
        return { ok: true };
    }

    if (action === 'invite') {
        const { classId, email: targetEmail, days } = payload;
        const yearSnap = await get(ref(db, 'accessControl/activeYear'));
        const activeYear = yearSnap.exists() ? yearSnap.val() : '2026-2027';
        const code = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const id = `inv_${Date.now()}_${classId}`;
        const inviteData = {
            id,
            classId,
            email: targetEmail,
            year: activeYear,
            createdAt: now,
            createdBy: user.uid,
            expiresAt: now + (Number(days) || 7) * 86400000
        };
        await set(ref(db, `accessControl/invitations/${classId}`), inviteData);
        return { ok: true, inviteCode: code, classId };
    }

    if (action === 'revoke-invite') {
        const { classId } = payload;
        await set(ref(db, `accessControl/invitations/${classId}`), null);
        return { ok: true };
    }

    if (action === 'save-draft') {
        const { year, placement } = payload;
        await set(ref(db, `accessControl/drafts/${year}`), { placement, updatedAt: now, version: 1 });
        return { ok: true };
    }

    return { ok: true };
}

export async function getRegistrationSlots() {
    const db = SIMNIFirebaseClient.database;
    const snap = await get(ref(db, 'accessControl'));
    const c = snap.exists() ? snap.val() : {};
    const enabled = c.registration?.enabled === true;
    const activeYear = c.activeYear || '2026-2027';
    const slots = CLASSES.map(classId => ({
        slotId: `kelas-${classId.toLowerCase()}`,
        classId,
        available: !c.slots?.[activeYear]?.[classId]?.assignedUid && classId !== '3A'
    }));
    return { ok: true, enabled, slots };
}

export async function validateRegistrationInvite(payload) {
    const { slotId, inviteCode } = payload || {};
    if (!slotId) throw new Error('Pilih kelas penugasan terlebih dahulu.');
    if (!inviteCode) throw new Error('Masukkan kode undangan.');
    const classId = String(slotId || '').replace(/^kelas-/i, '').toUpperCase();
    const db = SIMNIFirebaseClient.database;
    const invSnap = await get(ref(db, `accessControl/invitations/${classId}`));
    if (!invSnap.exists()) throw new Error(`Tidak ditemukan undangan aktif untuk Kelas ${classId}. Hubungi superuser.`);
    const inv = invSnap.val();
    if (inv.expiresAt && Date.now() > inv.expiresAt) throw new Error(`Undangan untuk Kelas ${classId} telah kedaluwarsa.`);
    if (inv.tokenHash) {
        const msgBuffer = new TextEncoder().encode(inviteCode);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hashHex !== inv.tokenHash) throw new Error('Kode undangan tidak sesuai.');
    }
    return { ok: true, classId };
}

export async function activateRegistration(payload) {
    const user = auth.currentUser;
    if (!user) throw new Error('Pengguna belum masuk.');
    const { slotId, inviteCode, displayName } = payload || {};
    const classId = String(slotId || '').replace(/^kelas-/i, '').toUpperCase();
    const db = SIMNIFirebaseClient.database;
    const now = Date.now();
    const yearSnap = await get(ref(db, 'accessControl/activeYear'));
    const activeYear = yearSnap.exists() ? yearSnap.val() : '2026-2027';

    const updates = {};
    updates[`accessControl/users/${user.uid}`] = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || user.email,
        status: 'pending_approval',
        classId,
        requestedAt: now
    };
    updates[`accessControl/requests/${user.uid}`] = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || user.email,
        classId,
        status: 'pending_approval',
        createdAt: now
    };
    await update(ref(db), updates);
    return { ok: true, status: 'pending_approval' };
}

export async function getRegistrationStatus(operationId) {
    const user = auth.currentUser;
    if (!user) return { ok: true, status: 'unregistered' };
    const db = SIMNIFirebaseClient.database;
    const [userSnap, reqSnap] = await Promise.all([
        get(ref(db, `accessControl/users/${user.uid}`)),
        get(ref(db, `accessControl/requests/${user.uid}`))
    ]);
    const profile = userSnap.exists() ? userSnap.val() : null;
    const request = reqSnap.exists() ? reqSnap.val() : null;
    const status = profile?.status || request?.status || 'unregistered';
    return { ok: true, status, profile, request };
}

export function readGrantedArchive(action, body) {
    return Promise.resolve({ ok: true });
}

export function getAuthoritativeAccess() {
    return Promise.resolve({ ok: true });
}
