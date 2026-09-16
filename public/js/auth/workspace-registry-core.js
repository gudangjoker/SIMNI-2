(function initSIMNIWorkspaceRegistry(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIWorkspaceRegistry = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIWorkspaceRegistry() {
    'use strict';

    const OWNER_EMAIL = 'unggaran.sditbm@gmail.com';
    const VIP_EMAIL = 'anur.auliya01@gmail.com';
    const OWNER_CLASS_ID = '3A';
    const OWNER_WORKSPACE_ID = 'ws_kelas3a';
    const VIP_WORKSPACE_ID = 'ws_pjok';
    const VIP_CLASS_ID = 'PJOK';

    const CLASS_IDS = Object.freeze([
        '1A', '1B', '2A', '2B', '3A', '3B',
        '4A', '4B', '5A', '5B', '6A', '6B'
    ]);

    function workspaceIdForClass(classId) {
        const normalized = String(classId || '').trim().toUpperCase();
        if (!CLASS_IDS.includes(normalized)) return null;
        return `ws_kelas${normalized.toLowerCase()}`;
    }

    const SLOTS = Object.freeze(CLASS_IDS.map((classId) => Object.freeze({
        slotId: `kelas-${classId.toLowerCase()}`,
        classId,
        workspaceId: workspaceIdForClass(classId),
        systemOwned: classId === OWNER_CLASS_ID,
        registrationAllowed: classId !== OWNER_CLASS_ID
    })));

    const SLOT_BY_CLASS = Object.freeze(Object.fromEntries(SLOTS.map((slot) => [slot.classId, slot])));
    const SLOT_BY_ID = Object.freeze(Object.fromEntries(SLOTS.map((slot) => [slot.slotId, slot])));
    const SLOT_BY_WORKSPACE = Object.freeze(Object.fromEntries(SLOTS.map((slot) => [slot.workspaceId, slot])));

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function normalizeClassId(value) {
        const normalized = String(value || '').trim().toUpperCase();
        return CLASS_IDS.includes(normalized) ? normalized : null;
    }

    function slotForClass(classId) {
        const normalized = normalizeClassId(classId);
        return normalized ? SLOT_BY_CLASS[normalized] : null;
    }

    function slotForId(slotId) {
        return SLOT_BY_ID[String(slotId || '').trim().toLowerCase()] || null;
    }

    function slotForWorkspace(workspaceId) {
        return SLOT_BY_WORKSPACE[String(workspaceId || '').trim()] || null;
    }

    function isOwnerEmail(email) {
        return normalizeEmail(email) === OWNER_EMAIL;
    }

    function isVipEmail(email) {
        return normalizeEmail(email) === VIP_EMAIL;
    }

    function isClassWorkspace(workspaceId) {
        return Boolean(slotForWorkspace(workspaceId));
    }

    function validateTeacherScope(classId, workspaceId) {
        const slot = slotForClass(classId);
        return Boolean(slot && !slot.systemOwned && slot.workspaceId === String(workspaceId || '').trim());
    }

    return Object.freeze({
        OWNER_EMAIL,
        VIP_EMAIL,
        OWNER_CLASS_ID,
        OWNER_WORKSPACE_ID,
        VIP_WORKSPACE_ID,
        VIP_CLASS_ID,
        CLASS_IDS,
        SLOTS,
        workspaceIdForClass,
        normalizeEmail,
        normalizeClassId,
        slotForClass,
        slotForId,
        slotForWorkspace,
        isOwnerEmail,
        isVipEmail,
        isClassWorkspace,
        validateTeacherScope
    });
}));
