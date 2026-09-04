# Runbook Deploy Firebase — SIMNI-GADM v4.6.1

## Mandat

Deploy hanya paket SIMNI-GADM v4.6.1 ke Firebase project `admin-kelas-3a`.

Runbook ini hanya mencakup validasi paket, QA, build, deployment Firebase, dan verifikasi live. Jangan melakukan migrasi workspace, reset tahun buku, perubahan data produksi, perubahan akun/role, deploy Cloudflare Worker, rotasi secret, atau upgrade layanan berbayar.

## Artefak Otoritatif

- Paket: `test-output/SIMNI-GADM-v4.6.1-PRODUCTION-READY.zip`
- Checksum: `test-output/SIMNI-GADM-v4.6.1-PRODUCTION-READY.sha256`
- Laporan paket: `test-output/PACKAGE_VERIFICATION_4.6.1.md`
- Project Firebase: `admin-kelas-3a`
- Hosting: `https://admin-kelas-3a.web.app`
- Worker Chat yang sudah aktif: `https://simni-chat-media-gateway.2ndgoal.workers.dev`

Gunakan isi ZIP yang diekstrak ke direktori kerja kosong. Jangan deploy dari root v4.5.7 atau dari folder `public` lama.

## Tahap 0 — Hapus Direktori Kosong Root Legacy

Seluruh isi root v4.5.7 telah dihapus setelah tujuh bukti migrasi disalin dan diverifikasi ke arsip privat `SIMNI_GADM_INTEGRATION/migration-evidence`. Direktori legacy kosong dapat tetap terlihat selama task Codex lama masih memegang working directory tersebut. Setelah task lama tidak aktif, jalankan pemeriksaan dan penghapusan berikut:

```powershell
$legacyRoot = 'C:\Users\Aretha Hafiza S\Downloads\SIMNI\SIMNI_PWA_PRODUCTION - Copy - Copy'
$expectedParent = 'C:\Users\Aretha Hafiza S\Downloads\SIMNI'
if (Test-Path -LiteralPath $legacyRoot) {
    $resolvedLegacy = (Resolve-Path -LiteralPath $legacyRoot).Path.TrimEnd('\')
    $resolvedParent = (Resolve-Path -LiteralPath ([IO.Path]::GetDirectoryName($resolvedLegacy))).Path.TrimEnd('\')
    if (-not $resolvedLegacy.Equals($legacyRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Target legacy tidak cocok' }
    if (-not $resolvedParent.Equals($expectedParent, [StringComparison]::OrdinalIgnoreCase)) { throw 'Parent target legacy tidak valid' }
    $remaining = @(Get-ChildItem -LiteralPath $resolvedLegacy -Force)
    if ($remaining.Count -ne 0) { throw 'Direktori legacy tidak kosong; penghapusan dibatalkan' }
    Remove-Item -LiteralPath $resolvedLegacy -Force
}
if (Test-Path -LiteralPath $legacyRoot) { throw 'Direktori kosong legacy belum berhasil dihapus' }
Write-Host 'EMPTY LEGACY ROOT REMOVED'
```

Direktori `migration-evidence` pada root 4.6.1 bersifat privat dan tidak boleh dimasukkan ke paket atau output hosting.

## Batasan Mutlak

1. Gunakan Firebase Spark/free tier; jangan mengaktifkan Cloud Functions, App Hosting, ekstensi berbayar, billing, atau Blaze.
2. Jangan menjalankan `firebase init` karena dapat menimpa konfigurasi yang telah diaudit.
3. Jangan mengubah Firebase project selain `admin-kelas-3a`.
4. Jangan menghapus atau menulis data RTDB/Firestore melalui console atau script.
5. Jangan menjalankan migrasi workspace atau reset tahun buku.
6. Jangan deploy `chat/edge/worker.js`; Worker Cloudflare tetap memakai deployment yang sudah aktif.
7. Jangan memasukkan service-account key, Cloudinary API secret, token Firebase CLI, atau secret lain ke source, ZIP, log, maupun output hosting.
8. Hentikan deployment jika salah satu QA gate gagal.
9. Hosting hanya boleh dilakukan setelah rules/indexes berhasil diterbitkan.

## Tahap 1 — Verifikasi Paket

Jalankan dari direktori yang berisi ZIP dan file `.sha256`:

```powershell
$zip = Resolve-Path '.\SIMNI-GADM-v4.6.1-PRODUCTION-READY.zip'
$checksumFile = Resolve-Path '.\SIMNI-GADM-v4.6.1-PRODUCTION-READY.sha256'
$expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split '\s+')[0].ToUpperInvariant()
$actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actual -ne $expected) { throw "Checksum paket tidak cocok. Expected=$expected Actual=$actual" }
$releaseRoot = Join-Path (Get-Location) 'SIMNI-GADM-v4.6.1-release'
if (Test-Path -LiteralPath $releaseRoot) { throw "Direktori release sudah ada: $releaseRoot" }
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
Expand-Archive -LiteralPath $zip -DestinationPath $releaseRoot
Set-Location -LiteralPath $releaseRoot
Write-Host "PACKAGE CHECKSUM VERIFIED: $actual"
```

Validasi identitas rilis:

```powershell
$package = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath '.\manifest.json' -Raw | ConvertFrom-Json
if ($package.version -ne '4.6.1' -or $manifest.version -ne '4.6.1') { throw 'Versi source bukan 4.6.1' }
$firebase = Get-Content -LiteralPath '.\firebase.json' -Raw | ConvertFrom-Json
if ($firebase.hosting.public -ne 'public') { throw 'Hosting public directory tidak valid' }
if ($firebase.functions) { throw 'Firebase Functions terdeteksi; deployment dibatalkan' }
if ((Get-Content -LiteralPath '.\firebase.json' -Raw) -notmatch "media-src 'self' blob:") { throw 'CSP media playback tidak valid' }
Write-Host 'RELEASE IDENTITY VERIFIED'
```

## Tahap 2 — Instalasi Dependensi Terkunci

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci gagal' }
npm ls --all --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'Dependency verification gagal' }
```

Jangan menjalankan `npm update`, `npm audit fix`, atau mengganti versi dependency saat deployment.

## Tahap 3 — QA Wajib

```powershell
node qa/runtime-sandbox-test.js
if ($LASTEXITCODE -ne 0) { throw 'Runtime sandbox gagal' }
node qa/chat-query-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chat query regression gagal' }
node qa/chat-audio-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chat audio regression gagal' }
node qa/security-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Security contract gagal' }
node qa/gadm-engine-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'GADM engine regression gagal' }
node qa/static-contract-regression.mjs
if ($LASTEXITCODE -ne 0) { throw 'Static/build contract gagal' }
node qa/e2e-ui-test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Browser E2E gagal' }
```

Hasil minimum yang wajib diperoleh:

- Runtime sandbox: `167 PASS, 0 FAIL`
- Security contract: `74 PASS, 0 FAIL`
- Chat query: `12 PASS, 0 FAIL`
- Chat audio: `17 PASS, 0 FAIL`
- GADM engine: `8 PASS, 0 FAIL`
- Static/build contract: `203 PASS, 0 FAIL`
- Browser E2E: `47 PASS, 0 FAIL`
- Total: `528 PASS, 0 FAIL`

Mock login Superuser adalah fixture QA. Pastikan fixture tetap berada di `qa/e2e-ui-test.mjs` dan tidak terdapat di `public`.

```powershell
if (-not (Select-String -LiteralPath '.\qa\e2e-ui-test.mjs' -Pattern 'qa-superuser-uid' -Quiet)) { throw 'Fixture mock Superuser QA tidak tersedia' }
if (Select-String -LiteralPath '.\public\index.html' -Pattern 'qa-superuser-uid' -Quiet) { throw 'Fixture QA bocor ke output hosting' }
```

## Tahap 4 — Build Produksi Final

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
node scripts/build-hosting.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build Hosting produksi gagal' }
```

Validasi output:

```powershell
$checks = [ordered]@{
    Version = Select-String -LiteralPath '.\public\js\core\runtime-config.js' -Pattern '4\.6\.1' -Quiet
    Worker = Select-String -LiteralPath '.\public\chat\chat.html' -Pattern 'simni-chat-media-gateway\.2ndgoal\.workers\.dev' -Quiet
    VoicePlayer = Select-String -LiteralPath '.\public\chat\js\chat-ui-handler.js' -Pattern 'createVoicePlayer' -Quiet
    WavRecorder = Select-String -LiteralPath '.\public\chat\js\chat-platform.js' -Pattern 'encodeMonoPcm16Wav' -Quiet
    GadmResolver = Select-String -LiteralPath '.\public\js\core\feature-loader.js' -Pattern 'document\.baseURI' -Quiet
    AuthOwnership = -not (Select-String -LiteralPath '.\public\js\database\sync.js' -Pattern 'lockScreen|unlockScreen' -Quiet)
    QaExcluded = -not (Test-Path -LiteralPath '.\public\qa')
    WorkerSourceExcluded = -not (Test-Path -LiteralPath '.\public\chat\edge')
    FunctionsExcluded = -not (Test-Path -LiteralPath '.\public\functions')
}
$failed = $checks.GetEnumerator() | Where-Object { -not $_.Value }
if ($failed) { throw ('Output Hosting gagal: ' + (($failed | ForEach-Object Key) -join ', ')) }
$checks.GetEnumerator() | ForEach-Object { Write-Host "$($_.Key)=PASS" }
```

## Tahap 5 — Validasi Target Firebase

```powershell
npx --yes firebase-tools@latest projects:list
if ($LASTEXITCODE -ne 0) { throw 'Firebase authentication/project listing gagal' }
npx --yes firebase-tools@latest use admin-kelas-3a
if ($LASTEXITCODE -ne 0) { throw 'Firebase project selection gagal' }
$activeProject = npx --yes firebase-tools@latest use
if ($LASTEXITCODE -ne 0 -or ($activeProject -join "`n") -notmatch 'admin-kelas-3a') { throw 'Project Firebase aktif bukan admin-kelas-3a' }
```

## Tahap 6 — Deployment Berurutan

Deploy rules dan indexes terlebih dahulu:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only firestore:rules,firestore:indexes --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Firestore gagal; Hosting tidak boleh dilanjutkan' }
```

Deploy RTDB Rules:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only database --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy RTDB Rules gagal; Hosting tidak boleh dilanjutkan' }
```

Deploy Hosting terakhir:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only hosting --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting gagal' }
```

## Tahap 7 — Verifikasi Live

```powershell
$baseUrl = 'https://admin-kelas-3a.web.app'
$nonce = [guid]::NewGuid().ToString('N')
$index = Invoke-WebRequest -Uri "$baseUrl/index.html?qa=$nonce" -UseBasicParsing
$manifest = Invoke-WebRequest -Uri "$baseUrl/manifest.json?qa=$nonce" -UseBasicParsing
$serviceWorker = Invoke-WebRequest -Uri "$baseUrl/sw.js?qa=$nonce" -UseBasicParsing
$runtime = Invoke-WebRequest -Uri "$baseUrl/js/core/runtime-config.js?qa=$nonce" -UseBasicParsing
$chat = Invoke-WebRequest -Uri "$baseUrl/chat/chat.html?qa=$nonce" -UseBasicParsing
$voiceUI = Invoke-WebRequest -Uri "$baseUrl/chat/js/chat-ui-handler.js?qa=$nonce" -UseBasicParsing
$voicePlatform = Invoke-WebRequest -Uri "$baseUrl/chat/js/chat-platform.js?qa=$nonce" -UseBasicParsing
$featureLoader = Invoke-WebRequest -Uri "$baseUrl/js/core/feature-loader.js?qa=$nonce" -UseBasicParsing
$sync = Invoke-WebRequest -Uri "$baseUrl/js/database/sync.js?qa=$nonce" -UseBasicParsing
$responses = @($index, $manifest, $serviceWorker, $runtime, $chat, $voiceUI, $voicePlatform, $featureLoader, $sync)
if ($responses.Where({ $_.StatusCode -ne 200 }).Count) { throw 'Satu atau lebih asset live gagal dimuat' }
if ($runtime.Content -notmatch '4\.6\.1' -or $serviceWorker.Content -notmatch 'runtime-config\.js') { throw 'Versi live/Service Worker tidak valid' }
if ($chat.Content -notmatch 'simni-chat-media-gateway\.2ndgoal\.workers\.dev') { throw 'Worker URL live tidak valid' }
if ($voiceUI.Content -notmatch 'createVoicePlayer' -or $voicePlatform.Content -notmatch 'encodeMonoPcm16Wav') { throw 'Voice note player/recorder belum live' }
if ($featureLoader.Content -notmatch 'document\.baseURI') { throw 'Koreksi GADM module resolver belum live' }
if ($sync.Content -match 'lockScreen|unlockScreen') { throw 'Modul sinkronisasi live masih mengendalikan login screen' }
$csp = [string]$index.Headers['Content-Security-Policy']
if ($csp -notmatch "media-src 'self' blob:") { throw 'CSP live memblokir playback voice note' }
if ($csp -notmatch "script-src-attr 'none'" -or $csp -notmatch "object-src 'none'") { throw 'CSP live tidak memenuhi security contract' }
Write-Host 'ALL LIVE ASSET AND HEADER VERIFICATIONS PASSED'
```

## Tahap 8 — Verifikasi Browser Live

Lakukan pada browser desktop dan Android/PWA terpasang:

1. Buka `https://admin-kelas-3a.web.app` dan pastikan versi Dashboard `4.6.1`.
2. Login Superuser dan pastikan Dashboard langsung terbuka.
3. Buka Chat, kirim voice note singkat, lalu putar dari bubble menggunakan Play/Pause dan timeline.
4. Tekan tombol kembali Chat dan pastikan Dashboard langsung tampil tanpa layar login atau freeze.
5. Buka GADM dan pastikan tidak ada request 404 ke `/js/core/features/gadm/gadm.js`.
6. Tutup dan buka kembali PWA, lalu pastikan sesi dipulihkan sesuai Firebase Authentication.
7. Pastikan DevTools Console tidak memiliki unhandled exception, CSP violation, 404 asset, atau mixed-version cache.

Jangan mengirim pesan pengujian ke pengguna lain tanpa kebutuhan. Voice note live boleh diuji antar akun Superuser dan VIP yang memang berada dalam ruang lingkup SIMNI.

## Kriteria Selesai

Deployment hanya boleh dinyatakan berhasil jika seluruh kondisi berikut terpenuhi:

- project Firebase tepat `admin-kelas-3a`;
- QA lokal `528 PASS, 0 FAIL`;
- Firestore rules/indexes sukses;
- RTDB rules sukses;
- Hosting sukses;
- versi live `4.6.1`;
- CSP live mengizinkan hanya media lokal `self` dan `blob:`;
- voice note dapat diputar langsung di Chat;
- tombol kembali Chat mempertahankan Dashboard;
- GADM dimuat tanpa 404;
- tidak ada layanan berbayar yang diaktifkan;
- tidak ada data produksi yang dimigrasikan, direset, dihapus, atau ditimpa.

Catat waktu mulai/selesai, hasil setiap QA gate, output deployment setiap target, URL Hosting, hasil verifikasi live, dan release identifier Firebase pada laporan deployment Antigravity.
