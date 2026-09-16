import{readFile,writeFile}from'node:fs/promises';
async function edit(file,fn){let old=await readFile(file,'utf8');old=old.replaceAll('\r\n','\n');const next=fn(old);if(next===old)throw Error('No edit '+file);await writeFile(file,next);}
const lazy={
'features/attendance/attendance.js':{openQRScanner:['scanner'],cetakRekapPresensiPDF:['pdf']},
'features/students/students.js':{generatePrintQR:['pdf'],importSiswaExcel:['xlsx']},
'features/grades/grades.js':{importTPExcel:['xlsx'],cetakBukuInduk:['pdf']},
'features/journal/journal.js':{cetakJurnalPDF:['pdf']},
'features/notes/notes.js':{cetakCatatanPDF:['pdf']},
'features/backup/backup.js':{exportArsipTotalExcel:['xlsx']},
'features/lps/lps.js':{exportExcelLPS:['excel']},
'features/gadm/gadm-engine.js':{printOutput:['pdf']},
'features/gadm/gadm-docx.js':{createDocxBlob:['zip']},
'features/gadm/gadm.js':{exportExcel:['xlsx']}
};
for(const[file,functions]of Object.entries(lazy))await edit(file,s=>{for(const[name,groups]of Object.entries(functions)){const re=new RegExp('(async\\s+)?function '+name+'\\(([^)]*)\\)\\s*\\{');if(!re.test(s))throw Error('Missing function '+name);s=s.replace(re,(_,a,args)=>'async function '+name+'('+args+') {\n    await window.ensureSIMNIVendors?.('+groups.map(g=>JSON.stringify(g)).join(',')+');');}return s;});
await edit('features/gadm/gadm.js',s=>s.replace("getElementById('gadm-download-excel')?.addEventListener('click', () => {\n        try {\n            exportExcel();", "getElementById('gadm-download-excel')?.addEventListener('click', async (event) => {\n        const button = event.currentTarget; button.disabled = true; button.setAttribute('aria-busy', 'true');\n        try {\n            await exportExcel();").replace("            await exportExcel();\n        } catch (error) {\n            notify(error.message || error, 'error');\n        }", "            await exportExcel();\n        } catch (error) {\n            notify(error.message || error, 'error');\n        } finally { button.disabled = false; button.removeAttribute('aria-busy'); }"));
for(const f of ['package.json','package-lock.json','js/core/runtime-config.js','manifest.json','index.html','features/settings/settings.html','features/dashboard/dashboard.html'])await edit(f,s=>s.replaceAll('4.6.7','4.6.8'));
console.log('Lazy vendors and release version revised.');
