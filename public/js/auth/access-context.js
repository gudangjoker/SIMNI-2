import { ref, get, onValue } from '../../vendor/firebase/firebase-database.js';
import { database, auth, runtime } from '../database/firebase-client.js';
const policy=window.SIMNIAccessPolicy, registry=window.SIMNIWorkspaceRegistry;
if(!policy || !registry)throw new Error('Access policy belum dimuat.');
let currentContext=null, unsubscribe=[], leaseTimer=null;
const LEASE_MS=8*60*60*1000;
const leaseKey=uid=>`simni:authority:v4:${uid}`;
const read=path=>get(ref(database,path));
function unavailable(){return Object.assign(new Error('Akun belum memiliki penugasan aktif atau menunggu persetujuan superuser.'),{code:'ACCOUNT_PENDING'});}
function stopWatch(){for(const stop of unsubscribe)stop();unsubscribe=[];clearTimeout(leaseTimer);}
export function getAccessContext(){return currentContext;}
export function clearAccessContext(){
    const uid=currentContext?.uid;stopWatch();currentContext=null;window.SIMNICurrentAccess=null;
    if(uid)try{localStorage.removeItem(leaseKey(uid));}catch(_){}
    applyAccessUI();
}
function invalidate(){clearAccessContext();window.stopFirebaseListener?.();window.lockScreen?.();window.location.replace('./register.html');}
function activate(profile,stale){currentContext=Object.freeze({...profile,source:stale?'offline-lease':'firebase-authority',stale});window.SIMNICurrentAccess=currentContext;applyAccessUI();return currentContext;}
async function authoritative(user){
    if(auth.currentUser?.uid!==user.uid)throw new Error('Sesi autentikasi berubah.');
    let p;
    try {
        const snap = await read(`accessControl/users/${user.uid}`);
        p = snap.val();
    } catch(error) {
        if(error.code==='PERMISSION_DENIED'||error.code==='permission-denied')throw unavailable();
        throw error;
    }
    if(!p || p.status!=='active' || registry.normalizeEmail(p.email)!==registry.normalizeEmail(user.email))throw unavailable();
    const year=p.activeAcademicYearId || '2026-2027';
    const profile=policy.validateProfile(p,user.uid);
    const record={profile,verifiedAt:Date.now(),expiresAt:Date.now()+LEASE_MS};
    try{localStorage.setItem(leaseKey(user.uid),JSON.stringify(record));localStorage.setItem('simni:active-academic-year',year);}catch(_){}
    stopWatch();
    unsubscribe.push(onValue(ref(database,`accessControl/users/${user.uid}`),snap=>{
        const value=snap.val();if(currentContext && (!value || value.status!=='active' || value.assignmentRevision!==profile.assignmentRevision || value.activeAcademicYearId!==year))invalidate();
    },()=>{if(currentContext)invalidate();}));
    unsubscribe.push(onValue(ref(database,'accessControl/maintenance'),snap=>{if(currentContext && snap.val()===true)invalidate();}));
    unsubscribe.push(onValue(ref(database,'accessControl/activeYear'),snap=>{if(currentContext && snap.val()!==year)invalidate();}));
    leaseTimer=setTimeout(()=>{if(currentContext)invalidate();},LEASE_MS);
    return profile;
}
export async function establishAccessContext(user){
    if(!user?.uid)throw new Error('Sesi Firebase diperlukan.');
    if(!navigator.onLine && !runtime.firebaseEmulator){
        let record;try{record=JSON.parse(localStorage.getItem(leaseKey(user.uid))||'null');}catch(_){}
        if(!record || record.profile?.uid!==user.uid || registry.normalizeEmail(record.profile.email)!==registry.normalizeEmail(user.email) || Date.now()<record.verifiedAt || Date.now()>=record.expiresAt)throw new Error('Akses offline kedaluwarsa. Hubungkan internet untuk memverifikasi penugasan.');
        leaseTimer=setTimeout(invalidate,record.expiresAt-Date.now());
        return activate(policy.validateProfile(record.profile,user.uid),true);
    }
    return activate(await authoritative(user),false);
}
export async function verifyAccessContext(user,expected=currentContext){
    const profile=await authoritative(user);
    if(!expected || currentContext!==expected || expected.uid!==user.uid)return null;
    if(profile.assignmentRevision!==expected.assignmentRevision || profile.workspaceId!==expected.workspaceId || profile.activeAcademicYearId!==expected.activeAcademicYearId){invalidate();return null;}
    return activate(profile,false);
}
export function canAccess(feature,action='read'){return policy.canAccess(currentContext,feature,action);}
export function assertFeature(feature,action='read'){if(!canAccess(feature,action))throw new Error(`Tidak memiliki izin ${action} untuk ${feature}.`);return true;}
export function assertLogicalPath(path,action='read'){const feature=policy.featureForLogicalPath(path);if(!feature)throw new Error(`Path tidak memiliki pemetaan izin: ${path}`);assertFeature(feature,action);return feature;}
export async function transitionAcademicYear(){throw new Error('Gunakan Kelola Akun & Penugasan > Tahun Ajaran.');}
window.addEventListener('pagehide',stopWatch);
window.addEventListener('online',()=>{if(auth.currentUser && currentContext)verifyAccessContext(auth.currentUser).catch(invalidate);});
function updateClassContext(role) {
    if (typeof state === 'undefined') return;
    if (role === policy.ROLES.VIP) state.activeKelas = window.getSIMNIActiveClass?.() || '1A';
    else state.activeKelas = currentContext?.classId || '';

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
        const allowed = canAccess(feature);
        element.classList.toggle('hidden', !allowed);
        element.setAttribute('aria-hidden', String(!allowed));
        if ('disabled' in element) element.disabled = !allowed;
    });

    document.querySelectorAll('[data-requires-feature]').forEach((element) => {
        const allowed = canAccess(element.dataset.requiresFeature);
        const ownsVisibility = element.matches('.view-section, [role="dialog"], [id^="modal-"]');
        if (!allowed && ownsVisibility) window.SIMNIDialog?.close?.(element);
        if (!ownsVisibility || !allowed) element.classList.toggle('hidden', !allowed);
        element.setAttribute('aria-hidden', String(!allowed || element.hidden || element.classList.contains('hidden')));
        if ('disabled' in element && element.dataset.simniProcessing !== 'true') element.disabled = !allowed;
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
        yearInput.title = 'Tahun pelajaran diatur superuser melalui Kelola Akun & Penugasan.';
        if (currentContext?.activeAcademicYearId) yearInput.value = currentContext.activeAcademicYearId;
    }

    if (currentContext?.activeAcademicYearId && window.state?.pengaturan) {
        window.state.pengaturan.tahun_pelajaran = currentContext.activeAcademicYearId;
    }

    const emailInput = document.getElementById('edit-email');
    if (emailInput) {
        emailInput.readOnly = true;
        emailInput.setAttribute('aria-readonly', 'true');
        emailInput.placeholder = 'Email akun dikunci oleh scope role';
        emailInput.title = 'Email akun merupakan identitas assignment dan tidak dapat diubah dari aplikasi.';
    }
}

window.SIMNIAccess = Object.freeze({
    get context() { return currentContext; },
    canAccess,
    assertFeature,
    assertLogicalPath,
    transitionAcademicYear,
    applyAccessUI
});
