// ==========================================
// FILE: js/platform/haptics-service.js
// FUNGSI:
// Layanan terpadu getaran taktil (Haptic Feedback) SIMNI.
// ==========================================

'use strict';

(function initSIMNIHapticsService() {
    const isNative = typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function'
        ? window.Capacitor.isNativePlatform()
        : false;

    function canVibrate() {
        return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    }

    async function impact(style = 'light') {
        try {
            if (isNative && window.Capacitor?.Plugins?.Haptics?.impact) {
                const styleUpper = String(style || 'LIGHT').toUpperCase();
                await window.Capacitor.Plugins.Haptics.impact({ style: styleUpper });
                return;
            }
            if (canVibrate()) {
                const duration = style === 'heavy' ? 25 : (style === 'medium' ? 18 : 10);
                navigator.vibrate(duration);
            }
        } catch (_) {}
    }

    async function notification(type = 'success') {
        try {
            if (isNative && window.Capacitor?.Plugins?.Haptics?.notification) {
                const typeUpper = String(type || 'SUCCESS').toUpperCase();
                await window.Capacitor.Plugins.Haptics.notification({ type: typeUpper });
                return;
            }
            if (canVibrate()) {
                const pattern = type === 'error' ? [20, 40, 20] : (type === 'warning' ? [15, 30] : [15]);
                navigator.vibrate(pattern);
            }
        } catch (_) {}
    }

    async function selection() {
        try {
            if (isNative && window.Capacitor?.Plugins?.Haptics?.selectionChanged) {
                await window.Capacitor.Plugins.Haptics.selectionChanged();
                return;
            }
            if (canVibrate()) {
                navigator.vibrate(8);
            }
        } catch (_) {}
    }

    const service = {
        impact,
        notification,
        selection,
        isSupported: isNative || canVibrate()
    };

    if (typeof window !== 'undefined') {
        window.SIMNIHaptics = service;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = service;
    }
})();
