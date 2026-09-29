'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  fps?: number;
  qrbox?: number;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, fps = 10, qrbox = 250 }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'simni-qr-reader-viewport';

  const startScanner = async () => {
    setErrorMsg(null);
    try {
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps, qrbox },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {
          // ignore frame errors (frame doesn't contain QR)
        }
      );
      setIsScanning(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Izin kamera ditolak atau kamera tidak ditemukan.';
      setErrorMsg(msg);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Gagal mematikan scanner:', err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-black aspect-video flex items-center justify-center border border-slate-700">
        <div id={elementId} className="w-full h-full" />
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900/90 p-4 text-center">
            <Camera className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Kamera dalam kondisi mati.</p>
            <p className="text-[10px] text-slate-500 mt-1">Nyalakan kamera untuk mulai memindai QR code.</p>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        {!isScanning ? (
          <Button variant="primary" size="sm" onClick={startScanner}>
            <Camera className="w-4 h-4 mr-1.5" /> Nyalakan Kamera Pemindai
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={stopScanner}>
            <CameraOff className="w-4 h-4 mr-1.5" /> Matikan Kamera
          </Button>
        )}
      </div>
    </div>
  );
};
