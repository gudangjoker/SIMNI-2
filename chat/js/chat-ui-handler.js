import { getToken, onMessage } from '../../vendor/firebase/firebase-messaging.js';
import { auth, getChatDeployment, getChatMessaging, CHAT_CONVERSATION_ID } from './chat-config.js';
import { observeChatSession, getChatSession, getChatIdToken } from './chat-auth.js';
import {
  ensureOwnPublicKey,
  getOwnKeyBackup,
  saveOwnKeyBackup,
  getPeerMember,
  getPublicKey,
  sendEncryptedMessage,
  subscribeMessages,
  savePushToken,
  markConversationRead
} from './chat-db.js';
import {
  getLocalIdentity,
  createIdentity,
  restoreIdentity,
  restoreIdentityFromAccount,
  createAccountBackupForIdentity,
  isAccountKeyBackup,
  accountBackupMatchesIdentity,
  encryptText,
  decryptText,
  sha256Base64,
  clearLocalIdentity
} from './chat-crypto.js';
import { getChatAccountUnlock } from '../../js/auth/chat-unlock.js';
import { startVoiceRecording, createPlayableAudioBlob } from './chat-platform.js';
import { createEncryptedMediaMessage, deleteEncryptedMedia, downloadAndDecryptMedia } from './chat-media.js';

const byId = (id) => document.getElementById(id);
const app = byId('chat-app');
const statusBox = byId('chat-status');
const messageList = byId('chat-message-list');
const emptyBox = byId('chat-empty');
const input = byId('chat-input');
const sendButton = byId('chat-send');
const fileInput = byId('chat-file-input');
const keyDialog = byId('chat-key-dialog');
const mediaDialog = byId('chat-media-dialog');

let identity = null;
let accountUnlockKey = null;
let peer = null;
let peerPublicKey = null;
let peerFingerprint = null;
let messagesUnsubscribe = null;
let authUnsubscribe = null;
let messagingUnsubscribe = null;
let objectUrls = new Set();
let currentMessages = [];
let busy = false;
let chatReady = false;
let voiceRecorder = null;
let voiceStarting = false;
let recordingStartedAt = 0;
let recordingTimer = null;
let lastMarkedReadMessageId = '';

function setStatus(text, tone = '') {
  statusBox.textContent = String(text || '');
  statusBox.dataset.tone = tone;
}

function resizeComposer() {
  input.style.height = 'auto';
  const nextHeight = Math.min(input.scrollHeight, 144);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > 144 ? 'auto' : 'hidden';
}

function setComposerAvailability(ready) {
  chatReady = ready === true;
  byId('chat-attach').disabled = !chatReady || busy;
  byId('chat-voice').disabled = !chatReady || busy || voiceStarting;
  sendButton.disabled = !chatReady || busy;
  input.disabled = !chatReady;
}

function formatRecordingDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function setRecordingUI(active) {
  const recording = active === true;
  const button = byId('chat-voice');
  const panel = byId('chat-recording');
  button.classList.toggle('is-recording', recording);
  button.setAttribute('aria-pressed', String(recording));
  button.setAttribute('aria-label', recording ? 'Hentikan rekaman voice note' : 'Rekam voice note');
  panel.classList.toggle('hidden', !recording);
  clearInterval(recordingTimer);
  recordingTimer = null;
  if (recording) {
    recordingStartedAt = Date.now();
    byId('chat-recording-time').textContent = '00:00';
    recordingTimer = setInterval(() => {
      byId('chat-recording-time').textContent = formatRecordingDuration(Date.now() - recordingStartedAt);
    }, 500);
  }
}

function latestReceivedMessage(messages = currentMessages) {
  const ownUid = auth.currentUser?.uid;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.recipientUid === ownUid) return messages[index];
  }
  return null;
}

function markVisibleConversationRead(messages = currentMessages) {
  if (document.visibilityState !== 'visible') return;
  const latest = latestReceivedMessage(messages);
  if (!latest?.id || latest.id === lastMarkedReadMessageId) return;
  lastMarkedReadMessageId = latest.id;
  markConversationRead(latest.id).catch((error) => {
    lastMarkedReadMessageId = '';
    console.warn('[SIMNI Chat] Status baca gagal disimpan:', error);
  });
}

function contextForPeer(peerUid) {
  const ownUid = auth.currentUser?.uid || '';
  return `conversation:${CHAT_CONVERSATION_ID}|users:${[ownUid, peerUid].sort().join(':')}`;
}

function decryptionContexts(message, otherUid) {
  const ownUid = auth.currentUser?.uid || '';
  const sortedUsers = [ownUid, otherUid].sort().join(':');
  const senderFirst = `${message.senderUid || ''}:${message.recipientUid || ''}`;
  const recipientFirst = `${message.recipientUid || ''}:${message.senderUid || ''}`;
  return [...new Set([
    contextForPeer(otherUid),
    `conversation:${CHAT_CONVERSATION_ID}|users:${senderFirst}`,
    `conversation:${CHAT_CONVERSATION_ID}|users:${recipientFirst}`,
    `conversation:${CHAT_CONVERSATION_ID}|${sortedUsers}`,
    `conversation:${CHAT_CONVERSATION_ID}`,
    `${CHAT_CONVERSATION_ID}|users:${sortedUsers}`,
    CHAT_CONVERSATION_ID
  ])];
}

async function decryptMessageText(message, otherKey, otherUid) {
  let lastError = null;
  for (const context of decryptionContexts(message, otherUid)) {
    try {
      return await decryptText({
        cryptoVersion: message.cryptoVersion,
        iv: message.iv,
        ciphertext: message.ciphertext,
        aad: message.aad || ''
      }, identity, otherKey, context);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Tidak ada konteks dekripsi yang kompatibel.');
}

function clearObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
}

function clearMessageUI() {
  clearObjectUrls();
  messageList.replaceChildren();
  emptyBox.classList.remove('hidden');
}

function formatTime(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  return date ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date) : '…';
}

function createTextMessage(text, sent, createdAt) {
  const row = document.createElement('div');
  row.className = `message-row ${sent ? 'sent' : 'received'}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const content = document.createElement('div');
  content.className = 'message-text';
  content.textContent = text;
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = formatTime(createdAt);
  bubble.append(content, meta);
  row.appendChild(bubble);
  return row;
}

function formatAudioTime(value) {
  const seconds = Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function waitForAudioMetadata(audio) {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Player pesan suara tidak merespons.'));
    }, 15000);
    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', loaded);
      audio.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error('Format pesan suara tidak dapat diputar pada perangkat ini.'));
    };
    audio.addEventListener('loadedmetadata', loaded, { once: true });
    audio.addEventListener('error', failed, { once: true });
    audio.load();
  });
}

function createVoicePlayer(message, sent, senderPublicJwk) {
  const player = document.createElement('div');
  player.className = 'voice-player';
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'voice-play-button';
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Putar pesan suara');
  const body = document.createElement('div');
  body.className = 'voice-player-body';
  const heading = document.createElement('div');
  heading.className = 'voice-player-heading';
  const label = document.createElement('strong');
  label.textContent = 'Pesan suara';
  const stateLabel = document.createElement('span');
  stateLabel.textContent = 'Siap diputar';
  heading.append(label, stateLabel);
  const timelineRow = document.createElement('div');
  timelineRow.className = 'voice-timeline-row';
  const timeline = document.createElement('input');
  timeline.type = 'range';
  timeline.className = 'voice-timeline';
  timeline.min = '0';
  timeline.max = '1000';
  timeline.value = '0';
  timeline.disabled = true;
  timeline.setAttribute('aria-label', 'Posisi pesan suara');
  const time = document.createElement('span');
  time.className = 'voice-time';
  time.textContent = '0:00 / 0:00';
  timelineRow.append(timeline, time);
  body.append(heading, timelineRow);
  const audio = document.createElement('audio');
  audio.className = 'voice-audio-engine';
  audio.preload = 'metadata';
  audio.setAttribute('aria-hidden', 'true');
  player.append(playButton, body, audio);

  let loadPromise = null;
  let audioUrl = '';
  const updateTimeline = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    timeline.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : '0';
    time.textContent = `${formatAudioTime(current)} / ${formatAudioTime(duration)}`;
  };
  const loadAudio = () => {
    if (audio.src) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      stateLabel.textContent = 'Memuat dan mendekripsi…';
      playButton.disabled = true;
      const context = contextForPeer(sent ? message.recipientUid : message.senderUid);
      const result = await downloadAndDecryptMedia(message, identity, senderPublicJwk, context);
      const blob = await createPlayableAudioBlob(result.bytes, result.meta.mime, result.meta.name);
      audioUrl = URL.createObjectURL(blob);
      objectUrls.add(audioUrl);
      audio.src = audioUrl;
      await waitForAudioMetadata(audio);
      timeline.disabled = false;
      stateLabel.textContent = result.meta.name || 'Pesan suara';
      updateTimeline();
    })().catch((error) => {
      stateLabel.textContent = 'Gagal dimuat';
      if (audioUrl) {
        objectUrls.delete(audioUrl);
        URL.revokeObjectURL(audioUrl);
        audioUrl = '';
      }
      audio.removeAttribute('src');
      audio.load();
      loadPromise = null;
      throw error;
    }).finally(() => {
      playButton.disabled = false;
    });
    return loadPromise;
  };

  playButton.addEventListener('click', async () => {
    try {
      await loadAudio();
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      if (error?.name === 'NotAllowedError' && audio.src) {
        stateLabel.textContent = 'Tekan putar sekali lagi';
        return;
      }
      setStatus(`Pesan suara gagal diputar: ${error.message || error}`, 'error');
    }
  });
  timeline.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = (Number(timeline.value) / 1000) * audio.duration;
    updateTimeline();
  });
  audio.addEventListener('loadedmetadata', updateTimeline);
  audio.addEventListener('durationchange', updateTimeline);
  audio.addEventListener('timeupdate', updateTimeline);
  audio.addEventListener('play', () => {
    playButton.textContent = '❚❚';
    playButton.setAttribute('aria-label', 'Jeda pesan suara');
    stateLabel.textContent = 'Sedang diputar';
  });
  audio.addEventListener('pause', () => {
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Putar pesan suara');
    if (!audio.ended && audio.src) stateLabel.textContent = 'Dijeda';
  });
  audio.addEventListener('ended', () => {
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Putar ulang pesan suara');
    stateLabel.textContent = 'Selesai';
    audio.currentTime = 0;
    updateTimeline();
  });
  return player;
}

async function createMediaMessage(message, sent, senderPublicJwk) {
  const row = document.createElement('div');
  row.className = `message-row ${sent ? 'sent' : 'received'}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const holder = document.createElement('div');
  holder.className = 'message-media';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = formatTime(message.createdAt);

  if (Number(message.expiresAt || 0) <= Date.now()) {
    const tombstone = document.createElement('div');
    tombstone.className = 'media-tombstone';
    tombstone.textContent = 'Media sudah kedaluwarsa.';
    holder.appendChild(tombstone);
  } else if (message.type === 'audio') {
    holder.appendChild(createVoicePlayer(message, sent, senderPublicJwk));
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'media-link';
    button.textContent = `Buka ${message.type}`;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const context = contextForPeer(sent ? message.recipientUid : message.senderUid);
        const result = await downloadAndDecryptMedia(message, identity, senderPublicJwk, context);
        const blob = new Blob([result.bytes], { type: result.meta.mime || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        objectUrls.add(url);
        holder.replaceChildren();
        if (message.type === 'image') {
          const image = document.createElement('img');
          image.src = url;
          image.alt = result.meta.name || 'Gambar Chat';
          holder.appendChild(image);
        } else if (message.type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.controls = true;
          video.playsInline = true;
          holder.appendChild(video);
        } else {
          const link = document.createElement('a');
          link.className = 'media-link';
          link.href = url;
          link.download = result.meta.name || 'file';
          link.textContent = `Unduh ${result.meta.name || 'file'}`;
          holder.appendChild(link);
        }
      } catch (error) {
        holder.textContent = error?.code === 'chat/media-expired' ? 'Media sudah kedaluwarsa.' : `Media gagal dibuka: ${error.message || error}`;
      } finally { button.disabled = false; }
    });
    holder.appendChild(button);
  }

  bubble.append(holder, meta);
  row.appendChild(bubble);
  return row;
}

async function renderMessages(messages) {
  currentMessages = messages;
  clearObjectUrls();
  const fragment = document.createDocumentFragment();
  const ownUid = auth.currentUser?.uid;
  let decryptionFailures = 0;

  for (const message of messages) {
    const sent = message.senderUid === ownUid;
    const otherUid = sent ? message.recipientUid : message.senderUid;
    let otherKey = sent
      ? (message.recipientPublicJwk || peerPublicKey)
      : (message.senderPublicJwk || peerPublicKey);
    if (!peer || peer.uid !== otherUid) {
      const keyDoc = await getPublicKey(otherUid);
      otherKey = keyDoc?.publicJwk || null;
    }
    if (!otherKey) continue;
    const context = contextForPeer(otherUid);

    if (message.type === 'text') {
      try {
        const text = await decryptMessageText(message, otherKey, otherUid);
        fragment.appendChild(createTextMessage(text, sent, message.createdAt));
      } catch (error) {
        decryptionFailures += 1;
        console.warn('[SIMNI Chat] Pesan gagal didekripsi:', message.id, error);
        fragment.appendChild(createTextMessage('[Pesan lama memerlukan kunci pemulihan]', sent, message.createdAt));
      }
    } else {
      fragment.appendChild(await createMediaMessage(message, sent, otherKey));
    }
  }

  messageList.replaceChildren(fragment);
  emptyBox.classList.toggle('hidden', messages.length > 0);
  if (decryptionFailures > 0) {
    setStatus(`${decryptionFailures} pesan lama tidak cocok dengan identity aktif. Buka tombol kunci untuk memulihkan identity asal.`, 'warning');
    byId('chat-key-state').textContent = 'Identity aktif tidak dapat membuka sebagian pesan lama. Pulihkan identity asal dengan Frasa Pemulihan.';
    byId('chat-recovery-created').classList.add('hidden');
    byId('chat-recovery-restore').classList.remove('hidden');
  }
  requestAnimationFrame(() => {
    const viewport = byId('chat-message-viewport');
    viewport.scrollTop = viewport.scrollHeight;
  });
  markVisibleConversationRead(messages);
}

async function ensureIdentityReady() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Object.assign(new Error('Sesi Firebase belum siap untuk identity Chat.'), { code: 'chat/auth-required' });
  identity = await getLocalIdentity(uid);
  let backup = await getOwnKeyBackup().catch(() => null);
  accountUnlockKey = await getChatAccountUnlock(uid).catch((error) => {
    console.warn('[SIMNI Chat] Kunci akun Firebase lokal tidak dapat dibaca:', error);
    return null;
  });

  if (!identity && backup?.backup) {
    if (isAccountKeyBackup(backup.backup) && accountUnlockKey) {
      try {
        identity = await restoreIdentityFromAccount(backup.backup, accountUnlockKey, uid);
        if (identity.fingerprint !== backup.fingerprint) {
          throw new Error('Fingerprint identity akun Firebase tidak cocok dengan backup server.');
        }
        await ensureOwnPublicKey(identity.publicJwk, identity.fingerprint);
        return true;
      } catch (e) {
        console.warn('[SIMNI Chat] Pemulihan identity berbasis login gagal:', e);
        throw e;
      }
    }
    if (isAccountKeyBackup(backup.backup) && !accountUnlockKey) {
      throw Object.assign(
        new Error('Login ulang ke SIMNI diperlukan untuk membuka identity Chat pada perangkat ini.'),
        { code: 'chat/account-login-required' }
      );
    }
    byId('chat-key-state').textContent = 'Backup lama memerlukan satu kali Frasa Pemulihan. Setelah berhasil, identity akan dikaitkan ke login Firebase dan prompt ini tidak muncul lagi.';
    byId('chat-recovery-created').classList.add('hidden');
    byId('chat-recovery-restore').classList.remove('hidden');
    keyDialog.showModal();
    return false;
  }

  if (!identity) {
    if (!accountUnlockKey) {
      throw Object.assign(
        new Error('Login ulang ke SIMNI diperlukan sebelum identity Chat baru dibuat.'),
        { code: 'chat/account-login-required' }
      );
    }
    const created = await createIdentity(uid, accountUnlockKey);
    identity = created.identity;
    await ensureOwnPublicKey(identity.publicJwk, identity.fingerprint);
    await saveOwnKeyBackup(created.recoveryBackup, identity.fingerprint, null);
    byId('chat-key-state').textContent = 'Identity Chat baru dibuat dan dikaitkan ke login Firebase.';
    byId('chat-recovery-created').classList.add('hidden');
    byId('chat-recovery-restore').classList.add('hidden');
    return true;
  }

  if (backup?.fingerprint && backup.fingerprint !== identity.fingerprint) {
    if (isAccountKeyBackup(backup.backup) && accountUnlockKey) {
      identity = await restoreIdentityFromAccount(backup.backup, accountUnlockKey, uid);
      await ensureOwnPublicKey(identity.publicJwk, identity.fingerprint);
    } else {
      byId('chat-key-state').textContent = 'Identity lokal berbeda dari backup lama. Masukkan Frasa Pemulihan satu kali untuk mengaitkannya ke login Firebase.';
      byId('chat-recovery-created').classList.add('hidden');
      byId('chat-recovery-restore').classList.remove('hidden');
      keyDialog.showModal();
      return false;
    }
  }

  await ensureOwnPublicKey(identity.publicJwk, identity.fingerprint);
  const accountBackupCurrent = accountUnlockKey && isAccountKeyBackup(backup?.backup)
    ? await accountBackupMatchesIdentity(backup.backup, accountUnlockKey, identity.fingerprint)
    : false;
  if (accountUnlockKey && (!backup?.backup || !accountBackupCurrent)) {
    try {
      const migrated = await createAccountBackupForIdentity(identity, accountUnlockKey, uid);
      identity = migrated.identity;
      backup = await saveOwnKeyBackup(migrated.backup, identity.fingerprint, null);
    } catch (error) {
      if (error?.code !== 'chat/legacy-key-migration-required') throw error;
      console.warn('[SIMNI Chat] Identity legacy tetap aktif; migrasi satu kali tersedia melalui tombol kunci.');
    }
  } else if (!backup?.backup && identity.recoveryBackup) {
    await saveOwnKeyBackup(identity.recoveryBackup, identity.fingerprint, null);
  }
  byId('chat-key-state').textContent = `Identity Chat aktif · ${identity.fingerprint.slice(0, 16)}…`;
  byId('chat-recovery-created').classList.add('hidden');
  byId('chat-recovery-restore').classList.toggle('hidden', isAccountKeyBackup(backup?.backup));
  return true;
}

async function resolvePeer() {
  peer = await getPeerMember();
  const keyDoc = await getPublicKey(peer.uid);
  if (!keyDoc?.publicJwk) {
    const error = new Error('Rekan Chat belum menyiapkan kunci E2E.');
    error.code = 'chat/peer-key-missing';
    throw error;
  }
  peerPublicKey = keyDoc.publicJwk;
  peerFingerprint = String(keyDoc.fingerprint || '');
  if (!peerFingerprint) throw new Error('Fingerprint kunci rekan Chat tidak tersedia.');
  return peer;
}

function startMessages() {
  messagesUnsubscribe?.();
  messagesUnsubscribe = subscribeMessages((messages) => {
    renderMessages(messages).catch((error) => setStatus(`Render pesan gagal: ${error.message || error}`, 'error'));
  }, (error) => setStatus(`Listener Chat gagal: ${error.message || error}`, 'error'));
}

async function initializeReadySession(session) {
  setComposerAvailability(false);
  byId('chat-session-label').textContent = `${session.role} · ${session.email || session.uid}`;
  const identityReady = await ensureIdentityReady();
  if (!identityReady) {
    setStatus('Selesaikan keamanan kunci Chat.', 'warning');
    return;
  }
  await resolvePeer();
  startMessages();
  await registerPush().catch((error) => console.warn('[SIMNI Chat] Push belum aktif:', error));
  app.setAttribute('aria-busy', 'false');
  setComposerAvailability(true);
  setStatus(`Terhubung dengan ${peer.role}. Pesan dienkripsi end-to-end.`, 'success');
}

async function sendText(event) {
  event.preventDefault();
  const text = String(input.value || '').trim();
  if (!text || busy) return;
  if (!identity || !peerPublicKey || !peer) return setStatus('Kunci/peer Chat belum siap.', 'warning');
  busy = true;
  setComposerAvailability(false);
  try {
    const context = contextForPeer(peer.uid);
    const encrypted = await encryptText(text, identity, peerPublicKey, context);
    await sendEncryptedMessage({
      type: 'text',
      recipientUid: peer.uid,
      cryptoVersion: encrypted.cryptoVersion,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      aad: encrypted.aad,
      senderFingerprint: identity.fingerprint,
      recipientFingerprint: peerFingerprint,
      senderPublicJwk: identity.publicJwk,
      recipientPublicJwk: peerPublicKey
    });
    input.value = '';
    resizeComposer();
    input.focus({ preventScroll: true });
    await sendCloakedPush(peer.uid).catch(() => {});
  } catch (error) {
    setStatus(`Pesan gagal dikirim: ${error.message || error}`, 'error');
  } finally {
    busy = false;
    setComposerAvailability(true);
  }
}

async function sendFile(file) {
  if (!file || busy) return;
  if (!chatReady || !identity || !peerPublicKey || !peer) {
    setStatus('Kunci/peer Chat belum siap untuk mengirim lampiran.', 'warning');
    return;
  }
  busy = true;
  setComposerAvailability(false);
  mediaDialog.showModal();
  byId('chat-media-status').textContent = 'Menyiapkan, mengompres, dan mengenkripsi media…';
  byId('chat-media-progress').value = 20;
  let message = null;
  try {
    const context = contextForPeer(peer.uid);
    message = await createEncryptedMediaMessage(file, identity, peerPublicKey, peer.uid, context);
    byId('chat-media-progress').value = 80;
    await sendEncryptedMessage({
      ...message,
      recipientFingerprint: peerFingerprint,
      senderPublicJwk: identity.publicJwk,
      recipientPublicJwk: peerPublicKey
    });
    byId('chat-media-progress').value = 100;
    byId('chat-media-status').textContent = 'Media berhasil dikirim.';
    await sendCloakedPush(peer.uid).catch(() => {});
    setTimeout(() => mediaDialog.close(), 500);
  } catch (error) {
    if (message?.objectKey) await deleteEncryptedMedia(message.objectKey).catch(() => undefined);
    byId('chat-media-status').textContent = `Media gagal: ${error.message || error}`;
  } finally {
    busy = false;
    setComposerAvailability(true);
  }
}

async function registerPush() {
  const deployment = getChatDeployment();
  if (typeof Notification === 'undefined') return false;
  if (!deployment.fcmVapidKey || Notification.permission === 'denied') return false;
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }
  const messaging = await getChatMessaging();
  if (!messaging) return false;
  const registration = await navigator.serviceWorker?.ready?.catch(() => null);
  const token = await getToken(messaging, { vapidKey: deployment.fcmVapidKey, serviceWorkerRegistration: registration || undefined });
  if (!token) return false;
  const tokenHash = (await sha256Base64(token)).replace(/[/+=]/g, '_');
  await savePushToken(token, tokenHash, window.SIMNIPlatform ? 'android-webview' : 'web');
  messagingUnsubscribe?.();
  messagingUnsubscribe = onMessage(messaging, () => setStatus('Pembaruan Sistem SIMNI: Database baru sudah siap!', 'success'));
  return true;
}

async function sendCloakedPush(recipientUid) {
  const deployment = getChatDeployment();
  if (!deployment.edgeBaseUrl) return false;
  const token = await getChatIdToken();
  const response = await fetch(`${deployment.edgeBaseUrl}/v1/push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientUid })
  });
  return response.ok;
}

async function restoreFromPhrase() {
  const phrase = String(byId('chat-recovery-input').value || '').trim();
  const backup = await getOwnKeyBackup();
  if (!backup?.backup) throw new Error('Backup kunci server tidak tersedia.');
  if (isAccountKeyBackup(backup.backup)) {
    throw new Error('Backup ini sudah terikat ke login Firebase dan tidak menggunakan Frasa Pemulihan.');
  }
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sesi Firebase tidak tersedia.');
  identity = await restoreIdentity(backup.backup, phrase, uid);
  if (identity.fingerprint !== backup.fingerprint) throw new Error('Fingerprint kunci hasil recovery tidak cocok.');
  await ensureOwnPublicKey(identity.publicJwk, identity.fingerprint);
  accountUnlockKey = accountUnlockKey || await getChatAccountUnlock(uid);
  if (!accountUnlockKey) throw new Error('Login ulang ke SIMNI diperlukan untuk menyelesaikan migrasi identity Chat.');
  const migrated = await createAccountBackupForIdentity(identity, accountUnlockKey, uid);
  identity = migrated.identity;
  await saveOwnKeyBackup(migrated.backup, identity.fingerprint, null);
  byId('chat-recovery-input').value = '';
  keyDialog.close();
  await initializeReadySession(getChatSession());
  setStatus('Identity lama berhasil dikaitkan ke login Firebase. Chat siap.', 'success');
}

function teardown() {
  voiceRecorder?.cancel?.();
  voiceRecorder = null;
  voiceStarting = false;
  setRecordingUI(false);
  setComposerAvailability(false);
  messagesUnsubscribe?.();
  messagesUnsubscribe = null;
  authUnsubscribe?.();
  authUnsubscribe = null;
  messagingUnsubscribe?.();
  messagingUnsubscribe = null;
  clearObjectUrls();
  clearMessageUI();
  identity = null;
  accountUnlockKey = null;
  peer = null;
  peerPublicKey = null;
  peerFingerprint = null;
  currentMessages = [];
  lastMarkedReadMessageId = '';
}

byId('chat-back').addEventListener('click', () => {
  window.location.assign(new URL('../index.html', window.location.href).href);
});
byId('chat-key-button').addEventListener('click', () => keyDialog.showModal());
byId('chat-recovery-confirm').addEventListener('click', () => {
  byId('chat-recovery-created').classList.add('hidden');
  keyDialog.close();
  initializeReadySession(getChatSession()).catch((error) => setStatus(error.message || String(error), 'error'));
});
byId('chat-recovery-submit').addEventListener('click', () => restoreFromPhrase().catch((error) => {
  byId('chat-key-state').textContent = error.message || String(error);
}));
byId('chat-composer').addEventListener('submit', sendText);
byId('chat-attach').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) sendFile(file);
});
byId('chat-voice').addEventListener('click', async () => {
  if (voiceRecorder) {
    voiceRecorder.stop();
    return;
  }
  if (voiceStarting || busy || !chatReady) return;
  voiceStarting = true;
  setComposerAvailability(true);
  try {
    voiceRecorder = await startVoiceRecording({ maxDurationMs: 120000 });
    voiceStarting = false;
    setRecordingUI(true);
    setComposerAvailability(true);
    setStatus('Merekam voice note… tekan tombol mikrofon untuk berhenti.', 'warning');
    const file = await voiceRecorder.result;
    voiceRecorder = null;
    setRecordingUI(false);
    await sendFile(file);
  } catch (error) {
    voiceRecorder = null;
    if (error?.code !== 'chat/voice-cancelled') {
      setStatus(`Voice note gagal: ${error.message || error}`, 'error');
    }
  } finally {
    voiceStarting = false;
    setRecordingUI(false);
    setComposerAvailability(chatReady);
  }
});
byId('chat-media-close').addEventListener('click', () => mediaDialog.close());
input.addEventListener('input', resizeComposer);
document.addEventListener('visibilitychange', () => markVisibleConversationRead());
window.addEventListener('pagehide', teardown, { once: true });

clearMessageUI();
setComposerAvailability(false);
resizeComposer();
authUnsubscribe = observeChatSession((state) => {
  if (state.status === 'loading') setStatus('Memeriksa akses Chat…');
  if (state.status === 'signed-out') {
    setStatus('Sesi SIMNI tidak tersedia. Kembali dan login ke SIMNI.', 'error');
    app.setAttribute('aria-busy', 'false');
  }
  if (state.status === 'denied') {
    setStatus(`Akses Chat ditolak: ${state.error?.message || state.error}`, 'error');
    app.setAttribute('aria-busy', 'false');
  }
  if (state.status === 'ready') {
    initializeReadySession(state.session).catch((error) => {
      console.error('[SIMNI Chat] init gagal:', error);
      setStatus(`Chat belum siap: ${error.message || error}`, 'error');
      app.setAttribute('aria-busy', 'false');
    });
  }
});

window.SIMNIChatDebug = Object.freeze({
  get session() { return getChatSession(); },
  get peer() { return peer; },
  get messages() { return [...currentMessages]; },
  clearLocalIdentity
});
