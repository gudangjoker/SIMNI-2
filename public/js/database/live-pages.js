// Live key ranges preserve complete collections without a year-sized snapshot.
// Boundaries are exclusive on the left and inclusive on the right. Inserts and
// deletes cannot fall through cursor gaps; a growing range splits before publish.
export function subscribeLivePages(sdk, reference, onSnapshot, onError, {
    pageSize = 1000, pageBytes = 1024 * 1024, recordBytes = 16 * 1024 * 1024,
    debounceMs = 30
} = {}) {
    const leaves = new Set();
    let stopped = false, timer = null;
    const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    const publish = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (stopped || [...leaves].some(leaf => !leaf.ready)) return;
            const value = Object.assign(Object.create(null), ...[...leaves].map(leaf => leaf.value));
            onSnapshot({ val: () => value, pagedComplete: true, pageCount: leaves.size });
        }, debounceMs);
    };
    function attach(left, right) {
        const leaf = { left, right, ready: false, value: {}, closed: false, unsubscribe: null };
        leaves.add(leaf);
        const constraints = [sdk.orderByKey()];
        if (left !== null) constraints.push(sdk.startAfter(left));
        if (right !== null) constraints.push(sdk.endAt(right));
        constraints.push(sdk.limitToFirst(pageSize + 1));
        leaf.unsubscribe = sdk.onValue(sdk.query(reference, ...constraints), snapshot => {
            if (stopped || leaf.closed) return;
            try {
                const raw = snapshot.val();
                const value = raw === null ? {} : raw;
                if (typeof value !== 'object') throw Error('Koleksi realtime tidak valid.');
                // RTDB key ordering treats integer keys specially; use SDK order.
                const entries = [];
                if (typeof snapshot.forEach === 'function') snapshot.forEach(child => { entries.push([child.key, child.val()]); });
                else entries.push(...Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
                if (entries.length > pageSize || (entries.length > 1 && bytes(value) > pageBytes)) {
                    leaf.closed = true; leaf.unsubscribe?.(); leaves.delete(leaf);
                    const boundary = entries[entries.length > pageSize ? pageSize - 1 : Math.floor(entries.length / 2) - 1][0];
                    attach(left, boundary); attach(boundary, right);
                    return;
                }
                if (entries.some(([, item]) => bytes(item) > recordBytes)) throw Error('Satu record melebihi batas aman 16 MiB; perbaiki record sebelum sinkronisasi.');
                leaf.value = Object.fromEntries(entries); leaf.ready = true; publish();
            } catch (error) { leaf.ready = false; clearTimeout(timer); onError(error); }
        }, error => {
            if (!stopped && !leaf.closed) { leaf.ready = false; clearTimeout(timer); onError(error); }
        });
        if (leaf.closed || stopped) leaf.unsubscribe?.();
    }
    attach(null, null);
    return () => {
        stopped = true; clearTimeout(timer);
        for (const leaf of leaves) { leaf.closed = true; leaf.unsubscribe?.(); }
        leaves.clear();
    };
}
