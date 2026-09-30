'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  Check,
  X,
  ShieldAlert,
  History,
  QrCode,
  Copy,
  ToggleLeft,
  ToggleRight,
  Palette
} from 'lucide-react';
import QRCode from 'qrcode';
import { CABANG_SENI_OPTIONS } from '@/lib/constants/subjects';

export default function AccountsPage() {
  const { toast } = useToast();
  const academicYear = useAppStore((state) => state.academicYear);

  // Switch Buka / Tutup Pendaftaran Guru
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  // Konfigurasi Cabang Seni Dinamis Tahun Ajaran
  const [cabangSeni, setCabangSeni] = useState('Seni Rupa');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedReg = localStorage.getItem('simni_registration_open');
      if (savedReg !== null) {
        setIsRegistrationOpen(savedReg === 'true');
      }

      const savedSeni = localStorage.getItem('simni_cabang_seni');
      if (savedSeni && CABANG_SENI_OPTIONS.includes(savedSeni)) {
        setCabangSeni(savedSeni);
      }
    }
  }, []);

  const toggleRegistrationSwitch = () => {
    const next = !isRegistrationOpen;
    setIsRegistrationOpen(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simni_registration_open', String(next));
    }
    toast(
      next ? 'Portal pendaftaran guru sekarang DIBUKA.' : 'Portal pendaftaran guru sekarang DITUTUP secara manual.',
      next ? 'success' : 'warning'
    );
  };

  const handleChangeCabangSeni = (val: string) => {
    setCabangSeni(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simni_cabang_seni', val);
    }
    toast(
      `Cabang seni tahun ajaran ini disetel menjadi: ${val}. Seluruh modul penilaian dan jurnal telah diselaraskan.`,
      'success'
    );
  };

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteClass, setInviteClass] = useState('1B');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inviteQrDataUrl, setInviteQrDataUrl] = useState<string | null>(null);

  // Mock initial account list dengan guru spesialis
  const [accounts, setAccounts] = useState([
    { uid: 'USR_001', name: 'Unggaran, S.Pd.', email: 'unggaran.sditbm@gmail.com', role: 'Superuser', classId: '3A', status: 'Aktif' },
    { uid: 'USR_002', name: 'Anur Auliya, S.Pd.', email: 'anur.auliya01@gmail.com', role: 'Guru PJOK', classId: 'PJOK', status: 'Aktif' },
    { uid: 'USR_003', name: 'Ahmad Fauzi, S.Pd.', email: 'ahmad.fauzi@guru.sch.id', role: 'Guru Kelas', classId: '1A', status: 'Aktif' },
    { uid: 'USR_004', name: 'Rahmat Hidayat, S.Kom.', email: 'rahmat.komputer@guru.sch.id', role: 'Guru Komputer', classId: 'Komputer', status: 'Aktif' },
    { uid: 'USR_005', name: 'Ustadz Mansyur, S.Pd.I.', email: 'mansyur.pai@guru.sch.id', role: 'Guru PAI', classId: 'PAI', status: 'Aktif' },
    { uid: 'USR_006', name: 'Dewi Lestari, S.Pd.', email: 'dewi.lestari@guru.sch.id', role: 'Guru Kelas', classId: '2A', status: 'Pending Approval' }
  ]);

  const handleGenerateInvite = async () => {
    const cleanSlot = inviteClass.replace(/\s+/g, '');
    const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + cleanSlot;
    setGeneratedCode(code);
    try {
      const url = await QRCode.toDataURL(code, { width: 300, margin: 1, color: { dark: '#1e1b4b', light: '#ffffff' } });
      setInviteQrDataUrl(url);
      toast(`Token undangan dan QR Code untuk ${inviteClass} berhasil dibuat.`, 'success');
    } catch (err) {
      console.warn('Gagal render QR token:', err);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    toast('Kode undangan berhasil disalin ke clipboard.', 'success');
  };

  const handleApprove = (uid: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.uid === uid ? { ...acc, status: 'Aktif' } : acc))
    );
    toast('Permohonan registrasi guru berhasil disetujui.', 'success');
  };

  const handleRevoke = (uid: string) => {
    if (!window.confirm('Nonaktifkan akses akun guru ini?')) return;
    setAccounts((prev) =>
      prev.map((acc) => (acc.uid === uid ? { ...acc, status: 'Nonaktif' } : acc))
    );
    toast('Akses akun telah dicabut.', 'warning');
  };

  return (
    <Shell>
      <div className="space-y-6" suppressHydrationWarning>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Konsol Kelola Akun Pendidik (Superuser)
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Otorisasi hak akses rombel kelas, guru bidang studi spesialis, dan audit keamanan tahun ajaran {academicYear}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Switch Manual Buka / Tutup Pendaftaran */}
            <div 
              onClick={toggleRegistrationSwitch}
              className={'flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border cursor-pointer select-none transition-all ' + (
                isRegistrationOpen
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/40 text-rose-700 dark:text-rose-400'
              )}
              title="Klik untuk membuka/menutup portal pendaftaran guru"
            >
              {isRegistrationOpen ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-rose-600" />}
              <span className="text-xs font-bold">
                Pendaftaran: {isRegistrationOpen ? 'DIBUKA' : 'DITUTUP'}
              </span>
            </div>

            <Button variant="primary" size="sm" onClick={() => setIsInviteOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" /> Buat Token QR
            </Button>
          </div>
        </div>

        {/* Widget Pengaturan Cabang Seni Tahun Ajaran */}
        <div className="p-4 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white dark:from-zinc-900 dark:to-zinc-950 border border-indigo-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Cabang Seni Kurikulum Merdeka (T.A. {academicYear})
                </h3>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                  Aktif: {cabangSeni}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Pilihan cabang seni resmi sekolah. Seluruh modul penilaian TP dan jurnal otomatis menggunakan nama cabang seni yang dipilih.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Pilih Cabang:</label>
            <select
              value={cabangSeni}
              onChange={(e) => handleChangeCabangSeni(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-zinc-700 rounded-xl text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              {CABANG_SENI_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <p className="text-xs text-slate-400 font-semibold">Total Pendidik Terdaftar</p>
            <p className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">
              {accounts.filter((a) => a.status === 'Aktif').length} Akun
            </p>
          </div>
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <p className="text-xs text-amber-500 font-semibold">Menunggu Persetujuan</p>
            <p className="text-2xl font-black text-amber-500 mt-1">
              {accounts.filter((a) => a.status === 'Pending Approval').length} Permohonan
            </p>
          </div>
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <p className="text-xs text-indigo-500 font-semibold">Guru Spesialis / Bidang Studi</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              5 Mata Pelajaran
            </p>
          </div>
        </div>

        {/* Table List Akun */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              Daftar Otorisasi Akun Guru & Wali Kelas
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Nama Pendidik</th>
                  <th className="px-4 py-3">Alamat Email</th>
                  <th className="px-4 py-3">Jabatan / Penugasan</th>
                  <th className="px-4 py-3">Rombel / Mapel</th>
                  <th className="px-4 py-3 text-center">Status Akses</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {accounts.map((acc) => (
                  <tr key={acc.uid} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-zinc-100">{acc.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{acc.email}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300">{acc.role}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {acc.classId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : acc.status === 'Pending Approval'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {acc.status === 'Pending Approval' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleApprove(acc.uid)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Setujui"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRevoke(acc.uid)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Tolak"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRevoke(acc.uid)}
                          className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          Cabut Akses
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Buat Undangan dengan QR Code */}
      <Modal 
        isOpen={isInviteOpen} 
        onClose={() => { setIsInviteOpen(false); setGeneratedCode(null); setInviteQrDataUrl(null); }} 
        title="Buat Token Undangan & QR Code"
        description="Pendidik dapat memindai QR code ini di halaman pendaftaran untuk aktivasi otomatis."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Penugasan Rombel / Guru Spesialis</label>
            <select
              value={inviteClass}
              onChange={(e) => setInviteClass(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold"
            >
              <optgroup label="Guru Kelas (Wali Kelas)">
                {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'].map((c) => (
                  <option key={c} value={c}>Kelas {c}</option>
                ))}
              </optgroup>
              <optgroup label="Guru Bidang Studi (Spesialis)">
                {['PJOK', 'PAI', 'Bahasa Inggris', 'Bahasa Arab', 'Komputer'].map((sp) => (
                  <option key={sp} value={sp}>Guru {sp}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <Button variant="primary" className="w-full" size="md" onClick={handleGenerateInvite}>
            <QrCode className="w-4 h-4 mr-2" /> Generate Token & QR Code
          </Button>

          {generatedCode && inviteQrDataUrl && (
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-indigo-200 dark:border-zinc-800 rounded-3xl text-center space-y-3 shadow-inner">
              <div className="p-3 bg-white rounded-2xl inline-block shadow-md border border-slate-100">
                <img src={inviteQrDataUrl} alt="QR Undangan" className="w-44 h-44 mx-auto" />
              </div>

              <div>
                <p className="text-[11px] text-slate-500 font-medium">Kode Undangan Mandiri:</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg font-black font-mono tracking-wider text-indigo-700 dark:text-indigo-400">
                    {generatedCode}
                  </span>
                  <button onClick={handleCopyCode} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer" title="Salin Kode">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-400">Berlaku satu kali registrasi untuk penugasan {inviteClass}.</p>
            </div>
          )}
        </div>
      </Modal>
    </Shell>
  );
}
