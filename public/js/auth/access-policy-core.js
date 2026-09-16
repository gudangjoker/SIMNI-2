(function initSIMNIAccessPolicy(root, factory) {
    const api = factory(root.SIMNIWorkspaceRegistry);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIAccessPolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIAccessPolicy(registry) {
    'use strict';

    if (!registry) throw new Error('Workspace registry core belum dimuat.');

    const ROLES = Object.freeze({
        SUPERUSER: 'superuser',
        VIP: 'vip',
        TEACHER: 'teacher'
    });

    // ROLE_SCOPES hanya untuk identitas canonical existing. Teacher selalu berasal
    // dari assignment server dan tidak mempunyai satu workspace statis per role.
    const ROLE_SCOPES = Object.freeze({
        [ROLES.SUPERUSER]: Object.freeze({
            workspaceId: registry.OWNER_WORKSPACE_ID,
            classId: registry.OWNER_CLASS_ID,
            email: registry.OWNER_EMAIL
        }),
        [ROLES.VIP]: Object.freeze({
            workspaceId: registry.VIP_WORKSPACE_ID,
            classId: registry.VIP_CLASS_ID,
            email: registry.VIP_EMAIL
        })
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
        ACCOUNTS: 'accounts'
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
        [ROLES.SUPERUSER]: Object.freeze([
            ...COMMON,
            FEATURES.ARCHIVE,
            FEATURES.RESET,
            FEATURES.NOTES,
            FEATURES.DOCUMENTS,
            FEATURES.LPS,
            FEATURES.USER_ADMIN,
            FEATURES.ACCOUNTS
        ]),
        [ROLES.VIP]: Object.freeze([...COMMON, FEATURES.ARCHIVE]),
        [ROLES.TEACHER]: Object.freeze([
            ...COMMON,
            FEATURES.ARCHIVE,
            FEATURES.NOTES,
            FEATURES.LPS
        ])
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
        gadm: FEATURES.GADM,
        pengaturan: FEATURES.SETTINGS,
        'kelola-akun': FEATURES.ACCOUNTS
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

    function isOwnerIdentity(profileOrContext) {
        return Boolean(
            profileOrContext &&
            normalizeRole(profileOrContext.role) === ROLES.SUPERUSER &&
            registry.isOwnerEmail(profileOrContext.email)
        );
    }

    function hasFeature(role, feature) {
        const normalizedRole = normalizeRole(role);
        return Boolean(normalizedRole && feature && (MATRIX[normalizedRole] || []).includes(feature));
    }

    function canAccess(context, feature, action = 'read') {
        if (!context || context.status !== 'active' || !hasFeature(context.role, feature)) return false;
        if (isOwnerIdentity(context)) return true;
        if (feature === FEATURES.DASHBOARD) return true;
        if ([FEATURES.DOCUMENTS, FEATURES.ACCOUNTS, FEATURES.USER_ADMIN, FEATURES.RESET].includes(feature)) return false;
        if (action === 'export' && context.permissions?.export !== true) return false;
        const grant = context.permissions?.[feature];
        return action === 'manage' ? grant === 'manage' : ['read','manage'].includes(grant);
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
        if (profile.status !== 'active') { const error = new Error('Akun belum aktif atau telah dinonaktifkan.'); error.code = 'ACCOUNT_INACTIVE'; throw error; }

        const resolvedUid = String(uid || profile.uid || '').trim();
        const email = registry.normalizeEmail(profile.email);
        const workspaceId = String(profile.workspaceId || '').trim();
        const classId = String(profile.classId || '').trim().toUpperCase();
        const activeAcademicYearId = String(profile.activeAcademicYearId || '').trim();
        const revision = Number(profile.assignmentRevision || 1);

        if (!resolvedUid || (profile.uid && String(profile.uid) !== resolvedUid)) throw new Error('UID profil tidak cocok dengan sesi autentikasi.');
        if (!email) throw new Error('Email profil tidak tersedia.');
        if (!workspaceId) throw new Error('workspaceId akun belum dikonfigurasi.');
        if (!classId) throw new Error('classId akun belum dikonfigurasi.');
        if (!/^\d{4}-\d{4}$/.test(activeAcademicYearId)) throw new Error('Tahun pelajaran aktif akun belum dikonfigurasi.');
        if (!Number.isInteger(revision) || revision < 1) throw new Error('assignmentRevision akun tidak valid.');

        let validScope = false;
        if (role === ROLES.SUPERUSER) {
            validScope = registry.isOwnerEmail(email) && workspaceId === registry.OWNER_WORKSPACE_ID && classId === registry.OWNER_CLASS_ID;
        } else if (role === ROLES.VIP) {
            validScope = registry.isVipEmail(email) && workspaceId === registry.VIP_WORKSPACE_ID && classId === registry.VIP_CLASS_ID;
        } else if (role === ROLES.TEACHER) {
            validScope = !registry.isOwnerEmail(email) && !registry.isVipEmail(email) && registry.validateTeacherScope(classId, workspaceId);
        }

        if (!validScope) {
            const error = new Error('Scope role akun tidak valid.');
            error.code = 'PROFILE_SCOPE_INVALID';
            throw error;
        }

        return Object.freeze({
            uid: resolvedUid,
            email,
            displayName: profile.displayName || null,
            role,
            workspaceId,
            classId,
            activeAcademicYearId,
            status: 'active',
            assignmentRevision: revision,
            permissions: Object.freeze({ ...(profile.permissions || {}) }),
            legacyOwnerWorkspace: profile.legacyOwnerWorkspace || null,
            archiveGrants: Object.freeze({ ...(profile.archiveGrants || {}) }),
            createdAt: profile.createdAt || null,
            updatedAt: profile.updatedAt || null
        });
    }

    function allowedSubject(role, subject) {
        const normalizedRole = normalizeRole(role);
        const normalizedSubject = String(subject || '').trim().toUpperCase();
        if (!normalizedRole || !normalizedSubject) return false;
        return normalizedRole !== ROLES.VIP || normalizedSubject === 'PJOK';
    }

    return Object.freeze({
        ROLES,
        ROLE_SCOPES,
        FEATURES,
        MATRIX,
        VIEW_FEATURE,
        MODAL_FEATURE,
        normalizeRole,
        isOwnerIdentity,
        hasFeature,
        canAccess,
        featureForView,
        featureForModal,
        featureForLogicalPath,
        validateProfile,
        allowedSubject
    });
}));
