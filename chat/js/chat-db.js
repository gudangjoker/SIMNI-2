import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from '../../vendor/firebase/firebase-firestore.js';
import { firestore, auth, COLLECTIONS, CHAT_CONVERSATION_ID, CHAT_SCHEMA_VERSION } from './chat-config.js';
import {
  createMessageDocumentId,
  mergeMessageSnapshots
} from './chat-query-core.mjs';

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Object.assign(new Error('Sesi Firebase tidak tersedia.'), { code: 'chat/auth-required' });
  return uid;
}

function messageCollection() {
  return collection(firestore, COLLECTIONS.conversations, CHAT_CONVERSATION_ID, COLLECTIONS.messages);
}

export async function getMembership(uid = requireUid()) {
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.members, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listActiveMembers() {
  const q = query(collection(firestore, COLLECTIONS.members), where('active', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.role === 'superuser' || item.role === 'vip');
}

export async function getPeerMember() {
  const uid = requireUid();
  const members = await listActiveMembers();
  const peer = members.find((item) => item.uid !== uid);
  if (!peer) throw Object.assign(new Error('Rekan Chat aktif belum tersedia.'), { code: 'chat/peer-missing' });
  return peer;
}

export async function getPublicKey(uid) {
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.publicKeys, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function ensureOwnPublicKey(publicJwk, fingerprint) {
  const uid = requireUid();
  const ref = doc(firestore, COLLECTIONS.publicKeys, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    if (data.fingerprint !== fingerprint) {
      const error = new Error('Public key server berbeda dari identity lokal. Recovery diperlukan.');
      error.code = 'chat/public-key-conflict';
      throw error;
    }
    return data;
  }
  const payload = {
    uid,
    version: 1,
    publicJwk,
    fingerprint,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload, { merge: false });
  const verify = await getDoc(ref);
  if (!verify.exists() || verify.data()?.fingerprint !== fingerprint) throw new Error('Public key gagal diverifikasi setelah write.');
  return verify.data();
}

export async function saveOwnKeyBackup(backup, fingerprint, autoRecovery = null) {
  const uid = requireUid();
  const ref = doc(firestore, COLLECTIONS.keyBackups, uid);
  await setDoc(ref, {
    uid,
    version: 1,
    fingerprint,
    backup,
    autoRecovery,
    updatedAt: serverTimestamp()
  }, { merge: false });
  const verify = await getDoc(ref);
  if (!verify.exists() || verify.data()?.fingerprint !== fingerprint) throw new Error('Backup kunci gagal diverifikasi.');
  return verify.data();
}

export async function getOwnKeyBackup() {
  const uid = requireUid();
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.keyBackups, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function sendEncryptedMessage(payload) {
  const uid = requireUid();
  const type = String(payload?.type || 'text');
  if (!['text', 'image', 'audio', 'file', 'video'].includes(type)) throw new Error('Tipe pesan tidak valid.');
  const data = {
    schemaVersion: CHAT_SCHEMA_VERSION,
    type,
    senderUid: uid,
    recipientUid: String(payload.recipientUid || ''),
    cryptoVersion: Number(payload.cryptoVersion || 1),
    iv: String(payload.iv || ''),
    ciphertext: payload.ciphertext ? String(payload.ciphertext) : '',
    aad: String(payload.aad || ''),
    objectKey: payload.objectKey ? String(payload.objectKey) : '',
    expiresAt: payload.expiresAt ? Number(payload.expiresAt) : null,
    mediaIv: payload.mediaIv ? String(payload.mediaIv) : '',
    encryptedMediaMeta: payload.encryptedMediaMeta ? payload.encryptedMediaMeta : null,
    senderFingerprint: String(payload.senderFingerprint || ''),
    recipientFingerprint: String(payload.recipientFingerprint || ''),
    senderPublicJwk: payload.senderPublicJwk || null,
    recipientPublicJwk: payload.recipientPublicJwk || null,
    createdAt: serverTimestamp()
  };
  if (!data.recipientUid) throw new Error('recipientUid wajib tersedia.');
  if (!data.senderFingerprint || !data.recipientFingerprint || !data.senderPublicJwk || !data.recipientPublicJwk) {
    throw new Error('Snapshot kunci pesan tidak lengkap.');
  }
  if (type === 'text' && (!data.ciphertext || !data.iv)) throw new Error('Ciphertext pesan text tidak lengkap.');
  if (type !== 'text' && (!data.objectKey || !data.mediaIv || !data.encryptedMediaMeta || !data.expiresAt)) throw new Error('Metadata pesan media tidak lengkap.');
  const ref = doc(messageCollection(), createMessageDocumentId());
  await setDoc(ref, data, { merge: false });
  return ref.id;
}

export function subscribeMessages(onChange, onError, maxItems = 150) {
  const uid = requireUid();
  const itemLimit = Math.max(1, Math.min(300, Number(maxItems) || 150));
  let stopped = false;
  let unsubscribeFunctions = [];
  const groups = { sent: [], received: [] };
  const ready = { sent: false, received: false };

  function clearSubscriptions() {
    const active = unsubscribeFunctions;
    unsubscribeFunctions = [];
    for (const unsubscribe of active) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[SIMNI Chat] Listener cleanup gagal:', error);
      }
    }
  }

  function fail(error) {
    if (stopped) return;
    stopped = true;
    clearSubscriptions();
    onError?.(error);
  }

  function addSubscription(unsubscribe) {
    if (stopped) unsubscribe();
    else unsubscribeFunctions.push(unsubscribe);
  }

  function emit() {
    if (!stopped && ready.sent && ready.received) {
      onChange?.(mergeMessageSnapshots([groups.sent, groups.received], itemLimit));
    }
  }

  function bind(key, field) {
    const scopedQuery = query(
      messageCollection(),
      where(field, '==', uid),
      limit(itemLimit)
    );
    addSubscription(onSnapshot(scopedQuery, (snapshot) => {
      if (stopped) return;
      groups[key] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      ready[key] = true;
      emit();
    }, fail));
  }

  try {
    bind('sent', 'senderUid');
    bind('received', 'recipientUid');
  } catch (error) {
    fail(error);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    clearSubscriptions();
  };
}

export function subscribeIncomingMessages(onChange, onError, maxItems = 150) {
  const uid = requireUid();
  const itemLimit = Math.max(1, Math.min(300, Number(maxItems) || 150));
  const scopedQuery = query(
    messageCollection(),
    where('recipientUid', '==', uid),
    limit(itemLimit)
  );
  return onSnapshot(scopedQuery, (snapshot) => {
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    onChange?.(mergeMessageSnapshots([messages], itemLimit));
  }, onError);
}

export function subscribeOwnReadState(onChange, onError) {
  const uid = requireUid();
  return onSnapshot(doc(firestore, COLLECTIONS.readStates, uid), (snapshot) => {
    onChange?.(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}

export async function markConversationRead(lastReadMessageId) {
  const uid = requireUid();
  const messageId = String(lastReadMessageId || '').trim();
  if (!messageId) throw new Error('ID pesan terakhir dibaca wajib tersedia.');
  const ref = doc(firestore, COLLECTIONS.readStates, uid);
  await setDoc(ref, {
    uid,
    conversationId: CHAT_CONVERSATION_ID,
    lastReadMessageId: messageId,
    lastReadAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return messageId;
}

export async function savePushToken(token, tokenHash, platform = 'web') {
  const uid = requireUid();
  const ref = doc(firestore, COLLECTIONS.pushTokens, uid, 'tokens', tokenHash);
  await setDoc(ref, { uid, token, tokenHash, platform, active: true, updatedAt: serverTimestamp() }, { merge: true });
}

export async function removePushToken(tokenHash) {
  const uid = requireUid();
  await deleteDoc(doc(firestore, COLLECTIONS.pushTokens, uid, 'tokens', tokenHash));
}
