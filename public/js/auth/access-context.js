import { ref, get, set } from '../../vendor/firebase/firebase-database.js';
import { database, runtime } from '../database/firebase-client.js';

const policy = window.SIMNIAccessPolicy;

if (!policy) throw new Error('Access policy core belum dimuat.');

const DEFAULT_ACADEMIC_YEAR_ID = '2026-2027';
const OWNER_EMAIL = 'unggaran.sditbm@gmail.com';
const ACCOUNT_BINDINGS = Object.freeze({
    [OWNER_EMAIL]: Object.freeze({ role: policy.ROLES.SUPERUSER, displayName: 'Owner · Superuser' }),
    'anur.auliya01@gmail.com': Object.freeze({ role: policy.ROLES.VIP, displayName: 'Guru PJOK' })
});
let currentContext = null;

function databaseReference(path) {
    return ref(database, path);
}

function readDatabase(path) {
    return get(databaseReference(path));
}

function setDatabase(path, value) {
    return set(databaseReference(path), value);
}

function cachedAcademicYear() {
    try {
        const value = localStorage.getItem('simni:active-academic-year');
        return /^\d{4}-\d{4}$/.test(String(value || '')) ? value : null;
    } catch (_) {
        return null;
    }
}

function cacheAcademicYear(value) {
    const year = String(value || '').trim();
    if (!/^\d{4}-\d{4}$/.test(year)) return;
    try {
        localStorage.setItem('simni:active-academic-year', year);
    } catch (_) {
        console.warn('[SIMNI Access] Tahun aktif tidak dapat dicache.');
    }
}

async function authoritativeAcademicYear() {
    try {
        const snapshot = await readDatabase('system/academicYear/activeYearId');
        const value = String(snapshot.val() || '').trim();
        if (/^\d{4}-\d{4}$/.test(value)) {
            cacheAcademicYear(value);
            return value;
        }
    } catch (error) {
        if (navigator.onLine) console.warn('[SIMNI Access] Registry tahun aktif belum tersedia:', error);
    }
    return cachedAcademicYear() || DEFAULT_ACADEMIC_YEAR_ID;
}

function validateIdentityBinding(profile, user) {
    const authEmail = String(user?.email || '').trim().toLowerCase();
    const binding = ACCOUNT_BINDINGS[authEmail];
    const profileEmail = String(profile?.email || '').trim().toLowerCase();
    if (!binding || profile?.role !== binding.role || profileEmail !== authEmail) {
        throw Object.assign(new Error('Identitas akun tidak cocok dengan binding akses SIMNI.'), {
            code: 'ACCOUNT_IDENTITY_INVALID'
        });
    }
    return profile;
}

function emulatorContext(user) {
    return Object.freeze({
        uid: user.uid,
        email: user.email || 'emulator@simni.local',
        displayName: 'Superuser Emulator',
        role: policy.ROLES.SUPERUSER,
        workspaceId: policy.ROLE_SCOPES[policy.ROLES.SUPERUSER].workspaceId,
        classId: policy.ROLE_SCOPES[policy.ROLES.SUPERUSER].classId,
        activeAcademicYearId: DEFAULT_ACADEMIC_YEAR_ID,
        status: 'active',
        stale: false,
        source: 'emulator-synthetic'
    });
}

async function readAuthoritativeProfile(user) {
    const snapshot = await readDatabase(`users/${user.uid}`);
    if (!snapshot.exists()) return null;
    const value = snapshot.val();
    return validateIdentityBinding(policy.validateProfile({
        ...value,
        email: value?.email || user.email || null
    }, user.uid), user);
}

function canonicalProfile(user, activeAcademicYearId = DEFAULT_ACADEMIC_YEAR_ID) {
    const email = String(user?.email || '').trim().toLowerCase();
    const binding = ACCOUNT_BINDINGS[email];
    if (!binding) {
        throw Object.assign(new Error('Email ini tidak terdaftar sebagai akun SIMNI.'), {
            code: 'ACCOUNT_NOT_ALLOWED'
        });
    }
    const scope = policy.ROLE_SCOPES[binding.role];
    return policy.validateProfile({
        uid: user.uid,
        email,
        displayName: user.displayName || binding.displayName,
        role: binding.role,
        workspaceId: scope.workspaceId,
        classId: scope.classId,
        activeAcademicYearId,
        status: 'active'
    }, user.uid);
}

async function provisionCanonicalProfile(user, existing = null) {
    const requestedYear = /^\d{4}-\d{4}$/.test(String(existing?.activeAcademicYearId || ''))
        ? existing.activeAcademicYearId
        : await authoritativeAcademicYear();
    const profile = canonicalProfile(user, requestedYear);
    await setDatabase(`users/${user.uid}`, profile);
    return validateIdentityBinding(profile, user);
}

export function getAccessContext() {
    return currentContext;
}

export function clearAccessContext() {
    currentContext = null;
    window.SIMNICurrentAccess = null;
    applyAccessUI();
}

function activateAccessContext(profile, source, stale) {
    currentContext = Object.freeze({
        ...profile,
        stale: stale === true,
        source
    });
    window.SIMNICurrentAccess = currentContext;
    applyAccessUI();
    return currentContext;
}

export function canAccess(feature) {
    return !!currentContext && policy.hasFeature(currentContext.role, feature);
}

export function assertFeature(feature) {
    if (!currentContext) throw new Error('Sesi akses belum siap.');
    if (!policy.hasFeature(currentContext.role, feature)) {
        throw new Error(`Role ${currentContext.role} tidak memiliki izin ${feature}.`);
    }
    return true;
}

export function assertLogicalPath(path) {
    const feature = policy.featureForLogicalPath(path);
    if (!feature) throw new Error(`Path aplikasi tidak memiliki permission mapping: ${path}`);
    assertFeature(feature);
    return feature;
}

export async function transitionAcademicYear(nextYearId) {
    if (!currentContext || currentContext.role !== policy.ROLES.SUPERUSER || currentContext.email !== OWNER_EMAIL) {
        throw new Error('Perubahan tahun pelajaran hanya tersedia untuk owner Superuser.');
    }
    const nextYear = String(nextYearId || '').trim();
    if (!/^\d{4}-\d{4}$/.test(nextYear)) throw new Error('Format tahun pelajaran tidak valid.');
    const [start, end] = nextYear.split('-').map(Number);
    if (end !== start + 1) throw new Error('Rentang tahun pelajaran harus berurutan satu tahun.');
    throw new Error(`Perubahan ke ${nextYear} wajib melalui wizard Reset Tahun Buku dan arsip semua role.`);
}

export function establishAccessContext(user) {
    if (!user?.uid) throw new Error('Firebase user tidak valid.');

    if (runtime.firebaseEmulator && user.isAnonymous) {
        return activateAccessContext(
            emulatorContext(user),
            'emulator-synthetic',
            false
        );
    }

    const profile = canonicalProfile(
        user,
        cachedAcademicYear() || DEFAULT_ACADEMIC_YEAR_ID
    );

    return activateAccessContext(
        profile,
        'firebase-auth-binding',
        true
    );
}

export async function verifyAccessContext(user, expectedContext = currentContext) {
    if (!user?.uid) throw new Error('Firebase user tidak valid.');
    if (runtime.firebaseEmulator && user.isAnonymous) return currentContext;

    let profile = await readAuthoritativeProfile(user);
    if (!profile) profile = await provisionCanonicalProfile(user);

    if (
        !expectedContext
        || currentContext !== expectedContext
        || String(expectedContext.uid) !== String(user.uid)
    ) {
        return null;
    }

    cacheAcademicYear(profile.activeAcademicYearId);
    return activateAccessContext(profile, 'firebase-authority', false);
}

function updateClassContext(role) {
    if (typeof state === 'undefined') return;
    if (role === policy.ROLES.SUPERUSER) state.activeKelas = currentContext?.classId || '';
    else if (role === policy.ROLES.VIP) state.activeKelas = window.getSIMNIActiveClass?.() || '1A';
    else state.activeKelas = '';

    const visible = role === policy.ROLES.VIP;
    for (const id of ['kelas-selector-container', 'kelas-selector-mobile-container']) {
        const container = document.getElementById(id);
        container?.classList.toggle('hidden', !visible);
        container?.setAttribute('aria-hidden', String(!visible));
    }
    for (const id of ['global-kelas-select', 'mobile-kelas-select']) {
        const select = document.getElementById(id);
        if (select && state.activeKelas) select.value = state.activeKelas;
    }
    const label = document.getElementById('navbar-active-kelas-label');
    if (label) label.textContent = state.activeKelas ? `Data Kelas ${state.activeKelas}` : 'Data Kelas';
}

function applyFeatureVisibility(role) {
    document.querySelectorAll('[data-target]').forEach((element) => {
        const feature = policy.featureForView(element.dataset.target);
        if (!feature) return;
        const allowed = !!role && policy.hasFeature(role, feature);
        element.classList.toggle('hidden', !allowed);
        element.setAttribute('aria-hidden', String(!allowed));
        if ('disabled' in element) element.disabled = !allowed;
    });

    document.querySelectorAll('[data-requires-feature]').forEach((element) => {
        const allowed = !!role && policy.hasFeature(role, element.dataset.requiresFeature);
        element.classList.toggle('hidden', !allowed);
        element.setAttribute('aria-hidden', String(!allowed));
        if ('disabled' in element) element.disabled = !allowed;
    });
}

export function applyAccessUI() {
    const role = currentContext?.role || null;
    document.documentElement.dataset.simniRole = role || 'none';
    updateClassContext(role);
    applyFeatureVisibility(role);

    const roleDisplay = document.getElementById('simni-role-display');
    if (roleDisplay) roleDisplay.textContent = role || '-';
    const workspaceDisplay = document.getElementById('simni-workspace-display');
    if (workspaceDisplay) {
        workspaceDisplay.textContent = currentContext
            ? `${currentContext.workspaceId} · ${currentContext.classId} · ${currentContext.activeAcademicYearId}`
            : '-';
    }

    const yearInput = document.getElementById('set-tapel');
    if (yearInput) {
        yearInput.readOnly = true;
        yearInput.setAttribute('aria-readonly', 'true');
        yearInput.title = 'Tahun pelajaran hanya dapat diubah melalui wizard Reset Tahun Buku.';
    }

    const emailInput = document.getElementById('edit-email');
    if (emailInput) {
        emailInput.readOnly = true;
        emailInput.setAttribute('aria-readonly', 'true');
        emailInput.placeholder = 'Email akun dikunci oleh scope role';
        emailInput.title = 'Email akun merupakan identitas scope dan tidak dapat diubah.';
    }
}

window.SIMNIAccess = Object.freeze({
    get context() {
        return currentContext;
    },
    canAccess,
    assertFeature,
    assertLogicalPath,
    transitionAcademicYear,
    applyAccessUI
});
