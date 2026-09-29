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
    const isConnecting = online === true && (!window.SIMNISyncState || window.SIMNISyncState?.status === 'connecting' || window.SIMNISyncState?.status === 'syncing');
    const label = connected ? 'Tersinkron' : isConnecting ? 'Menyinkronkan...' : navigator.onLine === false ? 'Offline · data lokal' : 'Koneksi data terputus';
    const badge = document.getElementById('dashboard-sync-status');
    if (badge) {
        const dotColor = connected ? 'bg-emerald-500' : isConnecting ? 'bg-amber-500' : 'bg-rose-500';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor} ${connected ? 'animate-pulse' : ''}"></span> ${label}`;
        badge.dataset.connected = String(connected);
    }
    window.SIMNILastConnectionLabel = label;

    // Desktop: Ikon bulat indikator warna yang berubah (glowing & pulse dot)
    const desktopEl = document.getElementById('sync-status-desktop');
    if (desktopEl) {
        desktopEl.setAttribute('role', 'status');
        desktopEl.setAttribute('aria-label', `Status koneksi: ${label}`);
        desktopEl.title = `Status: ${label} (Klik untuk info koneksi)`;

        let dotColorClass = 'bg-slate-400';
        let pingColorClass = '';
        let showPing = false;

        if (connected) {
            dotColorClass = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
            pingColorClass = 'bg-emerald-400';
            showPing = true;
        } else if (isConnecting) {
            dotColorClass = 'bg-amber-500 shadow-[0_0_8px_#f59e0b]';
            pingColorClass = 'bg-amber-400';
            showPing = true;
        } else {
            dotColorClass = 'bg-rose-500 shadow-[0_0_8px_#ef4444]';
            showPing = false;
        }

        desktopEl.innerHTML = `
            <div class="relative flex items-center justify-center w-5 h-5">
                ${showPing ? `<span class="animate-ping absolute inline-flex h-3 w-3 rounded-full ${pingColorClass} opacity-75"></span>` : ''}
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${dotColorClass} transition-colors duration-300"></span>
            </div>
            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hidden xl:inline">${label}</span>
        `;
    }

    // Mobile: Pertahankan apa adanya tanpa perubahan
    const renderMobile = (element) => {
        if (!element) return;
        element.replaceChildren();
        element.setAttribute('role', 'status');
        element.setAttribute('aria-label', label); element.title = label;
        const dot = document.createElement('div');
        dot.className = `w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`;
        element.append(dot);
    };
    renderMobile(document.getElementById('sync-status-mobile'));
}

function showSyncStatusInfo() {
    const isOnline = navigator.onLine !== false;
    const connected = isOnline && window.SIMNISyncState?.status === 'ready' && window.SIMNISyncState?.connected === true;

    const modalId = 'modal-sync-info';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 z-[10010] bg-slate-900/50 dark:bg-black/80 backdrop-blur-xs hidden items-center justify-center p-4 transition-opacity';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white dark:bg-[#111111] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-400'}"></span>
                    <h3 class="font-bold text-sm text-slate-800 dark:text-white">Status Jaringan &amp; Sinkronisasi</h3>
                </div>
                <button type="button" class="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs cursor-pointer" onclick="document.getElementById('${modalId}').classList.add('hidden')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="space-y-2 text-xs">
                <div class="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-[#000000] rounded-xl border border-slate-100 dark:border-slate-800">
                    <span class="text-slate-500 dark:text-slate-400">Koneksi Internet:</span>
                    <span class="font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">
                        ${isOnline ? '<i class="fas fa-wifi mr-1"></i> Terhubung' : '<i class="fas fa-plane mr-1"></i> Mode Offline'}
                    </span>
                </div>
                <div class="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-[#000000] rounded-xl border border-slate-100 dark:border-slate-800">
                    <span class="text-slate-500 dark:text-slate-400">Status Server Cloud:</span>
                    <span class="font-bold ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}">
                        ${connected ? 'Tersinkronisasi' : 'Lokal / Menunggu Jaringan'}
                    </span>
                </div>
                <div class="p-2.5 bg-slate-50 dark:bg-[#000000] rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-500 dark:text-slate-400">Penyimpanan Lokal:</span>
                        <span class="font-bold text-emerald-600 dark:text-emerald-400"><i class="fas fa-shield-alt mr-1"></i> Aman (IndexedDB)</span>
                    </div>
                    <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Aplikasi tetap dapat digunakan untuk mencatat presensi, nilai, dan jurnal meskipun tanpa sinyal. Perubahan akan disinkronkan otomatis begitu online.
                    </p>
                </div>
            </div>
            <div class="flex gap-2 pt-1">
                <button type="button" id="btn-recheck-sync" class="w-full py-2.5 bg-primary hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                    <i class="fas fa-sync-alt text-xs"></i> Periksa Sambungan Ulang
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    const recheckBtn = modal.querySelector('#btn-recheck-sync');
    if (recheckBtn) {
        recheckBtn.onclick = () => {
            recheckBtn.disabled = true;
            recheckBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> Memeriksa...';
            setTimeout(() => {
                updateSyncUI(navigator.onLine);
                modal.classList.add('hidden');
                toast('Status jaringan telah diperiksa.', 'info');
            }, 500);
        };
    }
}

let syncListenersBound = false;
function bindSyncClickListeners() {
    if (syncListenersBound) return;
    const desktopEl = document.getElementById('sync-status-desktop');
    const mobileEl = document.getElementById('sync-status-mobile');
    if (desktopEl) {
        desktopEl.style.cursor = 'pointer';
        desktopEl.onclick = showSyncStatusInfo;
    }
    if (mobileEl) {
        mobileEl.style.cursor = 'pointer';
        mobileEl.onclick = showSyncStatusInfo;
    }
    if (desktopEl || mobileEl) syncListenersBound = true;
}

if (typeof window !== 'undefined') {
    window.showLoad = showLoad;
    window.hideLoad = hideLoad;
    window.clearAllLoading = clearAllLoading;
    window.getActiveLoadingOwners = getActiveLoadingOwners;
    window.playBeep = playBeep;
    window.toast = toast;
    window.updateSyncUI = updateSyncUI;
    window.showSyncStatusInfo = showSyncStatusInfo;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindSyncClickListeners);
    } else {
        bindSyncClickListeners();
    }
}
