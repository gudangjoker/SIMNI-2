# RUNBOOK DEPLOYMENT & ROLLBACK SIMNI V.4.7.0

> **Historis — jangan digunakan untuk kandidat 4.7.1.** Lihat `DEPLOYMENT_RUNBOOK_4.7.1.md`. Klaim PASS di dokumen ini tidak mewakili audit final Codex; Chat telah dilepas dan gerbang rilis masih memiliki temuan terbuka.

Dokumen Resmi: **Prosedur Rilis Produksi & Penanganan Mundur (Rollback) SIMNI v4.7.0**  
Tanggal Dokumen: 13 September 2026  
Target Versi: **SIMNI v4.7.0 Enterprise**  
Target Build ID: `60f14d98b350a65a273924fc9aad75a0f4b9b641dc40b8a7be01d4fa3e996630`  

---

> [!CAUTION]
> **PERINGATAN PENTING**:
> Dokumen ini adalah panduan prosedur operasional. Jangan menjalankan runbook ini di lingkungan lokal ini jika sedang dalam mode rekonstruksi lokal terisolasi. Gunakan runbook ini hanya ketika pemilik proyek secara eksplisit memutuskan untuk merilis ke lingkungan cloud produksi live.

---

## 1. Persiapan & Verifikasi Pra-Deployment (Pre-flight Checks)

Sebelum melakukan deployment komponen apa pun, jalankan pemeriksaan integritas lokal wajib:

```powershell
# 1. Pastikan seluruh 17 suite pengujian kumulatif lulus 100%
node qa/final-cumulative-regression.mjs

# 2. Verifikasi kesesuaian manifest dan ketiadaan kebocoran berkas uji
node qa/lps-release-audit.mjs

# 3. Pastikan SHA-256 buildId cocok persis
# Target Build ID: 60f14d98b350a65a273924fc9aad75a0f4b9b641dc40b8a7be01d4fa3e996630
```

Kriteria Lolos Pra-Deployment:
- Seluruh 118 berkas di `public/` cocok dengan hash di `public/build-manifest.json`.
- Tidak ada berkas mock, folder `qa/`, folder `test-output/`, atau kredensial rahasia di dalam direktori `public/`.
- Versi di `package.json`, `package-lock.json`, `manifest.json`, `js/core/runtime-config.js`, dan `sw.js` adalah **4.7.0**.

---

## 2. Urutan Deployment Multi-Komponen (Deployment Sequence)

Komponen harus dideploy secara berurutan untuk menjamin kompatibilitas ke belakang (backward compatibility):

### Langkah 1: Deploy Firestore Security Rules & Indeks
*Tujuan: Memastikan validasi pesan E2EE (IV, ciphertext, AAD, metadata media) aktif sebelum aplikasi web baru memanfaatkannya.*

```powershell
# Deploy security rules Firestore untuk pesan chat
firebase deploy --only firestore:rules

# Deploy indeks Firestore (jika ada pembaruan indeks komposit)
firebase deploy --only firestore:indexes
```

### Langkah 2: Deploy Realtime Database Production Rules
*Tujuan: Mengaktifkan aturan validasi server S03 (`notes`, `journals`, `schedule`, `documents`, `lps`, `archives`) serta proteksi authoritative audit logging S05 (`auditLogs`).*

```powershell
# Deploy aturan database produksi RTDB
firebase deploy --only database
```

### Langkah 3: Deploy Cloudflare Worker (Chat Media Gateway)
*Tujuan: Memastikan signed URL upload R2, scoped cleanup, dan validasi origin siap melayani payload media terenkripsi.*

```powershell
# Masuk ke direktori worker dan deploy menggunakan wrangler
cd chat/edge
npx wrangler deploy
cd ../..
```

### Langkah 4: Deploy Firebase Hosting (`public/`)
*Tujuan: Mempublikasikan app shell minimal, Service Worker v4.7.0, dan modul fitur on-demand.*

```powershell
# Pastikan build public mutakhir
npm run build:hosting

# Deploy HANYA direktori public ke Firebase Hosting
firebase deploy --only hosting
```

---

## 3. Verifikasi Pasca-Deployment (Post-flight Verification)

Setelah deployment selesai di lingkungan live:

1. **Pemeriksaan Service Worker & Cache Busting**:
   - Buka DevTools di browser: tab **Application** → **Service Workers**.
   - Pastikan Service Worker versi baru terdaftar dan aktif.
   - Periksa **Cache Storage**: cache `simni-precache-v4.7.0` dan `simni-runtime-v4.7.0` terbentuk; cache lama `v4.6.9` terhapus otomatis secara atomic.
2. **Pemeriksaan Draf Lokal (Data Invariant Check)**:
   - Periksa tab **IndexedDB** → `SIMNIDraftsDB`.
   - Pastikan draf yang tersimpan sebelum upgrade tidak terhapus.
3. **Pemeriksaan Kunci Chat E2EE**:
   - Periksa tab **IndexedDB** → `simni-chat-crypto-v1`.
   - Pastikan pasangan kunci privat/publik tetap utuh dan pengguna tidak ter-logout paksa dari sesi chat.
4. **Pemeriksaan Authoritative Audit Logging**:
   - Di Firebase Console → Realtime Database → buka node `/auditLogs/{workspaceId}/`.
   - Lakukan satu aksi administratif (misal verifikasi backup).
   - Pastikan entri audit tercatat secara append-only dengan server timestamp (`.sv: timestamp`).

---

## 4. Prosedur Rollback Cepat & Aman (Rollback Procedure)

Jika ditemukan anomali kritis pasca-deployment pada lingkungan live, jalankan rollback bertahap tanpa merusak data pengguna:

### Rollback Hosting (Web App)
Karena aturan database v4.7.0 dirancang backward-compatible penuh dengan skema 4.6.9, rollback hosting dapat dilakukan secara instan:

```powershell
# Opsi A: Rollback via Firebase CLI ke rilis sebelumnya
firebase hosting:rollback

# Opsi B: Redeploy build rilis stabil sebelumnya
git checkout <commit-rilis-sebelumnya>
npm run build:hosting
firebase deploy --only hosting
```

### Rollback Cloudflare Worker
```powershell
cd chat/edge
npx wrangler rollback
cd ../..
```

### Jaminan Keamanan Data Pengguna Saat Rollback:
1. **Draf Formulir**: Draf yang dibuat saat versi 4.7.0 tetap menggunakan struktur IndexedDB kanonik yang sepenuhnya kompatibel dengan pembaca draf versi sebelumnya.
2. **Service Worker Fallback**: Saat versi hosting di-rollback, Service Worker versi sebelumnya akan melakukan atomic activation dan menghapus cache 4.7.0 tanpa menyentuh IndexedDB pengguna.
3. **Kunci Kriptografi**: Kunci chat di `simni-chat-crypto-v1` tidak pernah diubah formatnya, sehingga chat tetap berfungsi normal.
