import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base = 'test-output/tahap7-takeover-baseline';
const manifest = JSON.parse(await readFile(`${base}/public/build-manifest.json`, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [file, expected] of Object.entries(manifest.files)) {
    let bytes = await readFile(path.join(base, file)).catch(() => null);
    if (bytes && hash(bytes) === expected) continue;
    const current = await readFile(path.join('public', file));
    if (hash(current) === expected) bytes = current;
    else if (bytes && file.endsWith('.html')) {
        const injection = current.toString().match(/  <meta name="simni-chat-edge-url"[^\n]+\n  <meta name="simni-chat-fcm-vapid-key"[^\n]+\n/);
        if (injection) bytes = Buffer.from(bytes.toString().replace('</head>', injection[0] + '</head>'));
    }
    if (!bytes || hash(bytes) !== expected) throw Error(`Cannot reconstruct exact baseline asset: ${file}`);
    await mkdir(path.dirname(path.join(base, file)), { recursive: true });
    await writeFile(path.join(base, file), bytes);
}
console.log(`Baseline ${manifest.version}: ${Object.keys(manifest.files).length} hashes verified`);
