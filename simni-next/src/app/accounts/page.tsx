'use client';

import React, { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ShieldCheck, UserCheck, KeyRound, Check, X, ShieldAlert, History } from 'lucide-react';

export default function AccountsPage() {
  const { toast } = useToast();
  const academicYear = useAppStore((state) => state.academicYear);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteClass, setInviteClass] = useState('1B');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Mock initial account list
  const [accounts, setAccounts] = useState([
    { uid: 'USR_001', name: 'Unggaran, S.Pd.', email: 'unggaran.sditbm@gmail.com', role: 'Superuser', classId: '3A', status: 'Aktif' },
    { uid: 'USR_002', name: 'Anur Auliya, S.Pd.', email: 'anur.auliya01@gmail.com', role: 'VIP (PJOK)', classId: 'PJOK', status: 'Aktif' },
    { uid: 'USR_003', name: 'Ahmad Fauzi, S.Pd.', email: 'ahmad.fauzi@guru.sch.id', role: 'Teacher', classId: '1A', status: 'Aktif' },
    { uid: 'USR_004', name: 'Dewi Lestari, S.Pd.', email: 'dewi.lestari@guru.sch.id', role: 'Teacher', classId: '2A', status: 'Pending Approval' },
  ]);

  const handleGenerateInvite = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    setGeneratedCode(code);
    toast(`Kode undangan untuk Kelas ${inviteClass} berhasil dibuat: ${code}`, 'success');
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Konsol Kelola Akun Pendidik (Superuser)
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Otorisasi hak akses rombel kelas, token undangan, dan audit keamanan tahun ajaran {academicYear}.
            </p>
          </div>

          <Button variant="primary" size="sm" onClick={() => setIsInviteOpen(true)}>
            <KeyRound className="w-4 h-4 mr-1.5" /> Buat Token Undangan
          </Button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <p className="text-xs text-slate-400 font-semibold">Total Pendidik Aktif</p>
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
            <p className="text-xs text-indigo-500 font-semibold">Slot Ruang Rombel</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">12 Kelas + 1 PJOK</p>
          </div>
        </div>

        {/* Account Table */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" /> Daftar Penugasan Guru & Status Akses
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Nama Pendidik</th>
                  <th className="px-4 py-3">Alamat Email</th>
                  <th className="px-4 py-3">Peran / Scope</th>
                  <th className="px-4 py-3">Penugasan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {accounts.map((acc) => (
                  <tr key={acc.uid} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-zinc-100">{acc.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{acc.email}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">{acc.role}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[10px] font-bold">
                        {acc.classId === 'PJOK' ? 'PJOK' : `Kelas ${acc.classId}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.status === 'Aktif'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-600'
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
                            title="Setujui Akun"
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
                          className="text-[11px] text-rose-600 hover:underline font-semibold"
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

      {/* Modal Buat Undangan */}
      <Modal isOpen={isInviteOpen} onClose={() => { setIsInviteOpen(false); setGeneratedCode(null); }} title="Buat Token Undangan Guru">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Penugasan Rombel Kelas</label>
            <select
              value={inviteClass}
              onChange={(e) => setInviteClass(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
            >
              {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'PJOK'].map((c) => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>
          </div>

          <Button variant="primary" className="w-full" size="sm" onClick={handleGenerateInvite}>
            Generate Kode Undangan
          </Button>

          {generatedCode && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-2">
              <p className="text-xs text-slate-500">Berikan kode ini kepada pendidik yang bersangkutan:</p>
              <p className="text-xl font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400">
                {generatedCode}
              </p>
              <p className="text-[10px] text-slate-400">Kode ini berlaku satu kali untuk penugasan Kelas {inviteClass}.</p>
            </div>
          )}
        </div>
      </Modal>
    </Shell>
  );
}
