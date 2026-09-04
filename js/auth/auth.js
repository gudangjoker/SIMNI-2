// ==========================================
// FILE: js/auth/auth.js
// FUNGSI: Firebase Authentication, reauthentication, dan lifecycle sesi role-scoped.
// ==========================================
import {
    signInWithEmailAndPassword,
    updatePassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
    reauthenticateWithCredential,
    EmailAuthProvider,
    sendPasswordResetEmail
} from '../../vendor/firebase/firebase-auth.js';
import { auth, authPersistenceReady, runtime } from '../database/firebase-client.js';
import { establishAccessContext, verifyAccessContext, clearAccessContext } from './access-context.js';
import { loadLocalBackup, migrateLegacyCacheIfNeeded, purgeCurrentLocalCache } from '../database/local-cache.js';
import { loadFeatureFragments, resetFeatureFragments } from '../core/feature-loader.js';
import { startChatNotifications, stopChatNotifications } from '../services/chat-notifications.js';
import { establishChatAccountUnlock, clearChatAccountUnlock } from './chat-unlock.js';

const AUTH_PHASE = Object.freeze({
    RESTORING_SESSION: 'restoring-session',
    SIGNED_OUT: 'signed-out',
    AUTHENTICATING: 'authenticating',
    ESTABLISHING_ACCESS: 'establishing-access',
    LOADING_WORKSPACE: 'loading-workspace',
    SESSION_READY: 'session-ready',
    ERROR: 'error'
});

const INITIAL_APP_STATE = cloneSerializable(window.state || {});

let authTransitionGeneration = 0;
let authState = Object.freeze({
    phase: AUTH_PHASE.RESTORING_SESSION,
    uid: null,
    email: null,
    message: '',
    loginBusy: true,
    credentialBusy: false,
    updatedAt: new Date().toISOString()
});

window.isUserLoggedIn = false;
window.SIMNIAuthState = authState;

function cloneSerializable(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (_) {
            // Fallback JSON untuk state SIMNI yang persisted-compatible.
        }
    }
    try {
        return JSON.parse(JSON.stringify(value ?? null));
    } catch (_) {
        return {};
    }
}

function authMessage(error) {
    const code = String(error?.code || '');
    if (code.includes('invalid-credential') || code.includes('wrong-password')) {
        return 'Email atau kata sandi tidak cocok.';
    }
    if (code.includes('user-not-found')) {
        return 'Akun tidak ditemukan.';
    }
    if (code.includes('user-disabled')) {
        return 'Akun ini dinonaktifkan oleh Superuser.';
    }
    if (code.includes('too-many-requests')) {
        return 'Terlalu banyak percobaan. Coba kembali beberapa saat lagi.';
    }
    if (code.includes('network-request-failed')) {
        return 'Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.';
    }
    if (code.includes('requires-recent-login')) {
        return 'Untuk keamanan, masukkan kata sandi saat ini lalu ulangi perubahan.';
    }
    if (code.includes('email-already-in-use')) {
        return 'Email baru sudah digunakan akun lain.';
    }
    if (code.includes('invalid-email')) {
        return 'Format email tidak valid.';
    }
    if (code.includes('weak-password')) {
        return 'Kata sandi baru belum memenuhi kebijakan keamanan Firebase.';
    }
    if (code.includes('operation-not-allowed')) {
        return 'Operasi autentikasi ini belum diizinkan pada Firebase Authentication.';
    }
    return error?.message ? `Firebase: ${error.message}` : 'Operasi autentikasi gagal.';
}

function isTerminalAccessError(error) {
    const code = String(error?.code || '').toLowerCase();
    return [
        'account_identity_invalid',
        'account_not_allowed',
        'profile_missing',
        'owner_already_claimed',
        'permission-denied'
    ].some((terminalCode) => code.includes(terminalCode));
}

function renderButtonContent(button, label, iconClass = '') {
    if (!button) return;
    const nodes = [document.createTextNode(label)];
    if (iconClass) {
        nodes.push(document.createTextNode(' '));
        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        nodes.push(icon);
    }
    button.replaceChildren(...nodes);
}

function renderAuthUI() {
    const state = authState;
    document.documentElement.dataset.simniAuthPhase = state.phase;
    const errorBox = document.getElementById('auth-error');
    if (errorBox) {
        errorBox.textContent = state.message || '';
        errorBox.classList.toggle('hidden', !state.message);
    }
    const emailDisplay = document.getElementById('profile-email-display');
    if (emailDisplay) {
        emailDisplay.textContent = state.email || 'Belum login';
    }
    const uidDisplay = document.getElementById('firebase-uid-display');
    if (uidDisplay) {
        uidDisplay.textContent = state.uid ? `UID: ${state.uid}` : 'UID: -';
    }
    const loginButton = document.getElementById('btn-login');
    if (loginButton) {
        loginButton.disabled = state.loginBusy;
        renderButtonContent(
            loginButton,
            state.loginBusy ? 'Masuk...' : 'Masuk Ke Sistem',
            state.loginBusy ? 'fas fa-spinner fa-spin' : 'fas fa-arrow-right'
        );
    }
    const credentialButton = document.getElementById('btn-save-cred');
    if (credentialButton) {
        credentialButton.disabled = state.credentialBusy;
        renderButtonContent(
            credentialButton,
            state.credentialBusy ? 'Menyimpan...' : 'Simpan Kredensial Baru',
            state.credentialBusy ? 'fas fa-spinner fa-spin' : 'fas fa-save mr-1'
        );
    }
}

function setAuthState(patch) {
    authState = Object.freeze({
        ...authState,
        ...patch,
        updatedAt: new Date().toISOString()
    });
    window.SIMNIAuthState = authState;
    renderAuthUI();
    return authState;
}

function resetInMemoryApplicationState() {
    const current = window.state;
    if (!current || typeof current !== 'object') {
        return;
    }
    const scanner = current.scannerInstance;
    if (scanner && typeof scanner.stop === 'function') {
        Promise.resolve(scanner.stop()).catch((error) => {
            console.warn('[SIMNI Auth] Scanner gagal dihentikan saat teardown sesi:', error);
        });
    }
    Object.keys(current).forEach((key) => delete current[key]);
    Object.assign(current, cloneSerializable(INITIAL_APP_STATE));
    current.currentView = 'dashboard';
    current.tempSelectedSiswaNISN = null;
    current.scannerInstance = null;
}

function resetProtectedFeatureSurfaces(reason) {
    try {
        window.SIMNIGADM?.unmount?.();
    } catch (error) {
        console.warn('[SIMNI Auth] GADM unmount gagal:', error);
    }
    try {
        window.SIMNILPS?.unmount?.();
    } catch (error) {
        console.warn('[SIMNI Auth] LPS unmount gagal:', error);
    }
    try {
        resetFeatureFragments(reason);
    } catch (error) {
        console.warn('[SIMNI Auth] Reset feature fragments gagal:', error);
    }
}

function teardownSession({ clearContext = true, clearState = true, reason = 'session-teardown' } = {}) {
    stopChatNotifications();
    window.stopFirebaseListener?.();
    window.isInitialLoad = true;
    window.isUserLoggedIn = false;
    resetProtectedFeatureSurfaces(reason);
    if (clearContext) {
        clearAccessContext();
    }
    if (clearState) {
        resetInMemoryApplicationState();
    }
}

function transitionIsCurrent(generation, expectedUid = null) {
    if (generation !== authTransitionGeneration) {
        return false;
    }
    if (expectedUid && auth.currentUser?.uid !== expectedUid) {
        return false;
    }
    return true;
}

function accessScopeKey(context) {
    if (!context) return '';
    return [
        context.uid,
        context.role,
        context.workspaceId,
        context.classId,
        context.activeAcademicYearId
    ].map((value) => String(value || '')).join(':');
}

async function renderApplicationState(generation, uid) {
    for (const renderAction of [
        window.renderIdentitas,
        window.populateAllDropdowns,
        window.renderAllViews
    ]) {
        if (typeof renderAction !== 'function') continue;
        try {
            const result = renderAction();
            if (result && typeof result.then === 'function') {
                await result;
            }
        } catch (error) {
            console.warn(
                '[SIMNI Auth] Render sesi gagal pada satu consumer; sesi tetap dilanjutkan:',
                error
            );
        }
        if (!transitionIsCurrent(generation, uid)) return false;
    }
    return true;
}

async function mountAuthorizedFeatures(generation, uid) {
    const fragmentResult = await loadFeatureFragments();
    if (!transitionIsCurrent(generation, uid)) {
        return { cancelled: true };
    }
    if (fragmentResult.failed?.length) {
        console.warn('[SIMNI Auth] Beberapa fragmen fitur gagal dimuat:', fragmentResult.failed);
    }
    if (!window.SIMNIAccess?.canAccess('lps')) {
        window.SIMNILPS?.unmount?.();
    }
    window.SIMNIAccess?.applyAccessUI?.();
    return fragmentResult;
}

async function hydrateAuthorizedSession(user, context, generation) {
    if (!transitionIsCurrent(generation, user.uid)) {
        return;
    }

    setAuthState({
        phase: AUTH_PHASE.LOADING_WORKSPACE,
        uid: user.uid,
        email: runtime.firebaseEmulator
            ? 'Pengguna emulator'
            : (user.email || context.email || 'Tanpa email'),
        message: '',
        loginBusy: true
    });

    try {
        const fragmentResult =
            await mountAuthorizedFeatures(
                generation,
                user.uid
            );

        if (
            !transitionIsCurrent(
                generation,
                user.uid
            )
            || fragmentResult?.cancelled
        ) {
            return;
        }
    } catch (error) {
        console.warn(
            '[SIMNI Auth] Feature fragments gagal dimuat setelah login; sesi tetap dilanjutkan:',
            error
        );
    }

    if (
        !transitionIsCurrent(
            generation,
            user.uid
        )
    ) {
        return;
    }

    try {
        const migration = runtime.mode === 'mock'
            ? null
            : await migrateLegacyCacheIfNeeded();

        if (
            migration
            && migration.ok === false
        ) {
            console.warn(
                '[SIMNI Auth] Legacy cache migration ditahan; legacy key dipertahankan.',
                migration.error
            );
        }
    } catch (error) {
        console.warn(
            '[SIMNI Auth] Legacy cache migration gagal; login tetap dilanjutkan:',
            error
        );
    }

    if (
        !transitionIsCurrent(
            generation,
            user.uid
        )
    ) {
        return;
    }

    try {
        if (runtime.mode !== 'mock') await loadLocalBackup();
    } catch (error) {
        console.warn(
            '[SIMNI Auth] Local backup/cache tidak dapat dimuat; login tetap dilanjutkan:',
            error
        );
    }

    if (
        !transitionIsCurrent(
            generation,
            user.uid
        )
    ) {
        return;
    }

    if (!(await renderApplicationState(generation, user.uid))) {
        return;
    }

    window.isUserLoggedIn =
        true;

    setAuthState({
        phase:
            AUTH_PHASE.SESSION_READY,

        uid:
            user.uid,

        email:
            runtime.firebaseEmulator
                ? 'Pengguna emulator'
                : (
                    user.email
                    || context.email
                    || 'Tanpa email'
                ),

        message:
            '',

        loginBusy:
            false,

        credentialBusy:
            false
    });

    window.SIMNIAccess
        ?.applyAccessUI
        ?.();

    window.unlockScreen
        ?.();

    window.switchView
        ?.('dashboard');

    if (runtime.mode !== 'mock') {
        void startChatNotifications().catch((error) => {
            console.warn('[SIMNI Auth] Notifikasi Chat dashboard gagal dimulai:', error);
        });
    }

    if (
        context.stale !== true
        && (
            navigator.onLine
            || runtime.firebaseEmulator
            || runtime.mode === 'mock'
        )
    ) {
        try {
            window.initFirebaseListener
                ?.();
        } catch (error) {
            console.warn(
                '[SIMNI Auth] Remote sync tidak dapat dimulai; dashboard tetap aktif:',
                error
            );
        }
    } else if (!navigator.onLine && !runtime.firebaseEmulator && runtime.mode !== 'mock') {
        window.toast?.(
            'Mode offline: menampilkan cache workspace terakhir. Penulisan ditahan.',
            'warning'
        );
    }
}

function accessFailureMessage(error) {
    const code = String(error?.code || '').toLowerCase();
    if (code.includes('profile_missing')) {
        return 'Akun Firebase ini belum terdaftar sebagai role SIMNI.';
    }
    if (code.includes('owner_already_claimed')) {
        return 'Superuser SIMNI sudah terikat ke akun legacy owner lain.';
    }
    if (code.includes('permission-denied')) {
        return 'Firebase menolak akses data SIMNI untuk akun ini.';
    }
    if (code.includes('unavailable') || code.includes('network')) {
        return 'Login berhasil, tetapi koneksi data SIMNI sedang tidak tersedia.';
    }
    return `Akses SIMNI ditolak: ${error?.message || error}`;
}

async function rejectAuthenticatedSession(user, error, generation) {
    if (!transitionIsCurrent(generation, user?.uid)) return;

    const terminalAccessFailure = isTerminalAccessError(error);
    clearAccessContext();
    resetProtectedFeatureSurfaces('access-context-failed');
    resetInMemoryApplicationState();
    window.lockScreen?.();
    window.isUserLoggedIn = false;
    setAuthState({
        phase: AUTH_PHASE.ERROR,
        uid: null,
        email: null,
        message: accessFailureMessage(error),
        loginBusy: false
    });

    console.error('[SIMNI Auth] Access context gagal:', error);
    if (!terminalAccessFailure) return;

    try {
        await clearChatAccountUnlock(user.uid).catch((clearError) => {
            console.warn('[SIMNI Auth] Kunci akun Chat lokal tidak dapat dibersihkan:', clearError);
        });
        if (runtime.mode === 'mock') auth.currentUser = null;
        else await signOut(auth);
    } catch (signOutError) {
        console.error('[SIMNI Auth] Sign-out fail-closed gagal:', signOutError);
    }
}

async function verifyAuthoritativeSession(user, generation, initialContext) {
    if (!navigator.onLine && !runtime.firebaseEmulator && runtime.mode !== 'mock') return false;

    try {
        const verifiedContext = await verifyAccessContext(user, initialContext);
        if (!verifiedContext || !transitionIsCurrent(generation, user.uid)) return false;

        if (accessScopeKey(verifiedContext) !== accessScopeKey(initialContext)) {
            window.stopFirebaseListener?.();
            resetInMemoryApplicationState();
            try {
                if (runtime.mode !== 'mock') await loadLocalBackup();
            } catch (error) {
                console.warn('[SIMNI Auth] Cache scope terverifikasi tidak dapat dimuat:', error);
            }
            if (!(await renderApplicationState(generation, user.uid))) return false;
            window.switchView?.('dashboard');
        }

        if (!transitionIsCurrent(generation, user.uid)) return false;
        try {
            window.initFirebaseListener?.();
        } catch (error) {
            console.warn('[SIMNI Auth] Remote sync tidak dapat dimulai setelah verifikasi:', error);
        }
        return true;
    } catch (error) {
        if (!transitionIsCurrent(generation, user.uid)) return false;
        if (isTerminalAccessError(error)) {
            await rejectAuthenticatedSession(user, error, generation);
        } else {
            console.warn(
                '[SIMNI Auth] Verifikasi profil Firebase tertunda; dashboard lokal tetap aktif:',
                error
            );
        }
        return false;
    }
}


async function handleAuthenticatedUser(user, generation) {
    setAuthState({
        phase: AUTH_PHASE.ESTABLISHING_ACCESS,
        uid: user.uid,
        email: runtime.firebaseEmulator
            ? 'Pengguna emulator'
            : (user.email || 'Memuat profil...'),
        message: '',
        loginBusy: true
    });

    try {
        const context = await establishAccessContext(user);
        if (!context || !transitionIsCurrent(generation, user.uid)) {
            return;
        }

        await hydrateAuthorizedSession(user, context, generation);
        if (transitionIsCurrent(generation, user.uid) && context.stale === true) {
            void verifyAuthoritativeSession(user, generation, context);
        }
    } catch (error) {
        if (!transitionIsCurrent(generation, user.uid)) {
            return;
        }
        await rejectAuthenticatedSession(user, error, generation);
    }
}

function handleSignedOut(generation) {
    if (!transitionIsCurrent(generation)) {
        return;
    }
    const previousUid = authState.uid;
    const preservedMessage = authState.phase === AUTH_PHASE.ERROR ? authState.message : '';
    teardownSession({ reason: 'signed-out' });
    if (previousUid) {
        void clearChatAccountUnlock(previousUid).catch((error) => {
            console.warn('[SIMNI Auth] Kunci akun Chat lokal tidak dapat dibersihkan setelah sign-out:', error);
        });
    }
    window.lockScreen?.();
    setAuthState({
        phase: AUTH_PHASE.SIGNED_OUT,
        uid: null,
        email: null,
        message: preservedMessage,
            loginBusy: false,
        credentialBusy: false
    });
}

await authPersistenceReady;

onAuthStateChanged(auth, (user) => {
    authTransitionGeneration += 1;
    const generation = authTransitionGeneration;
    if (user) {
        void handleAuthenticatedUser(user, generation);
    } else {
        handleSignedOut(generation);
    }
});

function resumeAuthenticatedSession() {
    const user = auth.currentUser;
    if (!user?.uid) return false;

    const currentContext = window.SIMNICurrentAccess;
    if (
        authState.phase === AUTH_PHASE.SESSION_READY
        && window.isUserLoggedIn === true
        && String(currentContext?.uid || '') === String(user.uid)
    ) {
        window.unlockScreen?.();
        if (currentContext.stale === true) {
            void verifyAuthoritativeSession(user, authTransitionGeneration, currentContext);
        } else if ((navigator.onLine || runtime.mode === 'mock') && !window.isFirebaseListening) {
            try {
                window.initFirebaseListener?.();
            } catch (error) {
                console.warn('[SIMNI Auth] Sinkronisasi gagal dilanjutkan setelah resume:', error);
            }
        }
        return true;
    }

    authTransitionGeneration += 1;
    void handleAuthenticatedUser(user, authTransitionGeneration);
    return true;
}

window.resumeSIMNIAuthSession = resumeAuthenticatedSession;

window.addEventListener('pageshow', (event) => {
    if (event.persisted || document.wasDiscarded === true) {
        resumeAuthenticatedSession();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        resumeAuthenticatedSession();
    }
});

if (runtime.firebaseEmulator) {
    signInAnonymously(auth).catch((error) => {
        console.error('[SIMNI Auth] Autentikasi emulator gagal:', error);
        setAuthState({
            phase: AUTH_PHASE.ERROR,
            message: 'Firebase Emulator belum berjalan.',
            loginBusy: false
        });
    });
}

window.loginAuth = async function loginAuth(event) {
    event?.preventDefault?.();
    if (authState.loginBusy) return false;

    if (runtime.firebaseEmulator) {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            setAuthState({
                phase: AUTH_PHASE.ERROR,
                message: `Emulator belum siap: ${error.message || error}`,
                loginBusy: false
            });
        }
        return false;
    }
    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value || '';
    if (!email || !password) {
        setAuthState({ message: 'Isi email dan kata sandi.' });
        return false;
    }
    setAuthState({ phase: AUTH_PHASE.AUTHENTICATING, loginBusy: true, message: '' });
    try {
        if (
            auth.currentUser?.uid
            && String(auth.currentUser.email || '').toLowerCase() === email.toLowerCase()
        ) {
            await establishChatAccountUnlock(auth.currentUser, password);
            authTransitionGeneration += 1;
            await handleAuthenticatedUser(auth.currentUser, authTransitionGeneration);
            return window.isUserLoggedIn === true;
        }
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await establishChatAccountUnlock(credential.user, password);
        const pass = document.getElementById('auth-password');
        if (pass) pass.value = '';
        return true;
    } catch (error) {
        console.warn('[SIMNI Auth] Login Firebase ditolak:', error?.code);
        setAuthState({
            phase: AUTH_PHASE.ERROR,
            loginBusy: false,
            message: authMessage(error)
        });
        return false;
    }
};

window.requestPasswordReset = async function requestPasswordReset() {
    if (runtime.firebaseEmulator) {
        window.toast?.('Reset password dinonaktifkan di emulator.', 'warning');
        return false;
    }
    const email = document.getElementById('auth-email')?.value?.trim();
    if (!email) {
        setAuthState({ message: 'Isi alamat email terlebih dahulu.' });
        return false;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        setAuthState({ message: '' });
        window.toast?.('Jika email terdaftar, tautan reset password telah dikirim.', 'success');
        return true;
    } catch (error) {
        console.warn('[SIMNI Auth] Reset password gagal:', error?.code);
        setAuthState({ message: authMessage(error) });
        return false;
    }
};

window.updateCredentials = async function updateCredentials(event) {
    event?.preventDefault?.();
    if (runtime.firebaseEmulator) {
        window.toast?.('Perubahan kredensial dinonaktifkan di emulator.', 'warning');
        return false;
    }
    if (authState.credentialBusy) return false;
    const newEmail = document.getElementById('edit-email')?.value?.trim() || '';
    const newPassword = document.getElementById('edit-password')?.value || '';
    const currentPassword = document.getElementById('edit-current-password')?.value || '';
    const user = auth.currentUser;
    if (!newEmail && !newPassword) {
        window.toast?.('Isi email atau kata sandi baru.', 'warning');
        return false;
    }
    if (newEmail && newEmail.toLowerCase() !== String(user?.email || '').toLowerCase()) {
        window.toast?.('Email akun dikunci untuk menjaga isolasi role dan workspace.', 'warning');
        return false;
    }
    if (!user?.email) {
        window.toast?.('Akun harus login dengan email terlebih dahulu.', 'error');
        return false;
    }
    if (!currentPassword) {
        window.toast?.('Masukkan kata sandi saat ini untuk konfirmasi.', 'warning');
        return false;
    }
    if (newPassword && newPassword.length < 8) {
        window.toast?.('Kata sandi baru minimal 8 karakter.', 'warning');
        return false;
    }
    setAuthState({ credentialBusy: true });
    window.showLoad?.('Memverifikasi dan memperbarui kredensial...');
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        if (newPassword) {
            await updatePassword(user, newPassword);
            await establishChatAccountUnlock(user, newPassword);
        }
        window.toast?.('Berhasil disimpan: kredensial diperbarui. Silakan login ulang.', 'success');
        event?.target?.reset?.();
        window.stopFirebaseListener?.();
        await signOut(auth);
    } catch (error) {
        window.toast?.(authMessage(error), 'error');
    } finally {
        setAuthState({ credentialBusy: false });
        window.hideLoad?.();
    }
    return false;
};

window.logoutAuth = async function logoutAuth() {
    if (runtime.mode === 'mock') {
        window.toast?.('Sesi mock Superuser dipertahankan untuk rangkaian audit.', 'info');
        return false;
    }
    if (runtime.firebaseEmulator) {
        window.toast?.('Keluar dinonaktifkan selama emulator.', 'warning');
        return false;
    }
    if (!window.confirm('Apakah Anda yakin ingin keluar dari sistem keamanan?')) return false;
    try {
        window.stopFirebaseListener?.();
        await purgeCurrentLocalCache().catch((error) => {
            console.warn('[SIMNI Auth] Cache sesi tidak dapat dipurge sepenuhnya:', error);
        });
        await clearChatAccountUnlock(auth.currentUser?.uid).catch((error) => {
            console.warn('[SIMNI Auth] Kunci akun Chat lokal tidak dapat dipurge:', error);
        });
        await signOut(auth);
        window.closeModal?.('modal-pengaturan');
        window.toast?.('Berhasil keluar.', 'success');
        return true;
    } catch (error) {
        window.toast?.(authMessage(error), 'error');
        return false;
    }
};


renderAuthUI();
