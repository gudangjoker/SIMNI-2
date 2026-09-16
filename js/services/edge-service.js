import { auth } from '../database/firebase-client.js';

const DEFAULT_EDGE_URL = 'https://simni-assets-gateway.2ndgoal.workers.dev';

function edgeBaseUrl() {
    const configured = window.SIMNIEdgeDeployment?.edgeBaseUrl ||
        document.querySelector('meta[name="simni-edge-url"]')?.content ||
        DEFAULT_EDGE_URL;
    const value = String(configured).trim();
    if (!value) throw new Error('Endpoint Cloudflare Worker SIMNI belum dikonfigurasi pada deployment.');
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
        throw new Error('Endpoint Cloudflare Worker wajib HTTPS.');
    }
    return url.href.replace(/\/$/, '');
}

async function invoke(path, body) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi autentikasi diperlukan untuk operasi cloud.');
    const token = await user.getIdToken(false);
    const response = await fetch(`${edgeBaseUrl()}${path}`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit'
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
        throw Object.assign(new Error(data?.message || `Cloudflare Worker menolak operasi (${response.status}).`), { pending: data?.pending === true || response.status >= 500 || data?.ok !== false, operationId: data?.operationId, dataCommitted: data?.dataCommitted === true });
    }
    return data;
}

export async function createCloudinaryUploadSignature(payload) {
    return invoke('/v1/cloudinary/sign', payload);
}

export async function cleanupCloudinaryUpload(payload) {
    return invoke('/v1/cloudinary/delete', payload);
}

export async function commitAdministrativeOperation(payload) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sesi autentikasi diperlukan.');
    const serialized = JSON.stringify(payload);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const storageKey = `simni-admin-operation:${uid}:${payload.action}:${payload.targetId || ''}`;
    const pending = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (pending && pending.fingerprint !== fingerprint) {
        try {
            await invoke('/v1/admin/status', { operationId: pending.operationId });
            localStorage.removeItem(storageKey);
        } catch (error) {
            if (error.pending === false) localStorage.removeItem(storageKey);
            throw error;
        }
        throw new Error('Operasi sebelumnya telah dikonfirmasi. Periksa data terbaru sebelum mengirim perubahan berbeda.');
    }
    const operationId = pending?.operationId || ('op_' + crypto.randomUUID().replaceAll('-', ''));
    // If persistence fails, do not start an operation whose retry identity is lost.
    localStorage.setItem(storageKey, JSON.stringify({ operationId, fingerprint }));
    try {
        const result = await invoke('/v1/admin/commit', { ...payload, operationId });
        localStorage.removeItem(storageKey);
        return result;
    } catch (error) {
        // Network errors are ambiguous. Preserve the same ID across reload/retry.
        if (error.pending === false) localStorage.removeItem(storageKey);
        throw error;
    }
}

export async function getGlobalRolloverOverview() {
    return invoke('/v1/admin/rollover-overview', {});
}
