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

export function getRegistrationSlots() {
    return Promise.resolve({ ok: true, slots: CLASSES });
}

export function validateRegistrationInvite(payload) {
    return Promise.resolve({ ok: true });
}

export function activateRegistration(payload) {
    return Promise.resolve({ ok: true });
}

export function getRegistrationStatus(operationId) {
    return Promise.resolve({ ok: true, status: 'active' });
}

export function readGrantedArchive(action, body) {
    return Promise.resolve({ ok: true });
}

export function getAuthoritativeAccess() {
    return Promise.resolve({ ok: true });
}
