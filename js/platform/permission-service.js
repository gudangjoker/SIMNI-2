// ==========================================
// FILE: js/platform/permission-service.js
// FUNGSI:
// Manager Permission Terpusat untuk PWA & Capacitor Android Native.
// Mengikuti prinsip least-privilege, lazy-request on demand,
// dan pembedaan status granted / denied / permanently-denied.
// ==========================================

'use strict';

export const PERMISSION_TYPES = Object.freeze({
    CAMERA: 'camera',
    MICROPHONE: 'microphone',
    NOTIFICATIONS: 'notifications'
});

export const PERMISSION_STATUS = Object.freeze({
    GRANTED: 'granted',
    DENIED: 'denied',
    PROMPT: 'prompt',
    PERMANENTLY_DENIED: 'permanently-denied',
    UNSUPPORTED: 'unsupported'
});

class PermissionService {
    constructor() {
        this._deniedCounts = new Map();
    }

    isNative() {
        return Boolean(window.Capacitor) || Boolean(window.SIMNIPlatform) || window.location.protocol === 'capacitor:';
    }

    async check(type) {
        if (!Object.values(PERMISSION_TYPES).includes(type)) {
            throw new Error(`Tipe permission tidak dikenal: ${type}`);
        }

        // 1. Jalur Capacitor / Native Bridge jika tersedia
        if (this.isNative() && window.Capacitor?.Plugins) {
            try {
                if (type === PERMISSION_TYPES.CAMERA && window.Capacitor.Plugins.Camera) {
                    const status = await window.Capacitor.Plugins.Camera.checkPermissions();
                    return this._mapCapacitorStatus(status.camera);
                }
                if (type === PERMISSION_TYPES.NOTIFICATIONS && window.Capacitor.Plugins.PushNotifications) {
                    const status = await window.Capacitor.Plugins.PushNotifications.checkPermissions();
                    return this._mapCapacitorStatus(status.receive);
                }
            } catch (err) {
                console.warn(`[PermissionService] Native check failed for ${type}:`, err);
            }
        }

        // 2. Jalur Web Standard (Permissions API)
        if (navigator.permissions?.query) {
            try {
                let name = null;
                if (type === PERMISSION_TYPES.CAMERA) name = 'camera';
                else if (type === PERMISSION_TYPES.MICROPHONE) name = 'microphone';
                else if (type === PERMISSION_TYPES.NOTIFICATIONS) name = 'notifications';

                if (name) {
                    const result = await navigator.permissions.query({ name });
                    if (result.state === 'granted') return PERMISSION_STATUS.GRANTED;
                    if (result.state === 'denied') {
                        return this._isPermanentlyDenied(type)
                            ? PERMISSION_STATUS.PERMANENTLY_DENIED
                            : PERMISSION_STATUS.DENIED;
                    }
                    return PERMISSION_STATUS.PROMPT;
                }
            } catch (queryErr) {
                // Sebagian browser tidak mendukung query { name: 'camera' }
            }
        }

        // Fallback untuk notifikasi
        if (type === PERMISSION_TYPES.NOTIFICATIONS && typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') return PERMISSION_STATUS.GRANTED;
            if (Notification.permission === 'denied') return PERMISSION_STATUS.DENIED;
            return PERMISSION_STATUS.PROMPT;
        }

        return PERMISSION_STATUS.PROMPT;
    }

    async request(type, { rationale = '' } = {}) {
        if (!Object.values(PERMISSION_TYPES).includes(type)) {
            throw new Error(`Tipe permission tidak dikenal: ${type}`);
        }

        // Cek status saat ini terlebih dahulu
        const current = await this.check(type);
        if (current === PERMISSION_STATUS.GRANTED) {
            return PERMISSION_STATUS.GRANTED;
        }

        if (current === PERMISSION_STATUS.PERMANENTLY_DENIED) {
            this._notifyPermanentDenial(type);
            return PERMISSION_STATUS.PERMANENTLY_DENIED;
        }

        // Tampilkan pesan edukasi singkat jika ada rationale
        if (rationale && typeof window.toast === 'function') {
            window.toast(rationale, 'info');
        }

        // 1. Jalur Native Capacitor
        if (this.isNative() && window.Capacitor?.Plugins) {
            try {
                if (type === PERMISSION_TYPES.CAMERA && window.Capacitor.Plugins.Camera) {
                    const result = await window.Capacitor.Plugins.Camera.requestPermissions({ permissions: ['camera'] });
                    const status = this._mapCapacitorStatus(result.camera);
                    this._recordResult(type, status);
                    return status;
                }
                if (type === PERMISSION_TYPES.NOTIFICATIONS && window.Capacitor.Plugins.PushNotifications) {
                    const result = await window.Capacitor.Plugins.PushNotifications.requestPermissions();
                    const status = this._mapCapacitorStatus(result.receive);
                    this._recordResult(type, status);
                    return status;
                }
            } catch (nativeErr) {
                console.warn(`[PermissionService] Native request error on ${type}:`, nativeErr);
            }
        }

        // 2. Jalur Web Standard Runtime Prompt
        try {
            if (type === PERMISSION_TYPES.CAMERA) {
                if (!navigator.mediaDevices?.getUserMedia) return PERMISSION_STATUS.UNSUPPORTED;
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach((track) => track.stop());
                this._recordResult(type, PERMISSION_STATUS.GRANTED);
                return PERMISSION_STATUS.GRANTED;
            }

            if (type === PERMISSION_TYPES.MICROPHONE) {
                if (!navigator.mediaDevices?.getUserMedia) return PERMISSION_STATUS.UNSUPPORTED;
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
                this._recordResult(type, PERMISSION_STATUS.GRANTED);
                return PERMISSION_STATUS.GRANTED;
            }

            if (type === PERMISSION_TYPES.NOTIFICATIONS) {
                if (typeof Notification === 'undefined') return PERMISSION_STATUS.UNSUPPORTED;
                const permission = await Notification.requestPermission();
                const status = permission === 'granted' ? PERMISSION_STATUS.GRANTED : PERMISSION_STATUS.DENIED;
                this._recordResult(type, status);
                return status;
            }
        } catch (requestErr) {
            const isDeny = requestErr.name === 'NotAllowedError' || requestErr.name === 'PermissionDeniedError';
            const status = isDeny ? PERMISSION_STATUS.DENIED : PERMISSION_STATUS.UNSUPPORTED;
            this._recordResult(type, status);
            return status;
        }

        return PERMISSION_STATUS.DENIED;
    }

    openSettings() {
        if (this.isNative() && window.Capacitor?.Plugins?.App?.openUrl) {
            window.Capacitor.Plugins.App.openUrl({ url: 'app-settings:' });
            return;
        }
        if (typeof window.toast === 'function') {
            window.toast('Buka Pengaturan Aplikasi di perangkat Anda untuk mengaktifkan izin.', 'warning');
        }
    }

    _mapCapacitorStatus(status) {
        if (status === 'granted') return PERMISSION_STATUS.GRANTED;
        if (status === 'denied') return PERMISSION_STATUS.DENIED;
        if (status === 'prompt-with-rationale') return PERMISSION_STATUS.PROMPT;
        return PERMISSION_STATUS.DENIED;
    }

    _recordResult(type, status) {
        if (status === PERMISSION_STATUS.DENIED) {
            const count = (this._deniedCounts.get(type) || 0) + 1;
            this._deniedCounts.set(type, count);
        } else if (status === PERMISSION_STATUS.GRANTED) {
            this._deniedCounts.set(type, 0);
        }
    }

    _isPermanentlyDenied(type) {
        return (this._deniedCounts.get(type) || 0) >= 2;
    }

    _notifyPermanentDenial(type) {
        let label = 'fitur ini';
        if (type === PERMISSION_TYPES.CAMERA) label = 'kamera';
        else if (type === PERMISSION_TYPES.MICROPHONE) label = 'mikrofon';
        else if (type === PERMISSION_TYPES.NOTIFICATIONS) label = 'notifikasi';

        if (typeof window.toast === 'function') {
            window.toast(`Izin ${label} diblokir permanen. Silakan buka Pengaturan Aplikasi untuk mengizinkan.`, 'error');
        }
    }
}

export const permissionService = new PermissionService();
if (typeof window !== 'undefined') {
    window.SIMNIPermissionService = permissionService;
}
export default permissionService;
