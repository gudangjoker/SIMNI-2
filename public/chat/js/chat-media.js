import { getChatIdToken } from './chat-auth.js';
import { requireEdgeBaseUrl } from './chat-config.js';
import { compressVideoNative } from './chat-platform.js';
import { encryptBytes, decryptBytes, encryptText, decryptText } from './chat-crypto.js';

export const MEDIA_POLICY = Object.freeze({
  image: Object.freeze({ maxSourceBytes: 12 * 1024 * 1024, maxUploadBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  audio: Object.freeze({ maxSourceBytes: 12 * 1024 * 1024, maxUploadBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  file: Object.freeze({ maxSourceBytes: 8 * 1024 * 1024, maxUploadBytes: 8 * 1024 * 1024, ttlMs: 5 * 24 * 60 * 60 * 1000 }),
  video: Object.freeze({ maxSourceBytes: 64 * 1024 * 1024, maxUploadBytes: 8 * 1024 * 1024, ttlMs: 3 * 24 * 60 * 60 * 1000, maxDurationSec: 60, maxWidth: 1280, maxHeight: 720, maxFps: 30 })
});

function policy(type) {
  const value = MEDIA_POLICY[type];
  if (!value) throw new Error(`Tipe media tidak didukung: ${type}`);
  return value;
}

function mediaTypeFor(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

function sanitizeFilename(value) {
  const text = String(value || 'file').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/\s+/g, ' ').trim();
  return text.slice(0, 180) || 'file';
}

async function imageToBlob(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size <= MEDIA_POLICY.image.maxUploadBytes) return file;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    const mime = file.type === 'image/png' && file.size < 2 * 1024 * 1024 ? 'image/png' : 'image/webp';
    const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Kompresi gambar gagal.')), mime, mime === 'image/webp' ? 0.82 : undefined));
    return new File([blob], sanitizeFilename(file.name).replace(/\.[^.]+$/, mime === 'image/webp' ? '.webp' : '.png'), { type: blob.type, lastModified: Date.now() });
  } finally { bitmap.close(); }
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => resolve({ video, url, cleanup, duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => { cleanup(); reject(new Error('Metadata video tidak dapat dibaca.')); };
    video.src = url;
  });
}

async function compressVideoWeb(file, meta) {
  const { video, cleanup, duration, width, height } = meta;
  try {
    if (!Number.isFinite(duration) || duration <= 0 || duration > MEDIA_POLICY.video.maxDurationSec) {
      throw new Error(`Durasi video maksimum ${MEDIA_POLICY.video.maxDurationSec} detik.`);
    }
    if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === 'undefined' || typeof video.captureStream !== 'function') {
      throw Object.assign(new Error('Browser ini tidak menyediakan pipeline kompresi video yang dibutuhkan.'), { code: 'chat/video-compression-not-supported' });
    }

    const scale = Math.min(1, MEDIA_POLICY.video.maxWidth / width, MEDIA_POLICY.video.maxHeight / height);
    const outWidth = Math.max(2, Math.floor(width * scale / 2) * 2);
    const outHeight = Math.max(2, Math.floor(height * scale / 2) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const canvasStream = canvas.captureStream(MEDIA_POLICY.video.maxFps);
    const sourceStream = video.captureStream();
    sourceStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

    const mimeCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error('Codec WebM untuk kompresi video tidak tersedia.');

    const targetBits = Math.max(1_000_000, Math.min(6_000_000, Math.floor((MEDIA_POLICY.video.maxUploadBytes * 8 * 0.90) / duration)));
    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: targetBits, audioBitsPerSecond: 96000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, outWidth, outHeight);
      if (!video.ended && !video.paused) raf = requestAnimationFrame(draw);
    };

    const done = new Promise((resolve, reject) => {
      recorder.onerror = (event) => reject(event.error || new Error('MediaRecorder video gagal.'));
      recorder.onstop = () => resolve();
    });

    recorder.start(500);
    await video.play();
    draw();
    await new Promise((resolve, reject) => {
      video.onended = resolve;
      video.onerror = () => reject(new Error('Playback video untuk kompresi gagal.'));
    });
    cancelAnimationFrame(raf);
    if (recorder.state !== 'inactive') recorder.stop();
    await done;
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size || blob.size > MEDIA_POLICY.video.maxUploadBytes) {
      throw new Error(`Hasil kompresi video masih melebihi ${Math.round(MEDIA_POLICY.video.maxUploadBytes / 1024 / 1024)} MB.`);
    }
    return new File([blob], `${sanitizeFilename(file.name).replace(/\.[^.]+$/, '')}.webm`, { type: mimeType, lastModified: Date.now() });
  } finally { cleanup(); }
}

async function prepareVideo(file) {
  const meta = await loadVideo(file);
  const withinDimension = meta.width <= MEDIA_POLICY.video.maxWidth && meta.height <= MEDIA_POLICY.video.maxHeight;
  const withinDuration = meta.duration <= MEDIA_POLICY.video.maxDurationSec;
  if (file.size <= MEDIA_POLICY.video.maxUploadBytes && withinDimension && withinDuration) {
    meta.cleanup();
    return file;
  }
  const native = await compressVideoNative(file, {
    maxWidth: MEDIA_POLICY.video.maxWidth,
    maxHeight: MEDIA_POLICY.video.maxHeight,
    maxFps: MEDIA_POLICY.video.maxFps,
    maxDurationSec: MEDIA_POLICY.video.maxDurationSec,
    maxBytes: MEDIA_POLICY.video.maxUploadBytes
  });
  if (native) {
    meta.cleanup();
    return native;
  }
  return compressVideoWeb(file, meta);
}

export async function prepareMediaFile(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('File media tidak valid.');
  const type = mediaTypeFor(file);
  const cfg = policy(type);
  if (file.size > cfg.maxSourceBytes) throw new Error(`Ukuran sumber ${type} melebihi batas.`);
  let prepared = file;
  if (type === 'image') prepared = await imageToBlob(file);
  if (type === 'video') prepared = await prepareVideo(file);
  if (prepared.size > cfg.maxUploadBytes) throw new Error(`Ukuran ${type} setelah proses masih melebihi batas.`);
  return { type, file: prepared, policy: cfg };
}

async function uploadCiphertext(type, encryptedBytes, expiresAt) {
  const token = await getChatIdToken();
  const edge = requireEdgeBaseUrl();
  const response = await fetch(`${edge}/v1/media/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-SIMNI-Media-Type': type,
      'X-SIMNI-Expires-At': String(expiresAt)
    },
    body: encryptedBytes
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.objectKey) throw new Error(payload?.message || `Upload media gagal (${response.status}).`);
  return payload;
}

export async function deleteEncryptedMedia(objectKey) {
  const key = String(objectKey || '').trim();
  if (!key) return false;
  const token = await getChatIdToken();
  const edge = requireEdgeBaseUrl();
  const response = await fetch(`${edge}/v1/media/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || `Cleanup media gagal (${response.status}).`);
  return payload.deleted === true;
}

export async function createEncryptedMediaMessage(file, identity, peerPublicJwk, recipientUid, contextBase) {
  const prepared = await prepareMediaFile(file);
  const expiresAt = Date.now() + prepared.policy.ttlMs;
  const bytes = new Uint8Array(await prepared.file.arrayBuffer());
  const aad = `${contextBase}|media|${prepared.type}|${expiresAt}`;
  const encrypted = await encryptBytes(bytes, identity, peerPublicJwk, aad, aad);
  const encryptedBytes = Uint8Array.from(atob(encrypted.ciphertext), (ch) => ch.charCodeAt(0));
  const uploaded = await uploadCiphertext(prepared.type, encryptedBytes, expiresAt);
  try {
    const metaPlain = JSON.stringify({
      name: sanitizeFilename(prepared.file.name || file.name || 'file'),
      mime: prepared.file.type || 'application/octet-stream',
      bytes: prepared.file.size,
      originalBytes: file.size
    });
    const encryptedMeta = await encryptText(metaPlain, identity, peerPublicJwk, `${contextBase}|media-meta|${uploaded.objectKey}`);
    return {
      type: prepared.type,
      recipientUid,
      objectKey: uploaded.objectKey,
      expiresAt,
      mediaIv: encrypted.iv,
      encryptedMediaMeta: encryptedMeta,
      cryptoVersion: encrypted.cryptoVersion,
      senderFingerprint: identity.fingerprint
    };
  } catch (error) {
    await deleteEncryptedMedia(uploaded.objectKey).catch(() => undefined);
    throw error;
  }
}

export async function downloadAndDecryptMedia(message, identity, peerPublicJwk, contextBase) {
  if (Number(message.expiresAt || 0) <= Date.now()) throw Object.assign(new Error('Media sudah kedaluwarsa.'), { code: 'chat/media-expired' });
  const token = await getChatIdToken();
  const edge = requireEdgeBaseUrl();
  const response = await fetch(`${edge}/v1/media/${encodeURIComponent(message.objectKey)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 410) throw Object.assign(new Error('Media sudah kedaluwarsa.'), { code: 'chat/media-expired' });
  if (!response.ok) throw new Error(`Download media gagal (${response.status}).`);
  const ciphertext = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < ciphertext.length; i += 0x8000) binary += String.fromCharCode(...ciphertext.subarray(i, i + 0x8000));
  const encryptedPayload = {
    cryptoVersion: Number(message.cryptoVersion || 1),
    iv: message.mediaIv,
    ciphertext: btoa(binary),
    aad: `${contextBase}|media|${message.type}|${message.expiresAt}`
  };
  const plainBytes = await decryptBytes(encryptedPayload, identity, peerPublicJwk, encryptedPayload.aad);
  const metaText = await decryptText(message.encryptedMediaMeta, identity, peerPublicJwk, `${contextBase}|media-meta|${message.objectKey}`);
  const meta = JSON.parse(metaText);
  return { bytes: plainBytes, meta };
}
