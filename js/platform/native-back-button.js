// ==========================================
// FILE: js/platform/native-back-button.js
// FUNGSI:
// Handler Hardware Back Button Android (Capacitor App plugin)
// dan fallback browser popstate.
//
// Hierarki Penutupan (LIFO):
// 1. SIMNI Lens viewfinder / active camera
// 2. HTML5 QR scanner overlay
// 3. Modal GADM (selector/preview)
// 4. Mobile Menu Drawer
// 5. Modal dialog terbuka (.fixed:not(.hidden))
// 6. Non-dashboard active view -> switchView('dashboard')
// 7. Dashboard -> double tap to exit (2000ms window)
// ==========================================

'use strict';

(function initNativeBackButton() {
    let lastBackPressTime = 0;
    const EXIT_CONFIRM_WINDOW_MS = 2000;

    function handleBackAction() {
        // 1. SIMNI Lens Viewfinder
        const lensOverlay = document.getElementById('simni-ocr-overlay');
        if (lensOverlay && !lensOverlay.classList.contains('hidden')) {
            if (typeof window.closeSIMNILens === 'function') {
                window.closeSIMNILens();
                return true;
            }
        }

        // 2. QR Scanner Modal / Presensi QR
        const qrModal = document.getElementById('modal-scanner');
        if (qrModal && !qrModal.classList.contains('hidden')) {
            if (typeof window.closeQRScanner === 'function') {
                void window.closeQRScanner();
                return true;
            }
            if (typeof window.closeModal === 'function') {
                window.closeModal('modal-scanner');
                return true;
            }
        }

        // 3. GADM Modal
        const gadmModal = document.getElementById('gadm-selector-modal');
        if (gadmModal && !gadmModal.classList.contains('hidden')) {
            gadmModal.classList.add('hidden');
            return true;
        }

        // 4. Mobile Menu Drawer
        if (typeof window.isMenuDrawerOpen === 'function' && window.isMenuDrawerOpen()) {
            if (typeof window.closeMenuDrawer === 'function') {
                window.closeMenuDrawer();
                return true;
            }
        }

        // 5. Open Modals (paling atas / z-index tinggi)
        const openModals = Array.from(document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]'));
        if (openModals.length > 0) {
            const topModal = openModals[openModals.length - 1];
            if (topModal?.id && typeof window.closeModal === 'function') {
                window.closeModal(topModal.id);
                return true;
            }
        }

        // 6. View selain Dashboard -> kembali ke Dashboard
        const currentView = window.state?.currentView || 'dashboard';
        if (currentView !== 'dashboard') {
            if (typeof window.switchView === 'function') {
                window.switchView('dashboard');
                return true;
            }
        }

        // 7. Di Dashboard -> Double tap to exit
        const now = Date.now();
        if (now - lastBackPressTime < EXIT_CONFIRM_WINDOW_MS) {
            if (window.Capacitor?.Plugins?.App?.exitApp) {
                window.Capacitor.Plugins.App.exitApp();
            }
            return false;
        }

        lastBackPressTime = now;
        if (typeof window.toast === 'function') {
            window.toast('Tekan sekali lagi untuk keluar dari SIMNI.', 'info');
        }
        return true;
    }

    // Register Capacitor Hardware Back Button Listener jika tersedia
    if (window.Capacitor?.Plugins?.App?.addListener) {
        window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
            const handled = handleBackAction();
            if (!handled && !canGoBack) {
                window.Capacitor.Plugins.App.exitApp();
            }
        });
    }

    // Expose untuk pemanggilan terprogram atau testing
    window.SIMNINativeBackButton = Object.freeze({
        handleBackAction
    });
})();
