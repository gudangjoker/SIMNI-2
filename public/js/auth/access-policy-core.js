(function initSIMNIAccessPolicy(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIAccessPolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIAccessPolicy() {
    'use strict';

    const ROLES = Object.freeze({
        SUPERUSER: 'superuser',
        VIP: 'vip'
    });

    const ROLE_SCOPES = Object.freeze({
        [ROLES.SUPERUSER]: Object.freeze({ workspaceId: 'ws_superuser', classId: '3A' }),
        [ROLES.VIP]: Object.freeze({ workspaceId: 'ws_pjok', classId: 'PJOK' })
    });

    const FEATURES = Object.freeze({
        DASHBOARD: 'dashboard',
        STUDENTS: 'students',
        ATTENDANCE: 'attendance',
        GRADES: 'grades',
        JOURNAL: 'journal',
        NOTES: 'notes',
        SETTINGS: 'settings',
        BACKUP: 'backup',
        ARCHIVE: 'archive',
        RESET: 'reset',
        DOCUMENTS: 'documents',
        LPS: 'lps',
        GADM: 'gadm',
        USER_ADMIN: 'userAdmin',
        CHAT: 'chat'
    });

    const COMMON = Object.freeze([
        FEATURES.DASHBOARD,
        FEATURES.STUDENTS,
        FEATURES.ATTENDANCE,
        FEATURES.GRADES,
        FEATURES.JOURNAL,
        FEATURES.GADM,
        FEATURES.SETTINGS,
        FEATURES.BACKUP
    ]);

    const MATRIX = Object.freeze({
        [ROLES.SUPERUSER]: Object.freeze([...COMMON, FEATURES.ARCHIVE, FEATURES.RESET, FEATURES.NOTES, FEATURES.DOCUMENTS, FEATURES.LPS, FEATURES.USER_ADMIN, FEATURES.CHAT]),
        [ROLES.VIP]: Object.freeze([...COMMON, FEATURES.CHAT])
    });

    const VIEW_FEATURE = Object.freeze({
        dashboard: FEATURES.DASHBOARD,
        siswa: FEATURES.STUDENTS,
        presensi: FEATURES.ATTENDANCE,
        nilai: FEATURES.GRADES,
        jurnal: FEATURES.JOURNAL,
        catatan: FEATURES.NOTES,
        dokumen: FEATURES.DOCUMENTS,
        lps: FEATURES.LPS,
        gadm: FEATURES.GADM
    });

    const MODAL_FEATURE = Object.freeze({
        'modal-pengaturan': FEATURES.SETTINGS,
        'modal-pengaturan-lps': FEATURES.LPS,
        'modal-dokumen': FEATURES.DOCUMENTS
    });

    function normalizeRole(value) {
        const role = String(value || '').trim().toLowerCase();
        return Object.values(ROLES).includes(role) ? role : null;
    }

    function hasFeature(role, feature) {
        const normalizedRole = normalizeRole(role);
        return !!normalizedRole && !!feature && (MATRIX[normalizedRole] || []).includes(feature);
    }

    function featureForView(viewId) {
        return VIEW_FEATURE[String(viewId || '')] || null;
    }

    function featureForModal(modalId) {
        return MODAL_FEATURE[String(modalId || '')] || null;
    }

    function featureForLogicalPath(path) {
        const value = String(path || '').replace(/^\/+|\/+$/g, '');
        if (!value) return null;
        if (value === 'Dokumen' || value.startsWith('Dokumen/')) return FEATURES.DOCUMENTS;
        if (value === 'Data_LPS' || value.startsWith('Data_LPS/') || value === 'LPS' || value.startsWith('LPS/') || value === 'Pengaturan/LPS_v2' || value.startsWith('Pengaturan/LPS_v2/')) return FEATURES.LPS;
        if (value === 'Siswa' || value.startsWith('Siswa/')) return FEATURES.STUDENTS;
        if (value === 'Presensi' || value.startsWith('Presensi/')) return FEATURES.ATTENDANCE;
        if (value === 'Mapel_TP' || value.startsWith('Mapel_TP/') || value === 'Nilai_TP' || value.startsWith('Nilai_TP/')) return FEATURES.GRADES;
        if (value === 'Jurnal' || value.startsWith('Jurnal/') || value === 'Jadwal' || value.startsWith('Jadwal/')) return FEATURES.JOURNAL;
        if (value === 'Catatan' || value.startsWith('Catatan/')) return FEATURES.NOTES;
        if (value === 'Pengaturan/Identitas' || value.startsWith('Pengaturan/Identitas/')) return FEATURES.SETTINGS;
        return null;
    }

    function validateProfile(profile, uid) {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('Profil akses tidak tersedia.');
        const role = normalizeRole(profile.role);
        if (!role) throw new Error('Role akun tidak valid.');
        if (profile.status !== 'active') throw new Error('Akun belum aktif atau telah dinonaktifkan.');
        const workspaceId = String(profile.workspaceId || '').trim();
        const classId = String(profile.classId || '').trim();
        const activeAcademicYearId = String(profile.activeAcademicYearId || '').trim();
        const expectedScope = ROLE_SCOPES[role];
        const resolvedUid = String(uid || profile.uid || '').trim();
        if (!resolvedUid || (profile.uid && String(profile.uid) !== resolvedUid)) throw new Error('UID profil tidak cocok dengan sesi autentikasi.');
        if (!workspaceId) throw new Error('workspaceId akun belum dikonfigurasi.');
        if (!classId) throw new Error('classId akun belum dikonfigurasi.');
        if (!activeAcademicYearId) throw new Error('Tahun pelajaran aktif akun belum dikonfigurasi.');
        const validWorkspace = workspaceId === expectedScope.workspaceId;
        const validClass = role === ROLES.VIP
            ? classId === expectedScope.classId
            : /^[1-6][A-Z]$/.test(classId);
        if (!validWorkspace || !validClass) {
            const error = new Error('Scope role akun tidak valid.');
            error.code = 'PROFILE_SCOPE_INVALID';
            throw error;
        }
        return Object.freeze({
            uid: resolvedUid,
            email: profile.email || null,
            displayName: profile.displayName || null,
            role,
            workspaceId,
            classId,
            activeAcademicYearId,
            status: 'active'
        });
    }

    function allowedSubject(role, subject) {
        const normalizedRole = normalizeRole(role);
        const normalizedSubject = String(subject || '').trim().toUpperCase();
        if (!normalizedRole || !normalizedSubject) return false;
        return normalizedRole !== ROLES.VIP || normalizedSubject === 'PJOK';
    }

    return Object.freeze({ ROLES, ROLE_SCOPES, FEATURES, MATRIX, VIEW_FEATURE, MODAL_FEATURE, normalizeRole, hasFeature, featureForView, featureForModal, featureForLogicalPath, validateProfile, allowedSubject });
}));
