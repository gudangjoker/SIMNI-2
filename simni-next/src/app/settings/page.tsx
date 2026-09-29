'use client';

import React, { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet } from '@/lib/firebase/repository';
import { SchoolSettings } from '@/types/settings';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Settings, School, User, Database, HardDrive, Download, Save } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const settings = useAppStore((state) => state.pengaturan);
  const setCollection = useAppStore((state) => state.setCollection);

  const [activeTab, setActiveTab] = useState<'sekolah' | 'guru' | 'database'>('sekolah');

  // Form State
  const [namaSekolah, setNamaSekolah] = useState(settings.nama_sekolah);
  const [namaYayasan, setNamaYayasan] = useState(settings.nama_yayasan);
  const [tahunPelajaran, setTahunPelajaran] = useState(settings.tahun_pelajaran);
  const [kepalaSekolah, setKepalaSekolah] = useState(settings.kepala_sekolah || '');
  const [nuks, setNuks] = useState(settings.nuks_kepala_sekolah || '');
  const [waliKelas, setWaliKelas] = useState(settings.wali_kelas || '');
  const [nuptk, setNuptk] = useState(settings.nuptk_wali_kelas || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: SchoolSettings = {
      ...settings,
      nama_sekolah: namaSekolah,
      nama_yayasan: namaYayasan,
      tahun_pelajaran: tahunPelajaran,
      kepala_sekolah: kepalaSekolah,
      nuks_kepala_sekolah: nuks,
      wali_kelas: waliKelas,
      nuptk_wali_kelas: nuptk
    };

    const res = await dbSet<SchoolSettings>('Pengaturan/Identitas', updated, activeKelas, academicYear);
    setIsSaving(false);

    if (res.success) {
      setCollection('pengaturan', updated);
      toast('Identitas dan pengaturan berhasil diperbarui.', 'success');
    } else {
      toast(res.error || 'Gagal menyimpan pengaturan.', 'error');
    }
  };

  const handleExportBackup = () => {
    const fullState = useAppStore.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `SIMNI_Backup_${activeKelas}_${academicYear}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast('Berkas cadangan offline JSON berhasil diunduh.', 'success');
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Pusat Pengaturan Sistem - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Konfigurasi data identitas sekolah, profil pendidik, dan pemeliharaan basis data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sekolah')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'sekolah'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Identitas Sekolah
            </button>
            <button
              onClick={() => setActiveTab('guru')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'guru'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Profil Guru
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'database'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Database & Cadangan
            </button>
          </div>
        </div>

        {activeTab === 'sekolah' && (
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <School className="w-4 h-4 text-indigo-600" /> Identitas Satuan Pendidikan
            </h2>

            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <Input
                label="Nama Sekolah"
                value={namaSekolah}
                onChange={(e) => setNamaSekolah(e.target.value)}
                required
              />
              <Input
                label="Nama Yayasan"
                value={namaYayasan}
                onChange={(e) => setNamaYayasan(e.target.value)}
                required
              />
              <Input
                label="Tahun Pelajaran Aktif"
                value={tahunPelajaran}
                onChange={(e) => setTahunPelajaran(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nama Kepala Sekolah"
                  value={kepalaSekolah}
                  onChange={(e) => setKepalaSekolah(e.target.value)}
                />
                <Input
                  label="NUKS Kepala Sekolah"
                  value={nuks}
                  onChange={(e) => setNuks(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  <Save className="w-4 h-4 mr-1.5" /> Simpan Identitas Sekolah
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'guru' && (
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" /> Profil Wali Kelas & Pendidik
            </h2>

            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <Input
                label="Nama Lengkap Wali Kelas & Gelar"
                placeholder="Cth: Siti Aminah, S.Pd."
                value={waliKelas}
                onChange={(e) => setWaliKelas(e.target.value)}
              />
              <Input
                label="NUPTK / NIP Pendidik"
                placeholder="16 digit NUPTK"
                value={nuptk}
                onChange={(e) => setNuptk(e.target.value)}
              />

              <div className="pt-2">
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  <Save className="w-4 h-4 mr-1.5" /> Perbarui Profil Pendidik
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-4 max-w-2xl">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" /> Ekspor Cadangan Lokal (JSON)
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Unduh seluruh data kelas {activeKelas} (Siswa, Nilai, Presensi, Jurnal) dalam format snapshot terverifikasi untuk arsip pribadi.
              </p>
              <Button variant="outline" size="sm" onClick={handleExportBackup}>
                <Download className="w-4 h-4 mr-1.5" /> Unduh Berkas Cadangan JSON
              </Button>
            </div>

            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-500" /> Pembersihan Cache Offline
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Segarkan penyimpanan sementara Service Worker dan IndexedDB jika aplikasi terasa lambat.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
              >
                Muat Ulang & Segarkan Aplikasi
              </Button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
