import { CHAT_CRYPTO_VERSION } from './chat-config.js';

const DB_NAME = 'simni-chat-crypto-v1';
const STORE = 'identity';
const PBKDF2_ITERATIONS = 600000;
const ACCOUNT_BACKUP_ALGORITHM = 'ECDH-P256+FIREBASE-PASSWORD-AES-256-GCM';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const C = Object.freeze(['b','c','d','f','g','h','j','k','l','m','n','p','r','s','t','v']);
const V = Object.freeze(['a','e','i','o','u','ai','au','ea','ia','io','oa','ui','ya','yo','ra','ri']);

function bytesToBase64(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function encodeByte(byte) {
  return `${C[(byte >>> 4) & 15]}${V[byte & 15]}`;
}

function normalizePhrase(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createRecoveryPhrase() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const words = [];
  for (let i = 0; i < bytes.length; i += 2) words.push(`${encodeByte(bytes[i])}${encodeByte(bytes[i + 1])}`);
  return words.join(' ');
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB Chat gagal dibuka.'));
  });
}

function identityKey(uid = window.SIMNICurrentAccess?.uid) {
  const normalized = String(uid || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) throw new Error('UID identity Chat tidak valid.');
  return `identity:${uid}`;
}

async function idbGet(uid) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(identityKey(uid));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IndexedDB Chat read gagal.'));
    });
  } finally { db.close(); }
}

async function idbPut(value, uid) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, identityKey(uid));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB Chat write gagal.'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB Chat write dibatalkan.'));
    });
  } finally { db.close(); }
}

async function idbDelete(uid) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(identityKey(uid));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB Chat delete gagal.'));
    });
  } finally { db.close(); }
}

async function fingerprintJwk(publicJwk) {
  const normalized = JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y });
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  return bytesToBase64(new Uint8Array(digest));
}

async function deriveRecoveryKey(phrase, saltBytes) {
  const normalized = normalizePhrase(phrase);
  if (normalized.split(' ').length !== 12) throw Object.assign(new Error('Frasa Pemulihan harus terdiri dari 12 kata.'), { code: 'chat/recovery-format' });
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(normalized), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function publicJwkFromPrivate(privateJwk) {
  return {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    ext: true,
    key_ops: []
  };
}

async function importPrivateJwk(privateJwk) {
  return crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function importPublicJwk(publicJwk) {
  return crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function makeRecoveryBackup(privateJwk, phrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveRecoveryKey(phrase, salt);
  const plaintext = encoder.encode(JSON.stringify(privateJwk));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return Object.freeze({
    version: CHAT_CRYPTO_VERSION,
    algorithm: 'ECDH-P256+PBKDF2-SHA256+AES-256-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  });
}

async function decryptRecoveryBackup(backup, phrase) {
  if (!backup || Number(backup.version) !== CHAT_CRYPTO_VERSION) throw new Error('Versi backup kunci Chat tidak didukung.');
  if (Number(backup.iterations) !== PBKDF2_ITERATIONS) throw new Error('Parameter KDF backup kunci tidak sesuai.');
  try {
    const salt = base64ToBytes(backup.salt);
    const iv = base64ToBytes(backup.iv);
    const key = await deriveRecoveryKey(phrase, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(backup.ciphertext));
    const jwk = JSON.parse(decoder.decode(plaintext));
    if (jwk?.kty !== 'EC' || jwk?.crv !== 'P-256' || !jwk?.d || !jwk?.x || !jwk?.y) throw new Error('Private key recovery tidak valid.');
    return jwk;
  } catch (error) {
    const wrapped = new Error('Frasa Pemulihan salah atau backup kunci rusak.');
    wrapped.code = 'chat/recovery-failed';
    wrapped.cause = error;
    throw wrapped;
  }
}

function assertAccountUnlockKey(accountKey) {
  if (
    !(accountKey instanceof CryptoKey)
    || accountKey.algorithm?.name !== 'AES-GCM'
    || !accountKey.usages?.includes('encrypt')
    || !accountKey.usages?.includes('decrypt')
  ) {
    throw new Error('Kunci pemulihan akun Firebase tidak valid.');
  }
  return accountKey;
}

async function makeAccountBackup(privateJwk, accountKey) {
  const key = assertAccountUnlockKey(accountKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(privateJwk))
  );
  return Object.freeze({
    version: CHAT_CRYPTO_VERSION,
    algorithm: ACCOUNT_BACKUP_ALGORITHM,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  });
}

async function decryptAccountBackup(backup, accountKey) {
  if (
    !backup
    || Number(backup.version) !== CHAT_CRYPTO_VERSION
    || backup.algorithm !== ACCOUNT_BACKUP_ALGORITHM
  ) {
    throw new Error('Backup kunci akun Firebase tidak didukung.');
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(backup.iv) },
      assertAccountUnlockKey(accountKey),
      base64ToBytes(backup.ciphertext)
    );
    const jwk = JSON.parse(decoder.decode(plaintext));
    if (jwk?.kty !== 'EC' || jwk?.crv !== 'P-256' || !jwk?.d || !jwk?.x || !jwk?.y) {
      throw new Error('Private key akun Firebase tidak valid.');
    }
    return jwk;
  } catch (error) {
    const wrapped = new Error('Kunci akun Firebase tidak dapat membuka identity Chat. Login ulang diperlukan.');
    wrapped.code = 'chat/account-backup-failed';
    wrapped.cause = error;
    throw wrapped;
  }
}

export function isAccountKeyBackup(backup) {
  return Number(backup?.version) === CHAT_CRYPTO_VERSION
    && backup?.algorithm === ACCOUNT_BACKUP_ALGORITHM;
}

export async function accountBackupMatchesIdentity(backup, accountKey, fingerprint) {
  try {
    const privateJwk = await decryptAccountBackup(backup, accountKey);
    return await fingerprintJwk(publicJwkFromPrivate(privateJwk)) === String(fingerprint || '');
  } catch (_) {
    return false;
  }
}

export async function getLocalIdentity(uid) {
  const record = await idbGet(uid);
  if (!record?.privateKey || !record?.publicJwk || !record?.fingerprint) return null;
  return record;
}

export async function createIdentity(uid, accountKey = null) {
  const existing = await getLocalIdentity(uid);
  if (existing) return { created: false, identity: existing, recoveryPhrase: null, recoveryBackup: null };

  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateKey = await importPrivateJwk(privateJwk);
  const fingerprint = await fingerprintJwk(publicJwk);
  const recoveryPhrase = accountKey ? null : createRecoveryPhrase();
  const recoveryBackup = accountKey
    ? await makeAccountBackup(privateJwk, accountKey)
    : await makeRecoveryBackup(privateJwk, recoveryPhrase);
  const identity = { version: CHAT_CRYPTO_VERSION, privateKey, publicJwk, fingerprint, recoveryBackup, createdAt: new Date().toISOString() };
  await idbPut(identity, uid);
  return { created: true, identity, recoveryPhrase, recoveryBackup };
}

export async function restoreIdentity(recoveryBackup, recoveryPhrase, uid) {
  const privateJwk = await decryptRecoveryBackup(recoveryBackup, recoveryPhrase);
  const publicJwk = publicJwkFromPrivate(privateJwk);
  const privateKey = await importPrivateJwk(privateJwk);
  const fingerprint = await fingerprintJwk(publicJwk);
  const identity = { version: CHAT_CRYPTO_VERSION, privateKey, publicJwk, fingerprint, recoveryBackup, restoredAt: new Date().toISOString() };
  await idbPut(identity, uid);
  return identity;
}

export async function restoreIdentityFromAccount(recoveryBackup, accountKey, uid) {
  const privateJwk = await decryptAccountBackup(recoveryBackup, accountKey);
  const publicJwk = publicJwkFromPrivate(privateJwk);
  const privateKey = await importPrivateJwk(privateJwk);
  const fingerprint = await fingerprintJwk(publicJwk);
  const identity = {
    version: CHAT_CRYPTO_VERSION,
    privateKey,
    publicJwk,
    fingerprint,
    recoveryBackup,
    restoredAt: new Date().toISOString()
  };
  await idbPut(identity, uid);
  return identity;
}

export async function createAccountBackupForIdentity(identity, accountKey, uid) {
  if (!identity?.privateKey || identity.privateKey.extractable !== true) {
    const error = new Error('Identity lama memerlukan satu kali pemulihan sebelum dapat dikaitkan ke login Firebase.');
    error.code = 'chat/legacy-key-migration-required';
    throw error;
  }
  const privateJwk = await crypto.subtle.exportKey('jwk', identity.privateKey);
  const recoveryBackup = await makeAccountBackup(privateJwk, accountKey);
  const updated = { ...identity, recoveryBackup, migratedAt: new Date().toISOString() };
  await idbPut(updated, uid);
  return { identity: updated, backup: recoveryBackup };
}

export async function clearLocalIdentity(uid) {
  await idbDelete(uid);
}

async function deriveSharedKey(privateKey, peerPublicJwk, context) {
  if (!privateKey || !peerPublicJwk) throw new Error('Identity key belum lengkap.');
  const peerKey = await importPublicJwk(peerPublicJwk);
  const secretBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey('raw', secretBits, 'HKDF', false, ['deriveKey']);
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`SIMNI_CHAT_SALT|${context}`)));
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(`SIMNI_CHAT_KEY|v${CHAT_CRYPTO_VERSION}|${context}`) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(bytes, identity, peerPublicJwk, context, additionalData = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSharedKey(identity.privateKey, peerPublicJwk, context);
  const algorithm = { name: 'AES-GCM', iv, tagLength: 128 };
  if (additionalData) algorithm.additionalData = encoder.encode(additionalData);
  const ciphertext = await crypto.subtle.encrypt(algorithm, key, data);
  return Object.freeze({
    cryptoVersion: CHAT_CRYPTO_VERSION,
    algorithm: 'ECDH-P256+HKDF-SHA256+AES-256-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    aad: additionalData || ''
  });
}

export async function decryptBytes(payload, identity, peerPublicJwk, context) {
  if (Number(payload?.cryptoVersion) !== CHAT_CRYPTO_VERSION) throw new Error('Versi crypto pesan tidak didukung.');
  const key = await deriveSharedKey(identity.privateKey, peerPublicJwk, context);
  const algorithm = { name: 'AES-GCM', iv: base64ToBytes(payload.iv), tagLength: 128 };
  if (payload.aad) algorithm.additionalData = encoder.encode(payload.aad);
  const plaintext = await crypto.subtle.decrypt(algorithm, key, base64ToBytes(payload.ciphertext));
  return new Uint8Array(plaintext);
}

export async function encryptText(text, identity, peerPublicJwk, context, additionalData = '') {
  return encryptBytes(encoder.encode(String(text)), identity, peerPublicJwk, context, additionalData);
}

export async function decryptText(payload, identity, peerPublicJwk, context) {
  return decoder.decode(await decryptBytes(payload, identity, peerPublicJwk, context));
}

export async function sha256Base64(value) {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(String(value));
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

export const ChatCrypto = Object.freeze({
  createRecoveryPhrase,
  getLocalIdentity,
  createIdentity,
  restoreIdentity,
  restoreIdentityFromAccount,
  createAccountBackupForIdentity,
  isAccountKeyBackup,
  accountBackupMatchesIdentity,
  clearLocalIdentity,
  encryptBytes,
  decryptBytes,
  encryptText,
  decryptText,
  sha256Base64
});
