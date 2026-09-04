import { getFirestore } from '../../vendor/firebase/firebase-firestore.js';
import { getMessaging, isSupported as isMessagingSupported } from '../../vendor/firebase/firebase-messaging.js';
import { firebaseApp, auth, firebaseConfig, runtime } from '../../js/database/firebase-client.js';

export const CHAT_DATABASE_AUTHORITY = Object.freeze({
  projectId: 'admin-kelas-3a',
  databaseId: '(default)',
  authorityRole: 'superuser'
});

if (firebaseConfig.projectId !== CHAT_DATABASE_AUTHORITY.projectId) {
  throw new Error('Chat wajib menggunakan Firebase project milik Superuser.');
}

export const CHAT_SCHEMA_VERSION = 1;
export const CHAT_CRYPTO_VERSION = 1;
export const CHAT_CONVERSATION_ID = 'main';

export const COLLECTIONS = Object.freeze({
  members: 'chatMembers',
  publicKeys: 'chatPublicKeys',
  keyBackups: 'chatKeyBackups',
  conversations: 'chatConversations',
  messages: 'messages',
  pushTokens: 'chatPushTokens',
  readStates: 'chatReadStates'
});

export const firestore = getFirestore(firebaseApp);

function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const url = new URL(text, window.location.origin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error('Endpoint Chat harus HTTPS di luar localhost.');
  }
  return url.href.replace(/\/$/, '');
}

function deploymentSource() {
  const globalConfig = window.SIMNIChatDeployment && typeof window.SIMNIChatDeployment === 'object'
    ? window.SIMNIChatDeployment
    : {};
  const edgeMeta = document.querySelector('meta[name="simni-chat-edge-url"]')?.content || '';
  const vapidMeta = document.querySelector('meta[name="simni-chat-fcm-vapid-key"]')?.content || '';
  return {
    edgeBaseUrl: normalizeUrl(globalConfig.edgeBaseUrl || edgeMeta),
    fcmVapidKey: String(globalConfig.fcmVapidKey || vapidMeta || '').trim() || null
  };
}

export function getChatDeployment() {
  return Object.freeze({ ...deploymentSource() });
}

export function requireEdgeBaseUrl() {
  const url = deploymentSource().edgeBaseUrl;
  if (!url) {
    const error = new Error('Cloudflare Worker Chat belum dikonfigurasi pada deployment.');
    error.code = 'chat/edge-not-configured';
    throw error;
  }
  return url;
}

let messagingPromise = null;
export async function getChatMessaging() {
  if (!messagingPromise) {
    messagingPromise = isMessagingSupported().then((supported) => supported ? getMessaging(firebaseApp) : null);
  }
  return messagingPromise;
}

export const chatRuntime = Object.freeze({
  schemaVersion: CHAT_SCHEMA_VERSION,
  cryptoVersion: CHAT_CRYPTO_VERSION,
  conversationId: CHAT_CONVERSATION_ID,
  firebaseProjectId: firebaseConfig.projectId,
  firestoreDatabaseId: CHAT_DATABASE_AUTHORITY.databaseId,
  databaseAuthorityRole: CHAT_DATABASE_AUTHORITY.authorityRole,
  firebaseAuthDomain: firebaseConfig.authDomain,
  appVersion: runtime.appVersion || window.SIMNI_APP_VERSION || null
});

export { firebaseApp, auth, firebaseConfig, runtime };
