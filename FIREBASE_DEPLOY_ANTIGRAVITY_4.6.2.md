# Tugas Google Antigravity — Deploy SIMNI-GADM v4.6.2

## Cakupan Tunggal

Deploy paket SIMNI-GADM v4.6.2 ke Firebase project `admin-kelas-3a`. Jangan mengubah source, data pengguna, workspace, tahun buku, role, Cloudflare Worker, Cloudinary, secret, billing, atau layanan lain.

## Larangan

1. Gunakan Firebase Spark/free tier. Jangan mengaktifkan Blaze, Cloud Functions, App Hosting, extension, atau layanan berbayar.
2. Jangan menjalankan `firebase init`.
3. Jangan melakukan reset tahun buku, migrasi workspace, import data, penghapusan data, atau perubahan RTDB/Firestore melalui console.
4. Jangan deploy `chat/edge/worker.js`; Worker Chat Cloudflare yang aktif tidak diubah.
5. Jangan menulis secret, service-account key, token CLI, atau credential ke source, log, ZIP, dan output hosting.
6. Hentikan proses bila satu gerbang QA gagal.
7. Deploy Hosting hanya setelah Firestore rules/indexes dan RTDB rules sukses.

## Artefak

- ZIP: `test-output/SIMNI-GADM-v4.6.2-PRODUCTION-READY.zip`
- Checksum: `test-output/SIMNI-GADM-v4.6.2-PRODUCTION-READY.sha256`
- Laporan: `GADM_RECONSTRUCTION_AND_MOBILE_QA_REPORT_4.6.2.md`
- Project: `admin-kelas-3a`
- Hosting: `https://admin-kelas-3a.web.app`
- Worker Chat aktif: `https://simni-chat-media-gateway.2ndgoal.workers.dev`

## 1. Verifikasi dan Ekstraksi Paket

Jalankan dari folder `test-output`:

```powershell
$zip = Resolve-Path '.\SIMNI-GADM-v4.6.2-PRODUCTION-READY.zip'
$checksumFile = Resolve-Path '.\SIMNI-GADM-v4.6.2-PRODUCTION-READY.sha256'
$expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split '\s+')[0].ToUpperInvariant()
$actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actual -ne $expected) { throw "Checksum tidak cocok. Expected=$expected Actual=$actual" }
$releaseRoot = Join-Path (Get-Location) 'SIMNI-GADM-v4.6.2-release'
if (Test-Path -LiteralPath $releaseRoot) { throw "Direktori release sudah ada: $releaseRoot" }
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
Expand-Archive -LiteralPath $zip -DestinationPath $releaseRoot
Set-Location -LiteralPath $releaseRoot
Write-Host "PACKAGE CHECKSUM VERIFIED: $actual"
```

Validasi identitas:

```powershell
$package = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath '.\manifest.json' -Raw | ConvertFrom-Json
$firebase = Get-Content -LiteralPath '.\firebase.json' -Raw | ConvertFrom-Json
if ($package.version -ne '4.6.2' -or $manifest.version -ne '4.6.2') { throw 'Versi paket bukan 4.6.2' }
if ($firebase.hosting.public -ne 'public') { throw 'Hosting public directory tidak valid' }
if ($firebase.functions) { throw 'Firebase Functions terdeteksi' }
if (Test-Path -LiteralPath '.\public\qa') { throw 'Fixture QA bocor ke hosting output' }
if (Test-Path -LiteralPath '.\public\chat\edge') { throw 'Source Worker bocor ke hosting output' }
Write-Host 'RELEASE IDENTITY VERIFIED'
```

## 2. Instal Dependensi Terkunci

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci gagal' }
npm ls --all --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'Dependency verification gagal' }
```

Jangan menjalankan `npm update` atau `npm audit fix`.

## 3. QA Wajib

Jalankan secara serial:

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
if ($LASTEXITCODE -ne 0) { throw 'E2E UI gagal' }
node qa/gadm-mobile-workflow-test.mjs
if ($LASTEXITCODE -ne 0) { throw 'GADM mobile workflow gagal' }
```

Hasil minimum:

- Runtime: `167 PASS, 0 FAIL`
- Chat query: `12 PASS, 0 FAIL`
- Chat audio: `17 PASS, 0 FAIL`
- Security: `74 PASS, 0 FAIL`
- GADM engine: `13 PASS, 0 FAIL`
- Static/build: `208 PASS, 0 FAIL`
- E2E UI: `47 PASS, 0 FAIL`
- GADM mobile: `49 PASS, 0 FAIL`
- Total: `587 PASS, 0 FAIL`

Validasi fixture mock tidak bocor:

```powershell
if (-not (Select-String -LiteralPath '.\qa\gadm-mobile-workflow-test.mjs' -Pattern 'qa-superuser-gadm-mobile' -Quiet)) { throw 'Fixture mock Superuser tidak tersedia' }
if (Get-ChildItem -LiteralPath '.\public' -File -Recurse | Select-String -Pattern 'qa-superuser-gadm-mobile' -Quiet) { throw 'Fixture mock bocor ke output hosting' }
```

## 4. Build Hosting Final

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
node scripts/build-hosting.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build hosting gagal' }
```

Validasi output final:

```powershell
$checks = [ordered]@{
    Version = Select-String -LiteralPath '.\public\js\core\runtime-config.js' -Pattern '4\.6\.2' -Quiet
    ServiceWorker = Select-String -LiteralPath '.\public\sw.js' -Pattern '4\.6\.2' -Quiet
    GadmCorpus = Test-Path -LiteralPath '.\public\features\gadm\gadm-curriculum-2026.js'
    GadmMobileQA = -not (Test-Path -LiteralPath '.\public\qa')
    WorkerUrl = Select-String -LiteralPath '.\public\chat\chat.html' -Pattern 'simni-chat-media-gateway\.2ndgoal\.workers\.dev' -Quiet
    WorkerSourceExcluded = -not (Test-Path -LiteralPath '.\public\chat\edge')
    FunctionsExcluded = -not (Test-Path -LiteralPath '.\public\functions')
}
$failed = $checks.GetEnumerator() | Where-Object { -not $_.Value }
if ($failed) { throw ('Output gagal: ' + (($failed | ForEach-Object Key) -join ', ')) }
$checks.GetEnumerator() | ForEach-Object { Write-Host "$($_.Key)=PASS" }
```

## 5. Validasi Target Firebase

```powershell
npx --yes firebase-tools@latest projects:list
if ($LASTEXITCODE -ne 0) { throw 'Firebase authentication gagal' }
npx --yes firebase-tools@latest use admin-kelas-3a
if ($LASTEXITCODE -ne 0) { throw 'Pemilihan project gagal' }
$activeProject = npx --yes firebase-tools@latest use
if ($LASTEXITCODE -ne 0 -or ($activeProject -join "`n") -notmatch 'admin-kelas-3a') { throw 'Project aktif bukan admin-kelas-3a' }
```

## 6. Deploy Berurutan

Firestore rules dan indexes:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only firestore:rules,firestore:indexes --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Firestore gagal; hentikan proses' }
```

RTDB rules:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only database --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy RTDB Rules gagal; hentikan proses' }
```

Hosting:

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only hosting --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting gagal' }
```

## 7. Verifikasi Live

```powershell
$baseUrl = 'https://admin-kelas-3a.web.app'
$nonce = [guid]::NewGuid().ToString('N')
$paths = @(
    'index.html',
    'manifest.json',
    'sw.js',
    'js/core/runtime-config.js',
    'features/gadm/gadm.html',
    'features/gadm/gadm.js',
    'features/gadm/gadm-engine.js',
    'features/gadm/gadm-curriculum-2026.js',
    'chat/chat.html'
)
$responses = @{}
foreach ($path in $paths) {
    $response = Invoke-WebRequest -Uri "$baseUrl/$path?qa=$nonce" -UseBasicParsing
    if ($response.StatusCode -ne 200) { throw "Asset live gagal: $path" }
    $responses[$path] = $response
}
if ($responses['js/core/runtime-config.js'].Content -notmatch '4\.6\.2') { throw 'Runtime live bukan 4.6.2' }
if ($responses['sw.js'].Content -notmatch '4\.6\.2') { throw 'Service Worker live bukan 4.6.2' }
if ($responses['features/gadm/gadm-curriculum-2026.js'].Content -notmatch '046/H/KR/2025') { throw 'Corpus CP GADM belum live' }
if ($responses['features/gadm/gadm.html'].Content -notmatch 'Buat Dokumen Baru') { throw 'Toolbar GADM belum live' }
if ($responses['chat/chat.html'].Content -notmatch 'simni-chat-media-gateway\.2ndgoal\.workers\.dev') { throw 'Worker URL live salah' }
$csp = [string]$responses['index.html'].Headers['Content-Security-Policy']
if ($csp -notmatch "script-src-attr 'none'" -or $csp -notmatch "object-src 'none'" -or $csp -notmatch "media-src 'self' blob:") { throw 'CSP live tidak valid' }
Write-Host 'SIMNI-GADM v4.6.2 LIVE VERIFICATION PASS'
```

## Output Laporan Antigravity

Laporkan hanya fakta berikut:

- SHA-256 paket yang diverifikasi.
- Hasil masing-masing QA gate.
- Project Firebase aktif.
- Hasil deploy Firestore rules/indexes.
- Hasil deploy RTDB rules.
- Hasil deploy Hosting.
- URL release.
- Hasil verifikasi live setiap asset.
- Konfirmasi tidak ada layanan berbayar yang diaktifkan.
- Konfirmasi tidak ada data produksi, workspace, tahun buku, role, Worker Cloudflare, Cloudinary, atau secret yang diubah.
