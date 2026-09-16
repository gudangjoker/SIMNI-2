import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {startAuditServer} from './uiux-audit-server.mjs';
const out=path.resolve('test-output/uiux-4.6.8/final'),downloads=path.join(out,'downloads');await mkdir(downloads,{recursive:true});
const {server,origin}=await startAuditServer(),browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage();
const r={checks:[],screens:[],errors:[],external:[],build:JSON.parse(await readFile('public/build-manifest.json','utf8')).buildId};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
page.on('pageerror',e=>r.errors.push(e.message));await page.setRequestInterception(true);page.on('request',q=>{if(q.url().startsWith(origin)||q.url().startsWith('data:')||q.url().startsWith('blob:'))q.continue();else{r.external.push(q.url());q.abort();}});
const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
const completed=new Set();cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')completed.add(e.guid);});
async function test(name,fn){try{r.checks.push({name,status:'PASS',evidence:await fn()});}catch(e){r.checks.push({name,status:'FAIL',error:e.stack});}console.log(r.checks.at(-1).status,name);await writeFile(path.join(out,'results.json'),JSON.stringify(r,null,2));}
async function view(n){await page.evaluate(n=>switchView(n),n);await page.waitForFunction(n=>document.getElementById('view-'+n)?.hidden===false,{},n);await wait(200);}
async function fill(s,v){await page.evaluate((s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},s,v);}
async function scan(label){if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({url:origin+'/qa/axe.js'});const result=await page.evaluate(async()=>{const a=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {width:innerWidth,scroll:document.querySelector('#main-scroll-area').scrollWidth,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};});r.screens.push({label,...result});await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});assert.ok(result.scroll<=result.width+2,JSON.stringify(result));assert.equal(result.violations.length,0,JSON.stringify(result));return result;}
async function download(selector,ext){const before=new Set(await readdir(downloads)),count=completed.size;await page.click(selector);for(let i=0;i<240;i++){await wait(250);const file=(await readdir(downloads)).find(n=>n.endsWith(ext)&&!before.has(n));if(file&&completed.size>count){const bytes=await readFile(path.join(downloads,file));assert.ok(bytes.length>500);await writeFile(path.join(out,'verified-'+file),bytes);return {file,bytes:bytes.length,signature:bytes.subarray(0,8).toString(),completed:true};}}throw Error('No completed '+ext+' download');}
try{
 await page.setViewport({width:390,height:844});await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.UIUXAuthReady);await page.evaluate(()=>UIUXLogin());
 for(const width of [320,390,768,1366])await test('Settings labels and reflow '+width,async()=>{await page.setViewport({width,height:900});await view('pengaturan');return scan('settings-'+width);});
 await page.setViewport({width:390,height:844});await view('gadm');await page.click('[data-gadm-document="modulAjar"]');
 for(const[id,v]of Object.entries({'gadm-nama-guru':'Guru Audit','gadm-mata-pelajaran':'IPAS','gadm-materi-unit':'Pancaindra','gadm-alokasi-waktu':'2 x 35 menit'}))await fill('#'+id,v);
 await page.click('[data-gadm-step-target="2"]');await page.click('#gadm-refresh-curriculum');await page.waitForFunction(()=>!document.querySelector('#gadm-use-cp').disabled);await page.click('#gadm-use-cp');await page.click('#gadm-use-tp');await page.click('[data-gadm-step-target="4"]');await page.click('#gadm-generate');await page.waitForFunction(()=>document.querySelector('#gadm-status').dataset.state==='ok');
 for(const width of [320,390,768,1366])await test('GADM steps contrast and reflow '+width,async()=>{await page.setViewport({width,height:900});return scan('gadm-'+width);});
 await test('GADM lazy PDF completed and button restored',async()=>{assert.equal(await page.evaluate(()=>!!window.html2pdf),false);const d=await download('#gadm-print','.pdf');assert.ok(d.signature.startsWith('%PDF'));await page.waitForFunction(()=>!document.querySelector('#gadm-print').disabled);return d;});
 await test('GADM lazy Excel completed',async()=>{assert.equal(await page.evaluate(()=>!!window.XLSX),false);const d=await download('#gadm-download-excel','.xlsx');assert.ok(d.signature.startsWith('PK'));return d;});
 await test('GADM Word completed',async()=>download('#gadm-download-word','.doc'));
 await test('LPS lazy Excel completed',async()=>{await view('lps');await fill('#lps-select-siswa','1200000001');await fill('#lps-select-periode','lps_mid_s1');const d=await download('[data-simni-action="exportExcelLPS"]','.xlsx');assert.ok(d.signature.startsWith('PK'));return d;});
 await test('BLP Excel completed',async()=>{await fill('#lps-select-periode','blp_final_s1');const d=await download('[data-simni-action="exportExcelLPS"]','.xlsx');assert.ok(d.signature.startsWith('PK'));return d;});
 await test('No external requests or uncaught errors',async()=>{assert.deepEqual(r.external,[]);assert.deepEqual(r.errors,[]);return true;});
}catch(e){r.fatal=e.stack;}finally{await writeFile(path.join(out,'results.json'),JSON.stringify(r,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({pass:r.checks.filter(c=>c.status==='PASS').length,fail:r.checks.filter(c=>c.status==='FAIL').length,fatal:r.fatal}));if(r.fatal||r.checks.some(c=>c.status==='FAIL'))process.exitCode=1;}
