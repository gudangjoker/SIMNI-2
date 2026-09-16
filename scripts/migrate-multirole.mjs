#!/usr/bin/env node
// Offline plan first; no production mutation without --apply and the exact plan hash.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const databaseUrl=String(process.env.SIMNI_MIGRATION_DATABASE_URL||'').replace(/\/$/,'');
const token=String(process.env.SIMNI_MIGRATION_AUTH_TOKEN||'');
const projectId=String(process.env.SIMNI_MIGRATION_PROJECT_ID||'');
if(!databaseUrl || !token || !projectId)throw new Error('Set SIMNI_MIGRATION_DATABASE_URL, SIMNI_MIGRATION_AUTH_TOKEN, SIMNI_MIGRATION_PROJECT_ID. Jangan tulis token dalam laporan.');
if(new URL(databaseUrl).protocol!=='https:' && !['localhost','127.0.0.1'].includes(new URL(databaseUrl).hostname))throw new Error('Database harus HTTPS atau emulator lokal.');
const headers={Authorization:`Bearer ${token}`,'content-type':'application/json'};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
async function fetchRoot(){
 const response=await fetch(`${databaseUrl}/.json`,{headers:{...headers,'X-Firebase-ETag':'true'}});
 if(!response.ok)throw new Error(`Baca database gagal: ${response.status}`);
 return {value:await response.json(),etag:response.headers.get('etag')};
}
async function putRoot(value,etag){
 if(!etag)throw new Error('ETag database tidak tersedia.');
 const response=await fetch(`${databaseUrl}/.json`,{method:'PUT',headers:{...headers,'if-match':etag},body:JSON.stringify(value)});
 if(!response.ok)throw new Error(response.status===412?'Database berubah sejak rencana dibuat. Apply dibatalkan.':`Apply gagal: ${response.status}`);
}
const ownerEmail='unggaran.sditbm@gmail.com',vipEmail='anur.auliya01@gmail.com';
const classes=['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6A','6B'];
const features=['students','attendance','grades','journal','notes','gadm','lps','settings','backup','archive'];
const preset=()=>Object.fromEntries([...features.map(f=>[f,['backup','archive'].includes(f)?'read':'manage']),['export',true]]);
async function verifyIdentity(uid,email){
 const response=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,{method:'POST',headers,body:JSON.stringify({localId:[uid]})});
 const body=await response.json();
 if(!response.ok || body.users?.length!==1 || body.users[0].localId!==uid || body.users[0].email?.toLowerCase()!==email || body.users[0].disabled)throw new Error('Identitas Firebase Auth tidak cocok atau nonaktif. Migrasi dihentikan.');
}
function firebaseValue(value){
 if(Array.isArray(value))return value.map(v=>firebaseValue(v));
 if(value && typeof value==='object'){
  const entries=Object.entries(value).map(([k,v])=>[k,firebaseValue(v)]).filter(([,v])=>v!==null && v!==undefined);
  return entries.length?Object.fromEntries(entries):null;
 }
 return value;
}
function build(root){
 if(root.accessControl?.schemaVersion===4)return {alreadyMigrated:true};
 if(root.meta?.multiroleMaintenance!==true)throw new Error('Pasang rules maintenance yang menutup seluruh write klien dan set meta/multiroleMaintenance=true melalui kredensial administratif terlebih dahulu.');
 const now=Date.now(), users=structuredClone(root.users||{}),year=root.system?.academicYear?.activeYearId;
 if(!/^\d{4}-\d{4}$/.test(year||'')||Number(year.slice(5))!==Number(year.slice(0,4))+1)throw new Error('Tahun aktif invalid; tidak ada default diam-diam.');
 const find=email=>{const matches=Object.entries(users).filter(([,p])=>String(p.email||'').toLowerCase()===email);if(matches.length!==1)throw new Error('Identitas canonical hilang/ganda.');return matches[0];};
 const [ownerUid,owner]=find(ownerEmail),[vipUid,vip]=find(vipEmail);
 if(owner.status!=='active'||owner.role!=='superuser')throw new Error('Profil owner harus aktif dan ber-role superuser sebelum migrasi.');
 for(const ops of Object.values(root.administrativeOperations||{}))for(const op of Object.values(ops||{}))if(op.state==='pending')throw new Error('Selesaikan operasi administratif pending sebelum migrasi.');
 const result=structuredClone(root);result.workspaces ||= {};
 const legacy=result.workspaces.ws_superuser,target=result.workspaces.ws_kelas3a;
 if(!legacy&&!target)throw new Error('Data workspace owner tidak ditemukan.');
 if(legacy&&target&&hash(legacy)!==hash(target))throw new Error('Target 3A berkonflik; tidak di-overwrite.');
 if(!target)result.workspaces.ws_kelas3a=structuredClone(legacy);
 const control={schemaVersion:4,revision:1,maintenance:true,ownerUid,activeYear:year,legacyOwnerWorkspace:legacy?'ws_superuser':null,users,assignments:structuredClone(root.assignments||{}),slots:{[year]:{}},requests:{},invitations:{},operations:{},audit:{},drafts:{},registration:{enabled:false},migration:{at:now,sourceHash:hash(root),legacyRetained:!!legacy}};
 control.assignments[year] ||= {};
 for(const cls of classes){
  const ws=`ws_kelas${cls.toLowerCase()}`;
  result.workspaces[ws] ||= {meta:{workspaceId:ws,classId:cls,kind:'class',schemaVersion:4},settings:{identity:{nama_aplikasi:'SIMNI Administrasi Kelas',nama_kelas:`Kelas ${cls}`,tahun_pelajaran:year,nama_yayasan:'Yayasan Sosial dan Pendidikan Bina Muda',jenjang_sekolah:'Sekolah Dasar',nama_sekolah:'SDIT Bina Muda Cicalengka',status_akreditasi:'A',kota:'Cicalengka',nomor_izin:'No.421.2/1143-Disdikbud/2011',nama_wali_kelas:'',nuptk_wali_kelas:''}},academicYears:{[year]:{meta:{academicYearId:year,schemaVersion:4}}}};
  control.slots[year][cls]={classId:cls,workspaceId:ws,status:'available',revision:0,systemOwned:cls==='3A'};
 }
 for(const [uid,p] of Object.entries(users)){
  p.uid=uid;p.email=String(p.email||'').toLowerCase();p.assignmentRevision=Number(p.assignmentRevision||0)+1;
  if(uid===ownerUid){Object.assign(p,{role:'superuser',workspaceId:'ws_kelas3a',classId:'3A',legacyOwnerWorkspace:control.legacyOwnerWorkspace});}
  else if(uid===vipUid){Object.assign(p,{role:'vip',workspaceId:'ws_pjok',classId:'PJOK'});}
  else if(p.role!=='teacher')throw new Error('Role existing tidak dikenal; perlu pemetaan eksplisit.');
  p.permissions=p.permissions||preset();p.activeAcademicYearId=year;
  if(!['active','disabled'].includes(p.status)){
   p.workspaceId=null;p.classId=null;p.status='unassigned';continue;
  }
  if(p.role==='teacher'&&(!classes.includes(p.classId)||p.classId==='3A'||p.workspaceId!==`ws_kelas${p.classId.toLowerCase()}`))throw new Error('Scope teacher existing tidak konsisten.');
  control.assignments[year][uid]={uid,role:p.role,workspaceId:p.workspaceId,classId:p.classId,academicYearId:year,status:'active',revision:p.assignmentRevision,permissions:p.permissions,assignedBy:ownerUid,assignedAt:now};
  if(p.role!=='vip'){
   const slot=control.slots[year][p.classId];if(slot.assignedUid)throw new Error('Kelas existing memiliki dua pemilik.');Object.assign(slot,{assignedUid:uid,status:'occupied',revision:p.assignmentRevision});
  }
 }
 // Do not silently lose live legacy reservations/invitations; finish or revoke them first.
 for(const slot of Object.values(root.registrationSlots||{}))if(slot.reservation||slot.invitation)throw new Error('Undangan/reservasi legacy ditemukan. Selesaikan atau cabut secara eksplisit sebelum migrasi.');
 // Retain old data and copy receipts to the new owner address; pending operations were rejected above.
 for(const name of ['auditLogs','administrativeOperations','administrativeCommitMarkers']){
  const old=root[name]?.ws_superuser;if(!old)continue;
  result[name] ||= {};const dest=result[name].ws_kelas3a||{};
  for(const [id,value] of Object.entries(old)){if(dest[id]&&hash(dest[id])!==hash(value))throw new Error('Konflik referensi administratif legacy.');dest[id]=structuredClone(value);}
  result[name].ws_kelas3a=dest;
 }
 result.accessControl=control;
 return {after:result,ownerUid,vipUid};
}
if(args.includes('--open-access')){
 if(option('--confirm-schema')!=='4')throw new Error('Butuh --confirm-schema 4 setelah rules/Worker/Hosting final diverifikasi Antigravity.');
 const snap=await fetchRoot();if(snap.value?.accessControl?.schemaVersion!==4)throw new Error('Migrasi belum selesai.');
 snap.value.accessControl.maintenance=false;snap.value.accessControl.revision++;await putRoot(snap.value,snap.etag);
 console.log('Akses authority dibuka; registrasi tetap mengikuti pengaturan superuser.');
}else if(args.includes('--apply')){
 const file=option('--plan'),expected=option('--plan-sha256');if(!file||!expected)throw new Error('Gunakan --apply --plan <file> --plan-sha256 <hash>.');
 const plan=JSON.parse(await readFile(file,'utf8'));const {planHash,...payload}=plan;
 if(hash(plan.after)!==plan.afterHash)throw new Error('Isi hasil migrasi tidak cocok dengan hash rencana.');
 if(planHash!==expected||hash(payload)!==expected||plan.databaseUrl!==databaseUrl||plan.projectId!==projectId)throw new Error('Rencana/hash/target tidak cocok.');
 const current=await fetchRoot();
 if(hash(current.value)===plan.afterHash){console.log('Rencana sudah diterapkan; tidak ada penulisan ulang.');process.exit(0);}
 if(current.value?.accessControl?.schemaVersion===4)throw new Error('Database sudah bermigrasi dan berubah; rencana lama tidak boleh diulang.');
 if(hash(current.value)!==plan.beforeHash || current.etag!==plan.etag || current.value?.meta?.multiroleMaintenance!==true)throw new Error('Baseline berubah atau maintenance belum aktif. Buat rencana baru.');
 await verifyIdentity(plan.ownerUid,ownerEmail);await verifyIdentity(plan.vipUid,vipEmail);
 await putRoot(plan.after,plan.etag);
 const confirmed=await fetchRoot();if(hash(confirmed.value)!==plan.afterHash)throw new Error('Read-back berbeda. Pertahankan maintenance dan periksa perubahan.');
 console.log('Migrasi terkonfirmasi; legacy dipertahankan. Maintenance tetap aktif sampai cutover selesai.');
}else{
 const snap=await fetchRoot(),result=build(snap.value);
 if(result.alreadyMigrated){console.log('Schema 4 sudah ada; migrasi tidak menulis ulang metadata.');process.exit(0);}
 await verifyIdentity(result.ownerUid,ownerEmail);await verifyIdentity(result.vipUid,vipEmail);
 result.after = firebaseValue(result.after);
 const plan={databaseUrl,projectId,etag:snap.etag,beforeHash:hash(snap.value),afterHash:hash(result.after),ownerUid:result.ownerUid,vipUid:result.vipUid,after:result.after};
 plan.planHash=hash(plan);const output=option('--plan')||'multirole-migration-plan.private.json';
 await writeFile(output,JSON.stringify(plan),{encoding:'utf8',flag:'wx',mode:0o600});
 console.log(`DRY-RUN: ${output}\nPlan SHA-256: ${plan.planHash}\nFile mengandung data pribadi lengkap. Simpan di luar Hosting/Git. Tidak ada mutasi database.`);
}
