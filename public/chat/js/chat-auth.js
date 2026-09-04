import { onAuthStateChanged } from '../../vendor/firebase/firebase-auth.js';
import { doc, getDoc } from '../../vendor/firebase/firebase-firestore.js';
import { auth, firestore, COLLECTIONS, requireEdgeBaseUrl } from './chat-config.js';
import { authPersistenceReady } from '../../js/database/firebase-client.js';
import { establishAccessContext, clearAccessContext } from '../../js/auth/access-context.js';

let authUnsubscribe = null;
let session = null;

function roleAllowed(role) {
  return role === 'superuser' || role === 'vip';
}

function normalizeMembership(data, uid) {
  if (!data || data.uid !== uid || data.active !== true || !roleAllowed(data.role)) return null;
  return Object.freeze({
    uid,
    role: data.role,
    active: true,
    updatedAt: data.updatedAt || null
  });
}

async function readMembership(uid) {
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.members, uid));
  return snapshot.exists() ? normalizeMembership(snapshot.data(), uid) : null;
}

async function syncMembershipWithEdge(user) {
  const access = await establishAccessContext(user);
  if (!roleAllowed(access.role)) {
    throw new Error('Role tidak diizinkan menggunakan Chat.');
  }
  const token = await user.getIdToken();
  const edge = requireEdgeBaseUrl();
  const response = await fetch(`${edge}/v1/session/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Sinkronisasi membership Chat gagal.');
  return normalizeMembership(payload.membership, user.uid);
}

export async function resolveChatSession(user = auth.currentUser) {
  if (!user?.uid) {
    const error = new Error('Login Firebase SIMNI diperlukan.');
    error.code = 'chat/auth-required';
    throw error;
  }

  const access = await establishAccessContext(user);
  if (!roleAllowed(access.role)) {
    const error = new Error('Role ini tidak memiliki akses Chat.');
    error.code = 'chat/access-denied';
    throw error;
  }

  let membership = await readMembership(user.uid).catch(() => null);
  if (!membership || membership.role !== access.role) {
    membership = await syncMembershipWithEdge(user);
  }
  if (!membership || membership.role !== access.role) {
    const error = new Error('Membership Chat tidak sinkron dengan role SIMNI.');
    error.code = 'chat/membership-invalid';
    throw error;
  }

  session = Object.freeze({
    uid: user.uid,
    email: user.email || access.email || null,
    role: access.role,
    access,
    membership
  });
  return session;
}

export function getChatSession() {
  return session;
}

export async function getChatIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Sesi Firebase tidak tersedia.'), { code: 'chat/auth-required' });
  return user.getIdToken(forceRefresh);
}

export function observeChatSession(callback) {
  let cancelled = false;
  void authPersistenceReady.then(() => {
    if (cancelled) return;
    authUnsubscribe?.();
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        session = null;
        clearAccessContext();
        callback?.({ status: 'signed-out', session: null, error: null });
        return;
      }
      callback?.({ status: 'loading', session: null, error: null });
      try {
        const resolved = await resolveChatSession(user);
        if (!cancelled) callback?.({ status: 'ready', session: resolved, error: null });
      } catch (error) {
        session = null;
        if (!cancelled) callback?.({ status: 'denied', session: null, error });
      }
    });
  }).catch((error) => {
    if (!cancelled) callback?.({ status: 'denied', session: null, error });
  });
  return () => {
    cancelled = true;
    authUnsubscribe?.();
    authUnsubscribe = null;
  };
}

export function clearChatSession() {
  session = null;
  clearAccessContext();
}
