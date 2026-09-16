// ==========================================
// FILE: js/ui/feedback.js
// Loading, toast, beep, dan status sinkronisasi.
// ==========================================

let loadingTimer = null, loadingHideTimer = null, loadingShownAt = 0, loadingGeneration = 0;
let loadingSeq = 0;
const activeLoadingOwners = new Map();

function getActiveLoadingOwners() {
    return Array.from(activeLoadingOwners.keys());
}

function showLoad(text, ownerId) {
    const generation = ++loadingGeneration;
    clearTimeout(loadingTimer);
    clearTimeout(loadingHideTimer);

    const token = String(ownerId || `load_${++loadingSeq}_${Date.now()}`);
    const message = String(text || 'Memproses data…');
    activeLoadingOwners.set(token, {
        text: message,
        createdAt: performance.now(),
        isAnonymous: !ownerId
    });

    const overlay = document.getElementById('loading-overlay');
    const label = document.getElementById('loading-text');
    if (label) label.textContent = message;

    const reveal = () => {
        if (generation !== loadingGeneration || activeLoadingOwners.size === 0) return;
        loadingShownAt = performance.now();
        overlay?.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        overlay?.classList.add('flex', 'opacity-100', 'translate-y-0');
        overlay?.setAttribute('role', 'status');
        const bar = document.getElementById('slim-loading-bar');
        if (bar) { bar.style.opacity = '1'; bar.style.width = '75%'; }
    };

    if (overlay && !overlay.classList.contains('hidden')) reveal();
    else loadingTimer = setTimeout(reveal, 120);

    return token;
}

function hideLoad(token) {
    if (token) {
        activeLoadingOwners.delete(String(token));
    } else {
        let anonKey = null;
        for (const [key, meta] of activeLoadingOwners.entries()) {
            if (meta.isAnonymous) anonKey = key;
        }
        if (!anonKey && activeLoadingOwners.size > 0) {
            anonKey = activeLoadingOwners.keys().next().value;
        }
        if (anonKey) activeLoadingOwners.delete(anonKey);
    }

    const overlay = document.getElementById('loading-overlay');
    const label = document.getElementById('loading-text');

    if (activeLoadingOwners.size > 0) {
        const remaining = Array.from(activeLoadingOwners.values());
        const latest = remaining[remaining.length - 1];
        if (label && latest) label.textContent = latest.text;
        return;
    }

    const generation = ++loadingGeneration;
    clearTimeout(loadingTimer);
    clearTimeout(loadingHideTimer);

    loadingHideTimer = setTimeout(() => {
        if (generation !== loadingGeneration || activeLoadingOwners.size > 0) return;
        overlay?.classList.add('hidden', 'opacity-0');
        overlay?.classList.remove('flex');
        const bar = document.getElementById('slim-loading-bar');
        if (bar) { bar.style.opacity = '0'; bar.style.width = '0'; }
    }, overlay && !overlay.classList.contains('hidden') ? Math.max(0, 300 - (performance.now() - loadingShownAt)) : 0);
}

function clearAllLoading() {
    activeLoadingOwners.clear();
    const generation = ++loadingGeneration;
    clearTimeout(loadingTimer);
    clearTimeout(loadingHideTimer);
    const overlay = document.getElementById('loading-overlay');
    overlay?.classList.add('hidden', 'opacity-0');
    overlay?.classList.remove('flex');
    const bar = document.getElementById('slim-loading-bar');
    if (bar) { bar.style.opacity = '0'; bar.style.width = '0'; }
}

function playBeep() {
    try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        const context = new AudioContextCtor();
        if (context.state === 'suspended') context.resume().catch(() => {});
        const oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        oscillator.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
        oscillator.addEventListener?.('ended', () => context.close?.().catch?.(() => {}), { once: true });
    } catch (error) {
        console.warn('Suara beep ditahan oleh browser.', error);
    }
}

function toast(message, type = 'info') {
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

// A successful commit remains successful even if a renderer fails afterwards.
function notifyCommittedSave(render, message = 'Berhasil disimpan.') {
    toast(message, 'success');
    try { render(); } catch (error) {
        console.error('[SIMNI Render after commit]', error);
        toast('Data tersimpan, tetapi tampilan belum dapat diperbarui. Buka kembali halaman ini.', 'warning');
    }
}

function updateSyncUI(online) {
    const connected = online === true && navigator.onLine !== false && window.SIMNISyncState?.status === 'ready' && window.SIMNISyncState?.connected === true;
    const label = connected ? 'Tersinkron' : navigator.onLine === false ? 'Offline · data lokal' : 'Koneksi data terputus';
    online = connected;
    const badge = document.getElementById('dashboard-sync-status');
    if (badge) { badge.textContent = label; badge.dataset.connected = String(connected); }
    window.SIMNILastConnectionLabel = label;
    const render = (element, small = false) => {
        if (!element) return;
        element.replaceChildren();
        element.setAttribute('role', 'status');
        element.setAttribute('aria-label', label); element.title = label;
        const dot = document.createElement('div');
        dot.className = `w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`;
        if (small) {
            element.append(dot);
            return;
        }
        const text = document.createElement('span');
        text.className = 'sync-label';
        text.textContent = label;
        element.append(dot, text);
    };
    render(document.getElementById('sync-status-desktop'));
    render(document.getElementById('sync-status-mobile'), true);
}

if (typeof window !== 'undefined') {
    window.showLoad = showLoad;
    window.hideLoad = hideLoad;
    window.clearAllLoading = clearAllLoading;
    window.getActiveLoadingOwners = getActiveLoadingOwners;
    window.playBeep = playBeep;
    window.toast = toast;
    window.updateSyncUI = updateSyncUI;
}
