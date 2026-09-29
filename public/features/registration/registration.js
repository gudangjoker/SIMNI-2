import {createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,updateProfile,reload,signOut,onAuthStateChanged} from '../../vendor/firebase/firebase-auth.js';
import {auth,authPersistenceReady} from '../../js/database/firebase-client.js';
import {getRegistrationSlots,validateRegistrationInvite,activateRegistration,getRegistrationStatus} from '../../js/auth/registration-service.js';
const $=id=>document.getElementById(id);
let busy=false,lastEmail=0,currentStatus='unregistered';
const initialLink=new URLSearchParams(location.hash.slice(1));
const linkSlot=initialLink.get('slot')||'';
$('registration-code').value=initialLink.get('code')||'';
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text, type='info'){
    const el=$('registration-status');
    if(!el)return;
    el.hidden=false;el.classList.remove('hidden','border-red-300','bg-red-50','text-red-700','dark:bg-red-950/40','dark:text-red-300','border-amber-300','bg-amber-50','text-amber-700','border-emerald-300','bg-emerald-50','text-emerald-700','border-blue-300','bg-blue-50','text-blue-700');
    if(type==='error'||type==='rejected'){
        el.classList.add('border-red-300','bg-red-50','text-red-700','dark:bg-red-950/40','dark:text-red-300');
    }else if(type==='pending'){
        el.classList.add('border-amber-300','bg-amber-50','text-amber-700','dark:bg-amber-950/40','dark:text-amber-300');
    }else if(type==='success'){
        el.classList.add('border-emerald-300','bg-emerald-50','text-emerald-700','dark:bg-emerald-950/40','dark:text-emerald-300');
    }else{
        el.classList.add('border-blue-300','bg-blue-50','text-blue-700','dark:bg-blue-950/40','dark:text-blue-300');
    }
    el.innerHTML=text;
}
function setBusy(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);}
function payload(){return {slotId:$('registration-slot').value,inviteCode:$('registration-code').value.trim(),displayName:$('registration-name').value.trim()||auth.currentUser?.displayName||''};}
function operationId(uid){
    const k=`simni:registration-operation:${uid}`;let record;
    try{record=JSON.parse(sessionStorage.getItem(k)||'null');}catch(_){}
    if(!record?.operationId || Date.now()-record.issuedAt>47*60*60*1000){record={operationId:`reg_${crypto.randomUUID().replaceAll('-','')}`,issuedAt:Date.now()};sessionStorage.setItem(k,JSON.stringify(record));}
    return record;
}

async function loadSlots(){
    try{const result=await getRegistrationSlots();const select=$('registration-slot');select.replaceChildren(new Option('Pilih kelas',''));for(const slot of result.slots){const option=new Option(`Kelas ${slot.classId}${slot.available?'':' · terisi'}`,slot.slotId);option.disabled=!slot.available;select.append(option);}if(linkSlot)select.value=linkSlot;
        if(!result.enabled)message('Pendaftaran umum ditutup. Undangan penggantian yang masih berlaku dapat dilanjutkan.');
    }catch(e){message(e.message, 'error');}
}
async function inspect(){
    const user=auth.currentUser;if(!user)return;
    $('registration-verification').classList.remove('hidden');
    $('registration-name').value ||= user.displayName||'';$('registration-email').value=user.email||'';
    await reload(user);
    if(!auth.currentUser.emailVerified){message('Akun tersedia. Verifikasi email lalu periksa status. Jika kode belum terisi, masukkan kembali kode undangan.');return;}
    const result=await getRegistrationStatus();currentStatus=result.status;
    const pending=['pending_approval','active','disabled','deleting'].includes(result.status);
    $('registration-form').classList.toggle('hidden',pending);
    if(result.status==='active' && result.profile?.classId)message(`<strong>Akun Disetujui!</strong> Akses aktif untuk Kelas ${result.profile.classId}. Buka SIMNI melalui tautan di bawah.`, 'success');
    else if(result.status==='pending_approval')message(`Permohonan Kelas ${result.request?.classId||''} sedang menunggu persetujuan superuser.`, 'pending');
    else if(result.status==='disabled'||result.status==='deleting')message('Akses akun dihentikan. Hubungi superuser.', 'error');
    else if(result.status==='rejected'){
        const reason = result.request?.reason ? `<div class="mt-2 p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-xs"><strong>Alasan penolakan:</strong> ${escapeHtml(result.request.reason)}</div>` : '';
        message(`<div><strong>Permohonan Ditolak</strong>${reason}<p class="text-xs mt-1 text-slate-600 dark:text-slate-400">Silakan hubungi superuser untuk mendapatkan undangan baru.</p></div>`, 'rejected');
    }
    else message('Akun tersedia. Lengkapi nama dan kode undangan, lalu tekan Periksa Status / Kirim Permohonan.');
}
async function resend(){
    if(!auth.currentUser)throw new Error('Masuk terlebih dahulu.');
    if(Date.now()-lastEmail<60000)throw new Error('Tunggu satu menit sebelum mengirim ulang.');
    await sendEmailVerification(auth.currentUser);lastEmail=Date.now();message('Email verifikasi dikirim. Periksa kotak masuk dan spam.');
}
async function run(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){message(e.code==='auth/email-already-in-use'?'Email sudah memiliki akun. Gunakan Masuk & Lanjutkan di bawah.':e.message);}finally{setBusy(false);}}
$('registration-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    await authPersistenceReady;const body=payload(),mail=$('registration-email').value.trim().toLowerCase();
    await validateRegistrationInvite({...body,email:mail});
    if(auth.currentUser && auth.currentUser.email?.toLowerCase()!==mail)throw new Error('Keluar terlebih dahulu untuk mengganti akun.');
    if(!auth.currentUser){const password=$('registration-password').value;if(password.length<12||password!==$('registration-password-confirm').value)throw new Error('Kata sandi minimal 12 karakter dan harus sama.');await createUserWithEmailAndPassword(auth,mail,password);}
    operationId(auth.currentUser.uid);
    await updateProfile(auth.currentUser,{displayName:body.displayName});
    $('registration-password').value='';$('registration-password-confirm').value='';
    $('registration-verification').classList.remove('hidden');
    if(!auth.currentUser.emailVerified)await resend();else await submit();
});});
async function submit(){
    await inspect();if(!auth.currentUser?.emailVerified || ['pending_approval','active','disabled','deleting'].includes(currentStatus))return;
    const body=payload();if(!body.inviteCode||!body.slotId)throw new Error('Masukkan kembali kode undangan dan kelas; kode tidak disimpan di perangkat.');
    const result=await activateRegistration({...body,...operationId(auth.currentUser.uid)});
    if(result.status==='pending_approval'){$('registration-code').value='';sessionStorage.removeItem(`simni:registration-operation:${auth.currentUser.uid}`);}
    await inspect();
}
$('registration-check').addEventListener('click',()=>run(submit));
$('registration-resend').addEventListener('click',()=>run(resend));
$('registration-login').addEventListener('click',()=>run(async()=>{await authPersistenceReady;await signInWithEmailAndPassword(auth,$('resume-email').value.trim(),$('resume-password').value);$('resume-password').value='';await inspect();}));
$('registration-logout').addEventListener('click',()=>run(async()=>{await signOut(auth);location.reload();}));
await authPersistenceReady;
onAuthStateChanged(auth,user=>{if(user&&!busy)run(inspect);});
loadSlots();
window.addEventListener('pagehide',()=>{$('registration-code').value='';$('registration-password').value='';$('registration-password-confirm').value='';$('resume-password').value='';});
