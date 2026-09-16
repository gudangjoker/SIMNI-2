// One-time migration of callers to server-executed administrative operations.
import fs from 'node:fs';
const edit=(file,fn)=>fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')));
edit('js/database/repository.js',s=>{
 const start=s.indexOf('export async function dbRecordAuthoritativeAudit('),end=s.indexOf('export async function logSIMNIAuditEvent',start);
 if(start<0||end<0)throw Error('Audit boundary missing');
 s=s.slice(0,start)+`export async function dbRecordAuthoritativeAudit() {
    // Compatibility only: browser-authored committed receipts are forbidden.
    return failedResult(new Error('Audit hanya diterbitkan oleh operasi server. Gunakan receipt hasil operasi administratif.'));
}

`+s.slice(end);
 const from=s.indexOf('        const updates = {};',s.indexOf('export async function dbCommitAcademicYearRollover'));
 const to=s.indexOf("        await updateDatabase('', updates);",from);
 if(from<0||to<0)throw Error('Rollover boundary missing');
 s=s.slice(0,from)+`        const operation = await commitAdministrativeOperation({ action: 'year_rollover', targetId: nextYear, expectedYear: currentYearId, superuserClassId: nextSuperClass });`+s.slice(to+"        await updateDatabase('', updates);".length);
 return s.replace('completedAt: preparedAt, verification });','completedAt: preparedAt, verification, receipt: operation.receipt });');
});
edit('features/archive/archive.js',s=>{
 const start=s.indexOf('            let auditResult ='),end=s.indexOf('            runtime.lastOperation =',start);
 if(start<0||end<0)throw Error('Archive audit boundary missing');
 return s.slice(0,start)+'            const auditResult = finalWrite;\n\n'+s.slice(end);
});
edit('features/reset/reset.js',s=>{
 const start=s.indexOf('    async function writeAudit('),end=s.indexOf('\n    async function ',start+20);
 if(start<0||end<0)throw Error('Reset audit boundary missing');
 return s.slice(0,start)+s.slice(end);
});
edit('firebase/database.rules.production.json',s=>{
 const r=JSON.parse(s);
 r.rules.auditLogs['$workspaceId']['$operationId']['.write']=false;
 r.rules.administrativeOperations={'.read':false,'.write':false};
 return JSON.stringify(r,null,2)+'\n';
});
edit('js/database/firebase-client.js',s=>s.replace('Cloud Functions sekarang menulis audit event sendiri hanya setelah','Worker menulis receipt audit sendiri hanya setelah'));
