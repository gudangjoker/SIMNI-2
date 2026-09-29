'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [slot, setSlot] = useState('1A');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl">
        <div className="mb-6">
          <Link href="/login" className="inline-flex items-center text-xs text-slate-400 hover:text-white gap-1 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
          </Link>
          <h2 className="text-xl font-bold text-white tracking-tight">Pendaftaran Akun Guru</h2>
          <p className="text-xs text-slate-400 mt-1">Aktivasi akun menggunakan kode undangan dari Superuser.</p>
        </div>

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Penugasan Kelas / Rombel</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
              >
                {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'PJOK'].map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Nama Lengkap & Gelar"
              placeholder="Contoh: Budi Santoso, S.Pd."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Alamat Email"
              type="email"
              placeholder="guru@sditbm.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Kode Undangan (One-Time Token)"
              placeholder="Masukkan 8-16 digit kode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            <Input
              label="Kata Sandi Akun"
              type="password"
              placeholder="Minimal 12 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" className="w-full">
              Kirim Permohonan Akses
            </Button>
          </form>
        ) : (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Permohonan Terkirim</h3>
            <p className="text-xs text-slate-400">
              Pendaftaran Anda untuk penugasan <strong>Kelas {slot}</strong> telah diteruskan ke antrean persetujuan Superuser. Anda akan menerima notifikasi email setelah akun disetujui.
            </p>
            <Link href="/login" className="inline-block w-full">
              <Button variant="outline" className="w-full">
                Ke Halaman Masuk
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
