// ==========================================
// FILE: vendor/tesseract/ocr-worker.js
// Dedicated Web Worker untuk SIMNI Lens OCR
// 100% Offline, Zero External CDN, Non-blocking
// ==========================================

/* global importScripts, Tesseract */

let workerInstance = null;

async function initTesseract() {
    if (!workerInstance) {
        self.postMessage({ type: 'STATUS', message: 'Memuat modul OCR lokal...' });

        if (typeof Tesseract === 'undefined') {
            importScripts('./tesseract.min.js');
        }

        workerInstance = await Tesseract.createWorker('ind', 1, {
            workerPath: './worker.min.js',
            corePath: './tesseract-core.wasm.js',
            langPath: './',
            cachePath: './',
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    self.postMessage({
                        type: 'PROGRESS',
                        progress: Math.round((m.progress || 0) * 100)
                    });
                }
            }
        });
    }
    return workerInstance;
}

self.onmessage = async (e) => {
    const { type, imageBitmap, imageData } = e.data || {};

    if (type === 'SCAN_IMAGE') {
        try {
            const worker = await initTesseract();
            self.postMessage({ type: 'STATUS', message: 'Menganalisis teks dokumen...' });

            const target = imageBitmap || imageData;
            if (!target) throw new Error('Data gambar tidak valid.');

            const result = await worker.recognize(target);
            const text = result?.data?.text || '';

            self.postMessage({
                type: 'SUCCESS',
                rawText: text
            });
        } catch (err) {
            self.postMessage({
                type: 'ERROR',
                message: err?.message || 'Gagal memproses gambar.'
            });
        }
    }
};
