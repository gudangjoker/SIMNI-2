import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';import{startAuditServer}from'./uiux-audit-server.mjs';
const out=path.resolve('test-output/lps-template-fidelity'),downloads=path.join(out,'downloads');await mkdir(downloads,{recursive:true});
const{server,origin}=await startAuditServer(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage(),r={checks:[],errors:[],external:[],downloads:[],build:JSON.parse(await readFile('public/build-manifest.json','utf8')).buildId};
r.buildId=r.build;
page.on('pageerror',e=>r.errors.push(e.message));page.on('dialog',d=>d.accept());await page.setRequestInterception(true);page.on('request',q=>{if(q.url().startsWith(origin)||q.url().startsWith('data:')||q.url().startsWith('blob:'))q.continue();else{r.external.push(q.url());q.abort();}});
const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});const completed=new Set(),downloadNames=new Map();cdp.on('Browser.downloadWillBegin',e=>downloadNames.set(e.guid,e.suggestedFilename));cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')completed.add(e.guid);});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);if(!e)throw Error('Missing '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}
async function test(name,fn){try{r.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){r.checks.push({name,status:'FAIL',error:e.stack,feedback:await page.$eval('#toast-container',e=>e.innerText).catch(()=>null)});console.log('FAIL',name,e.message);}await writeFile(path.join(out,'workflow-results.json'),JSON.stringify(r,null,2));console.log(r.checks.at(-1).status,name);}
async function builder(){await page.click('[data-simni-action="openModalPengaturanLPS"]');await page.waitForFunction(()=>!document.querySelector('#modal-pengaturan-lps').classList.contains('hidden'));}
async function saveBuilder(){const before=await page.evaluate(()=>QAMock.writes.length);await page.click('#lps-save-template-button');await page.waitForFunction(n=>QAMock.writes.length>n,{},before);await page.waitForFunction(()=>document.querySelector('#modal-pengaturan-lps').classList.contains('hidden'));await page.waitForFunction(()=>!document.querySelector('#lps-save-template-button').disabled && !document.querySelector('[data-simni-processing="true"]'));assert.equal(await page.evaluate(()=>gunakanTemplateLPSAktif()),true);}
async function populate(){await page.evaluate(()=>{
 document.querySelectorAll('#lps-dynamic-form-container select').forEach(e=>{e.value=e.options[1]?.value || '';e.dispatchEvent(new Event('change',{bubbles:true}));});
 document.querySelectorAll('.lps-choice-group').forEach(g=>{const e=g.querySelector('input');if(e){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));}});
 document.querySelectorAll('.lps-response-detail').forEach(e=>e.value='Iqro 4 halaman 12');
 document.querySelectorAll('.lps-response-description,.lps-response-overall-text,.lps-response-item-text').forEach(e=>e.value='Catatan penilaian guru sintetis');
 document.querySelector('#lps-teacher-note').value='Catatan guru pertama';document.querySelector('#lps-teacher-note-secondary').value='Catatan guru kedua';document.querySelector('#lps-parent-note').value='Tanggapan orang tua';
});assert.equal(await page.evaluate(()=>saveLPSData()),true);}
async function download(label){const before=new Set(completed);await page.click('[data-simni-action="exportExcelLPS"]');for(let i=0;i<180;i++){await wait(200);const guid=[...completed].find(id=>!before.has(id)),f=downloadNames.get(guid);if(f){const bytes=await readFile(path.join(downloads,guid));assert.ok(bytes.length>500);const name=label+'.xlsx';await writeFile(path.join(out,name),bytes);r.downloads.push({label,file:name,guid,suggestedFilename:f,bytes:bytes.length});return {file:name,guid,bytes:bytes.length};}}throw Error('Unduhan tidak selesai: '+await page.$eval('#toast-container',e=>e.innerText));}
try{
await page.setViewport({width:1366,height:1000});await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.UIUXAuthReady);await page.evaluate(()=>UIUXLogin());await page.evaluate(()=>{state.students=state.students.slice(0,2);switchView('lps');});await page.waitForSelector('#lps-select-siswa');await fill('#lps-select-siswa','1200000001');
for(const[kind,period]of [['LPS','lps_mid_s1'],['BLP','blp_final_s1']]){
 await fill('#lps-select-periode',period);
 await test(kind+' built-in choice and populated editable form',async()=>{await builder();const options=await page.$$eval('#lps-template-source option',opts=>opts.map(e=>({value:e.value,disabled:e.disabled,text:e.textContent})));assert.ok(options.some(e=>e.value==='builtin:LPS')&&options.some(e=>e.value==='builtin:BLP'));await fill('#lps-template-source','builtin:'+kind);await page.click('[data-simni-action="salinTemplateLPS"]');const count=await page.$$eval('.lps-builder-aspect-title',e=>e.length);assert.equal(count,kind==='LPS'?8:7);await page.screenshot({path:path.join(out,kind+'-template-picker.png')});await saveBuilder();await populate();return {options,aspects:count};});
 await test(kind+' reference layout download',()=>download(kind+'-reference-result'));
 await test(kind+' rename aspect and criterion survives export',async()=>{await builder();await fill('.lps-builder-aspect-title','BTQ hasil edit guru');await page.$$eval('.lps-builder-aspect-items',els=>{const e=els.find(e=>e.value.trim());e.value=e.value.replace(/^[^\n]+/,'Butir yang diubah guru');e.dispatchEvent(new Event('input',{bubbles:true}));});await saveBuilder();await populate();return download(kind+'-renamed-result');});
 await test(kind+' add remove and reorder structure survives export',async()=>{await builder();await page.$$eval('.lps-builder-aspect-items',els=>{const e=els.find(e=>e.value.trim());e.value=e.value.split('\n').slice(1).reverse().concat(['Butir tambahan guru 1','Butir tambahan guru 2']).join('\n');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});await saveBuilder();await populate();return download(kind+'-custom-result');});
 await test(kind+' editable sections aspects criteria and text fields',async()=>{
  await builder();await page.click('[data-simni-action="addLPSBuilderSection"]');
  let section='.lps-builder-section:last-child';
  await fill(section+' .lps-builder-section-title','Bagian pilihan guru');
  await page.click(section+' [data-lps-action="add-builder-aspect"]');
  await fill(section+' .lps-builder-aspect-title','Aspek pilihan guru');
  await fill(section+' .lps-builder-aspect-input-type','text');
  await fill(section+' .lps-builder-aspect-items','Isian bebas guru');
  await fill(section+' .lps-builder-aspect-detail','Detail pilihan guru');
  await page.click(section+' [data-lps-action="add-builder-aspect"]');
  await page.click(section+' .lps-builder-aspect:last-child [data-lps-action="remove-builder-aspect"]');
  await page.click('[data-simni-action="addLPSBuilderSection"]');
  await page.click('.lps-builder-section:last-child [data-lps-action="remove-builder-section"]');
  await fill('.lps-builder-aspect-options','Sangat baik, Baik, Perlu latihan');
  await saveBuilder();await populate();return download(kind+'-extended-result');
 });
}
await test('Template editor responsive and accessible',async()=>{
 await builder();await page.addScriptTag({url:origin+'/qa/axe.js'});const evidence=[];
 for(const width of [320,390,1366])for(const dark of [false,true]){
  await page.setViewport({width,height:900});await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
  const result=await page.evaluate(async()=>{const el=document.querySelector('#modal-pengaturan-lps'),input=el.querySelector('.lps-builder-aspect-title'),style=getComputedStyle(input);const a=await axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,modalOverflow:el.scrollWidth>el.clientWidth,border:style.borderTopWidth,background:style.backgroundColor,violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))};});
  evidence.push({width,dark,...result});assert.equal(result.overflow,false);assert.equal(result.modalOverflow,false);assert.notEqual(result.border,'0px');assert.deepEqual(result.violations,[]);
  await page.screenshot({path:path.join(out,`builder-${width}-${dark?'dark':'light'}.png`)});
 }
 await page.setViewport({width:1366,height:1000});await page.evaluate(()=>document.documentElement.classList.remove('dark'));await page.click('[data-simni-action="closeModal"][data-simni-args*=modal-pengaturan-lps]');return evidence;
});
await test('Offline template export after PWA cache installation',async()=>{
 await page.evaluate(()=>{document.documentElement.classList.remove('dark');closeModal('modal-pengaturan-lps');});await page.setViewport({width:1366,height:1000});
 await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:60000});
 const cached=await page.evaluate(async()=>{const paths=['templates/BLP contoh.xlsx','vendor/jszip/jszip.min.js'];return Promise.all(paths.map(async p=>({path:p,cached:!!(await caches.match(new URL(p,location.href).href))})))});assert.ok(cached.every(e=>e.cached));
 await page.setOfflineMode(true);try{await download('BLP-offline-result');return {cached,offline:true};}finally{await page.setOfflineMode(false);}
});
await test('Final integrity rejection',async()=>{const rejected=await page.evaluate(async()=>{try{await SIMNILPSExcel.createWorkbook([{reportType:'BLP',status:'final',hash:'bad'}],['Invalid']);return false;}catch(e){return /Integritas/.test(e.message);}});assert.ok(rejected);return true;});
await test('Source reference download matches root bytes',async()=>{const result=[];for(const file of ['LPS KLS 2 contoh.xlsx','BLP contoh.xlsx']){const fetched=await page.evaluate(async file=>Array.from(new Uint8Array(await(await fetch('templates/'+encodeURIComponent(file))).arrayBuffer())),file);const original=await readFile(file);assert.ok(original.equals(Buffer.from(fetched)));result.push({file,identical:true});}return result;});
await test('No external requests or uncaught browser errors',async()=>{assert.deepEqual(r.errors,[]);assert.deepEqual(r.external,[]);return true;});
}catch(e){r.fatal=e.stack;}finally{await writeFile(path.join(out,'workflow-results.json'),JSON.stringify(r,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({pass:r.checks.filter(c=>c.status==='PASS').length,fail:r.checks.filter(c=>c.status==='FAIL').length,fatal:r.fatal}));if(r.fatal||r.checks.some(c=>c.status==='FAIL'))process.exitCode=1;}
