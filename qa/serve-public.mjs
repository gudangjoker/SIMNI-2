import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';

const publicRoot = path.resolve(process.cwd(), 'public');
const port = Number.parseInt(process.env.SIMNI_QA_PORT || '4173', 10);
const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webmanifest', 'application/manifest+json']
]);

function resolveRequestPath(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolvedPath = path.resolve(publicRoot, relativePath);
    const boundary = `${publicRoot}${path.sep}`;
    return resolvedPath === publicRoot || resolvedPath.startsWith(boundary) ? resolvedPath : null;
}

const server = createServer((request, response) => {
    const filePath = resolveRequestPath(request.url);
    if (!filePath) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
    }

    try {
        const metadata = statSync(filePath);
        if (!metadata.isFile()) throw new Error('Not a file');
        response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Length': metadata.size,
            'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
        });
        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not Found');
    }
});

server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`SIMNI QA server listening on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
