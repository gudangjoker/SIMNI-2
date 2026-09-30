'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { QRScanner } from '@/components/ui/QRScanner';
import { playSuccessBeep } from '@/lib/utils/audio';
import { ArrowLeft, CheckCircle2, QrCode, AlertTriangle } from 'lucide-react';

const AVAILABLE_SLOTS = [
  { id: '1A', label: 'Guru Kelas 1A' },
  { id: '1B', label: 'Guru Kelas 1B' },
  { id: '2A', label: 'Guru Kelas 2A' },
  { id: '2B', label: 'Guru Kelas 2B' },
  { id: '3A', label: 'Guru Kelas 3A' },
  { id: '3B', label: 'Guru Kelas 3B' },
  { id: '4A', label: 'Guru Kelas 4A' },
  { id: '4B', label: 'Guru Kelas 4B' },
  { id: '5A', label: 'Guru Kelas 5A' },
  { id: '5B', label: 'Guru Kelas 5B' },
  { id: '6A', label: 'Guru Kelas 6A' },
  { id: '6B', label: 'Guru Kelas 6B' },
  { id: 'PJOK', label: 'Guru Bidang Studi - PJOK' },
  { id: 'PAI', label: 'Guru Bidang Studi - PAI (Pendidikan Agama Islam)' },
  { id: 'Bahasa Inggris', label: 'Guru Bidang Studi - Bahasa Inggris' },
  { id: 'Bahasa Arab', label: 'Guru Bidang Studi - Bahasa Arab' },
  { id: 'Komputer', label: 'Guru Bidang Studi - Komputer / Informatika' }
];

export default function RegisterPage() {
  const [slot, setSlot] = useState('1A');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Status Switch Buka / Tutup Pendaftaran dari Superuser
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  // QR Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simni_registration_open');
      if (saved !== null) {
        setIsRegistrationOpen(saved === 'true');
      }
    }
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    const trimmed = decodedText.trim();
    if (!trimmed) return;

    playSuccessBeep();
    setCode(trimmed);

    // Auto-detect slot from token format: INV-XXXXXX-SLOT
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      const detected = parts.slice(2).join('-').trim();
      const match = AVAILABLE_SLOTS.find(
        (s) => s.id.toUpperCase() === detected.toUpperCase() || detected.toUpperCase().includes(s.id.toUpperCase())
      );
      if (match) {
        setSlot(match.id);
      }
    }

    setScanNotice(`QR Token terdeteksi: ${trimmed}`);
    setIsScannerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegistrationOpen) return;
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl">
        <div className="mb-6">
          <Link href="/login" className="inline-flex items-center text-xs text-slate-400 hover:text-white gap-1 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
          </Link>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">Pendaftaran Akun Guru</h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isRegistrationOpen
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {isRegistrationOpen ? 'PORTAL TERBUKA' : 'PORTAL DITUTUP'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Aktivasi akun menggunakan kode undangan dari Superuser.</p>
        </div>

        {/* Banner Jika Pendaftaran Ditutup */}
        {!isRegistrationOpen && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Pendaftaran Guru Sedang Ditutup</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5 leading-relaxed">
                Superuser telah menonaktifkan sementara pembukaan akun baru. Silakan hubungi operator sekolah untuk informasi aktivasi.
              </p>
            </div>
          </div>
        )}

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Penugasan Jabatan / Rombel</label>
              <select
                value={slot}
                disabled={!isRegistrationOpen}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"
              >
                <optgroup label="Guru Kelas (Wali Kelas)">
                  {AVAILABLE_SLOTS.slice(0, 12).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Guru Bidang Studi (Spesialis)">
                  {AVAILABLE_SLOTS.slice(12).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <Input
              label="Nama Lengkap & Gelar"
              placeholder="Contoh: Budi Santoso, S.Pd."
              value={name}
              disabled={!isRegistrationOpen}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Alamat Email"
              type="email"
              placeholder="guru@sditbm.sch.id"
              value={email}
              disabled={!isRegistrationOpen}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Kode Undangan (One-Time Token)
                </label>
                {isRegistrationOpen && (
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3 h-3" /> Scan QR Undangan
                  </button>
                )}
              </div>
              <Input
                placeholder="Masukkan atau scan kode token"
                value={code}
                disabled={!isRegistrationOpen}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              {scanNotice && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> {scanNotice}
                </p>
              )}
            </div>

            <Input
              label="Kata Sandi Akun"
              type="password"
              placeholder="Minimal 12 karakter"
              value={password}
              disabled={!isRegistrationOpen}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={!isRegistrationOpen}
            >
              {isRegistrationOpen ? 'Kirim Permohonan Akses' : 'Pendaftaran Dinonaktifkan'}
            </Button>
          </form>
        ) : (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Permohonan Terkirim</h3>
            <p className="text-xs text-slate-400">
              Pendaftaran Anda untuk penugasan <strong>{AVAILABLE_SLOTS.find(s => s.id === slot)?.label || slot}</strong> telah diteruskan ke antrean persetujuan Superuser. Anda akan menerima notifikasi email setelah akun disetujui.
            </p>
            <Link href="/login" className="inline-block w-full">
              <Button variant="outline" className="w-full">
                Ke Halaman Masuk
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Modal Scanner QR Undangan Guru */}
      <Modal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title="Pindai QR Token Undangan"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400 dark:text-zinc-400">
            Arahkan kamera ke QR Code undangan yang diberikan oleh Superuser sekolah. Kode token akan terisi secara otomatis disertai nada beep verifikasi.
          </p>

          <QRScanner onScanSuccess={handleScanSuccess} />

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsScannerOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
