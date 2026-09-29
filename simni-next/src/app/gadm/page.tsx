'use client';

import React, { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { BookOpen, Sparkles, Download, Copy, Check, FileCheck, Layers } from 'lucide-react';

const DOC_TYPES = [
  'Modul Ajar Harian',
  'Program Tahunan (Prota)',
  'Program Semester (Promes)',
  'Silabus Capaian Pembelajaran',
  'Proyek Penguatan Profil Pancasila (P5)',
  'Lembar Kerja Peserta Didik (LKPD)',
  'Deskripsi Capaian e-Rapor'
];

const MODELS = [
  'Problem-Based Learning (PBL)',
  'Project-Based Learning (PjBL)',
  'Inquiry Learning',
  'Discovery Learning',
  'Cooperative Learning',
  'Explicit Instruction'
];

export default function GADMPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const settings = useAppStore((state) => state.pengaturan);

  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [mapel, setMapel] = useState('Matematika');
  const [topik, setTopik] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [alokasiWaktu, setAlokasiWaktu] = useState('2 JP (2 x 35 Menit)');
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedText, setGeneratedText] = useState('');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topik.trim()) {
      toast('Topik / materi pembelajaran wajib diisi.', 'warning');
      return;
    }

    const template = `MODUL AJAR KURIKULUM MERDEKA & DEEP LEARNING 2026
Satuan Pendidikan : ${settings.nama_sekolah}
Tahun Pelajaran   : ${settings.tahun_pelajaran}
Fase / Kelas      : Fase B / Kelas ${activeKelas}
Mata Pelajaran    : ${mapel}
Alokasi Waktu     : ${alokasiWaktu}
Topik Bahasan     : ${topik}
Model Pembelajaran: ${model}

I. PENDEKATAN DEEP LEARNING (2026)
1. Mindful Learning (Bermakna): Peserta didik mengawali pembelajaran dengan kesadaran penuh melalui apersepsi kontekstual dan refleksi diri.
2. Meaningful Learning (Memahami): Pengaitan konsep materi dengan fenomena kehidupan sehari-hari di lingkungan peserta didik.
3. Joyful Learning (Menyenangkan): Pembelajaran kolaboratif menggunakan media visual interaktif dan penguatan positif.

II. TUJUAN PEMBELAJARAN
- Peserta didik mampu menganalisis dan mengaplikasikan pemahaman tentang ${topik} secara mandiri dan kritis.
- Peserta didik menunjukkan sikap gotong royong dan bernalar kritis selama proses pemecahan masalah.

III. KEGIATAN PEMBELAJARAN
A. Kegiatan Awal (10 Menit): Salam, doa bersama, presensi, apersepsi, dan penyampaian tujuan.
B. Kegiatan Inti (50 Menit): Penerapan sintaks ${model} - stimulasi, identifikasi masalah, pengumpulan data, pembuktian, dan penarikan kesimpulan.
C. Kegiatan Penutup (10 Menit): Refleksi bersama, asesmen formatif singkat, umpan balik guru, dan doa penutup.

IV. ASESMEN & EVALUASI
- Asesmen Diagnostik: Pertanyaan pemantik di awal materi.
- Asesmen Formatif: Observasi keaktifan diskusi dan LKPD mandiri.
- Asesmen Sumatif: Tes performa pemecahan soal terstruktur.`;

    setGeneratedText(template);
    setIsGenerated(true);
    toast('Dokumen administrasi berhasil disusun dengan pendekatan Deep Learning 2026.', 'success');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedText);
    toast('Teks dokumen telah disalin ke clipboard.', 'info');
  };

  const handleDownloadDoc = () => {
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GADM_${docType}_${mapel}_${activeKelas}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Berkas dokumen berhasil diunduh.', 'success');
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Generator Administrasi Guru Merdeka (GADM) 2026
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Penyusunan otomatis perangkat ajar berdasarkan Kurikulum Merdeka & Pendekatan Deep Learning 2026.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Wizard */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm h-fit">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Parameter Penyusunan
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Jenis Dokumen</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Mata Pelajaran</label>
                <select
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
                >
                  {['Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika', 'IPAS', 'PJOK', 'Seni Rupa', 'Bahasa Inggris', 'Bahasa Sunda'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Topik / Materi Pokok"
                placeholder="Cth: Penjumlahan Bilangan Cacah"
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Sintaks Model Pembelajaran</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
                >
                  {MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Alokasi Waktu"
                value={alokasiWaktu}
                onChange={(e) => setAlokasiWaktu(e.target.value)}
              />

              <Button type="submit" variant="primary" className="w-full" size="sm">
                Generate Perangkat Ajar
              </Button>
            </form>
          </div>

          {/* Preview Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Pratinjau Dokumen</h3>
              </div>

              {isGenerated && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyText}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Salin Teks
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleDownloadDoc}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Unduh Dokumen
                  </Button>
                </div>
              )}
            </div>

            {isGenerated ? (
              <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
                <pre className="text-xs font-mono text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                  {generatedText}
                </pre>
              </div>
            ) : (
              <div className="p-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <Layers className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-xs text-slate-400 font-medium">
                  Atur parameter di sebelah kiri lalu klik Generate untuk menyusun dokumen administrasi.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
