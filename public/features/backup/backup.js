(function initSIMNIBackupFeature() {
    'use strict';

    const core = window.SIMNIBackupCore;
    if (!core) {
        console.error('Modul inti backup gagal dimuat.');
        return;
    }

    const notify = (message, type = 'info') => typeof window.toast === 'function' ? window.toast(message, type) : console.log(message);
    const showProgress = (message) => typeof window.showLoad === 'function' && window.showLoad(message);
    const hideProgress = () => typeof window.hideLoad === 'function' && window.hideLoad();
    const currentSettings = () => window.SIMNILPSCore?.normalizeSettings(window.state?.pengaturan || {}) || (window.state?.pengaturan || {});
    const currentUser = () => typeof window.getCurrentUserMeta === 'function' ? window.getCurrentUserMeta() : { uid: null, email: null };
    const currentAccess = () => window.SIMNICurrentAccess || null;
    const allowedDataPaths = () => core.DATA_PATHS.filter((path) => {
        const feature = window.SIMNIAccessPolicy?.featureForLogicalPath(path);
        return feature ? !!window.SIMNIAccess?.canAccess(feature) : false;
    });

    function setAtPath(target, path, value) {
        core.setAtPath(target, path, value);
    }

    async function gatherDatabase() {
        const allowedPaths = allowedDataPaths();
        const database = core.filterDatabaseToPaths(core.stateToDatabase(window.state || {}), allowedPaths);
        const incompletePaths = [];
        let onlineReads = 0;

        const databaseReachable = navigator.onLine || window.SIMNIDatabaseTarget?.mode === 'emulator';
        if (databaseReachable && window.isUserLoggedIn && (typeof window.dbFetchCompleteCollection === 'function' || typeof window.dbGet === 'function')) {
            const results = await Promise.all(allowedPaths.map(async (path) => {
                let result;
                if (typeof window.dbFetchCompleteCollection === 'function') {
                    result = await window.dbFetchCompleteCollection(path);
                }
                if (!result?.ok && typeof window.dbGet === 'function') {
                    result = await window.dbGet(path);
                }
                return { path, result };
            }));
            results.forEach(({ path, result }) => {
                if (result?.ok) {
                    onlineReads += 1;
                    setAtPath(database, path, result.value);
                } else {
                    incompletePaths.push(path);
                }
            });
        } else {
            incompletePaths.push(...allowedPaths);
        }

        return {
            database,
            source: onlineReads === allowedPaths.length ? 'firebase-online' : onlineReads ? 'hybrid-online-local' : 'indexeddb-local',
            incompletePaths: [...new Set(incompletePaths)]
        };
    }

    function downloadBlob(blob, filename) {
        if (typeof window.SIMNIDownloadService?.downloadBlob === 'function') {
            void window.SIMNIDownloadService.downloadBlob(blob, filename);
            return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function downloadEnvelope(envelope, prefix) {
        window.SIMNIAccess.assertFeature('backup', 'export');
        const filename = core.createFilename(envelope, prefix);
        const json = JSON.stringify(envelope);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const maxBytes = core.MAX_FILE_BYTES || (25 * 1024 * 1024);
        if (blob.size > maxBytes) {
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
            const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
            throw new Error(`Ukuran berkas backup (${sizeMb} MB) melampaui batas aman pemulihan (${limitMb} MB). Harap arsipkan sebagian data terlebih dahulu.`);
        }
        downloadBlob(blob, filename);
        return filename;
    }

    async function buildCurrentEnvelope() {
        const settings = currentSettings();
        const gathered = await gatherDatabase();
        return core.createEnvelope(gathered.database, {
            createdAt: new Date().toISOString(),
            app: settings.nama_aplikasi || 'SIMNI PWA',
            projectId: window.firebaseConfig?.projectId || null,
            academicYear: settings.tahun_pelajaran || null,
            className: settings.nama_kelas || null,
            createdBy: currentUser(),
            scope: {
                uid: currentAccess()?.uid || null,
                role: currentAccess()?.role || null,
                workspaceId: currentAccess()?.workspaceId || null,
                classId: currentAccess()?.classId || null,
                academicYearId: currentAccess()?.activeAcademicYearId || null
            },
            source: gathered.source,
            schemaVersion: core.SCHEMA_VERSION,
            appVersion: window.SIMNI_APP_VERSION || null,
            incompletePaths: gathered.incompletePaths
        });
    }

    async function exportDataLokal(options = {}) {
        const safeOptions = options && typeof options === 'object' && !(options instanceof Event) ? options : {};
        const manageProgress = safeOptions.manageProgress !== false;
        if (manageProgress) showProgress('Menyiapkan backup lengkap...');
        try {
            const envelope = await buildCurrentEnvelope();
            const filename = core.createFilename(envelope, safeOptions.prefix || 'SIMNI_Backup');
            if (safeOptions.download !== false) downloadEnvelope(envelope, safeOptions.prefix || 'SIMNI_Backup');
            if (!safeOptions.silent) {
                const sourceNote = envelope.incompletePaths.length
                    ? ` (${envelope.source}; ${envelope.incompletePaths.length} alur memakai data lokal)`
                    : ' (snapshot Firebase lengkap)';
                notify(`Backup berhasil: ${filename}${sourceNote}. Dokumen cloud dicadangkan sebagai metadata/URL; file fisik Cloudinary tidak tertanam di JSON.`, envelope.incompletePaths.length ? 'warning' : 'success');
            }
            return { ok: true, envelope, filename };
        } catch (error) {
            console.error(error);
            if (!safeOptions.silent) notify(`Backup gagal: ${error.message}`, 'error');
            return { ok: false, error };
        } finally {
            if (manageProgress) hideProgress();
        }
    }

    function formatSummary(summary) {
        const labels = {
            'Pengaturan/Identitas': 'Identitas',
            'Pengaturan/LPS_v2': 'Template LPS lama',
            Siswa: 'Siswa', Presensi: 'Presensi', Mapel_TP: 'Tujuan Pembelajaran',
            Nilai_TP: 'Nilai', Dokumen: 'Dokumen', Catatan: 'Catatan', Jurnal: 'Jurnal',
            Jadwal: 'Jadwal', Data_LPS: 'LPS lama', 'LPS/Templates': 'Template LPS/BLP',
            'LPS/Reports': 'Laporan LPS/BLP', 'LPS/Revisions': 'Riwayat revisi'
        };
        return summary.map((entry) => `${labels[entry.path] || entry.path}: ${entry.count}`).join('\n');
    }

    async function inspectBackupPayload(parsed) {
        const integrity = await core.verifyEnvelope(parsed);
        if (!integrity.ok) throw new Error('Hash integritas tidak cocok. Berkas mungkin rusak atau telah diubah.');
        const scopeValidation = core.validateRestoreScope(parsed, currentAccess());
        const allowedPaths = allowedDataPaths();
        const database = core.filterDatabaseToPaths(core.extractDatabase(parsed), allowedPaths);
        return { integrity, scopeValidation, allowedPaths, database, summary: core.summarizeDatabase(database) };
    }

    async function readDatabasePaths(paths) {
        const database = {};
        const results = await Promise.all(paths.map(async (path) => ({ path, result: await window.dbGet(path) })));
        const failed = results.filter(({ result }) => !result?.ok);
        if (failed.length) throw new Error(`Read-back gagal pada: ${failed.map(({ path }) => path).join(', ')}`);
        results.forEach(({ path, result }) => setAtPath(database, path, result.value));
        return core.filterDatabaseToPaths(core.filterAllowedDatabase(database), paths);
    }

    async function verifyRestore(mode, inspected, updates) {
        const readBack = await readDatabasePaths(inspected.allowedPaths);
        if (mode === 'replace') {
            const expected = core.filterDatabaseToPaths(inspected.database, inspected.allowedPaths);
            const [expectedHash, actualHash] = await Promise.all([core.sha256(expected), core.sha256(readBack)]);
            if (expectedHash !== actualHash) throw new Error(`Read-back restore tidak cocok (expected ${expectedHash.slice(0, 12)}…, actual ${actualHash.slice(0, 12)}…).`);
            return { readBack, expectedHash, actualHash };
        }
        for (const [path, expected] of Object.entries(updates)) {
            const actual = core.getAtPath(readBack, path);
            if (core.canonicalStringify(actual) !== core.canonicalStringify(expected)) throw new Error(`Read-back merge tidak cocok pada ${path}.`);
        }
        return { readBack, expectedHash: null, actualHash: await core.sha256(readBack) };
    }

    async function rollbackFromSafetyBackup(safetyBackup, allowedPaths) {
        if (!safetyBackup?.envelope || safetyBackup.envelope.incompletePaths?.length) throw new Error('Rollback package tidak lengkap.');
        const rollbackDatabase = core.filterDatabaseToPaths(safetyBackup.envelope.database, allowedPaths);
        const rollbackUpdates = core.buildReplaceUpdates(rollbackDatabase, allowedPaths);
        const result = await window.dbAuditedUpdate('backup_restore', 'rollback', rollbackUpdates);
        if (!result?.ok) throw result?.error || new Error('Rollback write gagal.');
        const readBack = await readDatabasePaths(allowedPaths);
        const [expectedHash, actualHash] = await Promise.all([core.sha256(rollbackDatabase), core.sha256(readBack)]);
        if (expectedHash !== actualHash) throw new Error('Rollback read-back hash tidak cocok.');
        return { ok: true, expectedHash, actualHash };
    }

    async function restoreParsedBackup(parsed, options = {}) {
        const databaseReachable = navigator.onLine || window.SIMNIDatabaseTarget?.mode === 'emulator';
        if (!databaseReachable || !window.isUserLoggedIn) throw new Error('Restore memerlukan koneksi ke target database dan login aktif.');
        const mode = options.mode === 'replace' ? 'replace' : 'merge';
        const inspected = await inspectBackupPayload(parsed);
        let safetyBackup = null;

        if (options.createSafetyBackup !== false) {
            safetyBackup = await exportDataLokal({
                prefix: options.safetyPrefix || 'SIMNI_Sebelum_Restore',
                silent: true,
                download: options.downloadSafetyBackup !== false,
                manageProgress: false
            });
            if (!safetyBackup.ok) throw new Error('Backup pengaman gagal dibuat; restore dibatalkan.');
            if (safetyBackup.envelope?.incompletePaths?.length || safetyBackup.envelope?.completeness?.complete === false) throw new Error(`Backup pengaman tidak lengkap; restore dibatalkan. Path belum terbaca: ${(safetyBackup.envelope.incompletePaths || []).join(', ')}`);
            const safetyIntegrity = await core.verifyEnvelope(safetyBackup.envelope);
            if (!safetyIntegrity.ok) throw new Error('Hash backup pengaman tidak valid; restore dibatalkan.');
        }

        const updates = mode === 'replace'
            ? core.buildReplaceUpdates(inspected.database, inspected.allowedPaths)
            : core.flattenForMerge(inspected.database, inspected.allowedPaths);
        if (!Object.keys(updates).length) throw new Error('Tidak ada data yang dapat dipulihkan.');

        const result = await window.dbAuditedUpdate('backup_restore', mode, updates);
        if (!result?.ok) throw result?.error || new Error('Target database menolak restore.');
        try {
            const verification = await verifyRestore(mode, inspected, updates);
            const auditResult = result;
            return { ok: true, mode, safetyBackup, verification, auditLogged: auditResult?.ok === true, auditResult, ...inspected };
        } catch (verificationError) {
            if (!safetyBackup?.envelope) throw verificationError;
            try {
                const rollback = await rollbackFromSafetyBackup(safetyBackup, inspected.allowedPaths);
                throw new Error(`Restore gagal verifikasi dan telah di-rollback. ${verificationError.message || verificationError}`);
            } catch (rollbackError) {
                if (String(rollbackError?.message || '').startsWith('Restore gagal verifikasi')) throw rollbackError;
                const fatal = new Error(`Restore gagal verifikasi DAN rollback gagal. Hentikan operasi: ${rollbackError.message || rollbackError}`);
                fatal.cause = verificationError;
                throw fatal;
            }
        }
    }

    async function importDataLokal(event) {
        const input = event?.target;
        const file = input?.files?.[0];
        if (!file) return;

        try {
            const fileName = (file.name || '').toLowerCase();
            if (!fileName.endsWith('.json')) {
                throw new Error('Format file backup harus berupa JSON (.json).');
            }
            const maxImportBytes = core.MAX_IMPORT_BYTES || (32 * 1024 * 1024);
            const maxPayloadBytes = core.MAX_FILE_BYTES || (25 * 1024 * 1024);
            if (file.size > maxImportBytes) {
                throw new Error(`Ukuran berkas backup (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas baca ${(maxImportBytes / (1024 * 1024)).toFixed(0)} MB.`);
            }
            const databaseReachable = navigator.onLine || window.SIMNIDatabaseTarget?.mode === 'emulator';
            if (!databaseReachable || !window.isUserLoggedIn) throw new Error('Restore ke target database memerlukan koneksi dan login aktif.');

            showProgress('Memeriksa isi dan integritas backup...');
            const parsed = JSON.parse(await file.text());
            const payloadBytes = new TextEncoder().encode(JSON.stringify(parsed.database || parsed)).byteLength;
            if (payloadBytes > maxPayloadBytes) {
                throw new Error(`Ukuran data backup (${(payloadBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas muat ${(maxPayloadBytes / (1024 * 1024)).toFixed(0)} MB.`);
            }
            const inspected = await inspectBackupPayload(parsed);
            const mode = document.getElementById('restore-mode')?.value || 'merge';
            hideProgress();

            const modeText = mode === 'replace'
                ? 'GANTI DATA APLIKASI: kelompok data SIMNI saat ini akan diganti oleh isi backup.'
                : 'GABUNGKAN AMAN: data dengan ID sama diperbarui, sedangkan data lain tidak dihapus.';
            const targetText = window.SIMNIDatabaseTarget?.mode === 'emulator'
                ? 'TARGET: FIREBASE EMULATOR LOKAL (produksi terkunci)'
                : `TARGET: FIREBASE PRODUKSI ${window.firebaseConfig?.projectId || ''}`;
            const approved = window.confirm(`Backup terverifikasi.\n\n${targetText}\n\n${formatSummary(inspected.summary)}\n\nMode: ${modeText}\n\nLanjutkan restore?`);
            if (!approved) return;
            if (mode === 'replace') {
                const typed = window.prompt('Mode ini dapat menghapus data aplikasi yang tidak ada di backup. Ketik PULIHKAN untuk melanjutkan.');
                if (typed !== 'PULIHKAN') {
                    notify('Restore dibatalkan karena konfirmasi tidak cocok.', 'info');
                    return;
                }
            }

            showProgress('Membuat backup pengaman lalu memulihkan data...');
            await restoreParsedBackup(parsed, { mode });
            notify(`Restore ${mode === 'replace' ? 'penggantian' : 'aman'} berhasil. Backup sebelum restore juga telah diunduh.`, 'success');
        } catch (error) {
            console.error(error);
            notify(`Restore gagal: ${error.message}`, 'error');
        } finally {
            hideProgress();
            if (input) input.value = '';
        }
    }

    function toRows(collection) {
        const values = Array.isArray(collection) ? collection : Object.values(collection || {});
        return values.map((row) => {
            if (!row || typeof row !== 'object') return { Nilai: row };
            return Object.fromEntries(Object.entries(row).map(([key, value]) => {
                const cell = value && typeof value === 'object' ? JSON.stringify(value).slice(0, 32000) : value;
                return [key, typeof cell === 'string' && /^[=+\-@]/.test(cell) ? `'${cell}` : cell];
            }));
        });
    }

    async function exportArsipTotalExcel() {
        window.SIMNIAccess.assertFeature('archive', 'export');
    await window.ensureSIMNIVendors?.("xlsx");
        if (!window.XLSX?.utils) return notify('Pustaka Excel belum tersedia. Pastikan aplikasi online lalu muat ulang.', 'error');
        showProgress('Menyusun arsip Excel dan JSON lossless...');
        try {
            const settings = currentSettings();
            const envelope = await buildCurrentEnvelope();
            if (envelope.completeness?.complete !== true || envelope.incompletePaths?.length) {
                throw new Error(`Snapshot Firebase belum lengkap: ${(envelope.incompletePaths || []).join(', ')}`);
            }
            const database = envelope.database;
            const workbook = XLSX.utils.book_new();
            const addSheet = (name, rows) => {
                const data = rows.length ? toRows(rows) : [{ Keterangan: 'Tidak ada data pada tahun buku ini' }];
                const sheet = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
            };

            addSheet('Ringkasan', [
                { Informasi: 'Nama Aplikasi', Nilai: settings.nama_aplikasi || 'SIMNI PWA' },
                { Informasi: 'Kelas', Nilai: settings.nama_kelas || '' },
                { Informasi: 'Tahun Pelajaran', Nilai: settings.tahun_pelajaran || '' },
                { Informasi: 'Waktu Ekspor', Nilai: new Date().toISOString() },
                ...core.summarizeDatabase(database).map((entry) => ({ Informasi: entry.path, Nilai: entry.count }))
            ]);
            addSheet('Identitas', [settings]);
            addSheet('Siswa', toRows(core.getAtPath(database, 'Siswa')));
            addSheet('Presensi', toRows(core.getAtPath(database, 'Presensi')));
            addSheet('Tujuan Pembelajaran', toRows(core.getAtPath(database, 'Mapel_TP')));
            addSheet('Nilai TP', toRows(core.getAtPath(database, 'Nilai_TP')));
            addSheet('Jurnal', toRows(core.getAtPath(database, 'Jurnal')));
            addSheet('Jadwal', toRows(core.getAtPath(database, 'Jadwal')));
            addSheet('Catatan', toRows(core.getAtPath(database, 'Catatan')));
            addSheet('Dokumen', toRows(core.getAtPath(database, 'Dokumen')));
            addSheet('LPS BLP', toRows(core.getAtPath(database, 'LPS/Reports')));
            addSheet('Template LPS BLP', toRows(core.getAtPath(database, 'LPS/Templates')));
            addSheet('LPS Lama', toRows(core.getAtPath(database, 'Data_LPS')));

            const date = new Date().toISOString().slice(0, 10);
            const filename = `SIMNI_Arsip_${core.createFilename({ className: settings.nama_kelas, academicYear: settings.tahun_pelajaran, createdAt: date }, '').replace(/^_+|\.json$/g, '')}.xlsx`;
            const jsonFilename = downloadEnvelope(envelope, 'SIMNI_Arsip_Restore');
            XLSX.writeFile(workbook, filename);
            notify(`Arsip lengkap berhasil dibuat: ${filename} dan ${jsonFilename}. Pilih kembali JSON pada Verifikasi Arsip agar reset dapat diaktifkan.`, 'success');
            return { ok: true, envelope, excelFilename: filename, jsonFilename };
        } catch (error) {
            console.error(error);
            notify(`Ekspor Excel gagal: ${error.message}`, 'error');
            return { ok: false, error };
        } finally {
            hideProgress();
        }
    }

    async function verifyAnnualArchiveFile(event) {
        const input = event?.target;
        const file = input?.files?.[0];
        if (!file) return { ok: false, cancelled: true };
        showProgress('Memverifikasi ulang arsip JSON dan scope tahun buku...');
        try {
            const fileName = (file.name || '').toLowerCase();
            if (!fileName.endsWith('.json')) {
                throw new Error('Format arsip tahunan harus berupa JSON (.json).');
            }
            const maxImportBytes = core.MAX_IMPORT_BYTES || (32 * 1024 * 1024);
            const maxPayloadBytes = core.MAX_FILE_BYTES || (25 * 1024 * 1024);
            if (file.size > maxImportBytes) {
                throw new Error(`Ukuran berkas arsip (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas baca ${(maxImportBytes / (1024 * 1024)).toFixed(0)} MB.`);
            }
            const parsed = JSON.parse(await file.text());
            const payloadBytes = new TextEncoder().encode(JSON.stringify(parsed.database || parsed)).byteLength;
            if (payloadBytes > maxPayloadBytes) {
                throw new Error(`Ukuran data arsip (${(payloadBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas muat ${(maxPayloadBytes / (1024 * 1024)).toFixed(0)} MB.`);
            }
            const integrity = await core.verifyEnvelope(parsed);
            if (!integrity.ok) throw new Error('SHA-256 arsip tidak cocok.');
            core.validateRestoreScope(parsed, currentAccess());
            if (parsed.completeness?.complete !== true || parsed.incompletePaths?.length) {
                throw new Error('Arsip tidak lengkap dan tidak dapat menjadi gate reset.');
            }
            if (typeof window.dbMarkRolloverArchiveReady !== 'function') throw new Error('Repository readiness belum tersedia.');
            const result = await window.dbMarkRolloverArchiveReady({ ...parsed, filename: file.name });
            if (!result?.ok) throw result?.error || new Error('Readiness arsip ditolak database.');
            notify(`Arsip ${file.name} VERIFIED. Workspace siap untuk reset tahun buku.`, 'success');
            return result;
        } catch (error) {
            console.error(error);
            notify(`Verifikasi arsip gagal: ${error.message}`, 'error');
            return { ok: false, error };
        } finally {
            if (input) input.value = '';
            hideProgress();
        }
    }

    function openSubsystemRecoveryGuide() {
        document.getElementById('simni-subsystem-recovery-dialog')?.remove();
        const manifest = core.getSubsystemRecoveryManifest(currentAccess());
        const dialog = document.createElement('dialog');
        dialog.id = 'simni-subsystem-recovery-dialog';
        dialog.style.cssText = 'max-width:680px;width:92%;max-height:85vh;overflow:auto;padding:24px;border-radius:16px;border:1px solid #e2e8f0;';

        const esc = (str) => typeof window.escapeHTML === 'function' ? window.escapeHTML(str) : String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

        const title = document.createElement('h3');
        title.className = 'font-bold text-base mb-2 text-slate-800 dark:text-white';
        title.innerHTML = '<i class="fas fa-shield-alt text-primary mr-2"></i>Panduan Pemulihan Lintas Subsistem SIMNI';

        const intro = document.createElement('p');
        intro.className = 'text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed';
        intro.textContent = 'SIMNI terdiri atas beberapa subsistem penyimpanan terisolasi. Backup JSON mencakup data Akademik & LPS. Subsistem lain (GADM, berkas Cloudinary, dan Draf lokal) memiliki jalur pencadangan dan pemulihan masing-masing.';

        const listContainer = document.createElement('div');
        listContainer.className = 'space-y-3 mb-4';

        for (const [id, sub] of Object.entries(manifest.subsystems)) {
            const card = document.createElement('div');
            card.className = 'p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151515] text-xs space-y-1.5';

            const badgeClass = sub.backupIncluded ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
            const badgeText = sub.backupIncluded ? 'Termasuk di Backup JSON' : 'Pemulihan Terpisah';

            card.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">${esc(sub.name)}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${badgeText}</span>
                </div>
                <div class="text-slate-500 dark:text-slate-400 text-[11px]"><span class="font-semibold">Lokasi:</span> ${esc(sub.storageLocation)}</div>
                <div class="text-slate-600 dark:text-slate-300"><span class="font-semibold">Mekanisme:</span> ${esc(sub.backupMechanism)}</div>
                <div class="text-slate-700 dark:text-slate-200 bg-white dark:bg-black p-2 rounded-lg border border-slate-200 dark:border-slate-800"><span class="font-semibold text-primary">Prosedur Pemulihan:</span> ${esc(sub.recoveryProcedure)}</div>
            `;
            listContainer.append(card);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'w-full py-2.5 bg-slate-800 dark:bg-[#222222] hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer';
        closeBtn.textContent = 'Tutup Panduan';
        closeBtn.onclick = () => { dialog.close(); dialog.remove(); };

        dialog.append(title, intro, listContainer, closeBtn);
        document.body.append(dialog);
        dialog.showModal();
    }

    Object.assign(window, { exportDataLokal, importDataLokal, exportArsipTotalExcel, verifyAnnualArchiveFile, openSubsystemRecoveryGuide });
    window.SIMNIBackup = Object.freeze({
        buildCurrentEnvelope,
        gatherDatabase,
        inspectBackupPayload,
        restoreParsedBackup,
        readDatabasePaths,
        verifyRestore,
        openSubsystemRecoveryGuide
    });
}());
