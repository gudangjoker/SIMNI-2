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
                  // 1. Filter out console.error for bis_skin_checked extension mismatch
                  var origError = console.error;
                  console.error = function() {
                    var str = Array.prototype.slice.call(arguments).map(function(a) {
                      return typeof a === 'string' ? a : (a && a.message ? a.message : (a && a.stack ? a.stack : ''));
                    }).join(' ');
                    if (str.indexOf('bis_skin_checked') !== -1 || str.indexOf('bis_size') !== -1) {
                      return;
                    }
                    return origError.apply(console, arguments);
                  };

                  // 2. Active MutationObserver to immediately strip bis_skin_checked added by browser extensions
                  function cleanBis(node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.hasAttribute && node.hasAttribute('bis_skin_checked')) node.removeAttribute('bis_skin_checked');
                    if (node.hasAttribute && node.hasAttribute('bis_size')) node.removeAttribute('bis_size');
                    var children = node.querySelectorAll ? node.querySelectorAll('[bis_skin_checked],[bis_size]') : [];
                    for (var i = 0; i < children.length; i++) {
                      children[i].removeAttribute('bis_skin_checked');
                      children[i].removeAttribute('bis_size');
                    }
                  }

                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.attributeName && m.attributeName.indexOf('bis_') === 0) {
                        m.target.removeAttribute(m.attributeName);
                      } else if (m.type === 'childList') {
                        for (var j = 0; j < m.addedNodes.length; j++) {
                          cleanBis(m.addedNodes[j]);
                        }
                      }
                    }
                  });

                  if (document.documentElement) {
                    observer.observe(document.documentElement, {
                      attributes: true,
                      childList: true,
                      subtree: true,
                      attributeFilter: ['bis_skin_checked', 'bis_size']
                    });
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
