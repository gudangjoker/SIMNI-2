import {
  createMessageDocumentId,
  mergeMessageSnapshots,
  countUnreadMessages
} from '../chat/js/chat-query-core.mjs';

let passed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed += 1;
    process.stdout.write(`[PASS] ${label}\n`);
    return;
  }
  failures.push(label);
  process.stderr.write(`[FAIL] ${label}\n`);
}

function deterministicCrypto(seed) {
  return {
    getRandomValues(target) {
      target.fill(seed);
      return target;
    }
  };
}

process.stdout.write('\nSIMNI CHAT QUERY REGRESSION\n\n');

const olderId = createMessageDocumentId(1_700_000_000_000, deterministicCrypto(1));
const newerId = createMessageDocumentId(1_700_000_000_100, deterministicCrypto(2));
assert(/^!\d{13}_[0-9a-f]{24}$/.test(olderId), 'ID pesan memakai format sortable yang valid');
assert(newerId.localeCompare(olderId) < 0, 'ID pesan terbaru berada lebih awal untuk query limit index-free');
assert(newerId !== olderId, 'ID pesan membawa random entropy');

let invalidTimestampRejected = false;
try {
  createMessageDocumentId(-1, deterministicCrypto(1));
} catch {
  invalidTimestampRejected = true;
}
assert(invalidTimestampRejected, 'Timestamp ID negatif ditolak');

const sent = [
  { id: 'sent-1', createdAt: { seconds: 10, nanoseconds: 0 }, ciphertext: 'a' },
  { id: 'shared', createdAt: { seconds: 20, nanoseconds: 0 }, ciphertext: 'old' }
];
const received = [
  { id: 'received-1', createdAt: { toMillis: () => 15_000 }, ciphertext: 'b' },
  { id: 'shared', createdAt: { seconds: 20, nanoseconds: 0 }, ciphertext: 'new' }
];
const merged = mergeMessageSnapshots([sent, received], 10);
assert(merged.length === 3, 'Snapshot sender dan recipient digabung tanpa duplikasi');
assert(merged.map((message) => message.id).join(',') === 'sent-1,received-1,shared', 'Pesan diurutkan kronologis');
assert(merged.find((message) => message.id === 'shared')?.ciphertext === 'new', 'Versi snapshot terakhir memenangkan deduplikasi');
assert(mergeMessageSnapshots([sent, received], 2).length === 2, 'Batas maksimum hasil diterapkan setelah merge');

const idTimestampFallback = mergeMessageSnapshots([[
  { id: olderId, createdAt: null },
  { id: newerId, createdAt: null }
]], 10);
assert(idTimestampFallback[1]?.id === newerId, 'Timestamp ID menjadi fallback ketika serverTimestamp masih null');

const incoming = [
  { id: 'old', createdAt: { seconds: 10, nanoseconds: 0 } },
  { id: 'new', createdAt: { seconds: 20, nanoseconds: 0 } }
];
assert(countUnreadMessages(incoming, null) === 2, 'Tanpa status baca seluruh pesan masuk dihitung belum dibaca');
assert(countUnreadMessages(incoming, { seconds: 15, nanoseconds: 0 }) === 1, 'Status baca menyaring pesan lama secara deterministik');
assert(countUnreadMessages(incoming, { seconds: 20, nanoseconds: 0 }) === 0, 'Pesan pada timestamp baca tidak dihitung ulang');

process.stdout.write(`\nCHAT QUERY REGRESSION: ${passed} PASS, ${failures.length} FAIL\n`);
if (failures.length) process.exitCode = 1;
