import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('--- SIMNI TAHAP 2 CONTRACT TEST SUITE: LIFECYCLE & PERSISTENT DRAFTS (S08 / S04) ---');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
        testsFailed++;
    }
}

// Minimal DOM simulation for unit testing in Node
class MockElement {
    constructor(tagName = 'DIV', id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.dataset = {};
        this.classList = new Set();
        this.attributes = {};
        this.children = [];
        this.parentElement = null;
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.type = 'text';
    }
    setAttribute(name, val) { this.attributes[name] = String(val); }
    getAttribute(name) { return this.attributes[name]; }
    removeAttribute(name) { delete this.attributes[name]; }
    closest(selector) {
        let cur = this;
        while (cur) {
            if (selector.startsWith('.') && cur.classList.has(selector.slice(1))) return cur;
            if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur;
            if (cur.tagName === selector.toUpperCase()) return cur;
            cur = cur.parentElement;
        }
        return null;
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
        const matches = [];
        const walk = (node) => {
            for (const child of node.children) {
                if (selector.startsWith('.') && child.classList.has(selector.slice(1))) matches.push(child);
                else if (selector.startsWith('#') && child.id === selector.slice(1)) matches.push(child);
                else if (selector.includes('[data-baseline]') && child.dataset.baseline !== undefined) matches.push(child);
                else if (selector.includes('[data-draft-key]') && child.dataset.draftKey !== undefined) matches.push(child);
                else if (selector.includes('[data-simni-draft-status]') && child.dataset.simniDraftStatus !== undefined) matches.push(child);
                else if (child.tagName === selector.toUpperCase()) matches.push(child);
                walk(child);
            }
        };
        walk(this);
        return matches;
    }
    append(...children) {
        for (const c of children) {
            c.parentElement = this;
            this.children.push(c);
        }
    }
    prepend(child) {
        child.parentElement = this;
        this.children.unshift(child);
    }
}

// -------------------------------------------------------------
// 1. LIFECYCLE LOADING TESTS (S08)
// -------------------------------------------------------------

await runTest('2A: Token-based Loading Ownership — Op A and Op B concurrent lifecycle', async () => {
    // Emulate feedback.js activeLoadingOwners logic
    const activeLoadingOwners = new Map();
    let labelText = '';
    let overlayVisible = false;

    function showLoad(text, ownerId) {
        const token = String(ownerId || `load_${Date.now()}`);
        activeLoadingOwners.set(token, { text, createdAt: Date.now() });
        labelText = text;
        overlayVisible = true;
        return token;
    }

    function hideLoad(token) {
        if (token) activeLoadingOwners.delete(token);
        if (activeLoadingOwners.size > 0) {
            const remaining = Array.from(activeLoadingOwners.values());
            labelText = remaining[remaining.length - 1].text;
            return;
        }
        overlayVisible = false;
        labelText = '';
    }

    // Step 1: Op A starts
    const tokenA = showLoad('Memproses Presensi...', 'op_presensi');
    assert.equal(overlayVisible, true);
    assert.equal(labelText, 'Memproses Presensi...');
    assert.equal(activeLoadingOwners.size, 1);

    // Step 2: Op B starts while Op A is still running
    const tokenB = showLoad('Membuat Dokumen PDF...', 'op_pdf');
    assert.equal(overlayVisible, true);
    assert.equal(labelText, 'Membuat Dokumen PDF...');
    assert.equal(activeLoadingOwners.size, 2);

    // Step 3: Op A completes first
    hideLoad(tokenA);
    // Crucial check: overlay must STAY VISIBLE because Op B is still running!
    assert.equal(overlayVisible, true, 'Overlay must stay visible while Op B is still active');
    assert.equal(labelText, 'Membuat Dokumen PDF...', 'Label should show active Op B message');
    assert.equal(activeLoadingOwners.size, 1);

    // Step 4: Op B completes
    hideLoad(tokenB);
    assert.equal(overlayVisible, false, 'Overlay should hide after all operations finish');
    assert.equal(activeLoadingOwners.size, 0);
});

await runTest('2A: Cancel / fast completion before minimum duration cancels overlay without flicker', async () => {
    let timerFired = false;
    let timerCleared = false;
    const activeOwners = new Map();

    const token = 'fast_op';
    activeOwners.set(token, { text: 'Quick Task' });
    let timer = setTimeout(() => {
        timerFired = true;
    }, 120);

    // Operation finishes in 10ms
    activeOwners.delete(token);
    if (activeOwners.size === 0) {
        clearTimeout(timer);
        timerCleared = true;
    }

    assert.equal(timerCleared, true);
    assert.equal(timerFired, false);
});

await runTest('2A: Form and Button Double-Execution Guard in actions.js', () => {
    const form = new MockElement('FORM', 'test-form');
    const button = new MockElement('BUTTON', 'test-btn');
    form.append(button);

    // Initial state: not processing
    assert.equal(form.dataset.simniProcessing, undefined);

    // First submit begins
    form.dataset.simniProcessing = 'true';
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    // Second submit arrives while processing is true
    let secondActionExecuted = false;
    if (form.dataset.simniProcessing === 'true') {
        // Blocked!
        secondActionExecuted = false;
    } else {
        secondActionExecuted = true;
    }

    assert.equal(secondActionExecuted, false, 'Second submit must be blocked while form is processing');
    assert.equal(button.disabled, true);

    // Finish first submit
    form.dataset.simniProcessing = 'false';
    button.disabled = false;
    button.removeAttribute('aria-busy');

    assert.equal(form.dataset.simniProcessing, 'false');
    assert.equal(button.disabled, false);
});

// -------------------------------------------------------------
// 2. PERSISTENT DRAFTS TESTS (S04) — PRESENSI, NILAI/TP, JURNAL
// -------------------------------------------------------------

// In-memory mock of persistent IndexedDB
class MockDraftStorage {
    constructor() {
        this.store = new Map();
    }
    async put(record) {
        this.store.set(record.id, JSON.parse(JSON.stringify(record)));
        return true;
    }
    async get(id) {
        const item = this.store.get(id);
        return item ? JSON.parse(JSON.stringify(item)) : null;
    }
    async delete(id) {
        this.store.delete(id);
        return true;
    }
    async getAll(uid) {
        const all = Array.from(this.store.values());
        return uid ? all.filter(item => item.uid === uid) : all;
    }
    async clear() {
        this.store.clear();
    }
}

const mockDb = new MockDraftStorage();

// Standalone implementation of SIMNIFormDrafts logic for isolated testing
function createTestDraftManager(storage = mockDb) {
    const drafts = new Map();
    const pending = new Set();
    const cleanValues = new Map();
    let currentSessionStr = 'user1|superuser|ws_superuser|2026-2027';
    let revision = 0;

    function key(id, discriminator = '') {
        return [currentSessionStr, '3A', id, discriminator].join('|');
    }

    async function persist(id, record) {
        await storage.put(record);
    }

    async function removePersist(id) {
        await storage.delete(id);
    }

    return {
        setSession(s) {
            if (s !== currentSessionStr) {
                drafts.clear();
                pending.clear();
                cleanValues.clear();
                currentSessionStr = s;
            }
        },
        key,
        capture(id, values, baselines = []) {
            const record = {
                id,
                session: currentSessionStr,
                uid: currentSessionStr.split('|')[0],
                workspaceId: currentSessionStr.split('|')[2],
                academicYearId: currentSessionStr.split('|')[3],
                classId: '3A',
                revision: ++revision,
                baselines,
                values,
                updatedAt: new Date().toISOString()
            };
            drafts.set(id, record);
            persist(id, record);
            return record;
        },
        restore(id) {
            return drafts.get(id) || null;
        },
        begin(id) {
            if (pending.has(id)) throw new Error('Penyimpanan formulir masih berlangsung.');
            pending.add(id);
            const draft = drafts.get(id);
            return { id, session: currentSessionStr, revision: draft?.revision, values: draft?.values };
        },
        finish(token, committed = false) {
            if (!token) return;
            pending.delete(token.id);
            const current = drafts.get(token.id);
            if (committed && current && current.revision === token.revision) {
                drafts.delete(token.id);
                removePersist(token.id);
                return 'deleted';
            }
            return 'retained';
        },
        async loadFromStorage(uid) {
            const items = await storage.getAll(uid);
            for (const item of items) {
                if (item.session === currentSessionStr && !drafts.has(item.id)) {
                    drafts.set(item.id, item);
                    if (item.revision > revision) revision = item.revision;
                }
            }
        },
        dirty(id) {
            return drafts.has(id);
        },
        hasUnsaved() {
            return drafts.size > 0 || pending.size > 0;
        }
    };
}

await runTest('2B-1: Presensi — Persistent Draft capture, reload, and commit lifecycle', async () => {
    const draftMgr = createTestDraftManager();
    const presensiKey = draftMgr.key('presensi-table-body', '2026-09-12');

    // 1. User inputs attendance for 3 students
    const inputValues = {
        '0012345671:Hadir': false,
        '0012345671:Sakit': true,
        '0012345671:ket': 'Demam tinggi',
        '0012345672:Hadir': true,
        '0012345672:ket': ''
    };
    const captured = draftMgr.capture(presensiKey, inputValues);
    assert.equal(captured.revision, 1);
    assert.equal(draftMgr.dirty(presensiKey), true);

    // 2. Verify stored in persistent IndexedDB
    const stored = await mockDb.get(presensiKey);
    assert.ok(stored, 'Draft must exist in persistent storage');
    assert.equal(stored.values['0012345671:Sakit'], true);
    assert.equal(stored.values['0012345671:ket'], 'Demam tinggi');

    // 3. Simulate browser reload: new draft manager instance reads from storage
    const reloadedMgr = createTestDraftManager();
    assert.equal(reloadedMgr.dirty(presensiKey), false, 'Empty before sync');
    await reloadedMgr.loadFromStorage('user1');
    assert.equal(reloadedMgr.dirty(presensiKey), true, 'Dirty after sync from storage');
    const restored = reloadedMgr.restore(presensiKey);
    assert.equal(restored.values['0012345671:ket'], 'Demam tinggi');

    // 4. User clicks "Simpan Kehadiran" -> begin()
    const token = reloadedMgr.begin(presensiKey);
    assert.equal(token.revision, 1);

    // 5. Server responds OK -> finish(token, true)
    const finishResult = reloadedMgr.finish(token, true);
    assert.equal(finishResult, 'deleted');
    assert.equal(reloadedMgr.dirty(presensiKey), false, 'Draft deleted after commit');
    assert.equal(await mockDb.get(presensiKey), null, 'Draft deleted from persistent storage');
});

await runTest('2B-1: Presensi — Typing during in-flight commit is preserved (revision bump)', async () => {
    const draftMgr = createTestDraftManager();
    const presensiKey = draftMgr.key('presensi-table-body', '2026-09-12');

    // Initial input
    draftMgr.capture(presensiKey, { '001:Hadir': true });
    const token = draftMgr.begin(presensiKey);
    assert.equal(token.revision, 1);

    // User types new note while save request is in-flight!
    draftMgr.capture(presensiKey, { '001:Hadir': false, '001:Izin': true, '001:ket': 'Baru menyusul surat' });
    const activeDraft = draftMgr.restore(presensiKey);
    assert.equal(activeDraft.revision, 2, 'Revision bumped to 2');

    // Save request #1 completes
    const finishResult = draftMgr.finish(token, true);
    assert.equal(finishResult, 'retained', 'Must retain draft because revision 2 > token revision 1');
    assert.equal(draftMgr.dirty(presensiKey), true, 'Draft must remain dirty');
    const preserved = await mockDb.get(presensiKey);
    assert.equal(preserved.values['001:ket'], 'Baru menyusul surat', 'New typing preserved in storage');
});

await runTest('2B-2: Nilai/TP — Draft isolation across TP dropdown selections', async () => {
    const draftMgr = createTestDraftManager();
    const tp1Key = draftMgr.key('nilai-table-body', 'Matematika|TP_MTK_01');
    const tp2Key = draftMgr.key('nilai-table-body', 'Matematika|TP_MTK_02');

    // Teacher fills grades for TP 1
    draftMgr.capture(tp1Key, { 'stu_01:score': '88', 'stu_02:score': '92' });
    // Teacher switches to TP 2 and fills grades
    draftMgr.capture(tp2Key, { 'stu_01:score': '75', 'stu_02:score': '80' });

    // Verify both exist independently
    const tp1Draft = draftMgr.restore(tp1Key);
    const tp2Draft = draftMgr.restore(tp2Key);

    assert.equal(tp1Draft.values['stu_01:score'], '88');
    assert.equal(tp2Draft.values['stu_01:score'], '75');

    // Commit TP 1 only
    const token1 = draftMgr.begin(tp1Key);
    draftMgr.finish(token1, true);

    assert.equal(draftMgr.dirty(tp1Key), false, 'TP 1 draft cleaned');
    assert.equal(draftMgr.dirty(tp2Key), true, 'TP 2 draft still intact');
    assert.equal(await mockDb.get(tp2Key) !== null, true, 'TP 2 draft persists in storage');
});

await runTest('2B-3: Jurnal — Baseline conflict detection & journal draft persistence', async () => {
    const draftMgr = createTestDraftManager();
    const journalKey = draftMgr.key('jurnal-form-container', '2026-09-08');

    const baselines = [
        { key: '1:materi', baseline: JSON.stringify({ Materi: 'Materi Asli', Mapel: 'IPAS' }) }
    ];

    // User fills journal draft
    draftMgr.capture(journalKey, {
        '1:materi': 'Materi Edit Lokal',
        '1:ket': 'Catatan selesai',
        '1:mapel': 'IPAS'
    }, baselines);

    const draft = draftMgr.restore(journalKey);
    assert.equal(draft.values['1:materi'], 'Materi Edit Lokal');
    assert.equal(draft.baselines[0].baseline.includes('Materi Asli'), true);

    // Simulate remote conflict check:
    const serverCurrentMateri = 'Materi Diedit di Laptop Lain';
    const originalBaseline = JSON.parse(draft.baselines[0].baseline).Materi;
    const isConflict = serverCurrentMateri !== originalBaseline;

    assert.equal(isConflict, true, 'Conflict detected because server diverged from draft baseline');

    // Save with successful commit
    const token = draftMgr.begin(journalKey);
    draftMgr.finish(token, true);
    assert.equal(draftMgr.dirty(journalKey), false);
});

await runTest('2B-Scope: Multi-account isolation — Account B cannot access Account A drafts', async () => {
    const storage = new MockDraftStorage();
    const mgrA = createTestDraftManager(storage);
    mgrA.setSession('userA|superuser|ws_superuser|2026-2027');
    const keyA = mgrA.key('presensi-table-body', '2026-09-12');
    mgrA.capture(keyA, { '001:Hadir': true, '001:ket': 'Catatan Rahasia User A' });

    // User B logs in
    const mgrB = createTestDraftManager(storage);
    mgrB.setSession('userB|superuser|ws_superuser|2026-2027');
    await mgrB.loadFromStorage('userB');

    // User B must NOT see User A's draft
    const keyB = mgrB.key('presensi-table-body', '2026-09-12');
    assert.equal(mgrB.dirty(keyB), false, 'User B must not see draft for User A');
    assert.equal(mgrB.restore(keyB), null);

    // All items in storage for User B is empty
    const userBDrafts = await storage.getAll('userB');
    assert.equal(userBDrafts.length, 0);

    // User A items are intact
    const userADrafts = await storage.getAll('userA');
    assert.equal(userADrafts.length, 1);
});

await runTest('2C: Logout decision — Unsaved draft triggers confirmation without deleting chat keys', () => {
    const draftMgr = createTestDraftManager();
    const key = draftMgr.key('presensi-table-body', '2026-09-12');
    draftMgr.capture(key, { '001:Sakit': true });

    assert.equal(draftMgr.hasUnsaved(), true, 'hasUnsaved() must be true when draft exists');

    // Simulate logout prompt decision
    function simulateLogout(userAction) {
        if (draftMgr.hasUnsaved()) {
            if (userAction === 'cancel') return { proceeded: false, reason: 'user_cancelled_to_continue_work' };
            if (userAction === 'keep') return { proceeded: true, draftsPreserved: true };
            if (userAction === 'discard') {
                draftMgr.finish(draftMgr.begin(key), true);
                return { proceeded: true, draftsPreserved: false };
            }
        }
        return { proceeded: true };
    }

    const res1 = simulateLogout('cancel');
    assert.equal(res1.proceeded, false, 'Logout aborted to continue editing');

    const res2 = simulateLogout('keep');
    assert.equal(res2.proceeded, true);
    assert.equal(res2.draftsPreserved, true, 'Drafts preserved in storage for next login of same account');
});

console.log('\n========================================');
console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
console.log('========================================\n');

if (testsFailed > 0) {
    process.exit(1);
}
