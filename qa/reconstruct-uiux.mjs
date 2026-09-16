// One-time source migration for the reviewed UI/UX findings; never shipped.
import{readFile,writeFile,mkdir}from'node:fs/promises';import path from'node:path';
const baseline='test-output/uiux-reconstruction/baseline';const manifest=JSON.parse(await readFile('public/build-manifest.json'));for(const f of Object.keys(manifest.files)){await mkdir(path.dirname(path.join(baseline,f)),{recursive:true});await writeFile(path.join(baseline,f),await readFile(path.join('public',f)));}
async function edit(file,fn){const old=await readFile(file,'utf8'),next=fn(old);if(old===next)throw Error('No change '+file);await writeFile(file,next);}
await edit('js/ui/feedback.js',s=>{
const a=s.indexOf('function showLoad('),b=s.indexOf('function playBeep(');
s=s.slice(0,a)+`let loadingTimer = null, loadingHideTimer = null, loadingShownAt = 0, loadingGeneration = 0;
function showLoad(text) {
    const generation = ++loadingGeneration;
    clearTimeout(loadingTimer); clearTimeout(loadingHideTimer);
    const overlay = document.getElementById('loading-overlay');
    const label = document.getElementById('loading-text');
    if (label) label.textContent = String(text || 'Memproses data…');
    const reveal = () => {
        if (generation !== loadingGeneration) return;
        loadingShownAt = performance.now();
        overlay?.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        overlay?.classList.add('flex', 'opacity-100', 'translate-y-0');
        overlay?.setAttribute('role', 'status');
        const bar = document.getElementById('slim-loading-bar');
        if (bar) { bar.style.opacity = '1'; bar.style.width = '75%'; }
    };
    if (overlay && !overlay.classList.contains('hidden')) reveal();
    else loadingTimer = setTimeout(reveal, 120);
}
function hideLoad() {
    const generation = ++loadingGeneration;
    clearTimeout(loadingTimer); clearTimeout(loadingHideTimer);
    const overlay = document.getElementById('loading-overlay');
    loadingHideTimer = setTimeout(() => {
        if (generation !== loadingGeneration) return;
        overlay?.classList.add('hidden', 'opacity-0'); overlay?.classList.remove('flex');
        const bar = document.getElementById('slim-loading-bar');
        if (bar) { bar.style.opacity = '0'; bar.style.width = '0'; }
    }, overlay && !overlay.classList.contains('hidden') ? Math.max(0, 300 - (performance.now() - loadingShownAt)) : 0);
}

`+s.slice(b);
const c=s.indexOf('function toast('),d=s.indexOf('// A successful commit',c);
s=s.slice(0,c)+`function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const text = String(message ?? '');
    // Repeated identical notifications are represented once, with no growing queue.
    for (const previous of container.children) if (previous.dataset.message === text) previous.remove();
    if (type === 'success') container.querySelectorAll('[data-simni-success]').forEach(node => node.remove());
    while (container.children.length >= 4) container.firstElementChild.remove();
    const node = document.createElement('div');
    node.className = 'simni-notification'; node.dataset.tone = type; node.dataset.message = text;
    if (type === 'success') node.dataset.simniSuccess = 'true';
    const content = document.createElement('span');
    content.setAttribute('role', type === 'error' ? 'alert' : 'status');
    content.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    content.setAttribute('aria-atomic', 'true'); content.textContent = text;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label', 'Tutup pemberitahuan'); close.addEventListener('click', () => node.remove());
    node.append(content, close); container.append(node);
    if (type === 'success') {
        const active = document.querySelector('.view-section:not([hidden]):not(.hidden)');
        if (active) {
            let status = active.querySelector('[data-save-status]');
            if (!status) { status = document.createElement('p'); status.dataset.saveStatus = ''; status.className = 'simni-save-status'; active.append(status); }
            status.textContent = text + ' · ' + new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
        }
        if (text.includes('Hadir')) playBeep();
    }
    if (type !== 'error' && type !== 'warning') setTimeout(() => node.remove(), 4000);
}

`+s.slice(d);
s=s.replace("const label = online ? 'Online' : 'Offline';",`const connected = online === true && navigator.onLine !== false && window.SIMNISyncState?.connected !== false;
    const label = connected ? 'Tersinkron' : navigator.onLine === false ? 'Offline · data lokal' : 'Koneksi data terputus';
    online = connected;
    const badge = document.getElementById('dashboard-sync-status');
    if (badge) { badge.textContent = label; badge.dataset.connected = String(connected); }
    window.SIMNILastConnectionLabel = label;`);
s=s.replace("element.replaceChildren();", "element.replaceChildren();\n        element.setAttribute('aria-label', label); element.title = label;");return s;});
await edit('features/dashboard/dashboard.html',s=>s.replace(/<button data-simni-action="toast"[\s\S]*?Database Aktif & Aman<\/button>/,'<p id="dashboard-sync-status" class="simni-connection-status" role="status" aria-live="polite">Memeriksa koneksi data…</p>'));
await edit('features/dashboard/dashboard.js',s=>s.replace(/function renderDashboard\(\)\s*\{/,"function renderDashboard() {\n    window.updateSyncUI?.(window.SIMNISyncState?.status === 'ready' && window.SIMNISyncState?.connected === true);"));
const labels={'presensi-date':'Tanggal presensi','input-jurnal-tanggal':'Tanggal mengajar','filter-mapel-nilai':'Mata pelajaran nilai','filter-tp-nilai':'Tujuan pembelajaran nilai','filter-catatan-siswa':'Filter siswa catatan','input-catatan-siswa':'Siswa catatan','input-catatan-tanggal':'Tanggal catatan','filter-catatan-bulan':'Bulan catatan','student-import-template':'Template impor siswa'};
for(const file of ['features/attendance/attendance.html','features/journal/journal.html','features/grades/grades.html','features/notes/notes.html','features/students/students.html'])await edit(file,s=>{
for(const[id,label]of Object.entries(labels))s=s.replace(new RegExp('(<(?:input|select)\\b[^>]*\\bid="'+id+'")'),'$1 aria-label="'+label+'"');
s=s.replace(/<label([^>]*?)>([^<]+)<\/label>\s*(<(?:input|select|textarea)\b[^>]*\bid="([^"]+)")/g,(m,attrs,text,control,id)=>attrs.includes('for=')?m:'<label'+attrs+' for="'+id+'">'+text+'</label>'+control);
s=s.replace(/<button\b([^>]*data-simni-action="closeModal"[^>]*)>/g,(m,attrs)=>attrs.includes('aria-label')?m:'<button aria-label="Tutup dialog"'+attrs+'>');return s;});
await edit('features/attendance/attendance.js',s=>s.replace('type="radio" name="s_${nisn}"','type="radio" aria-label="${value} — ${escapeHTML(student[\'Nama Lengkap\'])}" name="s_${nisn}"').replace('type="text" class="p-ket','type="text" aria-label="Keterangan presensi ${escapeHTML(student[\'Nama Lengkap\'])}" class="p-ket'));
await edit('features/lps/lps.js',s=>s.replace("input.className =\n                    'lps-response-overall-text';","input.setAttribute('aria-label', aspect.title + ' — hasil pengamatan');\n                input.className =\n                    'lps-response-overall-text';").replace("select.className =\n                    'lps-response-overall';","select.setAttribute('aria-label', aspect.title + ' — hasil pengamatan');\n                select.className =\n                    'lps-response-overall';").replace("input.className =\n                        'lps-response-item-text';","input.setAttribute('aria-label', aspect.title + ' — ' + item.label);\n                    input.className =\n                        'lps-response-item-text';").replace("select.className =\n                        'lps-response-item';","select.setAttribute('aria-label', aspect.title + ' — ' + item.label);\n                    select.className =\n                        'lps-response-item';").replace("modal.classList.add(\n                'is-open'\n            );","modal.classList.add(\n                'is-open'\n            );\n            window.SIMNIDialog?.open(modal, closeLPSPreview);").replace("modal.classList.remove(\n            'is-open'\n        );","window.SIMNIDialog?.close(modal);\n        modal.classList.remove(\n            'is-open'\n        );"));
await edit('features/gadm/gadm.html',s=>s.replace('id="gadm-seed" class="gadm-visually-hidden"','id="gadm-seed" type="hidden"').replace('class="gadm-entry-card" tabindex="0" role="radio" aria-checked="false" data-gadm-choice="prota"','class="gadm-entry-card" role="group" aria-label="Administrasi tahunan dan semester" data-gadm-choice="prota"'));
await edit('features/gadm/gadm.js',s=>s.replace("card.setAttribute('aria-checked',", "if (card.getAttribute('role') === 'radio') card.setAttribute('aria-checked',").replace("card.addEventListener('click', () => {", "card.addEventListener('click', (event) => {\n            if (card.getAttribute('role') === 'group' || event.target.closest('button')) return;").replace("if (e.key === 'Enter' || e.key === ' ') {", "if (e.target !== card || card.getAttribute('role') === 'group') return;\n            if (e.key === 'Enter' || e.key === ' ') {"));
await edit('chat/chat.html',s=>s.replace('id="chat-call-video"','id="chat-call-video" hidden disabled').replace('id="chat-call-audio"','id="chat-call-audio" hidden disabled'));
await edit('chat/js/chat-ui-handler.js',s=>s.replace("byId('chat-session-label').textContent = 'Online · Terenkripsi end-to-end';","updateConnectionLabel();").replace("authUnsubscribe = observeChatSession",`function updateConnectionLabel() {
  const online = navigator.onLine !== false;
  byId('chat-session-label').textContent = online ? 'Sesi aktif · Pesan terenkripsi' : 'Offline · Pesan belum tersinkron';
  document.querySelector('.wa-online-dot')?.classList.toggle('is-offline', !online);
}
window.addEventListener('online', updateConnectionLabel);
window.addEventListener('offline', updateConnectionLabel);
authUnsubscribe = observeChatSession`));
await edit('js/ui/theme.js',s=>s.replace("primary: '#0D9488'", "primary: '#0F766E'").replace("primary: '#EA580C'", "primary: '#C2410C'").replace("primary: '#E11D48'", "primary: '#BE123C'"));
console.log('Source reconstruction batch applied; no tests run.');
