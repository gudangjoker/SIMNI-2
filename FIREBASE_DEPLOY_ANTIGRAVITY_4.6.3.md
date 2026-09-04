# Tugas Google Antigravity — Deploy Hotfix SIMNI-GADM v4.6.3

## Batas Tugas

Deploy paket `SIMNI-GADM-v4.6.3-PRODUCTION-READY.zip` ke Firebase Hosting project `admin-kelas-3a`.

Tugas ini hanya mencakup verifikasi paket, instalasi dependency, QA lokal, build deterministik, deploy Hosting, dan verifikasi live. Jangan mengubah source, Firebase Authentication, RTDB data/rules, Firestore data/rules/indexes, Cloudflare Worker/R2, Cloudinary, secret, billing, role, workspace, atau tahun buku.

Firebase harus tetap Spark/free tier. Jangan mengaktifkan Functions, App Hosting, extension, billing, atau layanan berbayar.

## Paket

- ZIP: `test-output/SIMNI-GADM-v4.6.3-PRODUCTION-READY.zip`
- Checksum: `test-output/SIMNI-GADM-v4.6.3-PRODUCTION-READY.sha256`
- Laporan: `HOTFIX_REPORT_4.6.3.md`

## 1. Verifikasi Paket

```powershell
$zip = Resolve-Path '.\SIMNI-GADM-v4.6.3-PRODUCTION-READY.zip'
$checksumFile = Resolve-Path '.\SIMNI-GADM-v4.6.3-PRODUCTION-READY.sha256'
$expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split '\s+')[0].ToUpperInvariant()
$actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actual -ne $expected) { throw "Checksum paket tidak cocok. Expected=$expected Actual=$actual" }
$releaseRoot = Join-Path (Get-Location) 'SIMNI-GADM-v4.6.3-release'
if (Test-Path -LiteralPath $releaseRoot) { throw "Folder release sudah ada: $releaseRoot" }
Expand-Archive -LiteralPath $zip -DestinationPath $releaseRoot
Set-Location -LiteralPath $releaseRoot
$package = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath '.\manifest.json' -Raw | ConvertFrom-Json
if ($package.version -ne '4.6.3' -or $manifest.version -ne '4.6.3') { throw 'Versi paket bukan 4.6.3' }
if (Test-Path '.\node_modules') { throw 'Paket tidak boleh membawa node_modules' }
if (Test-Path '.\migration-evidence') { throw 'Paket tidak boleh membawa bukti migrasi' }
```

## 2. Pastikan Project Firebase

```powershell
npx --yes firebase-tools@latest projects:list
npx --yes firebase-tools@latest use admin-kelas-3a
npx --yes firebase-tools@latest use
```

Hentikan proses bila project aktif bukan `admin-kelas-3a`.

## 3. Instalasi Dependency

```powershell
npm ci
```

Jangan menjalankan `npm audit fix`, upgrade dependency, atau mengubah lockfile.

## 4. QA Wajib Secara Serial

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'QA gagal; deploy dilarang' }
```

Hasil minimal yang wajib cocok:

- Runtime sandbox: 167 PASS, 0 FAIL.
- Chat query: 12 PASS, 0 FAIL.
- Chat audio: 17 PASS, 0 FAIL.
- Security contract: 75 PASS, 0 FAIL.
- GADM engine: 13 PASS.
- Static/build contract: 210 PASS, 0 FAIL.
- E2E UI/PWA: 50 PASS, 0 FAIL.
- GADM mobile workflow: 49 PASS, 0 FAIL.
- Total: 593 PASS, 0 FAIL.

## 5. Build Hosting Final

```powershell
$env:SIMNI_CHAT_EDGE_URL = 'https://simni-chat-media-gateway.2ndgoal.workers.dev'
$env:SIMNI_CHAT_FCM_VAPID_KEY = 'BGkQwWhZmAYgM6wCJlpTm4OYXPT_hiS9-7HDCL0lIdoDBEzx_sYhsqRD2FHyvgd-wOazKY_7RueEzjqO81eIL0c'
npm run build:hosting
if ($LASTEXITCODE -ne 0) { throw 'Build Hosting gagal' }
```

Pastikan build melaporkan versi `4.6.3` dan output `public`.

## 6. Deploy Hosting Saja

```powershell
npx --yes firebase-tools@latest deploy --project admin-kelas-3a --only hosting --non-interactive --force
if ($LASTEXITCODE -ne 0) { throw 'Deploy Hosting gagal' }
```

Jangan menjalankan deploy `database`, `firestore`, `functions`, atau target lain karena hotfix ini tidak mengubah backend/rules.

## 7. Verifikasi Live

```powershell
$baseUrl = 'https://admin-kelas-3a.web.app'
$nonce = [guid]::NewGuid().ToString('N')
$index = Invoke-WebRequest -Uri "$baseUrl/index.html?qa=$nonce" -UseBasicParsing
$manifest = Invoke-WebRequest -Uri "$baseUrl/manifest.json?qa=$nonce" -UseBasicParsing
$runtime = Invoke-WebRequest -Uri "$baseUrl/js/core/runtime-config.js?qa=$nonce" -UseBasicParsing
$serviceWorker = Invoke-WebRequest -Uri "$baseUrl/sw.js?qa=$nonce" -UseBasicParsing
$auth = Invoke-WebRequest -Uri "$baseUrl/js/auth/auth.js?qa=$nonce" -UseBasicParsing
$shellCss = Invoke-WebRequest -Uri "$baseUrl/js/ui/shell.css?qa=$nonce" -UseBasicParsing
foreach ($response in @($index, $manifest, $runtime, $serviceWorker, $auth, $shellCss)) {
    if ($response.StatusCode -ne 200) { throw 'Satu atau lebih asset live gagal dimuat' }
}
if ($manifest.Content -notmatch '4\.6\.3') { throw 'Manifest live bukan 4.6.3' }
if ($runtime.Content -notmatch '4\.6\.3') { throw 'Runtime live bukan 4.6.3' }
if ($index.Content -notmatch 'data-simni-auth-phase="restoring-session"') { throw 'State pemulihan sesi belum live' }
if ($auth.Content -notmatch 'resumeAuthenticatedSession') { throw 'Lifecycle resume belum live' }
if ($shellCss.Content -notmatch 'mobile-header-brand') { throw 'Header ponsel baru belum live' }
Write-Host 'SIMNI-GADM v4.6.3 LIVE VERIFICATION PASS'
```

## 8. Laporan Deploy

Laporkan project, waktu deploy WIB, semua hasil QA, URL Hosting, release identifier Firebase, hasil verifikasi live, dan SHA-256 paket. Nyatakan deployment gagal bila satu gerbang tidak lulus.
