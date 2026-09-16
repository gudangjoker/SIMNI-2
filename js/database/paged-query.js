(function initSIMNIPagedQuery(root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SIMNIPagedQuery = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSIMNIPagedQuery() {
    'use strict';

    const DEFAULT_PAGE_SIZE = 2000;
    const MAX_ALLOWED_RECORDS = 100000;

    /**
     * Mengambil satu halaman data menggunakan cursor key RTDB.
     */
    async function fetchPagedQuery(dbRefFn, physicalPath, {
        pageSize = DEFAULT_PAGE_SIZE,
        cursor = null,
        constraintsBuilder = null,
        getFn = null
    } = {}) {
        if (!physicalPath) throw new Error('Path database fisik wajib diisi.');
        if (typeof dbRefFn !== 'function') throw new Error('Fungsi database reference wajib tersedia.');

        const size = Math.max(1, Math.min(pageSize, 5000));
        const reference = dbRefFn(physicalPath, {
            cursor,
            limit: size + 1,
            constraintsBuilder
        });

        let snapshot;
        if (typeof getFn === 'function') {
            snapshot = await getFn(reference);
        } else if (typeof reference.get === 'function') {
            snapshot = await reference.get();
        } else {
            throw new Error('Metode pembacaan query (get) tidak tersedia.');
        }

        const raw = (snapshot && typeof snapshot.val === 'function' ? snapshot.val() : snapshot) || {};
        const entries = Object.entries(raw).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

        let hasMore = false;
        let nextCursor = null;
        let pageEntries = entries;

        if (entries.length > size) {
            hasMore = true;
            nextCursor = entries[entries.length - 1][0];
            pageEntries = entries.slice(0, size);
        }

        return {
            items: Object.fromEntries(pageEntries),
            entries: pageEntries,
            count: pageEntries.length,
            hasMore,
            nextCursor
        };
    }

    /**
     * Membaca keseluruhan koleksi secara paged untuk menghindari beban memori dan timeout.
     * Menjamin 0 record terlewat dan 0 duplikasi pada batas halaman.
     */
    async function fetchCompleteCollectionPaged(dbRefFn, physicalPath, {
        pageSize = DEFAULT_PAGE_SIZE,
        maxRecords = MAX_ALLOWED_RECORDS,
        onProgress = null,
        getFn = null
    } = {}) {
        const aggregated = {};
        let cursor = null;
        let pageIndex = 0;
        let totalCount = 0;
        const seenKeys = new Set();

        while (true) {
            const page = await fetchPagedQuery(dbRefFn, physicalPath, {
                pageSize,
                cursor,
                getFn
            });

            let addedInThisPage = 0;
            for (const [key, item] of page.entries) {
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    aggregated[key] = item;
                    totalCount++;
                    addedInThisPage++;
                }
            }

            if (totalCount > maxRecords) {
                throw new Error(`Kapasitas maksimum koleksi terlampaui (${totalCount} > ${maxRecords}). Batalkan pembacaan.`);
            }

            if (typeof onProgress === 'function') {
                try {
                    onProgress({
                        pageIndex,
                        pageCount: page.count,
                        totalLoaded: totalCount,
                        hasMore: page.hasMore,
                        cursor: page.nextCursor
                    });
                } catch (_) {}
            }

            if (!page.hasMore || !page.nextCursor) {
                break;
            }

            if (addedInThisPage === 0 && cursor === page.nextCursor) {
                break;
            }

            cursor = page.nextCursor;
            pageIndex++;
        }

        return {
            value: aggregated,
            count: totalCount,
            pages: pageIndex + 1,
            isComplete: true
        };
    }

    /**
     * Memfilter record (objek atau array) berdasarkan scope kelas dan periode.
     * Menangani data legacy yang tidak memiliki field Kelas secara eksplisit
     * dengan mencocokkannya ke roster siswa via NISN.
     */
    function filterRecordsByScope(records, {
        classId = null,
        date = null,
        month = null,
        studentNisn = null,
        studentsRoster = []
    } = {}) {
        const list = Array.isArray(records)
            ? records
            : Object.entries(records || {}).map(([key, val]) => (typeof val === 'object' && val ? { ...val, _recordKey: key } : val));

        const targetClass = classId ? String(classId).trim().toUpperCase() : null;
        const targetDate = date ? String(date).trim() : null;
        const targetMonth = month ? String(month).trim() : null;
        const targetNisn = studentNisn ? String(studentNisn).trim() : null;

        const studentClassMap = new Map();
        if (Array.isArray(studentsRoster)) {
            for (const student of studentsRoster) {
                const sNisn = String(student?.NISN || student?.nisn || '').trim();
                const sKelas = String(student?.Kelas || student?.kelas || '').trim().toUpperCase();
                if (sNisn && sKelas) studentClassMap.set(sNisn, sKelas);
            }
        }

        const filtered = list.filter((item) => {
            if (!item || typeof item !== 'object') return false;

            if (targetClass) {
                let itemClass = String(item.Kelas || item.kelas || '').trim().toUpperCase();
                if (!itemClass) {
                    const nisn = String(item.NISN || item.nisn || '').trim();
                    if (nisn && studentClassMap.has(nisn)) {
                        itemClass = studentClassMap.get(nisn);
                    }
                }
                if (itemClass !== targetClass) return false;
            }

            if (targetDate) {
                const itemDate = String(item.Tanggal || item.tanggal || '').split('T')[0].trim();
                if (itemDate !== targetDate) return false;
            }

            if (targetMonth) {
                const itemDate = String(item.Tanggal || item.tanggal || '').split('T')[0].trim();
                if (!itemDate.startsWith(targetMonth)) return false;
            }

            if (targetNisn) {
                const itemNisn = String(item.NISN || item.nisn || '').trim();
                if (itemNisn !== targetNisn) return false;
            }

            return true;
        });

        return {
            items: filtered,
            count: filtered.length,
            totalRaw: list.length,
            isClassScoped: Boolean(targetClass),
            scopeClassId: targetClass
        };
    }

    return Object.freeze({
        DEFAULT_PAGE_SIZE,
        MAX_ALLOWED_RECORDS,
        fetchPagedQuery,
        fetchCompleteCollectionPaged,
        filterRecordsByScope
    });
}));
