import { auth } from '../database/firebase-client.js';

function edgeBaseUrl() {
    const configured = window.SIMNIChatDeployment?.edgeBaseUrl ||
        document.querySelector('meta[name="simni-chat-edge-url"]')?.content || '';
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
        throw new Error(data?.message || `Cloudflare Worker menolak operasi (${response.status}).`);
    }
    return data;
}

export async function createCloudinaryUploadSignature(payload) {
    return invoke('/v1/cloudinary/sign', payload);
}

export async function cleanupCloudinaryUpload(payload) {
    return invoke('/v1/cloudinary/delete', payload);
}

