const MESSAGE_ID_EPOCH_CEILING = 9_999_999_999_999;
const MESSAGE_ID_RANDOM_BYTES = 12;
const MESSAGE_ID_PATTERN = /^!(\d{13})_[0-9a-f]{24}$/;

function normalizeLimit(value) {
  return Math.max(1, Math.min(300, Number(value) || 150));
}

function timestampMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value && typeof value.toMillis === 'function') {
    const milliseconds = Number(value.toMillis());
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  if (value && Number.isFinite(Number(value.seconds))) {
    const nanoseconds = Number(value.nanoseconds || 0);
    return (Number(value.seconds) * 1000) + Math.floor(nanoseconds / 1_000_000);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function timestampFromMessageId(id) {
  const match = MESSAGE_ID_PATTERN.exec(String(id || ''));
  if (!match) return null;
  const inverted = Number(match[1]);
  const milliseconds = MESSAGE_ID_EPOCH_CEILING - inverted;
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

function messageTimestamp(message) {
  return timestampMillis(message?.createdAt) ?? timestampFromMessageId(message?.id) ?? 0;
}

function randomBytes(source) {
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('Web Crypto random generator tidak tersedia untuk ID pesan.');
  }
  return source.getRandomValues(new Uint8Array(MESSAGE_ID_RANDOM_BYTES));
}

export function createMessageDocumentId(now = Date.now(), cryptoSource = globalThis.crypto) {
  const milliseconds = Number(now);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > MESSAGE_ID_EPOCH_CEILING) {
    throw new Error('Timestamp ID pesan tidak valid.');
  }
  const inverted = String(MESSAGE_ID_EPOCH_CEILING - milliseconds).padStart(13, '0');
  const random = [...randomBytes(cryptoSource)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `!${inverted}_${random}`;
}

export function mergeMessageSnapshots(snapshotGroups, maxItems = 150) {
  const merged = new Map();
  for (const group of Array.isArray(snapshotGroups) ? snapshotGroups : []) {
    for (const message of Array.isArray(group) ? group : []) {
      const id = String(message?.id || '').trim();
      if (id) merged.set(id, { ...message, id });
    }
  }
  return [...merged.values()]
    .sort((left, right) => {
      const timeDifference = messageTimestamp(left) - messageTimestamp(right);
      return timeDifference || String(left.id).localeCompare(String(right.id));
    })
    .slice(-normalizeLimit(maxItems));
}

export function countUnreadMessages(messages, lastReadAt) {
  const readAt = timestampMillis(lastReadAt) || 0;
  const source = Array.isArray(messages) ? messages : [];
  if (!readAt) return source.length;
  return source.reduce((total, message) => {
    return total + (messageTimestamp(message) > readAt ? 1 : 0);
  }, 0);
}

export const chatQueryCore = Object.freeze({
  createMessageDocumentId,
  mergeMessageSnapshots,
  countUnreadMessages
});
