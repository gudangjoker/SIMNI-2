import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const out = path.resolve('test-output/tahap7-final');
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile('public/build-manifest.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
async function assertArtifact() {
    const current = JSON.parse(await readFile('public/build-manifest.json', 'utf8'));
    if (current.buildId !== manifest.buildId) throw Error('Build changed during QA');
    for (const [file, expected] of Object.entries(manifest.files)) {
        if (hash(await readFile(path.join('public', file))) !== expected) throw Error(`Artifact mutated during QA: ${file}`);
    }
}
const scripts = [
    'qa/three-findings-local.mjs', 'qa/admin-operations-regression.mjs', 'qa/admin-client-retry.mjs',
    'qa/runtime-sandbox-test.js', 'qa/chat-removal-regression.mjs', 'qa/asset-worker-regression.mjs',
    'qa/security-contract-regression.mjs', 'qa/gadm-engine-regression.mjs', 'qa/lps-contract-regression.mjs',
    'qa/excel-template-regression.mjs', 'qa/static-contract-regression.mjs',
    'qa/backup-recovery-contract-test.mjs', 'qa/database-capacity-contract-test.mjs',
    'qa/tahap7-lifecycle-browser.mjs', 'qa/academic-uiux-regression.mjs',
    'qa/gadm-mobile-workflow-test.mjs', 'qa/uiux-reconstruction-test.mjs',
    'qa/uiux-reflow-verification.mjs', 'qa/lps-template-workflow.mjs', 'qa/lps-release-audit.mjs'
];
const evidence = { version: manifest.version, buildId: manifest.buildId, startedAt: new Date().toISOString(), suites: [], scope: 'Local contracts and browser fixtures; emulator, native XLSX fidelity, live baseline and release blockers reported separately' };
try {
    await assertArtifact();
    for (const script of scripts) {
        const started = Date.now();
        let stdout = '', stderr = '';
        const code = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: process.env, windowsHide: true, timeout: 600000 });
            child.stdout.on('data', data => stdout += data);
            child.stderr.on('data', data => stderr += data);
            child.on('error', reject); child.on('close', resolve);
        });
        const log = path.basename(script) + '.log';
        await writeFile(path.join(out, log), stdout + '\nSTDERR\n' + stderr);
        evidence.suites.push({ script, status: code === 0 ? 'PASS' : 'FAIL', exitCode: code, seconds: (Date.now() - started) / 1000, log, logHash: hash(stdout + '\nSTDERR\n' + stderr) });
        await assertArtifact();
        await writeFile(path.join(out, 'cumulative-results.json'), JSON.stringify(evidence, null, 2));
        console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${script}`);
        if (code !== 0) { console.error((stdout + stderr).slice(-3500)); process.exitCode = 1; break; }
    }
} catch (error) { evidence.fatal = error.stack; console.error(error); process.exitCode = 1; }
finally { evidence.completedAt = new Date().toISOString(); await writeFile(path.join(out, 'cumulative-results.json'), JSON.stringify(evidence, null, 2)); }
