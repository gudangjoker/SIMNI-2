import {readGrantedArchive} from '../../js/auth/registration-service.js';
export function openGrantedArchives(){
    const access=window.SIMNICurrentAccess;
    window.SIMNIAccess.assertFeature('archive');
    document.getElementById('simni-granted-archives')?.remove();
    const opener=document.activeElement,dialog=document.createElement('dialog');dialog.id='simni-granted-archives';
    dialog.style.cssText='width:min(94vw,620px);max-height:85dvh;overflow:auto;padding:24px;border-radius:16px';
    const title=document.createElement('h2');title.textContent='Arsip tahun sebelumnya';
    const form=document.createElement('form');
    const label=document.createElement('label');label.textContent='Tahun ajaran';
    const input=document.createElement('input');input.required=true;input.pattern='[0-9]{4}-[0-9]{4}';input.placeholder='2025-2026';input.style.cssText='padding:12px;border:1px solid #94a3b8;border-radius:8px;width:100%';
    const select=document.createElement('select');select.style.cssText='padding:12px;width:100%';
    const load=document.createElement('button');load.textContent='Muat arsip';load.type='submit';load.style.cssText='padding:12px';
    const feedback=document.createElement('p');feedback.setAttribute('role','status');
    const list=document.createElement('div');const close=document.createElement('button');close.textContent='Tutup';close.type='button';close.style.cssText='padding:12px';
    let busy=false,alive=true;
    function options(){select.replaceChildren();const values=new Set([access.workspaceId,...Object.keys(access.archiveGrants?.[input.value]||{}).filter(w=>access.archiveGrants[input.value][w]===true)]);for(const ws of values)select.append(new Option(ws.replace('ws_',''),ws));}
    input.addEventListener('change',options);options();
    form.append(label,input,select,load);dialog.append(title,form,feedback,list,close);document.body.append(dialog);
    const dismiss=()=>{if(busy)return;alive=false;dialog.close();dialog.remove();opener?.focus();};close.onclick=dismiss;dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
    form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;busy=true;load.disabled=true;const scope={year:input.value,workspaceId:select.value};list.replaceChildren();
        try{const result=await readGrantedArchive('list',scope);if(!alive)return;
            for(const [id,item] of Object.entries(result.items)){
                const row=document.createElement('p'),button=document.createElement('button');button.type='button';button.textContent=`Unduh ${id}`;button.style.cssText='padding:12px';button.disabled=access.role!=='superuser'&&access.permissions?.export!==true;
                button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;try{const value=await readGrantedArchive('read',{...scope,archiveId:id});await window.SIMNIDownloadService.downloadBlob(new Blob([JSON.stringify(value.archive,null,2)],{type:'application/json'}),`SIMNI_Arsip_${scope.year}_${id}.json`);feedback.textContent='Arsip disiapkan untuk diunduh.';}catch(error){feedback.textContent=error.message;}finally{busy=false;button.disabled=false;}};
                row.append(document.createTextNode(`${item.createdAt||id} `),button);list.append(row);
            }
            feedback.textContent=Object.keys(result.items).length?'Akses baca arsip; pemulihan lintas tahun tidak dilakukan.':'Tidak ada arsip pada tahun ini.';
        }catch(error){feedback.textContent=error.message;}finally{busy=false;load.disabled=false;}
    };
    dialog.showModal();input.focus();
}
