import { execSync } from 'node:child_process';
import path from 'node:path';

const srcDir = 'SIMNI_REVISI_4.7.2_LENGKAP_DENGAN_PUBLIC_ANDROID';
const files = [
  'features/attendance/attendance.html',
  'features/attendance/attendance.js',
  'features/settings/settings.html',
  'features/settings/settings.js',
  'js/auth/access-context.js',
  'js/core/state.js',
  'js/database/repository.js',
  'js/ui/render.js'
];

for (const f of files) {
  console.log('==============================================');
  console.log(`FILE: ${f}`);
  console.log('==============================================');
  try {
    const diff = execSync(`git diff --no-index "${f}" "${path.join(srcDir, f)}"`, { encoding: 'utf8' });
    console.log(diff.slice(0, 2000));
  } catch (err) {
    if (err.stdout) {
      console.log(err.stdout.slice(0, 2000));
    } else {
      console.error(err.message);
    }
  }
}
