'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbRemove } from '@/lib/firebase/repository';
import { DocumentAsset } from '@/types/document';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FolderGit2, Plus, Trash2, ExternalLink, Search, FileText } from 'lucide-react';

const KATEGORI_LIST = [
  'Modul Ajar',
  'RPP',
  'LKPD',
  'Silabus',
  'Administrasi Kelas',
  'Media Ajar',
  'Lainnya'
] as const;

export default function DocumentsPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const documentsMap = useAppStore((state) => state.dokumen);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formKategori, setFormKategori] = useState<typeof KATEGORI_LIST[number]>(KATEGORI_LIST[0]);
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredDocs = useMemo(() => {
    return Object.entries(documentsMap)
      .map(([id, d]) => ({ id, ...d }))
      .filter((d) => {
        const matchKategori = selectedKategori === 'all' || d.Kategori === selectedKategori;
        const q = searchQuery.toLowerCase().trim();
        const matchQuery = !q || d.Nama.toLowerCase().includes(q) || d.Deskripsi.toLowerCase().includes(q);
        return matchKategori && matchQuery;
      });
  }, [documentsMap, selectedKategori, searchQuery]);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim() || !formUrl.trim()) {
      toast('Nama dokumen dan URL berkas wajib diisi.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const docId = `DOC_${Date.now()}`;
    const payload: DocumentAsset = {
      ID_dokumen: docId,
      Nama: formNama.trim(),
      Kategori: formKategori,
      Deskripsi: formDeskripsi.trim(),
      url_file: formUrl.trim(),
      public_id: `simni/docs/${docId}`,
      bytes: 1024 * 500
    };

    const res = await dbSet<DocumentAsset>(`Dokumen/${docId}`, payload, activeKelas, academicYear);
    setIsSubmitting(false);

    if (res.success) {
      toast('Dokumen berhasil ditambahkan ke repository.', 'success');
      setFormNama('');
      setFormDeskripsi('');
      setFormUrl('');
      setIsUploadOpen(false);
    } else {
      toast(res.error || 'Gagal menyimpan dokumen.', 'error');
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Hapus permanen dokumen ini dari sistem?')) return;
    const res = await dbRemove(`Dokumen/${docId}`, activeKelas, academicYear);
    if (res.success) {
      toast('Dokumen berhasil dihapus.', 'success');
    } else {
      toast(res.error || 'Gagal menghapus dokumen.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Arsip & Dokumen Pembelajaran - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Penyimpanan berkas modul ajar, perangkat kurikulum, LKPD, dan media digital.
            </p>
          </div>

          <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
            <Plus className="w-4 h-4" /> Unggah Dokumen
          </Button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari dokumen pembelajaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
            >
              <option value="all">Semua Kategori</option>
              {KATEGORI_LIST.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents Grid */}
        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded">
                      {doc.Kategori}
                    </span>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 line-clamp-1">{doc.Nama}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {doc.Deskripsi || 'Tidak ada deskripsi berkas.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">Digital Cloud Asset</span>
                  <a
                    href={doc.url_file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Buka File <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
            <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">Belum ada dokumen yang sesuai dengan kategori ini.</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Tambah Dokumen Baru">
        <form onSubmit={handleUploadDoc} className="space-y-4">
          <Input
            label="Nama / Judul Dokumen"
            placeholder="Cth: Modul Ajar Bab 1 Matematika"
            value={formNama}
            onChange={(e) => setFormNama(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Kategori Berkas</label>
            <select
              value={formKategori}
              onChange={(e) => setFormKategori(e.target.value as typeof KATEGORI_LIST[number])}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
            >
              {KATEGORI_LIST.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <Input
            label="Tautan Berkas (Cloudinary / Google Drive HTTPS)"
            placeholder="https://..."
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Deskripsi Ringkas</label>
            <textarea
              rows={2}
              placeholder="Catatan tambahan seputar berkas..."
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsUploadOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Simpan Dokumen
            </Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
