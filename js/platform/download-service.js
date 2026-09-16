// ==========================================
// FILE: js/platform/download-service.js
// FUNGSI:
// Layanan terpadu ekspor/unduh file SIMNI.
//
// Strategi:
// 1. Jika runtime mendeteksi Capacitor Native (Android):
//    - Menggunakan @capacitor/filesystem untuk menulis file ke cache/document
//    - Menggunakan @capacitor/share untuk memunculkan native Android share/save sheet
// 2. Jika di Web / Browser PWA:
//    - Fallback ke standar browser: createObjectURL + <a download> click.
// ==========================================

'use strict';

(function initSIMNIDownloadService() {
    async function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function downloadBlob(blob, filename) {
        const access = window.SIMNICurrentAccess;
        if (!access || (access.role !== 'superuser' && access.permissions?.export !== true)) {
            throw new Error('Ekspor belum diizinkan oleh superuser.');
        }
        if (!blob || !filename) {
            throw new Error('Blob dan nama file wajib disertakan untuk unduhan.');
        }

        const isNative = typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function'
            ? window.Capacitor.isNativePlatform()
            : false;

        const hasFilesystem = Boolean(window.Capacitor?.Plugins?.Filesystem);
        const hasShare = Boolean(window.Capacitor?.Plugins?.Share);

        // Native Android Bridge via Capacitor Filesystem + Share Sheet
        if (isNative && hasFilesystem) {
            try {
                const base64Data = await blobToBase64(blob);
                const writeResult = await window.Capacitor.Plugins.Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: 'CACHE'
                });

                if (hasShare && writeResult?.uri) {
                    await window.Capacitor.Plugins.Share.share({
                        title: filename,
                        text: `Unduhan dokumen SIMNI: ${filename}`,
                        url: writeResult.uri,
                        dialogTitle: 'Buka atau Simpan Dokumen'
                    });
                    return { ok: true, native: true, uri: writeResult.uri };
                }
            } catch (nativeError) {
                console.warn('[SIMNI Download] Native save/share gagal, mencoba fallback browser:', nativeError);
            }
        }

        // Standard Web Fallback
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        return { ok: true, native: false };
    }

    window.SIMNIDownloadService = Object.freeze({
        downloadBlob,
        blobToBase64
    });
})();
