(function initSIMNIWorkspacePaths(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIWorkspacePaths = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIWorkspacePaths() {
    'use strict';

    const MAP = Object.freeze([
        ['Pengaturan/Identitas', 'settings/identity'],
        ['Pengaturan/LPS_v2', 'settings/lpsV2'],
        ['Siswa', 'students'],
        ['Presensi', 'attendance'],
        ['Mapel_TP', 'learningObjectives'],
        ['Nilai_TP', 'grades'],
        ['Dokumen', 'documents'],
        ['Catatan', 'notes'],
        ['Jurnal', 'journals'],
        ['Jadwal', 'schedule'],
        ['Data_LPS', 'legacyLps'],
        ['LPS/Templates', 'lps/templates'],
        ['LPS/Reports', 'lps/reports'],
        ['LPS/Revisions', 'lps/revisions']
    ]);

    function cleanSegment(value, label) {
        const text = String(value || '').trim();
        if (!text || /[.#$\[\]\/]/.test(text) || text === '.' || text === '..') throw new Error(`${label} tidak valid.`);
        return text;
    }

    function normalizeLogicalPath(path) {
        const value = String(path || '').trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
        if (!value || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('Path database kosong/tidak valid.');
        return value;
    }

    function requireContext(context) {
        if (!context || context.status !== 'active') throw new Error('Access context belum aktif.');
        return {
            workspaceId: cleanSegment(context.workspaceId, 'workspaceId'),
            academicYearId: cleanSegment(context.activeAcademicYearId, 'activeAcademicYearId')
        };
    }

    function resolveLogicalPath(path, context) {
        const logical = normalizeLogicalPath(path);
        const { workspaceId, academicYearId } = requireContext(context);
        const match = MAP.find(([legacy]) => logical === legacy || logical.startsWith(`${legacy}/`));
        if (!match) throw new Error(`Path SIMNI tidak dikenali: ${logical}`);
        const [legacy, modern] = match;
        const suffix = logical.slice(legacy.length).replace(/^\//, '');
        const settingsPath = modern.startsWith('settings/');
        const base = settingsPath
            ? `workspaces/${workspaceId}/${modern}`
            : `workspaces/${workspaceId}/academicYears/${academicYearId}/${modern}`;
        return suffix ? `${base}/${suffix}` : base;
    }

    function workspaceRoot(context) {
        const { workspaceId } = requireContext(context);
        return `workspaces/${workspaceId}`;
    }

    function academicYearRoot(context) {
        const { workspaceId, academicYearId } = requireContext(context);
        return `workspaces/${workspaceId}/academicYears/${academicYearId}`;
    }

    return Object.freeze({ MAP, normalizeLogicalPath, resolveLogicalPath, workspaceRoot, academicYearRoot });
}));
