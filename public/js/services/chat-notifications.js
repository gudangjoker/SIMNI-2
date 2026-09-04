import { countUnreadMessages } from '../../chat/js/chat-query-core.mjs';

const NOTICE_TITLE = 'Pembaruan Sistem SIMNI';
const NOTICE_BODY = 'Database baru sudah siap!';
const NOTICE_THROTTLE_MS = 2500;

let activeUid = null;
let incomingMessages = [];
let readState = null;
let incomingReady = false;
let readStateReady = false;
let knownMessageIds = new Set();
let unsubscribeIncoming = null;
let unsubscribeReadState = null;
let unsubscribeMessaging = null;
let lastNoticeAt = 0;
let dependenciesPromise = null;

function loadNotificationDependencies() {
    if (!dependenciesPromise) {
        dependenciesPromise = Promise.all([
            import('../../vendor/firebase/firebase-messaging.js'),
            import('../../chat/js/chat-config.js'),
            import('../../chat/js/chat-db.js'),
            import('../../chat/js/chat-crypto.js')
        ]).then(([messaging, config, database, crypto]) => Object.freeze({
            getToken: messaging.getToken,
            onMessage: messaging.onMessage,
            auth: config.auth,
            getChatDeployment: config.getChatDeployment,
            getChatMessaging: config.getChatMessaging,
            savePushToken: database.savePushToken,
            subscribeIncomingMessages: database.subscribeIncomingMessages,
            subscribeOwnReadState: database.subscribeOwnReadState,
            sha256Base64: crypto.sha256Base64
        }));
    }
    return dependenciesPromise;
}

function unreadCount() {
    return countUnreadMessages(incomingMessages, readState?.lastReadAt);
}

function renderUnreadBadge() {
    if (!incomingReady || !readStateReady) return;
    const count = unreadCount();
    const label = String(count) + ' pesan Chat belum dibaca';
    document.querySelectorAll('[data-chat-unread-badge]').forEach((badge) => {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('hidden', count === 0);
        badge.setAttribute('aria-label', label);
    });
    document.querySelectorAll('.chat-nav-link').forEach((link) => {
        link.setAttribute('aria-label', count > 0 ? 'Buka Chat Privat, ' + label : 'Buka Chat Privat');
    });
}

async function showCloakedNotification() {
    const now = Date.now();
    if (now - lastNoticeAt < NOTICE_THROTTLE_MS) return;
    lastNoticeAt = now;
    window.toast?.(NOTICE_TITLE + ': ' + NOTICE_BODY, 'success');
    if (typeof Notification === 'undefined' || document.visibilityState === 'visible' || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker?.ready?.catch(() => null);
    await registration?.showNotification?.(NOTICE_TITLE, {
        body: NOTICE_BODY,
        icon: './icons/icon-192.png',
        badge: './icons/favicon-32.png',
        tag: 'simni-system-update',
        renotify: false,
        data: { kind: 'simni-system-update', url: './chat/chat.html' }
    });
}

async function registerMessaging(dependencies) {
    const deployment = dependencies.getChatDeployment();
    if (typeof Notification === 'undefined') return false;
    if (!deployment.fcmVapidKey || Notification.permission !== 'granted') return false;
    const messaging = await dependencies.getChatMessaging();
    if (!messaging) return false;
    const registration = await navigator.serviceWorker?.ready?.catch(() => null);
    const token = await dependencies.getToken(messaging, {
        vapidKey: deployment.fcmVapidKey,
        serviceWorkerRegistration: registration || undefined
    });
    if (!token) return false;
    const tokenHash = (await dependencies.sha256Base64(token)).replace(/[/+=]/g, '_');
    await dependencies.savePushToken(token, tokenHash, window.SIMNIPlatform ? 'android-webview' : 'web');
    unsubscribeMessaging?.();
    unsubscribeMessaging = dependencies.onMessage(messaging, () => {
        void showCloakedNotification();
    });
    return true;
}

function handleIncoming(messages) {
    const nextMessages = Array.isArray(messages) ? messages : [];
    const nextIds = new Set(nextMessages.map((message) => String(message.id || '')).filter(Boolean));
    if (incomingReady) {
        const hasNewMessage = [...nextIds].some((id) => !knownMessageIds.has(id));
        if (hasNewMessage) void showCloakedNotification();
    }
    incomingMessages = nextMessages;
    knownMessageIds = nextIds;
    incomingReady = true;
    renderUnreadBadge();
}

function handleReadState(value) {
    readState = value;
    readStateReady = true;
    renderUnreadBadge();
}

export function stopChatNotifications() {
    unsubscribeIncoming?.();
    unsubscribeReadState?.();
    unsubscribeMessaging?.();
    unsubscribeIncoming = null;
    unsubscribeReadState = null;
    unsubscribeMessaging = null;
    activeUid = null;
    incomingMessages = [];
    readState = null;
    incomingReady = false;
    readStateReady = false;
    knownMessageIds = new Set();
    lastNoticeAt = 0;
    document.querySelectorAll('[data-chat-unread-badge]').forEach((badge) => {
        badge.textContent = '0';
        badge.classList.add('hidden');
        badge.setAttribute('aria-label', '0 pesan Chat belum dibaca');
    });
}

export async function startChatNotifications() {
    const dependencies = await loadNotificationDependencies();
    const uid = dependencies.auth.currentUser?.uid || null;
    if (!uid || !window.SIMNIAccess?.canAccess?.('chat')) {
        stopChatNotifications();
        return false;
    }
    if (activeUid === uid && unsubscribeIncoming && unsubscribeReadState) return true;
    stopChatNotifications();
    activeUid = uid;
    unsubscribeIncoming = dependencies.subscribeIncomingMessages(handleIncoming, (error) => {
        console.warn('[SIMNI Chat] Listener notifikasi pesan gagal:', error);
    });
    unsubscribeReadState = dependencies.subscribeOwnReadState(handleReadState, (error) => {
        console.warn('[SIMNI Chat] Listener status baca gagal:', error);
    });
    await registerMessaging(dependencies).catch((error) => {
        console.warn('[SIMNI Chat] FCM dashboard belum aktif:', error);
    });
    return true;
}

export const chatNotificationContract = Object.freeze({
    title: NOTICE_TITLE,
    body: NOTICE_BODY
});
