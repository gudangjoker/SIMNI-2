// ==========================================
// FILE: js/ui/actions.js
// Delegasi event deklaratif tanpa inline JavaScript.
// ==========================================

(function installSIMNIActionDispatcher(root) {
    'use strict';

    const ALLOWED_ACTIONS = new Set([
        'addLPSBuilderSection',
        'bukaRevisiLPS',
        'cetakBukuInduk',
        'cetakCatatanPDF',
        'cetakJurnalPDF',
        'cetakLPS',
        'cetakRekapPresensiPDF',
        'checkJurnalDateChange',
        'closeLPSPreview',
        'exportExcelLPS',
        'changeSIMNIAccount',
        'closeMenuDrawer',
        'closeModal',
        'commitSiswaImport',
        'commitTPImport',
        'deleteCatatan',
        'closeQRScanner',
        'createAnnualArchiveCloud',
        'createSIMNIInvitation',
        'editSiswa',
        'exportArsipTotalExcel',
        'exportDataLokal',
        'exportSiswaExcel',
        'finalisasiLPS',
        'generatePrintQR',
        'goToProfile',
        'hapusLogo',
        'hapusSiswaPaten',
        'importDataLokal',
        'importSiswaExcel',
        'importTPExcel',
        'jumpToBukuInduk',
        'jumpToPresensi',
        'loadSiswaLPS',
        'openAddSiswaModal',
        'openEditTPModal',
        'openMenuDrawer',
        'openModal',
        'openLocalStorageManager',
        'openSubsystemRecoveryGuide',
        'openAnnualArchiveManager',
        'openGrantedAcademicArchives',
        'openModalPengaturanLPS',
        'openQRScanner',
        'openSIMNILens',
        'closeSIMNILens',
        'captureLensFrameToRAM',
        'restartLensCapture',
        'batchInsertScannedTP',
        'handleLensGalleryFile',
        'rotateLens90',
        'toggleNewBabInput',
        'saveNewBabFromInput',
        'submitEditTP',
        'deleteTPEditModal',
        'updateEditTPBabOptions',
        'populateLPSFilter',
        'previewLPS',
        'refreshSIMNIAccounts',
        'renderBukuInduk',
        'renderCatatanList',
        'renderNilaiGrid',
        'renderPresensiManual',
        'renderRekapJurnal',
        'renderRekapNilai',
        'showRekapNilai',
        'unduhRekapNilai',
        'invalidateRekapNilai',
        'renderRekapPresensi',
        'renderSiswaList',
        'resetDataJadwal',
        'resetDataMurid',
        'resetDataTP',
        'resetTemplateLPSKeAcuan',
        'salinTemplateLPS',
        'saveJadwalMaster',
        'saveJurnalHarian',
        'saveLPSData',
        'saveNilaiBatch',
        'savePresensiManual',
        'editPresensiManual',
        'saveThemeFromDropdown',
        'sendProfilePasswordReset',
        'setActiveKelas',
        'setCatatanTab',
        'setDokumenTab',
        'setJurnalTab',
        'setNilaiTab',
        'setPresensiTab',
        'setSettingsTab',
        'showSyncStatusInfo',
        'simpanIdentitas',
        'simpanPengaturanLPS',
        'submitCatatan',
        'submitDokumenMurni',
        'submitSiswa',
        'submitTP',
        'startAnnualRollover',
        'switchView',
        'toggleMenuDrawer',
        'togglePasswordVisibility',
        'toast',
        'unduhTemplateExcel',
        'updateCredentials',
        'updateLPSHijriDate',
        'updateRekapTPDropdown',
        'updateStudentTemplateLink',
        'updateTPTemplateLink',
        'updateTPDropdown',
        'uploadStudentPhotoAction',
        'verifyAnnualArchiveFile',
        'gunakanTemplateLPSAktif',
        'logoutAuth',
        'previewPrintRekapNilai',
        'exportTPExcel',
        'previewPrintTP',
        'executePrintTPPreview',
        'executePrintRekapNilaiPreview',
        'previewPrintJurnal',
        'exportJurnalExcel',
        'executePrintJurnalPreview',
        'clearAppCacheAndReload',
        'toggleStudentSelectMode',
        'previewPrintSiswa',
        'toggleSelectAllStudents',
        'openBatchChangeClassModal',
        'openBatchChangeKelompokModal',
        'deleteBatchStudents',
        'clearStudentSelection',
        'executePrintSiswaPreview',
        'commitBatchUpdateStudents'
    ]);

    const SUPPORTED_TRIGGERS = new Set([
        'click',
        'change',
        'keyup',
        'submit'
    ]);

    const BUILT_IN_ACTIONS = new Set([
        'openAttendanceScanner',
        'openStudentsCreate',
        'preventDefault'
    ]);

    function parseArguments(element) {
        const raw = element.dataset.simniArgs;
        if (!raw) return [];
        const values = JSON.parse(raw);
        if (
            !Array.isArray(values) ||
            values.length > 8 ||
            values.some((value) =>
                value !== null &&
                !['string', 'number', 'boolean'].includes(typeof value)
            )
        ) {
            throw new Error('Argumen action deklaratif tidak valid.');
        }
        return values;
    }

    function resolveAction(name) {
        if (!ALLOWED_ACTIONS.has(name)) {
            throw new Error(`Action UI tidak diizinkan: ${name || '-'}.`);
        }
        const action = root[name];
        if (typeof action !== 'function') {
            throw new Error(`Action UI belum tersedia: ${name}.`);
        }
        return action;
    }

    function reportFailure(error) {
        console.error('[SIMNI Actions] Action gagal:', error);
        if (typeof root.toast === 'function') {
            root.toast(error?.message || String(error), 'error');
        }
    }

    async function invoke(element, event) {
        const trigger = String(element.dataset.simniTrigger || '').trim();
        if (!SUPPORTED_TRIGGERS.has(trigger) || trigger !== event.type) return;

        if (trigger === 'submit') event.preventDefault();

        const form = element.tagName === 'FORM' ? element : element.closest('form');
        if (element.dataset.simniProcessing === 'true' || (form && form.dataset.simniProcessing === 'true')) {
            event.preventDefault();
            return;
        }

        const name = String(element.dataset.simniAction || '').trim();
        if (name === 'preventDefault') {
            event.preventDefault();
            return;
        }

        let submitBtn = null;
        if (element.tagName === 'FORM') {
            submitBtn = element.querySelector('button[type="submit"]');
        } else if (element.tagName === 'BUTTON') {
            submitBtn = element;
        } else {
            submitBtn = element.closest('button') || element.querySelector('button');
        }

        try {
            element.dataset.simniProcessing = 'true';
            if (form) form.dataset.simniProcessing = 'true';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }

            const args = parseArguments(element);
            const argumentMode = String(element.dataset.simniArgument || 'none');
            if (argumentMode === 'event') args.push(event);
            else if (argumentMode === 'value') args.push(element.value);
            else if (argumentMode !== 'none') {
                throw new Error(`Mode argumen action tidak valid: ${argumentMode}.`);
            }

            if (name === 'openAttendanceScanner') {
                const switchRes = root.switchView?.('presensi');
                if (switchRes && typeof switchRes.then === 'function') await switchRes;
                const result = root.openQRScanner?.();
                if (result && typeof result.then === 'function') await result;
                return;
            }

            if (name === 'openStudentsCreate') {
                const switchRes = root.switchView?.('siswa');
                if (switchRes && typeof switchRes.then === 'function') await switchRes;
                const result = root.openAddSiswaModal?.();
                if (result && typeof result.then === 'function') await result;
                return;
            }

            const result = resolveAction(name).apply(root, args);
            if (result && typeof result.then === 'function') {
                await result;
            }
        } catch (error) {
            reportFailure(error);
        } finally {
            element.dataset.simniProcessing = 'false';
            if (form) form.dataset.simniProcessing = 'false';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
        }
    }

    for (const trigger of SUPPORTED_TRIGGERS) {
        document.addEventListener(trigger, (event) => {
            const source = trigger === 'click'
                ? event.target?.closest?.('[data-simni-action][data-simni-trigger="click"]')
                : event.target;
            if (!(source instanceof Element)) return;
            invoke(source, event);
        });
    }

    root.togglePasswordVisibility = function togglePasswordVisibility(targetId, eventOrElement) {
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const btn = (eventOrElement?.currentTarget || eventOrElement?.target || eventOrElement)?.closest?.('button')
            || document.querySelector(`[data-simni-action="togglePasswordVisibility"][data-simni-args*="${targetId}"]`);
        const icon = btn?.querySelector?.('i');
        if (icon) {
            icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    };

    root.goToProfile = function goToProfile() {
        if (typeof root.switchView === 'function') {
            root.switchView('pengaturan');
        }
        if (typeof root.setSettingsTab === 'function') {
            root.setSettingsTab('profile');
        }
    };

    root.SIMNIActionDispatcher = Object.freeze({
        actions: Object.freeze([...ALLOWED_ACTIONS, ...BUILT_IN_ACTIONS]),
        triggers: Object.freeze([...SUPPORTED_TRIGGERS])
    });
}(window));
