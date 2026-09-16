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

// --- DRAWER MENU GARIS 3 ---
function isMenuDrawerOpen() {
    const drawer = document.getElementById('mobile-menu-drawer');
    return Boolean(drawer && !drawer.classList.contains('hidden') && drawer.classList.contains('is-open'));
}

function openMenuDrawer() {
    const drawer = document.getElementById('mobile-menu-drawer');
    const backdrop = document.getElementById('menu-drawer-backdrop');
    if (!drawer) return;
    drawer.classList.remove('hidden');
    void drawer.offsetWidth;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    window.SIMNIDialog.open(drawer, closeMenuDrawer);
    if (backdrop) {
        backdrop.classList.remove('hidden');
        void backdrop.offsetWidth;
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
    }
}

function closeMenuDrawer() {
    const drawer = document.getElementById('mobile-menu-drawer');
    const backdrop = document.getElementById('menu-drawer-backdrop');
    if (!drawer) return;
    window.SIMNIDialog.close(drawer);
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (backdrop) {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
    }
    setTimeout(() => {
        if (!drawer.classList.contains('is-open')) {
            drawer.classList.add('hidden');
        }
        if (backdrop && !backdrop.classList.contains('is-open')) {
            backdrop.classList.add('hidden');
        }
    }, 250);
}

function toggleMenuDrawer() {
    if (isMenuDrawerOpen()) {
        closeMenuDrawer();
    } else {
        openMenuDrawer();
    }
}

document.addEventListener('click', (event) => {
    if (!isMenuDrawerOpen()) return;
    const drawer = document.getElementById('mobile-menu-drawer');
    const btnDrawer = document.getElementById('btn-menu-drawer');
    const target = event.target;
    if (drawer && !drawer.contains(target) && (!btnDrawer || !btnDrawer.contains(target))) {
        closeMenuDrawer();
    }
});

const MODAL_TO_FEATURE = Object.freeze({
    'modal-pengaturan': 'settings',
    'modal-pengaturan-lps': 'lps',
    'modal-dokumen': 'documents',
    'modal-siswa': 'students',
    'modal-tambah-siswa': 'students',
    'modal-edit-siswa': 'students',
    'modal-import-siswa': 'students',
    'modal-profil-siswa': 'students',
    'modal-scanner': 'attendance',
    'modal-rekap-presensi': 'attendance',
    'modal-kelola-tp': 'grades',
    'modal-tambah-tp': 'grades',
    'modal-edit-tp': 'grades',
    'modal-import-nilai': 'grades',
    'modal-tambah-jurnal': 'journal',
    'modal-setting-jadwal': 'journal',
    'modal-tambah-catatan': 'notes',
    'gadm-selector-modal': 'gadm'
});

function unmountActiveView(viewId) {
    if (!viewId) return;
    if (viewId === 'presensi' || viewId === 'attendance') {
        if (state.scannerInstance) {
            try {
                if (typeof closeQRScanner === 'function') {
                    void closeQRScanner();
                } else if (state.scannerInstance.clear) {
                    void state.scannerInstance.clear();
                    state.scannerInstance = null;
                }
            } catch (e) {
                console.warn('[SIMNI] Scanner unmount cleanup:', e);
            }
        }
    }
    if (viewId === 'lps') {
        window.SIMNILPS?.unmount?.();
    }
    if (viewId === 'gadm') {
        window.SIMNIGADM?.unmount?.();
    }
    window.SIMNIDialog?.closeAll?.();
}

// --- NAVIGASI & MODAL ---
let navigationSequence = 0;
async function switchView(id) {
    const sequence = ++navigationSequence;
    id = id || 'dashboard';
    closeMenuDrawer();
    await window.SIMNIFormDrafts?.ready?.();
    if (sequence !== navigationSequence) return false;
    const targetId = id || 'dashboard';
    const previousView = state.currentView;

    const feature = window.SIMNIAccessPolicy?.featureForView(targetId);
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        window.toast?.('Role Anda tidak memiliki akses ke fitur ini.', 'error');
        return false;
    }

    if (feature && typeof window.ensureFeatureLoaded === 'function') {
        try {
            await window.ensureFeatureLoaded(feature);
        } catch (error) {
            window.toast?.(`Fitur ${feature} gagal dimuat: ${error?.message || error}`, 'error');
            return false;
        }
    }

    if (sequence !== navigationSequence) return false;
    if (targetId === 'gadm' && window.SIMNIGADM?.isMounted?.() !== true) {
        try {
            await window.SIMNIGADM?.ensureReady?.();
        } catch (error) {
            window.toast?.(`GADM gagal dibuka: ${error?.message || error}`, 'error');
            return false;
        }
    }

    let activeView = document.getElementById(`view-${targetId}`);
    if (!activeView && targetId === 'lps' && window.SIMNILPS?.ensureReady) {
        try {
            await window.SIMNILPS.ensureReady();
            activeView = document.getElementById(`view-${targetId}`);
        } catch (error) {
            window.toast?.(`Halaman LPS/BLP gagal dibuka: ${error?.message || error}`, 'error');
            return false;
        }
    }

    if (sequence !== navigationSequence) return false;
    if (!activeView?.classList.contains('view-section')) {
        if (targetId !== 'dashboard' && document.getElementById('view-dashboard')) {
            return switchView('dashboard');
        }
        window.toast?.('Halaman yang diminta tidak tersedia.', 'error');
        return false;
    }

    if (previousView && previousView !== targetId) unmountActiveView(previousView);
    if (id !== 'lps') {
        window.SIMNILPS?.unmount?.();
        activeView = document.getElementById(`view-${id}`);
    }

    state.currentView = targetId;
    try { sessionStorage.setItem('simni:active-view', targetId); } catch (_) {}

    // Tombol menu garis 3 selalu tersedia pada header mobile
    const btnDrawer = document.getElementById('btn-menu-drawer');
    if (btnDrawer) {
        btnDrawer.classList.remove('hidden');
    }

    const drawerNav = document.getElementById('mobile-menu-drawer');
    if (drawerNav) {
        drawerNav.setAttribute('aria-label', id === 'gadm' ? 'Navigasi drawer' : 'Navigasi utama mobile');
    }

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
        b.classList.toggle('text-primary', active);
        b.classList.toggle('border-b-2', active);
        b.classList.toggle('border-primary', active);
        b.classList.toggle('bg-slate-50', active);
        b.classList.toggle('dark:bg-slate-800', active);
        b.classList.toggle('text-slate-600', !active);
        b.classList.toggle('dark:text-slate-400', !active);
        b.classList.toggle('dark:hover:bg-[#111111]', !active);
    });

    document.querySelectorAll('.nav-btn-drawer').forEach(b => {
        const active = b.dataset.target === id;
        b.classList.toggle('font-bold', active);
        b.classList.toggle('text-primary', active);
        b.classList.toggle('bg-indigo-50', active);
        b.classList.toggle('dark:bg-primary/20', active);
        b.classList.toggle('dark:text-indigo-300', active);
        b.classList.toggle('text-slate-700', !active);
        b.classList.toggle('dark:text-slate-300', !active);
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
    document.querySelectorAll('.nav-btn, .nav-btn-drawer, .nav-btn-mobile').forEach(button => {
        if (button.dataset.target === targetId) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    return true;
}

async function openModal(id) { 
    const feature = window.SIMNIAccessPolicy?.featureForModal(id) || MODAL_TO_FEATURE[id];
    if (feature && !window.SIMNIAccess?.canAccess(feature)) {
        window.toast?.('Role Anda tidak memiliki akses ke menu ini.', 'error');
        return false;
    }
    if (feature && typeof window.ensureFeatureLoaded === 'function') {
        try {
            await window.ensureFeatureLoaded(feature);
        } catch (error) {
            window.toast?.(`Menu gagal dimuat: ${error?.message || error}`, 'error');
            return false;
        }
    }
    const m = document.getElementById(id); 
    if(m) {
        m.classList.remove('hidden'); m.classList.add('flex'); void m.offsetWidth; m.classList.remove('opacity-0');
        window.SIMNIDialog.open(m, () => closeModal(id));
        if (id === 'modal-pengaturan' && window.SIMNIAccess?.canAccess('userAdmin')) window.refreshSIMNIAccounts?.();
        if (id === 'modal-kelola-tp' && typeof window.updateTPListModal === 'function') window.updateTPListModal();
    } 
}

function closeModal(id) { 
    const m = document.getElementById(id); 
    if(m) {
        window.SIMNIDialog.close(m);
        m.classList.add('opacity-0', 'hidden');
        m.classList.remove('flex');
    }
}

// Shared lifecycle for custom dialogs. Each layer restores the exact inert state
// and trigger it received, including when a second dialog opens over the first.
window.SIMNIDialog = (() => {
    const stack = [];
    const focusables = root => [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter(e => e.getClientRects().length && !e.closest('[hidden],.hidden,[inert]'));
    function open(element, dismiss) {
        if (!element) return;
        if (stack.some(item => item.element === element)) {
            if (!element.contains(document.activeElement)) (focusables(element)[0] || element).focus({preventScroll:true});
            return;
        }
        const entry = {element, dismiss, trigger:document.activeElement, siblings:[]};
        element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true');
        if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
            const title = element.querySelector('h1,h2,h3');
            if (title) { title.id ||= element.id + '-title'; element.setAttribute('aria-labelledby', title.id); }
            else element.setAttribute('aria-label', 'Dialog SIMNI');
        }
        for (let branch = element; branch?.parentElement && branch !== document.body; branch = branch.parentElement) {
            for (const sibling of branch.parentElement.children) {
                if (sibling === branch || sibling.id === 'toast-container' || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
                entry.siblings.push([sibling, sibling.inert]); sibling.inert = true;
            }
        }
        stack.push(entry); element.tabIndex = -1;
        (focusables(element)[0] || element).focus({preventScroll:true});
    }
    function close(element) {
        const index = stack.findIndex(item => item.element === element);
        if (index < 0) return;
        // Restore nested layers before removing their parent layer.
        for (let i=stack.length-1;i>=index;i--) {
            const entry = stack.pop();
            for (const [sibling,inert] of entry.siblings) sibling.inert = inert;
            entry.element.removeAttribute('aria-modal');
            if (entry.trigger?.isConnected && !entry.trigger.closest('[inert]')) entry.trigger.focus({preventScroll:true});
        }
    }
    document.addEventListener('keydown', event => {
        const top = stack.at(-1); if (!top) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); top.dismiss?.(); }
        if (event.key === 'Tab') {
            const items = focusables(top.element), first = items[0], last = items.at(-1);
            if (!first) { event.preventDefault(); top.element.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !top.element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !top.element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    }, true);
    function closeAll(keepWithin) {
        while (stack.length) { const top = stack.at(-1); if (keepWithin?.contains(top.element)) break; top.dismiss?.(); if (stack.at(-1) === top) close(top.element); }
    }
    return Object.freeze({open,close,closeAll});
})();

window.openMenuDrawer = openMenuDrawer;
window.closeMenuDrawer = closeMenuDrawer;
window.toggleMenuDrawer = toggleMenuDrawer;
window.isMenuDrawerOpen = isMenuDrawerOpen;
window.switchView = switchView;
window.openModal = openModal;
window.closeModal = closeModal;
window.unmountActiveView = unmountActiveView;

// --- POPULASI ANTARMUKA ---
