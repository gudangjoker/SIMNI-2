# Tugas Google Antigravity — Deploy SIMNI PWA v4.5.7

Lakukan hanya deployment Firebase Hosting untuk hotfix SIMNI PWA v4.5.7. Jangan mengubah source, data produksi, Firebase Authentication, RTDB, Firestore Rules/indexes, Cloudflare Worker/R2, Cloudinary, secret, role, workspace, atau konfigurasi billing.

## Target tetap

- Firebase project: `admin-kelas-3a`
- Hosting URL: `https://admin-kelas-3a.web.app`
- Worker Chat: `https://simni-chat-media-gateway.2ndgoal.workers.dev`
- Firebase plan: Spark/Free Tier
- Scope deploy: `hosting` saja

## Urutan wajib

1. Ekstrak paket `SIMNI-v4.5.7-FIREBASE-HOTFIX-READY.zip` ke direktori kerja kosong.
2. Verifikasi SHA-256 paket dengan nilai pada `SIMNI-v4.5.7-FIREBASE-HOTFIX-READY.sha256`.
3. Jalankan `npm ci` tanpa mengubah versi dependency atau lockfile.
4. Set environment build berikut pada proses saat ini:

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
```

5. Jalankan seluruh gerbang QA dan hentikan proses pada kegagalan pertama:

```powershell
node qa/runtime-sandbox-test.js
if ($LASTEXITCODE -ne 0) { throw 'Runtime sandbox gagal' }

node qa/chat-query-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chat query regression gagal' }

node qa/security-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Security contract gagal' }

node qa/static-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Static/build contract gagal' }

node qa/e2e-ui-test.mjs
if ($LASTEXITCODE -ne 0) { throw 'E2E UI/PWA gagal' }
```

6. Karena static QA membuat build terisolasi, bangun ulang output produksi setelah seluruh QA lulus:

```powershell
node scripts/build-hosting.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build Hosting produksi gagal' }
```

7. Pastikan project aktif tepat `admin-kelas-3a`:

```powershell
npx --yes firebase-tools@latest use admin-kelas-3a
npx --yes firebase-tools@latest use
```

8. Deploy hanya Hosting. Dilarang memakai `--only database`, `--only firestore`, `--only functions`, atau deploy tanpa pembatas scope:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only hosting --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting v4.5.7 gagal' }
```

9. Verifikasi live dengan cache-buster:

```powershell
$baseUrl = 'https://admin-kelas-3a.web.app'
$cacheBust = [guid]::NewGuid().ToString('N')
$manifest = Invoke-WebRequest -Uri "$baseUrl/manifest.json?t=$cacheBust" -UseBasicParsing
$serviceWorker = Invoke-WebRequest -Uri "$baseUrl/sw.js?t=$cacheBust" -UseBasicParsing
$runtimeConfig = Invoke-WebRequest -Uri "$baseUrl/js/core/runtime-config.js?t=$cacheBust" -UseBasicParsing
$chat = Invoke-WebRequest -Uri "$baseUrl/chat/chat.html?t=$cacheBust" -UseBasicParsing

if ($manifest.StatusCode -ne 200 -or $manifest.Content -notmatch '4\.5\.7') { throw 'Manifest live bukan v4.5.7' }
if ($serviceWorker.StatusCode -ne 200 -or $serviceWorker.Content -notmatch '4\.5\.7') { throw 'Service Worker live bukan v4.5.7' }
if ($runtimeConfig.StatusCode -ne 200 -or $runtimeConfig.Content -notmatch '4\.5\.7') { throw 'Runtime config live bukan v4.5.7' }
if ($chat.StatusCode -ne 200 -or $chat.Content -notmatch 'simni-chat-media-gateway\.2ndgoal\.workers\.dev') { throw 'Endpoint Worker Chat live tidak tepat' }
if ($chat.Content -notmatch 'simni-chat-fcm-vapid-key') { throw 'Public VAPID key tidak terdapat pada build live' }

Write-Host 'SIMNI v4.5.7 LIVE VERIFICATION PASSED'
```

## Kriteria selesai

- Lima gerbang QA lulus dengan 455 PASS dan 0 FAIL.
- Build produksi selesai setelah QA.
- Firebase CLI melaporkan `release complete` untuk Hosting.
- Manifest, Service Worker, dan runtime config live menunjukkan v4.5.7.
- Chat live menunjukkan Worker URL dan public VAPID key yang benar.
- Tidak ada layanan berbayar yang diaktifkan.
- Tidak ada deploy atau mutasi terhadap database/rules/cloud service.

Berikan laporan fakta berisi waktu deployment, hasil setiap gerbang QA, Firebase project aktif, release status, URL live, hasil verifikasi live, serta SHA-256 paket yang digunakan.
