// ==========================================
// FILE: js/ui/navigation.js
// Lock screen, navigasi view, dan modal.
// ==========================================

function unlockScreen() {
    const scr = document.getElementById('login-screen');
    if (!scr) return;
    scr.classList.add('hidden');
    scr.classList.remove('flex', 'opacity-0');
    scr.setAttribute('aria-hidden', 'true');
    scr.inert = true;
}
function lockScreen() {
    const scr = document.getElementById('login-screen');
    if (!scr) return;
    scr.inert = false;
    scr.setAttribute('aria-hidden', 'false');
    scr.classList.remove('hidden', 'opacity-0');
    scr.classList.add('flex');
}

// --- NAVIGASI & MODAL ---
function switchView(id) {
    const feature = window.SIMNIAccessPolicy?.featureForView(id);
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        window.toast?.('Role Anda tidak memiliki akses ke fitur ini.', 'error');
        return false;
    }
    if (id === 'gadm' && window.SIMNIGADM?.isMounted?.() !== true) {
        void window.SIMNIGADM?.ensureReady?.().then((mounted) => {
            if (mounted) switchView('gadm');
        }).catch((error) => {
            window.toast?.(`GADM gagal dibuka: ${error?.message || error}`, 'error');
        });
        return true;
    }
    let activeView = document.getElementById(`view-${id}`);
    if (!activeView && id === 'lps' && window.SIMNILPS?.ensureReady) {
        void window.SIMNILPS.ensureReady().then((mounted) => {
            if (mounted) switchView('lps');
        }).catch((error) => {
            window.toast?.(`Halaman LPS/BLP gagal dibuka: ${error?.message || error}`, 'error');
        });
        return true;
    }
    if (!activeView?.classList.contains('view-section')) {
        window.toast?.('Halaman yang diminta tidak tersedia.', 'error');
        return false;
    }
    if (id !== 'lps') {
        window.SIMNILPS?.unmount?.();
        activeView = document.getElementById(`view-${id}`);
    }
    state.currentView = id;
    document.querySelectorAll('.view-section').forEach(e => {
        const isActive = e === activeView;
        e.hidden = !isActive;
        e.classList.toggle('hidden', !isActive);
        e.classList.remove('fade-in');
    });
    activeView.hidden = false;
    activeView.classList.remove('hidden');
    void activeView.offsetWidth;
    activeView.classList.add('fade-in');
    
    document.querySelectorAll('.nav-btn').forEach(b => {
        const active = b.dataset.target === id;
        b.classList.toggle('font-bold', active);
        b.classList.toggle('font-medium', !active);
        b.classList.toggle('text-primary', active);
        b.classList.toggle('bg-indigo-50', active);
        b.classList.toggle('dark:bg-primary/20', active);
        b.classList.toggle('dark:text-indigo-300', active);
        b.classList.toggle('text-slate-600', !active);
        b.classList.toggle('hover:bg-slate-50', !active);
        b.classList.toggle('dark:text-slate-400', !active);
        b.classList.toggle('dark:hover:bg-[#111111]', !active);
    });
    
    document.querySelectorAll('.nav-btn-mobile').forEach(b => {
        const active = b.dataset.target === id;
        b.classList.toggle('text-primary', active);
        b.classList.toggle('scale-110', active);
        b.classList.toggle('text-slate-400', !active);
    });

    window.SIMNIAccess?.applyAccessUI?.();
    
    initDates(); 
    renderCurrentView();
    return true;
}
function openModal(id) { 
    const feature = window.SIMNIAccessPolicy?.featureForModal(id);
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        window.toast?.('Role Anda tidak memiliki akses ke menu ini.', 'error');
        return false;
    }
    const m = document.getElementById(id); 
    if(m) {
        m.classList.remove('hidden'); m.classList.add('flex'); void m.offsetWidth; m.classList.remove('opacity-0');
        if (id === 'modal-pengaturan' && window.SIMNIAccess?.canAccess('userAdmin')) window.refreshSIMNIAccounts?.();
    } 
}
function closeModal(id) { 
    const m = document.getElementById(id); 
    if(m) {
        m.classList.add('opacity-0', 'hidden');
        m.classList.remove('flex');
    }
}

// --- POPULASI ANTARMUKA ---
