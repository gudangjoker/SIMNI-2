// Served ONLY by the localhost UI/UX audit server as js/auth/auth.js.
import {ref,get,set} from '../../vendor/firebase/firebase-database.js';
const role=new URL(location.href).searchParams.get('role')==='vip'?'vip':'superuser';
window.UIUXLogin=async()=>{
    const started=performance.now();
    document.documentElement.dataset.simniAuthPhase='loading-workspace';
    const access=Object.freeze({uid:`uiux-${role}`,email:`${role}@qa.invalid`,displayName:'Guru Audit Sintetis',role,workspaceId:role==='vip'?'ws_pjok':'ws_superuser',classId:role==='vip'?'PJOK':'3A',activeAcademicYearId:'2026-2027',status:'active',source:'uiux-mock'});
    window.SIMNICurrentAccess=access;
    window.SIMNIAccess={canAccess:feature=>SIMNIAccessPolicy.hasFeature(role,feature),applyAccessUI(){
        document.documentElement.dataset.simniRole=role;
        document.querySelectorAll('[data-requires-feature]').forEach(el=>{
            const denied=!this.canAccess(el.dataset.requiresFeature);
            const ownsVisibility=el.matches('.view-section, [role="dialog"], [id^="modal-"]');
            if(denied && ownsVisibility) window.SIMNIDialog?.close?.(el);
            if(!ownsVisibility || denied) el.classList.toggle('hidden',denied);
            el.setAttribute('aria-hidden',String(denied || el.hidden || el.classList.contains('hidden')));
        });
    }};
    window.SIMNIDatabaseTarget={mode:'mock',projectId:'uiux-isolated'};
    window.isUserLoggedIn=true; state.activeKelas='3A';
    Object.assign(state.pengaturan,{nama_sekolah:'SD Audit Sintetis',nama_wali_kelas:'Guru Audit',nama_guru:'Guru Audit',nama_kelas:'Kelas 3A',tahun_pelajaran:'2026-2027'});
    const base=`workspaces/${access.workspaceId}/academicYears/2026-2027`;
    window.QABase=base;
    if(!(await get(ref(null,base))).exists()){
        const students={}, learningObjectives={};
        for(let i=1;i<=30;i++){const nisn=String(1200000000+i);students[nisn]={ID_Siswa:`stu_${nisn}`,NISN:nisn,'Nama Lengkap':i===1?'Alya Nama Panjang untuk Pemeriksaan Responsivitas':'Siswa Audit '+i,Kelas:'3A',Kelompok:'A','Jenis Kelamin':i%2?'L':'P','Foto URL':'./icons/simni-logo.png'};}
        const subjects=role==='vip'?['PJOK']:['Matematika','Bahasa Indonesia','Pendidikan Pancasila','IPAS','Seni Rupa','PJOK'];
        for(const [index,mapel] of subjects.entries())for(let n=1;n<=12;n++){const id=`tp_${index}_${n}`;learningObjectives[id]={ID_mapel:id,mapel,semester:'1',kode_tp:`TP.${n}`,deskripsi_tp:`Peserta didik dapat memahami dan menerapkan materi ${mapel} dengan contoh di kehidupan sehari-hari.`,kelas:'3A',chapterNumber:n===1?null:Math.min(n,10)};}
        await set(ref(null,base),{students,learningObjectives,grades:{},attendance:{},journals:{},schedule:{senin:{ID_Jadwal:'senin',Hari:'Senin',Jam_Ke:1,Mapel:subjects[0],Kelas:'3A'}},notes:{},documents:{}});
    }
    const {loadFeatureFragments}=await import('../core/feature-loader.js');
    await loadFeatureFragments();
    window.initFirebaseListener();
    await new Promise((resolve,reject)=>{const start=performance.now();const timer=setInterval(()=>{if(SIMNISyncState?.status==='ready'){clearInterval(timer);resolve();}else if(performance.now()-start>12000){clearInterval(timer);reject(new Error('Mock sync not ready'));}},25);});
    SIMNIAccess.applyAccessUI(); initDates(); renderIdentitas(); populateAllDropdowns();
    window.SIMNIAuthState={phase:'session-ready',uid:access.uid,role,loginBusy:false};
    document.documentElement.dataset.simniAuthPhase='session-ready';
    switchView('dashboard'); unlockScreen();
    sessionStorage.setItem('uiux-session',role);window.UIUXReady=true;
    window.UIUXLoginDuration=performance.now()-started;
};
window.loginAuth=window.UIUXLogin;
window.logoutAuth=async()=>{stopFirebaseListener();sessionStorage.removeItem('uiux-session');window.UIUXReady=false;lockScreen();document.documentElement.dataset.simniAuthPhase='signed-out';};
window.resetPasswordAuth=()=>toast('Respons reset akun tiruan.','info');
window.resumeSIMNIAuthSession=()=>true;
document.documentElement.dataset.simniAuthPhase='signed-out';
window.SIMNIAuthState={phase:'signed-out',loginBusy:false};
window.UIUXAuthReady=true;
if(sessionStorage.getItem('uiux-session')===role)await window.UIUXLogin();
export {};
