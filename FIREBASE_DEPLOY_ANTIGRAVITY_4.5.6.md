# Runbook Deploy Firebase SIMNI v4.5.6 untuk Google Antigravity

## Mandat dan Batas Mutlak

Tugas ini hanya mempublikasikan source SIMNI v4.5.6 yang telah disiapkan ke Firebase project `admin-kelas-3a`. Jangan mengubah source, role, workspace, database, Cloudflare Worker, Cloudinary, atau billing.

Dilarang menjalankan:

- `firebase init`
- upgrade Blaze atau aktivasi layanan berbayar
- deploy Firebase Functions
- import, delete, reset, atau overwrite data Firestore/Realtime Database
- Reset Tahun Buku atau migrasi workspace
- pembuatan ulang role Guru 3B
- perubahan secret Worker, API key Cloudinary, preset, bucket R2, atau VAPID key

Hentikan proses jika project aktif bukan `admin-kelas-3a`, satu QA gate gagal, build gagal, atau CLI meminta upgrade billing.

## Direktori Kerja

```powershell
Set-Location -LiteralPath 'C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_PWA_PRODUCTION - Copy - Copy'
```

## 1. Verifikasi Project

```powershell
firebase projects:list
firebase use admin-kelas-3a
firebase use
```

Output project aktif wajib `admin-kelas-3a`.

## 2. Instal Dependensi Terkunci

```powershell
npm ci
```

Jangan mengubah `package.json` atau `package-lock.json`.

## 3. Tetapkan Konfigurasi Build Publik

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
```

Kedua nilai ini adalah konfigurasi publik klien, bukan secret.

## 4. Jalankan Semua Gate QA

Jalankan berurutan dan hentikan deploy pada exit code bukan nol:

```powershell
node qa/runtime-sandbox-test.js
if ($LASTEXITCODE -ne 0) { throw 'Runtime sandbox gagal' }

node qa/chat-query-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chat regression gagal' }

node qa/security-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Security contract gagal' }

node qa/static-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Static/build contract gagal' }

node qa/e2e-ui-test.mjs
if ($LASTEXITCODE -ne 0) { throw 'E2E UI/PWA gagal' }
```

Hasil acuan: 442 PASS, 0 FAIL untuk lima suite lokal. Live integration telah menghasilkan 17 PASS, 0 FAIL sebelum paket diserahkan.

## 5. Bangun Folder Hosting

```powershell
node scripts/build-hosting.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build Hosting gagal' }
```

Verifikasi hasil build:

```powershell
Select-String -LiteralPath 'public\index.html' -Pattern '4.5.6','simni-chat-media-gateway.2ndgoal.workers.dev','BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
Select-String -LiteralPath 'public\sw.js' -Pattern '4.5.6'
Select-String -LiteralPath 'public\manifest.json' -Pattern 'SIMNI'
```

## 6. Deploy Firestore Rules dan Indexes Terlebih Dahulu

```powershell
firebase deploy --project admin-kelas-3a --only firestore:rules,firestore:indexes
if ($LASTEXITCODE -ne 0) { throw 'Deploy Firestore gagal; Hosting tidak boleh dilanjutkan' }
```

## 7. Deploy Realtime Database Rules

```powershell
firebase deploy --project admin-kelas-3a --only database
if ($LASTEXITCODE -ne 0) { throw 'Deploy RTDB Rules gagal; Hosting tidak boleh dilanjutkan' }
```

Perintah ini hanya menerbitkan rules dari `firebase/database.rules.production.json`; jangan menjalankan import database.

## 8. Deploy Hosting Terakhir

```powershell
firebase deploy --project admin-kelas-3a --only hosting
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting gagal' }
```

## 9. Verifikasi Live

```powershell
$simniBaseUrl = 'https://admin-kelas-3a.web.app'
$indexResponse = Invoke-WebRequest -Uri "$simniBaseUrl/index.html" -UseBasicParsing
$manifestResponse = Invoke-WebRequest -Uri "$simniBaseUrl/manifest.json" -UseBasicParsing
$serviceWorkerResponse = Invoke-WebRequest -Uri "$simniBaseUrl/sw.js" -UseBasicParsing

if ($indexResponse.StatusCode -ne 200) { throw 'index.html live gagal' }
if ($manifestResponse.StatusCode -ne 200) { throw 'manifest.json live gagal' }
if ($serviceWorkerResponse.StatusCode -ne 200) { throw 'sw.js live gagal' }
if ($indexResponse.Content -notmatch '4\.5\.6') { throw 'Versi live bukan 4.5.6' }
if ($indexResponse.Content -notmatch 'simni-chat-media-gateway\.2ndgoal\.workers\.dev') { throw 'Worker URL live tidak tepat' }
if ($serviceWorkerResponse.Content -notmatch '4\.5\.6') { throw 'Service Worker live tidak sinkron' }
if ($indexResponse.Headers['Content-Security-Policy'] -notmatch 'workers\.dev') { throw 'CSP live belum mengizinkan Worker' }
```

Lakukan hard reload satu kali dan pastikan Dashboard, Chat, ikon, manifest, dan Service Worker v4.5.6 termuat tanpa error console.

## 10. Laporan Deploy

Laporkan hanya fakta berikut:

- project Firebase yang aktif
- waktu mulai dan selesai deploy dalam zona Asia/Jakarta
- hasil setiap QA gate
- status deploy Firestore rules/indexes
- status deploy RTDB rules
- status deploy Hosting
- URL release Hosting
- hasil verifikasi live index, manifest, Service Worker, versi, Worker URL, dan CSP
- release/version identifier yang diberikan Firebase CLI jika tersedia
- SHA-256 paket sumber yang digunakan

Jangan menyatakan berhasil bila satu gate atau satu verifikasi live gagal.
