// ==========================================
// FILE: js/database/mock-adapter.js
// FUNGSI: Mock storage adapter untuk pengujian runtime offline/sandbox.
// ==========================================

export const mockAdapter = Object.freeze({
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null');
        } catch (_) {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (_) {
            return false;
        }
    }
});
