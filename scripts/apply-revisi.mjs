import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const hash = data => createHash('sha256').update(data).digest('hex');

const srcBase = 'SIMNI_REVISI_4.7.2_LENGKAP_DENGAN_PUBLIC_ANDROID';
const shaLines = readFileSync(path.join(srcBase, 'SHA256SUMS.txt'), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean);

const expectedHashes = {};
for (const line of shaLines) {
  const [expectedHash, relPath] = line.split(/\s+/);
  if (relPath !== 'PETUNJUK.txt') {
    expectedHashes[relPath] = expectedHash;
  }
}

console.log(`Found ${Object.keys(expectedHashes).length} files to apply from SHA256SUMS.txt.`);

let copiedCount = 0;
for (const [relPath, expectedHash] of Object.entries(expectedHashes)) {
  const srcFile = path.join(srcBase, relPath);
  const destFile = path.join('.', relPath);

  if (!existsSync(srcFile)) {
    throw new Error(`Source file missing: ${srcFile}`);
  }

  const srcContent = readFileSync(srcFile);
  const actualHash = hash(srcContent);
  if (actualHash !== expectedHash) {
    throw new Error(`Hash mismatch for ${srcFile}: expected ${expectedHash}, got ${actualHash}`);
  }

  mkdirSync(path.dirname(destFile), { recursive: true });
  copyFileSync(srcFile, destFile);

  const destContent = readFileSync(destFile);
  if (hash(destContent) !== expectedHash) {
    throw new Error(`Verification failed after copying to ${destFile}`);
  }

  console.log(`Copied & Verified: ${destFile}`);
  copiedCount++;
}

console.log(`\nSUCCESS: ${copiedCount} files successfully copied and verified against SHA256SUMS.txt.`);
