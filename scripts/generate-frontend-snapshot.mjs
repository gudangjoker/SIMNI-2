import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const frontendRoot = path.join(root, 'F dan D', 'frontend');
const outputFile = path.join(root, 'SNAPSHOT_SOURCE_FRONTEND.md');
const frontendCopy = path.join(frontendRoot, 'SNAPSHOT_SOURCE_FRONTEND.md');

const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.xlsx', '.pdf', '.zip', '.apk', '.gz', '.tgz', '.wasm'
]);

function getLanguage(ext) {
    switch (ext) {
        case '.html': return 'html';
        case '.js': return 'javascript';
        case '.css': return 'css';
        case '.json': return 'json';
        case '.md': return 'markdown';
        default: return 'text';
    }
}

async function collectFiles(dir) {
    const list = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const rel = path.relative(frontendRoot, fullPath).replace(/\\/g, '/');

        // Skip massive build output distribution 'public', android build intermediates, and git/node_modules
        if (entry.isDirectory()) {
            if (['public', 'android', 'node_modules', '.git'].includes(entry.name)) {
                list.push({ rel, isDir: true, fullPath, isSkippedDir: true });
            } else {
                list.push({ rel, isDir: true, fullPath });
                list.push(...await collectFiles(fullPath));
            }
        } else {
            const s = await stat(fullPath);
            list.push({ rel, isDir: false, fullPath, size: s.size });
        }
    }
    return list;
}

console.log('Mengumpulkan daftar berkas frontend...');
const allEntries = await collectFiles(frontendRoot);

// Generate Directory Structure Tree
let treeOutput = '# SNAPSHOT SOURCE KODE FRONTEND SIMNI PWA (v4.8.2)\n\n';
treeOutput += `> Waktu Pembuatan: ${new Date().toISOString()}\n`;
treeOutput += '> Direktori Sumber: `F dan D/frontend/`\n';
treeOutput += '> Deskripsi: Dokumentasi snapshot lengkap seluruh berkas source code, tata letak antarmuka, modul UI, JavaScript klien, CSS, serta metadata aset frontend.\n\n';

treeOutput += '## 1. STRUKTUR DIREKTORI FRONTEND\n\n```text\nF dan D/frontend/\n';

const sortedEntries = allEntries.slice().sort((a, b) => a.rel.localeCompare(b.rel));

for (const item of sortedEntries) {
    const depth = item.rel.split('/').length;
    const indent = '  '.repeat(depth);
    const basename = path.basename(item.rel);
    if (item.isDir) {
        treeOutput += `${indent}├── ${basename}/\n`;
    } else {
        treeOutput += `${indent}├── ${basename} (${item.size.toLocaleString()} bytes)\n`;
    }
}
treeOutput += '```\n\n---\n\n## 2. SNAPSHOT LENGKAP SOURCE CODE FILE FRONTEND\n\n';

let counter = 0;
for (const item of sortedEntries) {
    if (item.isDir) continue;
    if (item.rel === 'SNAPSHOT_SOURCE_FRONTEND.md') continue;

    counter++;
    const ext = path.extname(item.rel).toLowerCase();
    const isBinary = binaryExtensions.has(ext) || item.rel.endsWith('.wasm.js');

    console.log(`[${counter}] Menulis snapshot: ${item.rel}`);

    treeOutput += `### [${counter}] ${path.basename(item.rel)}\n\n`;
    treeOutput += `- **Judul File**: \`${path.basename(item.rel)}\`\n`;
    treeOutput += `- **Path Direktori**: \`F dan D/frontend/${item.rel}\`\n`;
    treeOutput += `- **Ukuran**: ${item.size.toLocaleString()} bytes\n`;
    treeOutput += `- **Tipe**: ${isBinary ? 'Berkas Biner / Asset' : 'Source Code Teks'}\n\n`;

    if (isBinary) {
        treeOutput += `> *[Catatan Aset Biner]*: Berkas ini merupakan aset biner/kompilasi (\`${ext}\`). Isi biner disimpan dalam direktori \`F dan D/frontend/${item.rel}\`.\n\n---\n\n`;
    } else {
        try {
            const content = await readFile(item.fullPath, 'utf8');
            const lang = getLanguage(ext);
            // Protect codeblocks from triple-backtick collision
            const safeContent = content.replace(/```/g, '` ` `');
            treeOutput += `\`\`\`${lang}\n${safeContent}\n\`\`\`\n\n---\n\n`;
        } catch (err) {
            treeOutput += `> *Gagal membaca isi berkas*: ${err.message}\n\n---\n\n`;
        }
    }
}

await writeFile(outputFile, treeOutput, 'utf8');
await writeFile(frontendCopy, treeOutput, 'utf8');

console.log(`\nBERHASIL: Snapshot frontend telah dibuat di:\n- ${outputFile}\n- ${frontendCopy}\nTotal file yang didokumentasikan: ${counter}`);
