// QA-only Firebase-shaped adapter. Never shipped; contains no network client.
if (typeof location !== 'undefined' && !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Mock hanya untuk localhost.');
if (typeof window === 'undefined') {
    globalThis.window = globalThis;
}
if (!globalThis.window.QAMock) {
    globalThis.window.QAMock = { connected: true, failNext: false, hold: false, writes: [] };
}
const listeners = new Set();
let tree = {};
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('simni-academic-qa') : { postMessage: () => {}, onmessage: null };
export const ref = (_database, path = '') => ({ path });
export const query = (reference, ...constraints) => ({ ...reference, constraints });
export const orderByKey = () => ({ type: 'orderByKey' });
export const orderByChild = field => ({ type: 'orderByChild', field });
export const limitToFirst = count => ({ type: 'first', count });
export const limitToLast = count => ({ type: 'last', count });
export const endBefore = key => ({ type: 'before', key });
export const startAt = key => ({ type: 'startAt', key });
export const startAfter = key => ({ type: 'startAfter', key });
export const endAt = key => ({ type: 'endAt', key });
export const equalTo = value => ({ type: 'equalTo', value });

function readQuery(reference) {
    const value = read(reference.path);
    if (!reference.constraints?.length || !value || typeof value !== 'object') return value;
    let entries = Object.entries(value);
    const childOrder = reference.constraints.find(item => item.type === 'orderByChild');
    if (childOrder) {
        entries.sort(([_, a], [__, b]) => {
            const valA = a?.[childOrder.field] ?? '';
            const valB = b?.[childOrder.field] ?? '';
            return valA < valB ? -1 : valA > valB ? 1 : 0;
        });
    } else {
        entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    }
    for (const constraint of reference.constraints) {
        if (constraint.type === 'before') entries = entries.filter(([key]) => key < constraint.key);
        if (constraint.type === 'startAt') entries = entries.filter(([key]) => key >= constraint.key);
        if (constraint.type === 'startAfter') entries = entries.filter(([key]) => key > constraint.key);
        if (constraint.type === 'endAt') entries = entries.filter(([key]) => key <= constraint.key);
        if (constraint.type === 'equalTo') entries = entries.filter(([_, item]) => {
            if (childOrder) return item?.[childOrder.field] === constraint.value;
            return item === constraint.value;
        });
    }
    for (const constraint of reference.constraints) {
        if (constraint.type === 'first') entries = entries.slice(0, constraint.count);
        if (constraint.type === 'last') entries = entries.slice(-constraint.count);
    }
    return entries.length ? Object.fromEntries(entries) : null;
}
const clone = value => structuredClone(value);
function read(path, root = tree) {
    if (path === '.info/connected') return window.QAMock.connected;
    return path.split('/').filter(Boolean).reduce((value, key) => value?.[key], root) ?? null;
}
function replaceServerValues(val) {
    if (val === null || typeof val !== 'object') return val;
    if (val['.sv'] === 'timestamp') return Date.now();
    const result = Array.isArray(val) ? [] : {};
    for (const [k, v] of Object.entries(val)) {
        result[k] = replaceServerValues(v);
    }
    return result;
}
export const serverTimestamp = () => ({ '.sv': 'timestamp' });
function write(root, path, value) {
    const parts = path.split('/').filter(Boolean);
    const last = parts.pop();
    if (!last) throw new Error('Mock root replacement forbidden.');
    const parent = parts.reduce((value, key) => value[key] ||= {}, root);
    const resolved = replaceServerValues(value);
    if (resolved === null) delete parent[last]; else parent[last] = clone(resolved);
}
const snapshot = value => ({ val: () => clone(value), exists: () => value !== null });
async function db() {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SIMNIAcademicQAMock', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('data');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function load() {
    const database = await db();
    if (!database) return;
    tree = await new Promise((resolve, reject) => {
        const request = database.transaction('data').objectStore('data').get('tree');
        request.onsuccess = () => resolve(request.result || {}); request.onerror = () => reject(request.error);
    });
    database.close();
}
function notify() {
    for (const listener of listeners) {
        const value = readQuery(listener);
        if (JSON.stringify(value) === listener.previous) continue;
        listener.previous = JSON.stringify(value);
        listener.next(snapshot(value));
    }
}
async function mutate(updater, description) {
    if (window.QAMock.failNext) { window.QAMock.failNext = false; throw new Error('MOCK_COMMIT_REJECTED'); }
    if (window.QAMock.hold) await new Promise(resolve => { window.QAMock.release = resolve; });
    const database = await db();
    let committed = false;
    if (database) {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction('data', 'readwrite');
            const store = transaction.objectStore('data');
            const request = store.get('tree');
            request.onsuccess = () => {
                const current = request.result || {};
                const next = updater(clone(current));
                if (next !== undefined) { tree = next; store.put(tree, 'tree'); committed = true; }
                else tree = current;
            };
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
        database.close();
    } else {
        const next = updater(clone(tree));
        if (next !== undefined) { tree = next; committed = true; }
    }
    if (committed) { window.QAMock.writes.push(description); notify(); if (channel.postMessage) channel.postMessage('changed'); }
    return committed;
}
export async function get(reference) { await load(); return snapshot(readQuery(reference)); }
export async function set(reference, value) { await mutate(root => { write(root, reference.path, value); return root; }, { type: 'set', path: reference.path }); }
export async function update(reference, values) { await mutate(root => { for (const [key,value] of Object.entries(values)) write(root, [reference.path,key].filter(Boolean).join('/'), value); return root; }, { type: 'update', paths: Object.keys(values) }); }
export async function remove(reference) { return set(reference, null); }
export async function runTransaction(reference, updater) {
    const committed = await mutate(root => {
        const next = updater(read(reference.path, root));
        if (next === undefined) return;
        write(root, reference.path, next); return root;
    }, { type: 'transaction', path: reference.path });
    return { committed, snapshot: snapshot(read(reference.path)) };
}
export function onValue(reference, next, error) {
    const listener = { ...reference, next, error, previous: undefined };
    listeners.add(listener);
    load().then(() => { if (listeners.has(listener)) { const value = readQuery(listener); listener.previous = JSON.stringify(value); next(snapshot(value)); } }).catch(error);
    return () => listeners.delete(listener);
}
window.QAMock = {
    connected: true, failNext: false, hold: false, writes: [],
    dump: () => clone(tree),
    write: (path, value) => set(ref(null, path), value),
    disconnect(value) { this.connected = !value; notify(); },
    failBinding(suffix) { for (const listener of listeners) if (listener.path.endsWith(suffix)) listener.error(new Error('MOCK_BINDING_DENIED')); }
};
channel.onmessage = () => load().then(notify);
