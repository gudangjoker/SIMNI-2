'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseClient } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, WifiOff, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { auth } = getFirebaseClient();
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setErrorMessage('Alamat email atau kata sandi tidak sesuai.');
      } else if (msg.includes('too-many-requests')) {
        setErrorMessage('Terlalu banyak percobaan masuk yang gagal. Silakan coba sesaat lagi.');
      } else {
        setErrorMessage('Gagal masuk ke sistem: ' + (msg || 'Periksa koneksi Anda.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResetSuccess(null);
    setErrorMessage(null);

    try {
      const { auth } = getFirebaseClient();
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess('Tautan pemulihan kata sandi telah dikirimkan ke email Anda.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email reset.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur-2xl shadow-2xl">
        {/* Brand Showcase Panel */}
        <div className="p-8 md:p-12 flex flex-col justify-between bg-gradient-to-br from-indigo-950/80 via-slate-900/80 to-slate-950/80 border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/40">
                S
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">SIMNI</h1>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
              Kelola pembelajaran dengan lebih tenang.
            </h2>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Ruang kerja aman terpadu untuk data siswa, presensi, nilai kurikulum merdeka, jurnal mengajar, dan rapor offline-first.
            </p>
          </div>

          <div className="space-y-2 mt-8">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Akses Multi-Role Terproteksi</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
              <WifiOff className="w-4 h-4 text-indigo-400" />
              <span>Dukungan Penuh Mode Offline</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Data Terenkripsi & Integritas SHA-256</span>
            </div>
          </div>
        </div>

        {/* Login / Reset Form Panel */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          {!showReset ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Selamat Datang Kembali</h3>
                <p className="text-xs text-slate-400 mt-1">Masukkan kredensial akun SIMNI Anda.</p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
                  {errorMessage}
                </div>
              )}

              <Input
                label="Alamat Email"
                type="email"
                placeholder="nama@guru.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Kata Sandi"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Lupa kata sandi?
                </button>
              </div>

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Masuk ke Ruang Kerja <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <div className="pt-2 text-center">
                <Link href="/register" className="text-xs text-slate-400 hover:text-indigo-400 transition-colors">
                  Punya kode undangan? <span className="font-semibold text-indigo-400">Daftar Guru Baru</span>
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Pemulihan Kata Sandi</h3>
                <p className="text-xs text-slate-400 mt-1">Kami akan mengirim tautan pemulihan ke email Anda.</p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
                  {errorMessage}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium">
                  {resetSuccess}
                </div>
              )}

              <Input
                label="Alamat Email Terdaftar"
                type="email"
                placeholder="nama@guru.sch.id"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Kirim Tautan Pemulihan
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-400"
                onClick={() => setShowReset(false)}
              >
                Kembali ke Form Masuk
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
