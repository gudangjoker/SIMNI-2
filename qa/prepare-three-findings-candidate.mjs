import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
// Version update only; preserve previous evidence and the baseline artifact.
await mkdir('test-output/three-findings-baseline/final-evidence', { recursive: true });
await cp('test-output/tahap7-final', 'test-output/three-findings-baseline/final-evidence', { recursive: true, force: false, errorOnExist: false });
for (const file of ['package.json', 'package-lock.json', 'manifest.json', 'js/core/runtime-config.js', 'features/dashboard/dashboard.html', 'features/settings/settings.html', 'index.html']) {
    await writeFile(file, (await readFile(file, 'utf8')).replaceAll('4.7.1', '4.7.2'));
}
for (const file of ['scripts/build-hosting.mjs', 'js/services/edge-service.js']) {
    await writeFile(file, (await readFile(file, 'utf8')).replaceAll('https://simni-chat-media-gateway.2ndgoal.workers.dev', 'https://simni-assets-gateway.2ndgoal.workers.dev'));
}
