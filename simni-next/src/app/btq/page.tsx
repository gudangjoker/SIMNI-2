'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { 
  Sparkles, Download, Save, BookOpen, Users, Search, 
  Layers, Award
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { BTQRecord } from '@/types/btq';
import { exportBTQToExcel } from '@/lib/excel/btq-excel';
import { ClassId } from '@/types/auth';

const PERIOD_OPTIONS = [
  'PERTENGAHAN SEMESTER 1',
  'SEMESTER 1',
  'PERTENGAHAN SEMESTER 2',
  'SEMESTER 2'
];

const DEFAULT_DESCRIPTIONS = {
  A: "Dalam mengaji sudah baik dan lancar, dalam pelafalan, makhraj, qolqolah, ikhfa serta waqof sudah baik. Cobalah berlatih membaca dalam satu tarikan nafas dan lebih konsisten dalam panjang pendek bacaan. Untuk kemampuan menulis sudah baik dan rapi, mampu menyambung dan memisahkan huruf hijaiyah. Tetap semangat belajar mengaji di rumah ataupun di sekolah ya.",
  B: "Dalam mengaji sudah cukup baik, pada pelafalan dan makhraj sudah lebih jelas, tetapi masih ada yang perlu diperhatikan yaitu kelancaran membaca serta panjang pendek bacaan, qolqolah, dan ikhfa. Untuk kemampuan menulis sudah baik, bisa menyambung dan memisahkan huruf hijaiyah dengan cukup rapi, harus lebih teliti menulis huruf di atas dan bawah garis. Tetap semangat belajar mengaji ya.",
  C: "Dalam mengaji masih memerlukan bimbingan rutin, terutama dalam kelancaran membaca dan ketepatan panjang pendek serta makharijul huruf. Untuk kemampuan menulis masih perlu banyak latihan agar bentuk huruf semakin proporsional dan rapi. Mohon pendampingan aktif dari orang tua di rumah agar ananda semakin percaya diri.",
  D: "Memerlukan bimbingan khusus dan intensif dalam mengenal harakat dan huruf hijaiyah dasar. Perbanyak waktu tilawah dan latihan menulis huruf hijaiyah di rumah dengan pendampingan sabar dari ayah dan bunda."
};

export default function BTQPage() {
  const { toast } = useToast();
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);

  // Form Header States
  const [periode, setPeriode] = useState('PERTENGAHAN SEMESTER 1');
  const [tahunPelajaran, setTahunPelajaran] = useState('2025-2026');
  const [namaPengajar, setNamaPengajar] = useState('Unggaran');

  // Kelompok BTQ Filter (Siswa dipanggil berdasarkan Kelompok BTQ)
  const [selectedKelompok, setSelectedKelompok] = useState<string>('all');
  const [filterKelas, setFilterKelas] = useState<string>('all');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Records state: key = nisn
  const [records, setRecords] = useState<Record<string, BTQRecord>>({});
  const [isSaved, setIsSaved] = useState(true);

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'kelompok' | 'all'>('kelompok');
  const [isExporting, setIsExporting] = useState(false);

  // Extract all available Kelompok BTQ from students
  const availableKelompok = useMemo(() => {
    const groups = new Set<string>();
    Object.values(studentsMap).forEach((s) => {
      if (s.Kelompok && s.Kelompok.trim() !== '') {
        groups.add(s.Kelompok.trim());
      }
    });
    return Array.from(groups).sort();
  }, [studentsMap]);

  // Set default selected kelompok if not set
  useEffect(() => {
    if (selectedKelompok === 'all' && availableKelompok.length > 0) {
      setSelectedKelompok(availableKelompok[0]);
    }
  }, [availableKelompok, selectedKelompok]);

  // Students filtered primarily by Kelompok BTQ
  const btqStudents = useMemo(() => {
    return Object.values(studentsMap)
      .filter((s) => {
        const matchKelompok = selectedKelompok === 'all' || s.Kelompok === selectedKelompok;
        const matchKelas = filterKelas === 'all' || s.Kelas === filterKelas;
        return matchKelompok && matchKelas;
      })
      .sort((a, b) => a['Nama Lengkap'].localeCompare(b['Nama Lengkap']));
  }, [studentsMap, selectedKelompok, filterKelas]);

  // Storage key based on Kelompok and Academic Year
  const storageKey = `simni_btq_records_${academicYear}_${selectedKelompok.replace(/\s+/g, '_')}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setRecords(JSON.parse(saved));
      } else {
        const initial: Record<string, BTQRecord> = {};
        btqStudents.forEach((s) => {
          initial[s.NISN] = {
            nisn: s.NISN,
            nama: s['Nama Lengkap'],
            kelas: s.Kelas,
            hancaTerakhir: '',
            nilai: 'B',
            gambaranKemampuan: DEFAULT_DESCRIPTIONS.B
          };
        });
        setRecords(initial);
      }
      setIsSaved(true);
    } catch {
      // ignore
    }
  }, [storageKey, selectedKelompok, academicYear, btqStudents]);

  // Handle cell edits
  const handleUpdateRecord = (nisn: string, field: keyof BTQRecord, value: any) => {
    setRecords((prev) => {
      const current = prev[nisn] || {
        nisn,
        nama: studentsMap[nisn]?.['Nama Lengkap'] || '',
        kelas: studentsMap[nisn]?.Kelas || '-',
        hancaTerakhir: '',
        nilai: 'B',
        gambaranKemampuan: ''
      };

      const updated = { ...current, [field]: value };

      if (field === 'nilai' && (value === 'A' || value === 'B' || value === 'C' || value === 'D')) {
        if (!current.gambaranKemampuan || Object.values(DEFAULT_DESCRIPTIONS).includes(current.gambaranKemampuan)) {
          updated.gambaranKemampuan = DEFAULT_DESCRIPTIONS[value as keyof typeof DEFAULT_DESCRIPTIONS];
        }
      }

      return {
        ...prev,
        [nisn]: updated
      };
    });
    setIsSaved(false);
  };

  const handleApplyTemplate = (nisn: string, grade: 'A' | 'B' | 'C' | 'D') => {
    handleUpdateRecord(nisn, 'nilai', grade);
    handleUpdateRecord(nisn, 'gambaranKemampuan', DEFAULT_DESCRIPTIONS[grade]);
    toast(`Template deskripsi predikat ${grade} diterapkan ke baris siswa.`, 'info');
  };

  const handleSave = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
      setIsSaved(true);
      toast(`Data Laporan BTQ untuk ${selectedKelompok} berhasil disimpan.`, 'success');
    } catch {
      toast('Gagal menyimpan ke penyimpanan lokal.', 'error');
    }
  };

  // Filtered by Search Query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return btqStudents;
    const q = searchQuery.toLowerCase();
    return btqStudents.filter(
      (s) =>
        s['Nama Lengkap'].toLowerCase().includes(q) ||
        s.NISN.toLowerCase().includes(q) ||
        (s.Kelompok || '').toLowerCase().includes(q) ||
        (records[s.NISN]?.hancaTerakhir || '').toLowerCase().includes(q)
    );
  }, [btqStudents, searchQuery, records]);

  // Handle Export
  const handleTriggerExport = async () => {
    setIsExporting(true);
    try {
      let exportRecords: BTQRecord[] = [];

      if (exportScope === 'kelompok') {
        exportRecords = btqStudents.map((s) => {
          const rec = records[s.NISN];
          return {
            nisn: s.NISN,
            nama: s['Nama Lengkap'],
            kelas: s.Kelas,
            hancaTerakhir: rec?.hancaTerakhir || '-',
            nilai: rec?.nilai || 'B',
            gambaranKemampuan: rec?.gambaranKemampuan || DEFAULT_DESCRIPTIONS.B
          };
        });
      } else {
        // All students across all kelompok
        exportRecords = Object.values(studentsMap).map((s) => {
          const rec = records[s.NISN];
          return {
            nisn: s.NISN,
            nama: s['Nama Lengkap'],
            kelas: s.Kelas,
            hancaTerakhir: rec?.hancaTerakhir || '-',
            nilai: rec?.nilai || 'B',
            gambaranKemampuan: rec?.gambaranKemampuan || DEFAULT_DESCRIPTIONS.B
          };
        });
      }

      await exportBTQToExcel({
        sheetTitle: selectedKelompok !== 'all' ? selectedKelompok : 'Laporan BTQ',
        periode,
        tahunPelajaran,
        namaPengajar,
        records: exportRecords,
        isMultiClass: exportScope === 'all'
      });

      setIsExportModalOpen(false);
      toast('Laporan BTQ Excel identik dengan template berhasil diunduh.', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengekspor Excel BTQ.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Laporan Bimbingan Tilawah Al-Qur'an (BTQ)
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Pencatatan evaluasi tilawah Al-Qur'an per Kelompok BTQ sesuai format resmi SDIT Bina Muda Cicalengka.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isSaved ? 'outline' : 'primary'}
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaved ? 'Tersimpan' : 'Simpan Perubahan'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
            >
              <Download className="w-4 h-4" />
              Ekspor Excel (Identik Template)
            </Button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Kelompok BTQ Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Pilih Kelompok BTQ Siswa
            </label>
            <select
              value={selectedKelompok}
              onChange={(e) => {
                setSelectedKelompok(e.target.value);
                setIsSaved(true);
              }}
              className="w-full text-xs font-bold px-3 py-2 bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 text-emerald-900 dark:text-emerald-200"
            >
              <option value="all">Semua Kelompok BTQ</option>
              {availableKelompok.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {/* Periode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
              Periode Laporan
            </label>
            <select
              value={periode}
              onChange={(e) => {
                setPeriode(e.target.value);
                setIsSaved(false);
              }}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Tahun Pelajaran */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
              Tahun Pelajaran
            </label>
            <input
              type="text"
              value={tahunPelajaran}
              onChange={(e) => {
                setTahunPelajaran(e.target.value);
                setIsSaved(false);
              }}
              placeholder="Contoh: 2025-2026"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Nama Pengajar BTQ */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
              Nama Pengajar BTQ
            </label>
            <input
              type="text"
              value={namaPengajar}
              onChange={(e) => {
                setNamaPengajar(e.target.value);
                setIsSaved(false);
              }}
              placeholder="Contoh: Unggaran"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Search Bar & Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari siswa atau capaian hanca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>
              Kelompok:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {selectedKelompok === 'all' ? 'Semua Kelompok' : selectedKelompok}
              </strong>
            </span>
            <span>•</span>
            <span>
              Siswa Terdaftar: <strong className="text-slate-800 dark:text-zinc-200">{filteredStudents.length}</strong>
            </span>
          </div>
        </div>

        {/* Data Input Table */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-12 text-center border-r border-slate-200 dark:border-zinc-700">NO</th>
                  <th className="py-3 px-4 w-60 border-r border-slate-200 dark:border-zinc-700">NAMA SISWA</th>
                  <th className="py-3 px-3 w-20 text-center border-r border-slate-200 dark:border-zinc-700">KELAS</th>
                  <th className="py-3 px-3 w-32 text-center border-r border-slate-200 dark:border-zinc-700">KELOMPOK</th>
                  <th className="py-3 px-4 w-52 border-r border-slate-200 dark:border-zinc-700">HANCA TERAKHIR</th>
                  <th className="py-3 px-3 w-32 text-center border-r border-slate-200 dark:border-zinc-700">NILAI</th>
                  <th className="py-3 px-4 border-r border-slate-200 dark:border-zinc-700">
                    GAMBARAN KEMAMPUAN MENGAJI DAN REKOMENDASI UNTUK ORANGTUA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada data siswa ditemukan untuk {selectedKelompok === 'all' ? 'semua kelompok' : selectedKelompok}.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => {
                    const rec = records[s.NISN] || {
                      nisn: s.NISN,
                      nama: s['Nama Lengkap'],
                      kelas: s.Kelas,
                      hancaTerakhir: '',
                      nilai: 'B',
                      gambaranKemampuan: DEFAULT_DESCRIPTIONS.B
                    };

                    return (
                      <tr key={s.NISN} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                        {/* NO */}
                        <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-100 dark:border-zinc-800">
                          {idx + 1}
                        </td>

                        {/* NAMA SISWA */}
                        <td className="py-3 px-4 border-r border-slate-100 dark:border-zinc-800">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{s['Nama Lengkap']}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NISN: {s.NISN}</div>
                        </td>

                        {/* KELAS */}
                        <td className="py-3 px-3 text-center border-r border-slate-100 dark:border-zinc-800">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold rounded-md text-[11px]">
                            {s.Kelas}
                          </span>
                        </td>

                        {/* KELOMPOK BTQ */}
                        <td className="py-3 px-3 text-center border-r border-slate-100 dark:border-zinc-800">
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded-md text-[10px]">
                            {s.Kelompok || 'Umum'}
                          </span>
                        </td>

                        {/* HANCA TERAKHIR (Input Teks Murni - Tanpa Dropdown Permanen) */}
                        <td className="py-3 px-4 border-r border-slate-100 dark:border-zinc-800">
                          <input
                            type="text"
                            value={rec.hancaTerakhir}
                            onChange={(e) => handleUpdateRecord(s.NISN, 'hancaTerakhir', e.target.value)}
                            placeholder="Contoh: Iqro 6 hal 28 / Al-Baqarah 112"
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                        </td>

                        {/* NILAI */}
                        <td className="py-3 px-3 border-r border-slate-100 dark:border-zinc-800">
                          <div className="flex items-center justify-center gap-1">
                            {(['A', 'B', 'C', 'D'] as const).map((grade) => (
                              <button
                                key={grade}
                                type="button"
                                onClick={() => handleUpdateRecord(s.NISN, 'nilai', grade)}
                                className={`w-6 h-6 rounded-md font-bold text-xs transition-all cursor-pointer ${
                                  rec.nilai === grade
                                    ? grade === 'A'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : grade === 'B'
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : grade === 'C'
                                      ? 'bg-amber-600 text-white shadow-sm'
                                      : 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                                }`}
                              >
                                {grade}
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* GAMBARAN KEMAMPUAN & REKOMENDASI */}
                        <td className="py-3 px-4 border-r border-slate-100 dark:border-zinc-800">
                          <div className="space-y-1.5">
                            <textarea
                              rows={3}
                              value={rec.gambaranKemampuan}
                              onChange={(e) => handleUpdateRecord(s.NISN, 'gambaranKemampuan', e.target.value)}
                              placeholder="Deskripsi kemampuan makhraj, tajwid, tilawah, dan rekomendasi orang tua..."
                              className="w-full text-[11px] leading-relaxed p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-normal resize-y"
                            />
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Template cepat:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(s.NISN, 'A')}
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-100 cursor-pointer"
                                >
                                  Isi A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(s.NISN, 'B')}
                                  className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-100 cursor-pointer"
                                >
                                  Isi B
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(s.NISN, 'C')}
                                  className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-100 cursor-pointer"
                                >
                                  Isi C
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Ekspor Excel BTQ */}
        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Ekspor Laporan BTQ ke Excel Resmi"
        >
          <div className="space-y-5">
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Format ekspor akan dihasilkan <strong>100% identik</strong> dengan file{' '}
              <code className="text-emerald-600 font-mono font-bold">Laporan BTQ - Template wajib.xlsx</code>:
              header kop judul, nama pengajar, batas tabel tipis, dan deskripsi kelancaran mengaji.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Pilih Cakupan Siswa yang Diekspor:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setExportScope('kelompok')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    exportScope === 'kelompok'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                    {selectedKelompok === 'all' ? 'Semua Kelompok' : selectedKelompok}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Mengekspor {btqStudents.length} siswa dalam kelompok ini.
                  </div>
                </div>

                <div
                  onClick={() => setExportScope('all')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    exportScope === 'all'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                    Seluruh Siswa Sekolah
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Sheet master KELAS1-6 dan lembar terpisah per rombel.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Periode:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{periode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tahun Pelajaran:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{tahunPelajaran}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pengajar:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{namaPengajar || '-'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTriggerExport}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isExporting ? 'Memproses Ekspor...' : 'Unduh File Excel'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Shell>
  );
}
