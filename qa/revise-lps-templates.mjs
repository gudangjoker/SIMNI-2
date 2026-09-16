import {readFile,writeFile} from 'node:fs/promises';
const file='features/lps/lps.js';let source=await readFile(file,'utf8');
const start=source.indexOf("        const builtins = createElement('optgroup'");
const end=source.indexOf('        select.appendChild(builtins);',start)+'        select.appendChild(builtins);'.length;
const builtin=source.slice(start,end);source=source.slice(0,start)+source.slice(end);
const selectStart=source.indexOf('    function populateTemplateSourceSelect()');
const insert=source.indexOf('        const templates =',selectStart);
source=source.slice(0,insert)+builtin+'\n\n'+source.slice(insert);
source=source.replace(/core\s*\.createDefaultTemplate\(/g,'createReferenceTemplate(');
const helperStart=source.indexOf('    function normalizeExcelText('),nameStart=source.indexOf('    function uniqueExcelSheetName('),nameEnd=source.indexOf('    function cloneExcelValue(',nameStart),exportStart=source.indexOf('    async function exportExcelLPS()'),exportEnd=source.indexOf('    function reportForOutput()',exportStart);
if([helperStart,nameStart,nameEnd,exportStart,exportEnd].some(n=>n<0))throw Error('Export boundaries unavailable');
const replacement=`    async function exportExcelLPS() {
        if (runtime.busy.print) return false;
        runtime.busy.print = true;
        renderBusyState();
        showProgress('Menyiapkan workbook LPS/BLP...');
        try {
            const period = currentPeriod();
            if (!period) throw new Error('Jenis laporan belum dipilih.');
            const group = byId('lps-filter-kelompok')?.value || 'Semua';
            const currentClass = String(window.state?.activeKelas || '').trim();
            const students = [...(window.state?.students || [])]
                .filter(student => !currentClass || String(student.Kelas || '') === currentClass)
                .filter(student => group === 'Semua' || student.Kelompok === group)
                .sort((a,b) => String(a['Nama Lengkap'] || '').localeCompare(String(b['Nama Lengkap'] || ''),'id'));
            if (!students.length) throw new Error('Tidak ada siswa pada filter aktif.');
            const template = core.normalizeTemplate(getActiveTemplate(period.id) || createReferenceTemplate(currentSettings(),period.id),currentSettings(),period.id);
            const current = reportForOutput(), names=[], used=new Set(), reports=[];
            students.forEach((student,index) => {
                const id=core.reportId(currentSettings(),period.id,student.NISN);
                let report=current?.reportId===id ? current : getSavedReport(id);
                if(!report) report=makeDraftReport(student,template);
                reports.push(report);
                const name=uniqueExcelSheetName({getWorksheet:name=>used.has(name)},student,index);
                names.push(name);used.add(name);
            });
            const result=await window.SIMNILPSExcel.createWorkbook(reports,names);
            const url=URL.createObjectURL(result.blob),link=document.createElement('a');
            link.href=url;
            link.download=period.type+'_'+safeFilename(currentSettings().nama_kelas || 'SIMNI')+'_'+safeFilename(currentSettings().tahun_pelajaran || '')+'.xlsx';
            document.body.appendChild(link);link.click();link.remove();
            setTimeout(()=>URL.revokeObjectURL(url),1000);
            runtime.lastOperation={type:'export-excel',status:'success',sheets:result.modes.map(({sheet,mode})=>({sheet,mode})),completedAt:nowISO()};
            notify('Berhasil disimpan: workbook '+period.type+' berisi '+students.length+' sheet siswa.','success');
            return true;
        } catch(error) {
            console.error('[SIMNI LPS] Ekspor Excel gagal:',error);
            notify('Ekspor Excel gagal: '+(error?.message || error),'error');
            return false;
        } finally {
            runtime.busy.print=false;renderBusyState();hideProgress();
        }
    }

`;
source=source.slice(0,helperStart)+source.slice(nameStart,nameEnd)+replacement+source.slice(exportEnd);
await writeFile(file,source);
for(const f of ['package.json','package-lock.json','js/core/runtime-config.js','manifest.json','index.html','features/dashboard/dashboard.html','features/settings/settings.html']){
 const original=await readFile(f,'utf8');if(!original.includes('4.6.8'))throw Error('Version missing '+f);await writeFile(f,original.replaceAll('4.6.8','4.6.9'));
}
