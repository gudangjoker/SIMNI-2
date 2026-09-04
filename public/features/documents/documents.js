// ==========================================
// FILE: features/documents/documents.js
// FUNGSI:
// Gudang Dokumen/LKPD dengan lifecycle Cloudinary + Firebase
// terverifikasi dan backend-authoritative.
// ==========================================

(function initSIMNIDocuments() {
    'use strict';

    const TABS = Object.freeze({
        ADMIN:
            'Administrasi',

        LKPD:
            'LKPD'
    });

    const MAX_CLIENT_FILE_BYTES =
        5 * 1024 * 1024;

    const runtime = {
        uploading:
            false,

        deletingIds:
            new Set(),

        lastOperation:
            null
    };

    function byId(
        id
    ) {
        return document.getElementById(
            id
        );
    }

    function requireDocumentsAccess() {
        if (
            window.SIMNIAccess
                ?.canAccess('documents') ===
            true
        ) {
            return true;
        }

        window.toast?.(
            'Role Anda tidak memiliki akses Dokumen/File.',
            'error'
        );

        return false;
    }

    function assertDocumentsAccess() {
        if (
            !requireDocumentsAccess()
        ) {
            throw new Error(
                'Akses Dokumen/File ditolak.'
            );
        }

        const access =
            window.SIMNICurrentAccess;

        if (
            !access?.uid ||
            !access?.workspaceId ||
            !access?.activeAcademicYearId ||
            access.status !==
                'active'
        ) {
            throw new Error(
                'Scope Dokumen belum siap.'
            );
        }

        return access;
    }

    function normalizeTab(
        tab
    ) {
        const value =
            String(
                tab || ''
            ).trim();

        if (
            value ===
            TABS.ADMIN ||
            value ===
            TABS.LKPD
        ) {
            return value;
        }

        return TABS.ADMIN;
    }

    function currentTab() {
        const existing =
            window.state
                ?.docTabActive;

        return normalizeTab(
            existing
        );
    }

    function documentCollection() {
        return Array.isArray(
            window.state
                ?.dokumen
        )
            ? window.state.dokumen
            : [];
    }

    function documentId(
        documentRecord
    ) {
        return String(
            documentRecord
                ?.ID_Dokumen ||
            documentRecord
                ?.Id_doc ||
            ''
        ).trim();
    }

    function safeDocumentId(
        value
    ) {
        if (
            typeof window.safeFirebaseKey ===
            'function'
        ) {
            return window.safeFirebaseKey(
                value,
                'ID dokumen'
            );
        }

        const id =
            String(
                value || ''
            ).trim();

        if (
            !id ||
            /[.#$\/\[\]]/.test(
                id
            )
        ) {
            throw new Error(
                'ID dokumen tidak valid.'
            );
        }

        return id;
    }

    function createDocumentId() {
        if (
            globalThis.crypto &&
            typeof globalThis.crypto
                .randomUUID ===
                'function'
        ) {
            return (
                'DOC-' +
                globalThis.crypto
                    .randomUUID()
            );
        }

        const random =
            Math.random()
                .toString(36)
                .slice(2);

        return (
            `DOC-${Date.now()}-${random}`
        );
    }

    function safeHTTPS(
        value
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (!raw) {
            return '';
        }

        try {
            const parsed =
                new URL(
                    raw
                );

            return parsed.protocol ===
                'https:'
                ? parsed.href
                : '';
        } catch (_) {
            return '';
        }
    }

    function cloudinaryDownloadURL(
        url
    ) {
        const safe =
            safeHTTPS(
                url
            );

        if (!safe) {
            return '';
        }

        if (
            safe.includes(
                '/upload/'
            )
        ) {
            return safe.replace(
                '/upload/',
                '/upload/fl_attachment/'
            );
        }

        return safe;
    }

    function documentIcon(
        format
    ) {
        const value =
            String(
                format || ''
            )
                .trim()
                .toLowerCase();

        if (
            value ===
            'pdf'
        ) {
            return {
                icon:
                    'fa-file-pdf',

                color:
                    'text-red-500'
            };
        }

        if (
            [
                'doc',
                'docx'
            ].includes(
                value
            )
        ) {
            return {
                icon:
                    'fa-file-word',

                color:
                    'text-blue-500'
            };
        }

        if (
            [
                'xls',
                'xlsx'
            ].includes(
                value
            )
        ) {
            return {
                icon:
                    'fa-file-excel',

                color:
                    'text-emerald-500'
            };
        }

        if (
            [
                'jpg',
                'jpeg',
                'png',
                'webp',
                'gif'
            ].includes(
                value
            )
        ) {
            return {
                icon:
                    'fa-image',

                color:
                    'text-purple-500'
            };
        }

        return {
            icon:
                'fa-file-alt',

            color:
                'text-slate-500'
        };
    }

    function setTabButtonState(
        button,
        active
    ) {
        if (!button) {
            return;
        }

        button.className =
            [
                'px-4',
                'py-2',
                'border-b-2',
                'text-sm',
                'font-bold',
                active
                    ? 'border-primary'
                    : 'border-transparent',
                active
                    ? 'text-primary'
                    : 'text-slate-500'
            ].join(' ');

        button.setAttribute(
            'aria-selected',
            String(
                active
            )
        );
    }

    function setUploadButtonState() {
        const button =
            byId(
                'btn-upload-murni'
            );

        if (!button) {
            return;
        }

        button.disabled =
            runtime.uploading;

        const icon =
            document.createElement(
                'i'
            );

        icon.className =
            runtime.uploading
                ? 'fas fa-spinner fa-spin'
                : 'fas fa-upload';

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        button.replaceChildren(
            icon,
            document.createTextNode(
                runtime.uploading
                    ? ' Mengunggah...'
                    : ' Mulai Unggah File'
            )
        );
    }

    function renderDocumentsUI() {
        if (
            !window.SIMNIAccess
                ?.canAccess('documents')
        ) {
            return;
        }

        const tab =
            currentTab();

        setTabButtonState(
            byId(
                'tab-admin'
            ),
            tab ===
                TABS.ADMIN
        );

        setTabButtonState(
            byId(
                'tab-lkpd'
            ),
            tab ===
                TABS.LKPD
        );

        setUploadButtonState();

        renderDokumenList();
    }

    function createEmptyState() {
        const empty =
            document.createElement(
                'div'
            );

        empty.className =
            'col-span-full text-center p-8 text-slate-400';

        empty.textContent =
            'Gudang kosong. Belum ada dokumen yang diunggah.';

        return empty;
    }

    function createActionLink({
        url,
        label,
        iconClass,
        className,
        download =
            false
    }) {
        const link =
            document.createElement(
                'a'
            );

        link.href =
            url;

        link.rel =
            'noopener noreferrer';

        if (!download) {
            link.target =
                '_blank';
        }

        link.className =
            className;

        const icon =
            document.createElement(
                'i'
            );

        icon.className =
            `${iconClass} mr-1`;

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        link.append(
            icon,
            document.createTextNode(
                ` ${label}`
            )
        );

        return link;
    }

    function createDocumentCard(
        documentRecord
    ) {
        const id =
            safeDocumentId(
                documentId(
                    documentRecord
                )
            );

        const format =
            String(
                documentRecord
                    ?.format ||
                'file'
            )
                .trim()
                .toLowerCase();

        const iconMeta =
            documentIcon(
                format
            );

        const url =
            safeHTTPS(
                documentRecord
                    ?.url_file
            );

        const downloadUrl =
            cloudinaryDownloadURL(
                url
            );

        const card =
            document.createElement(
                'div'
            );

        card.className =
            'bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-shadow';

        card.dataset.docId =
            id;

        const header =
            document.createElement(
                'div'
            );

        header.className =
            'flex items-start gap-4';

        const iconBox =
            document.createElement(
                'div'
            );

        iconBox.className =
            `w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 bg-slate-50 dark:bg-black border border-slate-100 dark:border-slate-700 ${iconMeta.color}`;

        const icon =
            document.createElement(
                'i'
            );

        icon.className =
            `fas ${iconMeta.icon}`;

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        iconBox.appendChild(
            icon
        );

        const metadata =
            document.createElement(
                'div'
            );

        metadata.className =
            'flex-1 overflow-hidden';

        const title =
            document.createElement(
                'h4'
            );

        title.className =
            'font-bold text-sm truncate pr-2 text-slate-800 dark:text-slate-200';

        title.textContent =
            String(
                documentRecord
                    ?.nama_file ||
                'Tanpa Nama'
            );

        const mapel =
            document.createElement(
                'p'
            );

        mapel.className =
            'text-[10px] text-primary font-bold uppercase mt-1 tracking-wider';

        mapel.textContent =
            String(
                documentRecord
                    ?.mapel ||
                ''
            );

        const formatLabel =
            document.createElement(
                'p'
            );

        formatLabel.className =
            'text-[10px] text-slate-400 uppercase mt-0.5';

        formatLabel.textContent =
            format;

        metadata.append(
            title,
            mapel,
            formatLabel
        );

        header.append(
            iconBox,
            metadata
        );

        const actions =
            document.createElement(
                'div'
            );

        actions.className =
            'flex border-t border-slate-100 dark:border-slate-800 pt-3 gap-2';

        if (url) {
            actions.appendChild(
                createActionLink({
                    url,

                    label:
                        'View',

                    iconClass:
                        'fas fa-eye',

                    className:
                        'flex-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold text-center'
                })
            );
        } else {
            const invalid =
                document.createElement(
                    'span'
                );

            invalid.className =
                'flex-1 py-2 text-xs text-center text-slate-400';

            invalid.textContent =
                'URL tidak valid';

            actions.appendChild(
                invalid
            );
        }

        if (downloadUrl) {
            actions.appendChild(
                createActionLink({
                    url:
                        downloadUrl,

                    label:
                        'Unduh',

                    iconClass:
                        'fas fa-download',

                    className:
                        'flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold text-center',

                    download:
                        true
                })
            );
        }

        const deleteButton =
            document.createElement(
                'button'
            );

        deleteButton.type =
            'button';

        deleteButton.className =
            'doc-delete-button py-2 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold';

        deleteButton.dataset.docId =
            id;

        const deleting =
            runtime.deletingIds.has(
                id
            );

        deleteButton.disabled =
            deleting;

        const deleteIcon =
            document.createElement(
                'i'
            );

        deleteIcon.className =
            deleting
                ? 'fas fa-spinner fa-spin'
                : 'fas fa-trash';

        deleteIcon.setAttribute(
            'aria-hidden',
            'true'
        );

        deleteButton.appendChild(
            deleteIcon
        );

        deleteButton.setAttribute(
            'aria-label',
            deleting
                ? `Sedang menghapus ${title.textContent}`
                : `Hapus ${title.textContent}`
        );

        deleteButton.addEventListener(
            'click',
            (event) => {
                void hapusDokumen(
                    event,
                    id
                );
            }
        );

        actions.appendChild(
            deleteButton
        );

        card.append(
            header,
            actions
        );

        return card;
    }

    function renderDokumenList() {
        if (
            window.SIMNIAccess
                ?.canAccess('documents') !==
            true
        ) {
            return;
        }

        const grid =
            byId(
                'dokumen-grid'
            );

        if (!grid) {
            return;
        }

        const tab =
            currentTab();

        const filtered =
            documentCollection()
                .filter(
                    (item) =>
                        item?.kategori ===
                        tab
                )
                .sort(
                    (
                        left,
                        right
                    ) => {
                        const leftTime =
                            Date.parse(
                                String(
                                    left?.createdAt ||
                                    ''
                                )
                            ) || 0;

                        const rightTime =
                            Date.parse(
                                String(
                                    right?.createdAt ||
                                    ''
                                )
                            ) || 0;

                        return (
                            rightTime -
                            leftTime
                        );
                    }
                );

        grid.replaceChildren();

        if (
            !filtered.length
        ) {
            grid.appendChild(
                createEmptyState()
            );

            return;
        }

        const fragment =
            document.createDocumentFragment();

        for (
            const documentRecord
            of filtered
        ) {
            try {
                fragment.appendChild(
                    createDocumentCard(
                        documentRecord
                    )
                );
            } catch (error) {
                console.error(
                    '[SIMNI Documents] Record dokumen tidak dapat dirender:',
                    documentRecord,
                    error
                );
            }
        }

        if (
            !fragment
                .childNodes
                .length
        ) {
            grid.appendChild(
                createEmptyState()
            );

            return;
        }

        grid.appendChild(
            fragment
        );
    }

    function setDokumenTab(
        tab
    ) {
        if (
            !requireDocumentsAccess()
        ) {
            return false;
        }

        const normalized =
            normalizeTab(
                tab
            );

        if (
            window.state &&
            typeof window.state ===
                'object'
        ) {
            window.state.docTabActive =
                normalized;
        }

        renderDocumentsUI();

        return true;
    }

    function validateDocumentFile(
        file
    ) {
        if (!file) {
            throw new Error(
                'Pilih file terlebih dahulu.'
            );
        }

        const bytes =
            Number(
                file.size
            );

        if (
            !Number.isFinite(
                bytes
            ) ||
            bytes <= 0
        ) {
            throw new Error(
                'Ukuran file tidak valid.'
            );
        }

        if (
            bytes >
            MAX_CLIENT_FILE_BYTES
        ) {
            throw new Error(
                'Maksimal ukuran file 5 MB.'
            );
        }

        if (
            !String(
                file.type ||
                ''
            ).trim()
        ) {
            throw new Error(
                'Tipe file tidak dapat dikenali.'
            );
        }

        return file;
    }

    function formPayload() {
        const category =
            normalizeTab(
                byId(
                    'input-doc-kat'
                )?.value
            );

        const mapel =
            String(
                byId(
                    'input-doc-mapel'
                )?.value ||
                ''
            ).trim();

        const name =
            String(
                byId(
                    'input-doc-nama'
                )?.value ||
                ''
            ).trim();

        if (!name) {
            throw new Error(
                'Nama dokumen wajib diisi.'
            );
        }

        return {
            category,
            mapel,
            name
        };
    }

    async function loadCloudinary() {
        const module =
            await import(
                '../../js/database/cloudinary-client.js'
            );

        const cloud =
            module.default ||
            window.SIMNICloudinary;

        if (
            !cloud ||
            typeof cloud
                .uploadDocument !==
                'function'
        ) {
            throw new Error(
                'Cloudinary document provider belum siap.'
            );
        }

        return cloud;
    }

    async function cleanupUploadedDocument(
        uploaded
    ) {
        if (
            !uploaded
                ?.public_id
        ) {
            return;
        }

        try {
            const cloud =
                await loadCloudinary();

            await cloud
                .deleteCloudinaryAsset(
                    uploaded.public_id,
                    uploaded.resource_type ||
                    'raw',
                    'document'
                );
        } catch (error) {
            console.error(
                '[SIMNI Documents] Compensation Cloudinary gagal:',
                error
            );
        }
    }

    async function submitDokumenMurni(
        event
    ) {
        event?.preventDefault?.();

        if (
            runtime.uploading
        ) {
            return false;
        }

        let uploaded =
            null;

        try {
            assertDocumentsAccess();

            const file =
                validateDocumentFile(
                    byId(
                        'input-doc-file'
                    )
                        ?.files
                        ?.[0]
                );

            const {
                category,
                mapel,
                name
            } =
                formPayload();

            runtime.uploading =
                true;

            runtime.lastOperation = {
                type:
                    'upload',

                status:
                    'running',

                startedAt:
                    new Date()
                        .toISOString()
            };

            renderDocumentsUI();

            window.showLoad?.(
                'Mengunggah dokumen ke Cloudinary...'
            );

            const cloud =
                await loadCloudinary();

            uploaded =
                await cloud
                    .uploadDocument(
                        file
                    );

            const id =
                safeDocumentId(
                    createDocumentId()
                );

            const extension =
                String(
                    file.name ||
                    ''
                )
                    .split('.')
                    .pop()
                    ?.toLowerCase() ||
                'file';

            const payload = {
                Id_doc:
                    id,

                ID_Dokumen:
                    id,

                kategori:
                    category,

                mapel,

                nama_file:
                    name,

                format:
                    String(
                        uploaded.format ||
                        extension
                    )
                        .trim()
                        .toLowerCase(),

                url_file:
                    safeHTTPS(
                        uploaded.secure_url
                    ),

                public_id:
                    String(
                        uploaded.public_id ||
                        ''
                    ).trim(),

                resource_type:
                    String(
                        uploaded.resource_type ||
                        'raw'
                    )
                        .trim()
                        .toLowerCase(),

                bytes:
                    Number(
                        uploaded.bytes ||
                        file.size
                    ),

                createdAt:
                    new Date()
                        .toISOString()
            };

            if (
                !payload.url_file
            ) {
                throw new Error(
                    'URL hasil upload Cloudinary tidak valid.'
                );
            }

            if (
                !payload.public_id
            ) {
                throw new Error(
                    'Cloudinary tidak mengembalikan public_id.'
                );
            }

            if (
                typeof window.dbSet !==
                'function'
            ) {
                throw new Error(
                    'Database repository belum siap.'
                );
            }

            const result =
                await window.dbSet(
                    `Dokumen/${id}`,
                    payload
                );

            if (!result?.ok) {
                throw (
                    result?.error ||
                    new Error(
                        'Metadata dokumen gagal disimpan.'
                    )
                );
            }

            runtime.lastOperation = {
                type:
                    'upload',

                status:
                    'success',

                documentId:
                    id,

                completedAt:
                    new Date()
                        .toISOString()
            };

            window.state.dokumen = documentCollection()
                .filter((item) => documentId(item) !== id)
                .concat(payload);

            renderDocumentsUI();

            window.closeModal?.(
                'modal-form-dokumen'
            );

            event
                ?.target
                ?.reset?.();

            window.toast?.(
                'Berhasil disimpan: dokumen telah diunggah.',
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Documents] Upload dokumen gagal:',
                error
            );

            if (
                uploaded
                    ?.public_id
            ) {
                await cleanupUploadedDocument(
                    uploaded
                );
            }

            runtime.lastOperation = {
                type:
                    'upload',

                status:
                    'failed',

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            window.toast?.(
                `Gagal unggah: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime.uploading =
                false;

            renderDocumentsUI();

            window.hideLoad?.();
        }
    }

    async function hapusDokumen(
        event,
        id
    ) {
        event
            ?.stopPropagation?.();

        let safeId;

        try {
            assertDocumentsAccess();

            safeId =
                safeDocumentId(
                    id
                );
        } catch (error) {
            window.toast?.(
                error.message,
                'error'
            );

            return false;
        }

        if (
            runtime
                .deletingIds
                .has(
                    safeId
                )
        ) {
            return false;
        }

        const documentRecord =
            documentCollection()
                .find(
                    (item) =>
                        documentId(
                            item
                        ) ===
                        safeId
                );

        if (!documentRecord) {
            window.toast?.(
                'Dokumen tidak ditemukan pada state aktif.',
                'error'
            );

            return false;
        }

        if (
            !window.confirm(
                [
                    `Hapus dokumen "${documentRecord.nama_file || safeId}"?`,
                    '',
                    'File Cloudinary dan metadata database akan dihapus melalui server.',
                    'Operasi ini permanen.'
                ].join('\n')
            )
        ) {
            return false;
        }

        runtime
            .deletingIds
            .add(
                safeId
            );

        runtime.lastOperation = {
            type:
                'delete',

            status:
                'running',

            documentId:
                safeId,

            startedAt:
                new Date()
                    .toISOString()
        };

        renderDocumentsUI();

        window.showLoad?.(
            'Menghapus dokumen dari cloud dan database...'
        );

        try {
            const removeResult = await window.dbRemove(`Dokumen/${safeId}`);
            if (!removeResult?.ok) throw removeResult?.error || new Error('Metadata dokumen gagal dihapus.');
            if (documentRecord.public_id) {
                const cloud = await loadCloudinary();
                await cloud.deleteCloudinaryAsset(
                    documentRecord.public_id,
                    documentRecord.resource_type || 'raw',
                    'document'
                );
            }
            const result = { ok: true, deleted: true };

            runtime.lastOperation = {
                type:
                    'delete',

                status:
                    'success',

                documentId:
                    safeId,

                deleted:
                    result.deleted !==
                    false,

                operationId:
                    result.operationId ||
                    null,

                completedAt:
                    new Date()
                        .toISOString()
            };

            window.toast?.(
                result.deleted ===
                    false
                    ? 'Dokumen sudah tidak tersedia.'
                    : 'Dokumen berhasil dihapus.',
                'success'
            );

            return true;
        } catch (error) {
            console.error(
                '[SIMNI Documents] Delete dokumen gagal:',
                error
            );

            runtime.lastOperation = {
                type:
                    'delete',

                status:
                    'failed',

                documentId:
                    safeId,

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    String(
                        error?.message ||
                        error
                    )
            };

            window.toast?.(
                `Gagal hapus dokumen: ${error.message || error}`,
                'error'
            );

            return false;
        } finally {
            runtime
                .deletingIds
                .delete(
                    safeId
                );

            renderDocumentsUI();

            window.hideLoad?.();
        }
    }

    function getDocumentsRuntimeSnapshot() {
        return {
            uploading:
                runtime.uploading,

            deletingIds:
                [
                    ...runtime
                        .deletingIds
                ],

            activeTab:
                currentTab(),

            lastOperation:
                runtime.lastOperation
                    ? {
                        ...runtime
                            .lastOperation
                    }
                    : null
        };
    }

    Object.assign(
        window,
        {
            setDokumenTab,

            renderDokumenList,

            submitDokumenMurni,

            hapusDokumen,

            renderDocumentsUI
        }
    );

    window.SIMNIDocuments =
        Object.freeze({
            setTab:
                setDokumenTab,

            render:
                renderDocumentsUI,

            upload:
                submitDokumenMurni,

            remove:
                hapusDokumen,

            getRuntimeSnapshot:
                getDocumentsRuntimeSnapshot
        });

    if (
        window.state &&
        typeof window.state ===
            'object'
    ) {
        window.state.docTabActive =
            normalizeTab(
                window.state
                    .docTabActive
            );
    }
}());
