import { executeAdminOperation, recoverAdminOperation } from './admin-operations.js';

const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database';
const ALLOWED_ROLES = new Set(['superuser', 'vip']);
const CLOUDINARY_POLICY = Object.freeze({
  logo: Object.freeze({ maxBytes: 5 * 1024 * 1024, mime: /^image\/(png|jpeg|webp)$/i, resourceType: 'image' }),
  document: Object.freeze({ maxBytes: 8 * 1024 * 1024, mime: /^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/i, resourceType: 'auto' }),
  student_photo: Object.freeze({ maxBytes: 2 * 1024 * 1024, mime: /^image\/(png|jpeg|webp)$/i, resourceType: 'image' })
});

let certCache = { value: null, expiresAt: 0 };
let googleTokenCache = { value: null, expiresAt: 0 };

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra
    }
  });
}

function cors(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.SIMNI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) throw Object.assign(new Error('Origin tidak diizinkan.'), { code: 'assets/origin-denied', status: 400, definiteRejection: true });
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToBytes(pem) {
  const body = String(pem || '').replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

async function firebasePublicKeys() {
  if (certCache.value && Date.now() < certCache.expiresAt) return certCache.value;
  const response = await fetch(FIREBASE_JWK_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Firebase public-key fetch gagal (${response.status}).`);
  const cache = response.headers.get('cache-control') || '';
  const maxAge = Number(/max-age=(\d+)/i.exec(cache)?.[1] || 300);
  const data = await response.json();
  const keys = Object.fromEntries((data.keys || []).filter((key) => key?.kid).map((key) => [key.kid, key]));
  if (!Object.keys(keys).length) throw new Error('Firebase public-key set kosong.');
  certCache = { value: keys, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return certCache.value;
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Firebase ID token tidak valid.');
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Algoritma token Firebase ditolak.');
  if (payload.aud !== projectId) throw new Error('Audience token Firebase salah.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Issuer token Firebase salah.');
  if (!payload.sub || String(payload.sub).length > 128) throw new Error('UID token Firebase tidak valid.');
  if (Number(payload.exp || 0) <= now || Number(payload.iat || 0) > now + 60) throw new Error('Firebase ID token kedaluwarsa/tidak valid.');
  const publicKeys = await firebasePublicKeys();
  const jwk = publicKeys[header.kid];
  if (!jwk) throw new Error('Signing key Firebase tidak ditemukan.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlDecode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('Signature Firebase ID token tidak valid.');
  return payload;
}

async function serviceJwt(env) {
  const email = String(env.FIREBASE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKeyPem = String(env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!email || !privateKeyPem) throw new Error('Firebase service account secret belum lengkap.');
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    iss: email,
    sub: email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: TOKEN_SCOPE,
    iat: now,
    exp: now + 3600
  })));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function googleAccessToken(env) {
  if (googleTokenCache.value && Date.now() < googleTokenCache.expiresAt - 60000) return googleTokenCache.value;
  const assertion = await serviceJwt(env);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error(data?.error_description || 'OAuth service account gagal.');
  googleTokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return googleTokenCache.value;
}

function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) throw Object.assign(new Error('Authorization Bearer Firebase ID token wajib tersedia.'), { code: 'assets/unauthorized', status: 401, definiteRejection: true });
  return match[1];
}

function requireEnv(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const databaseUrl = String(env.FIREBASE_DATABASE_URL || '').trim().replace(/\/$/, '');
  if (!projectId || !databaseUrl) throw new Error('Environment Firebase Worker belum lengkap.');
  return { projectId, databaseUrl };
}

function requireCloudinary(env) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '').trim();
  const uploadPreset = String(env.CLOUDINARY_UPLOAD_PRESET || '').trim();
  if (!cloudName || !apiKey || !apiSecret || !uploadPreset) throw new Error('Environment Cloudinary Worker belum lengkap.');
  return { cloudName, apiKey, apiSecret, uploadPreset };
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function cloudinarySignature(params, secret) {
  const canonical = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${canonical}${secret}`)));
}

function scopedPublicId(profile, purpose, suffix = crypto.randomUUID()) {
  return `simni/${profile.workspaceId}/${profile.activeAcademicYearId}/${purpose}/${suffix}`;
}

async function authoritativeProfile(env, uid) {
  const { databaseUrl } = requireEnv(env);
  const access = await googleAccessToken(env);
  const response = await fetch(`${databaseUrl}/users/${encodeURIComponent(uid)}.json`, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${access}`
    }
  });
  if (!response.ok) throw new Error(`Profil SIMNI tidak dapat dibaca (${response.status}).`);
  const profile = await response.json();
  if (!profile || profile.status !== 'active' || !ALLOWED_ROLES.has(profile.role)) {
    const error = new Error('Role/status SIMNI tidak memiliki akses Assets.');
    error.code = 'assets/access-denied';
    throw error;
  }
  return profile;
}

async function authenticated(request, env) {
  const { projectId } = requireEnv(env);
  const token = bearerToken(request);
  const claims = await verifyFirebaseIdToken(token, projectId);
  const profile = await authoritativeProfile(env, claims.sub);
  return { token, claims, profile };
}

async function destroyCloudinaryAsset(env, publicId, resourceType) {
  const cloud = requireCloudinary(env);
  const normalizedType = ['image', 'raw', 'video'].includes(resourceType) ? resourceType : 'image';
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp, type: 'upload' };
  const form = new URLSearchParams({
    api_key: cloud.apiKey,
    public_id: publicId,
    timestamp: String(timestamp),
    type: 'upload',
    invalidate: 'true',
    signature: await cloudinarySignature(params, cloud.apiSecret)
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud.cloudName)}/${normalizedType}/destroy`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !['ok', 'not found'].includes(result?.result)) throw new Error(result?.error?.message || 'Cleanup Cloudinary gagal.');
  return result?.result === 'ok';
}

async function createCloudinarySignature(request, env, identity) {
  if (identity.profile.role !== 'superuser') throw new Error('Hanya Superuser yang dapat mengunggah aset dokumen.');
  const body = await request.json().catch(() => ({}));
  const purpose = String(body.purpose || '').trim().toLowerCase();
  const policy = CLOUDINARY_POLICY[purpose];
  const fileSize = Number(body.fileSize || 0);
  const mime = String(body.mime || '').trim().toLowerCase();
  if (!policy || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > policy.maxBytes || !policy.mime.test(mime)) {
    throw new Error('File tidak memenuhi policy Cloudinary Free SIMNI.');
  }
  const cloud = requireCloudinary(env);
  const publicId = scopedPublicId(identity.profile, purpose);
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadParams = { public_id: publicId, timestamp, upload_preset: cloud.uploadPreset };
  return {
    cloudName: cloud.cloudName,
    apiKey: cloud.apiKey,
    signature: await cloudinarySignature(uploadParams, cloud.apiSecret),
    publicId,
    resourceType: policy.resourceType,
    uploadParams,
    policy: { maxBytes: policy.maxBytes, reportedMime: mime, enforcedByPreset: cloud.uploadPreset }
  };
}

async function deleteCloudinaryAsset(request, env, identity) {
  if (identity.profile.role !== 'superuser') throw new Error('Hanya Superuser yang dapat menghapus aset dokumen.');
  const body = await request.json().catch(() => ({}));
  const purpose = String(body.purpose || '').trim().toLowerCase();
  const policy = CLOUDINARY_POLICY[purpose];
  const publicId = String(body.publicId || '').trim();
  const expectedPrefix = `simni/${identity.profile.workspaceId}/${identity.profile.activeAcademicYearId}/${purpose}/`;
  if (!policy || !publicId.startsWith(expectedPrefix) || publicId.includes('..')) throw new Error('Scope public_id Cloudinary ditolak.');
  const resourceType = String(body.resourceType || policy.resourceType).toLowerCase();
  const deleted = await destroyCloudinaryAsset(env, publicId, resourceType === 'auto' ? 'raw' : resourceType);
  return { deleted };
}

async function route(request, env) {
  const url = new URL(request.url);
  const corsHeaders = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const identity = await authenticated(request, env);

  const isAdminCommit = url.pathname === '/v1/admin/commit' && request.method === 'POST';
  const isAdminStatus = (url.pathname === '/v1/admin/status' && request.method === 'POST') ||
                        (url.pathname.startsWith('/v1/admin/status') && ['GET', 'POST'].includes(request.method));

  if (isAdminCommit || isAdminStatus) {
    let body = {};
    if (request.method === 'POST') {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > 32 * 1024 * 1024) throw new Error('Permintaan melebihi 32 MiB.');
      body = text ? JSON.parse(text) : {};
    } else {
      const pathSuffix = url.pathname.slice('/v1/admin/status'.length).replace(/^\//, '');
      const opId = pathSuffix || url.searchParams.get('operationId');
      body = { operationId: opId };
    }
    const { databaseUrl } = requireEnv(env);
    const adminToken = await googleAccessToken(env);
    async function db(path, method = 'GET', value, asUser = false, extraHeaders = {}) {
      const target = new URL(databaseUrl + '/' + path + '.json');
      if (asUser) target.searchParams.set('auth', identity.token);
      if (method === 'PATCH') target.searchParams.set('print', 'silent');
      let response;
      try {
        response = await fetch(target.href, { method, headers: { 'content-type': 'application/json', ...(asUser ? {} : { Authorization: `Bearer ${adminToken}` }), ...extraHeaders }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
      } catch (_) { throw new Error('Koneksi RTDB tidak terkonfirmasi.'); }
      if (response.status === 412) return { reserved: false };
      if (!response.ok) throw Object.assign(new Error(`RTDB menolak operasi (${response.status}).`), { definiteRejection: [400, 401, 403].includes(response.status) });
      return response.status === 204 ? null : response.json();
    }
    const io = {
      readServer: path => db(path),
      readUser: path => db(path, 'GET', undefined, true),
      patchUser: updates => db('', 'PATCH', updates, true),
      patchServer: updates => db('', 'PATCH', updates),
      reserve: async (path, record) => (await db(path, 'PUT', record, false, { 'if-match': 'null_etag' }))?.reserved !== false
    };
    return json(200, await (isAdminStatus ? recoverAdminOperation(io, identity, body.operationId) : executeAdminOperation(io, identity, body)), corsHeaders);
  }


  if (url.pathname === '/v1/cloudinary/sign' && request.method === 'POST') {
    const signature = await createCloudinarySignature(request, env, identity);
    return json(200, { ok: true, ...signature }, corsHeaders);
  }

  if (url.pathname === '/v1/cloudinary/delete' && request.method === 'POST') {
    const result = await deleteCloudinaryAsset(request, env, identity);
    return json(200, { ok: true, ...result }, corsHeaders);
  }

  return json(404, { ok: false, code: 'not-found', message: 'Endpoint Assets tidak ditemukan.' }, corsHeaders);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error('[SIMNI Assets Worker]', error);
      const code = error?.code || 'assets/edge-error';
      const status = error?.status || (code === 'assets/unauthorized' ? 401 : code === 'assets/access-denied' ? 403 : /Authorization|token|role|akses/i.test(String(error?.message || '')) ? 403 : 400);
      let corsHeaders = {};
      try {
        corsHeaders = cors(request, env);
      } catch (_) {
        corsHeaders = { vary: 'Origin' };
      }
      const pending = error?.pending === true || (new URL(request.url).pathname.startsWith('/v1/admin/') && error?.definiteRejection !== true);
      return json(pending ? 409 : status, { ok: false, code, message: String(error?.message || error), ...(pending ? { pending: true, operationId: error.operationId, dataCommitted: error.dataCommitted === true } : {}) }, corsHeaders);
    }
  }
};
