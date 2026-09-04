import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');
const HOST = '127.0.0.1';
const PORT = 5000;
const BASE_URL = `http://${HOST}:${PORT}`;

const FIREBASE_CONFIG = JSON.parse(readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf8'));
const FIREBASE_HEADERS = FIREBASE_CONFIG.hosting?.headers?.find((entry) => entry.source === '**')?.headers || [];

const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon']
]);

function createQaServer() {
    return createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url || '/', BASE_URL).pathname);
        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const target = path.resolve(PUBLIC_ROOT, relative);
        const boundary = `${PUBLIC_ROOT}${path.sep}`;
        
        if (target !== PUBLIC_ROOT && !target.startsWith(boundary)) {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Forbidden');
            return;
        }

        try {
            const metadata = statSync(target);
            if (!metadata.isFile()) throw new Error('Not a file');
            
            const ext = path.extname(target).toLowerCase();
            const headers = {
                'Content-Length': metadata.size,
                'Content-Type': MIME_TYPES.get(ext) || 'application/octet-stream'
            };
            
            // Terapkan security headers dari firebase.json
            for (const h of FIREBASE_HEADERS) {
                headers[h.key] = h.value;
            }

            response.writeHead(200, headers);
            createReadStream(target).pipe(response);
        } catch {
            // SPA Fallback: Rewrite to index.html jika tidak ditemukan
            try {
                const indexTarget = path.resolve(PUBLIC_ROOT, 'index.html');
                const metadata = statSync(indexTarget);
                const headers = {
                    'Content-Length': metadata.size,
                    'Content-Type': 'text/html; charset=utf-8'
                };
                for (const h of FIREBASE_HEADERS) headers[h.key] = h.value;
                
                response.writeHead(200, headers);
                createReadStream(indexTarget).pipe(response);
            } catch {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Not Found');
            }
        }
    });
}

const server = createQaServer();
server.listen(PORT, HOST, () => {
    console.log(`\n=======================================================`);
    console.log(` SIMNI-GADM LOCAL QA SERVER (Node.js)`);
    console.log(` Menerapkan Security Headers dari firebase.json`);
    console.log(` Listening on: ${BASE_URL}`);
    console.log(`=======================================================\n`);
    console.log(`Tekan CTRL+C untuk menghentikan server.`);
});
