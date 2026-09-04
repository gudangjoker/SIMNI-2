// ==========================================
// FILE: js/utils/sanitize.js
// Utility sanitasi HTML, URL, key, dan filename.
// ==========================================

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeHTTPSUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) return raw;
    try {
        const url = new URL(raw, window.location.href);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
        return url.href;
    } catch (error) {
        return fallback;
    }
}

function safeFirebaseKey(value, label = 'ID') {
    const key = String(value || '').trim();
    if (!key || /[.#$\[\]\/]/.test(key) || key === '.' || key === '..') {
        throw new Error(`${label} tidak valid.`);
    }
    return key;
}

function safeFilename(value, fallback = 'SIMNI') {
    const cleaned = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100);
    return cleaned || fallback;
}

function normalizeClassLabel(value) {
    const normalized = String(value || '')
        .normalize('NFKC')
        .trim()
        .toUpperCase()
        .replace(/^KELAS\s*/i, '')
        .replace(/\s+/g, '');
    const match = normalized.match(/^([1-6])([A-Z])$/);
    return match ? `${match[1]}${match[2]}` : '';
}
