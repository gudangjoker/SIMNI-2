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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var origSetAttribute = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (name && (name.indexOf('bis_') === 0 || name === 'bis_skin_checked' || name === 'bis_size')) return;
                    return origSetAttribute.apply(this, arguments);
                  };
                  if (Element.prototype.setAttributeNode) {
                    var origSetAttributeNode = Element.prototype.setAttributeNode;
                    Element.prototype.setAttributeNode = function(attr) {
                      if (attr && attr.name && (attr.name.indexOf('bis_') === 0 || attr.name === 'bis_skin_checked' || attr.name === 'bis_size')) return null;
                      return origSetAttributeNode.apply(this, arguments);
                    };
                  }
                } catch(e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-black font-sans antialiased" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
