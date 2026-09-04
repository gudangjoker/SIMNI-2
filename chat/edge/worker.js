const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/firebase.messaging';
const ALLOWED_ROLES = new Set(['superuser', 'vip']);
const MEDIA_POLICY = Object.freeze({
  image: Object.freeze({ maxBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  audio: Object.freeze({ maxBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  file: Object.freeze({ maxBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  video: Object.freeze({ maxBytes: 8 * 1024 * 1024, ttlMs: 3 * 24 * 60 * 60 * 1000 })
});
const CLOUDINARY_POLICY = Object.freeze({
  logo: Object.freeze({ maxBytes: 5 * 1024 * 1024, mime: /^image\/(png|jpeg|webp)$/i, resourceType: 'image' }),
  document: Object.freeze({ maxBytes: 8 * 1024 * 1024, mime: /^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/i, resourceType: 'auto' })
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
  if (!origin || !allowed.includes(origin)) throw Object.assign(new Error('Origin tidak diizinkan.'), { code: 'chat/origin-denied' });
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type,X-SIMNI-Media-Type,X-SIMNI-Expires-At',
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
  if (!match) throw new Error('Authorization Bearer Firebase ID token wajib tersedia.');
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

function requireChatMediaBucket(env) {
  const bucket = env.CHAT_MEDIA_BUCKET;
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function' || typeof bucket.delete !== 'function') {
    throw new Error('Binding R2 CHAT_MEDIA_BUCKET belum tersedia.');
  }
  return bucket;
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
    const error = new Error('Role/status SIMNI tidak memiliki akses Chat.');
    error.code = 'chat/access-denied';
    throw error;
  }
  return profile;
}

function fsString(value) { return { stringValue: String(value ?? '') }; }
function fsBoolean(value) { return { booleanValue: !!value }; }
function fsTimestamp(date = new Date()) { return { timestampValue: date.toISOString() }; }

async function firestoreRequest(env, path, init = {}) {
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const access = await googleAccessToken(env);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  return response;
}

async function upsertMembership(env, uid, profile) {
  const fields = {
    uid: fsString(uid),
    role: fsString(profile.role),
    active: fsBoolean(true),
    updatedAt: fsTimestamp()
  };
  const response = await firestoreRequest(env, `chatMembers/${encodeURIComponent(uid)}?updateMask.fieldPaths=uid&updateMask.fieldPaths=role&updateMask.fieldPaths=active&updateMask.fieldPaths=workspaceId&updateMask.fieldPaths=classId&updateMask.fieldPaths=updatedAt`, {
    method: 'PATCH',
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`Firestore membership sync gagal (${response.status}).`);
  return {
    uid,
    role: profile.role,
    active: true,
    updatedAt: new Date().toISOString()
  };
}

async function authenticated(request, env) {
  const { projectId } = requireEnv(env);
  const token = bearerToken(request);
  const claims = await verifyFirebaseIdToken(token, projectId);
  const profile = await authoritativeProfile(env, claims.sub);
  return { token, claims, profile };
}

function mediaPolicy(type) {
  const normalized = String(type || '').toLowerCase();
  const cfg = MEDIA_POLICY[normalized];
  if (!cfg) throw new Error('Tipe media ditolak.');
  return { type: normalized, ...cfg };
}

function parseMediaObjectKey(objectKey) {
  const normalized = String(objectKey || '').trim();
  const match = /^media\/(image|audio|file|video)\/(\d{13})\/([^/]{1,128})\/([0-9a-f-]{36})\.bin$/i.exec(normalized);
  if (!match) throw new Error('Object key media Chat tidak valid.');
  const expiresAt = Number(match[2]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new Error('Expiry object media Chat tidak valid.');
  return {
    objectKey: normalized,
    mediaType: match[1].toLowerCase(),
    expiresAt,
    senderUid: match[3]
  };
}

async function uploadMedia(request, env, identity) {
  const cfg = mediaPolicy(request.headers.get('x-simni-media-type'));
  const expiresAt = Number(request.headers.get('x-simni-expires-at') || 0);
  const now = Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + cfg.ttlMs + 5 * 60 * 1000) throw new Error('expiresAt media tidak valid.');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength && contentLength > cfg.maxBytes) throw new Error('Ciphertext media melebihi batas Worker.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > cfg.maxBytes) throw new Error('Ukuran ciphertext media tidak valid.');
  const bucket = requireChatMediaBucket(env);
  const objectKey = `media/${cfg.type}/${expiresAt}/${identity.claims.sub}/${crypto.randomUUID()}.bin`;
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      senderUid: identity.claims.sub,
      mediaType: cfg.type,
      expiresAt: String(expiresAt)
    }
  });
  const stored = await bucket.head(objectKey);
  if (!stored || Number(stored.size) !== bytes.length || stored.customMetadata?.senderUid !== identity.claims.sub) {
    await bucket.delete(objectKey).catch(() => {});
    throw new Error('Verifikasi penyimpanan media Chat di R2 gagal.');
  }
  return { objectKey, expiresAt, bytes: bytes.length };
}

async function readMedia(request, env, identity, objectKey) {
  const descriptor = parseMediaObjectKey(objectKey);
  const { mediaType, expiresAt } = descriptor;
  mediaPolicy(mediaType);
  const bucket = requireChatMediaBucket(env);
  if (!expiresAt || Date.now() >= expiresAt) {
    await bucket.delete(descriptor.objectKey).catch(() => {});
    return new Response('Expired', { status: 410, headers: { 'cache-control': 'no-store' } });
  }
  const stored = await bucket.get(descriptor.objectKey);
  if (!stored) return new Response('Not found', { status: 404 });
  if (stored.customMetadata?.mediaType !== mediaType || Number(stored.customMetadata?.expiresAt) !== expiresAt || stored.customMetadata?.senderUid !== descriptor.senderUid) {
    throw new Error('Metadata media Chat di R2 tidak konsisten.');
  }
  return new Response(stored.body, {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream',
      'cache-control': 'private, no-store',
      'x-simni-expires-at': String(expiresAt),
      'x-simni-media-type': mediaType
    }
  });
}

async function deleteMedia(env, identity, objectKey) {
  const descriptor = parseMediaObjectKey(objectKey);
  if (descriptor.senderUid !== identity.claims.sub) {
    throw new Error('Hanya pengirim yang dapat menghapus media sebelum expiry.');
  }
  await requireChatMediaBucket(env).delete(descriptor.objectKey);
  return true;
}

async function cleanupExpiredChatMedia(env, now = Date.now()) {
  const bucket = requireChatMediaBucket(env);
  let cursor;
  let scanned = 0;
  let deleted = 0;
  do {
    const page = await bucket.list({ prefix: 'media/', limit: 1000, ...(cursor ? { cursor } : {}) });
    const expiredKeys = [];
    for (const object of page.objects || []) {
      scanned += 1;
      try {
        if (parseMediaObjectKey(object.key).expiresAt <= now) expiredKeys.push(object.key);
      } catch (_) {
        expiredKeys.push(object.key);
      }
    }
    if (expiredKeys.length) {
      await bucket.delete(expiredKeys);
      deleted += expiredKeys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && scanned < 10000);
  return { scanned, deleted };
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

function firestoreValue(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  return null;
}

async function listPushTokens(env, uid) {
  const response = await firestoreRequest(env, `chatPushTokens/${encodeURIComponent(uid)}/tokens?pageSize=100`, { method: 'GET' });
  if (response.status === 404) return [];
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Push token list gagal (${response.status}).`);
  return (data?.documents || [])
    .map((item) => ({ token: firestoreValue(item.fields?.token), active: firestoreValue(item.fields?.active) }))
    .filter((item) => item.token && item.active !== false)
    .map((item) => item.token);
}

async function sendFcm(env, token) {
  const access = await googleAccessToken(env);
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: 'Pembaruan Sistem SIMNI',
          body: 'Database baru sudah siap!'
        },
        data: {
          kind: 'simni-system-update',
          route: 'chat'
        },
        webpush: {
          headers: { Urgency: 'normal' },
          notification: { renotify: false, tag: 'simni-system-update' }
        }
      }
    })
  });
  return response.ok;
}

async function push(request, env, identity) {
  const body = await request.json().catch(() => ({}));
  const recipientUid = String(body.recipientUid || '').trim();
  if (!recipientUid || recipientUid === identity.claims.sub) throw new Error('recipientUid push tidak valid.');
  await authoritativeProfile(env, recipientUid);
  const tokens = await listPushTokens(env, recipientUid);
  const results = await Promise.allSettled(tokens.map((token) => sendFcm(env, token)));
  return { attempted: tokens.length, delivered: results.filter((item) => item.status === 'fulfilled' && item.value === true).length };
}

async function route(request, env) {
  const url = new URL(request.url);
  const corsHeaders = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const identity = await authenticated(request, env);

  if (url.pathname === '/v1/session/sync' && request.method === 'POST') {
    const membership = await upsertMembership(env, identity.claims.sub, identity.profile);
    return json(200, { ok: true, membership }, corsHeaders);
  }

  if (url.pathname === '/v1/cloudinary/sign' && request.method === 'POST') {
    const signature = await createCloudinarySignature(request, env, identity);
    return json(200, { ok: true, ...signature }, corsHeaders);
  }

  if (url.pathname === '/v1/cloudinary/delete' && request.method === 'POST') {
    const result = await deleteCloudinaryAsset(request, env, identity);
    return json(200, { ok: true, ...result }, corsHeaders);
  }

  if (url.pathname === '/v1/media/upload' && request.method === 'POST') {
    const uploaded = await uploadMedia(request, env, identity);
    return json(200, { ok: true, ...uploaded }, corsHeaders);
  }

  if (url.pathname.startsWith('/v1/media/') && request.method === 'GET') {
    const key = decodeURIComponent(url.pathname.slice('/v1/media/'.length));
    const response = await readMedia(request, env, identity, key);
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
    return new Response(response.body, { status: response.status, headers });
  }

  if (url.pathname.startsWith('/v1/media/') && request.method === 'DELETE') {
    const key = decodeURIComponent(url.pathname.slice('/v1/media/'.length));
    const deleted = await deleteMedia(env, identity, key);
    return json(200, { ok: true, deleted }, corsHeaders);
  }

  if (url.pathname === '/v1/push' && request.method === 'POST') {
    const result = await push(request, env, identity);
    return json(200, { ok: true, ...result }, corsHeaders);
  }

  return json(404, { ok: false, code: 'not-found', message: 'Endpoint Chat tidak ditemukan.' }, corsHeaders);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error('[SIMNI Chat Worker]', error);
      const code = error?.code || 'chat/edge-error';
      const status = code === 'chat/access-denied' ? 403 : /Authorization|token|role|akses/i.test(String(error?.message || '')) ? 403 : 400;
      let corsHeaders = {};
      try {
        corsHeaders = cors(request, env);
      } catch (_) {
        corsHeaders = { vary: 'Origin' };
      }
      return json(status, { ok: false, code, message: String(error?.message || error) }, corsHeaders);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanupExpiredChatMedia(env, Number(controller.scheduledTime || Date.now())));
  }
};
