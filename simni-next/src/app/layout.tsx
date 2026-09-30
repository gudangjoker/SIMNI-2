import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIMNI Administrasi Kelas Digital',
  description: 'PWA Administrasi Kelas, Presensi, Nilai, Jurnal, dan Evaluasi Kurikulum Merdeka Offline-First.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-black font-sans antialiased" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
