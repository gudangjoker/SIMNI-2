# PANDUAN LENGKAP PEMBANGUNAN SIMNI DARI NOL MENJADI APK ANDROID (ARSITEKTUR KOTLIN NATIVE)
## Master Engineering Blueprint: From Zero to Installable .APK

> **CETAK BIRU TEKNIS PENGEMBANGAN NATIVE ANDROID**  
> Dokumen ini memuat seluruh panduan arsitektur, desain sistem, struktur dependensi, spesifikasi basis data, alur sinkronisasi, antarmuka Jetpack Compose, hingga pipeline kompilasi build release untuk membangun kembali aplikasi **SIMNI** dari nol (*from scratch*) sebagai aplikasi **Android Native murni** berbasis bahasa **Kotlin** dengan hasil akhir berkas **.APK** yang siap diinstal di ponsel pintar.

---

## 1. VISI ARSITEKTUR & KEUNGGULAN KOTLIN NATIVE

### 1.1 Mengapa Membangun SIMNI dalam Kotlin Native?
Versi web PWA SIMNI 4.7.2 telah berhasil menyelesaikan audit offline dan sinkronisasi cloud. Namun, ketika target akhirnya adalah perangkat ponsel Android, arsitektur **Kotlin Native** memberikan lompatan performa dan ketahanan sistem yang jauh lebih tinggi:
1. **Performa Rendering 60-120 FPS:** Menggunakan **Jetpack Compose** murni tanpa perantara WebView/browser engine, menghilangkan lag (*stutter*) saat guru menggulir daftar ratusan siswa atau matriks nilai.
2. **Kamera & Pemindai QR Instan:** Integrasi langsung dengan **CameraX API** dan **Google ML Kit Barcode Scanning**, memindai kartu presensi siswa dalam waktu kurang dari 50 milidetik (jauh lebih cepat dibanding pustaka JS web kamera).
3. **Background Sync Tanpa Batas:** Menggunakan **Android WorkManager** yang memiliki kontrak resmi dengan sistem operasi Android. Sinkronisasi data ke cloud tetap berjalan di latar belakang meskipun aplikasi ditutup atau layar ponsel mati.
4. **Penyimpanan Lokal Kelas Enterprise (Room Database):** Menggantikan IndexedDB browser dengan SQLite/Room yang mendukung kueri multi-tabel, indeks kompleks, dan kapasitas penyimpanan gigabyte tanpa risiko pembersihan cache sepihak oleh browser.
5. **Keamanan Tingkat Perangkat Keras (Android Keystore):** Token autentikasi Firebase dan kredensial sesi disimpan di dalam enkripsi berbasis hardware (TEE/StrongBox) melalui `EncryptedSharedPreferences`.

---

## 2. POLA ARSITEKTUR PERANGKAT LUNAK (CLEAN ARCHITECTURE + MVI/MVVM)

Aplikasi dibangun di atas standar arsitektur Google untuk Android:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                              │
│  Jetpack Compose UI (Screens, Cards, Modals) <---> ViewModel (StateFlow) │
└─────────────────────────────────────▲─────────────────────────────────────┘
                                      │ UI State / User Intent
┌─────────────────────────────────────▼─────────────────────────────────────┐
│                              DOMAIN LAYER                                 │
│  UseCases / Interactors (Pure Kotlin Business Logic without Android SDK)  │
│  - GetStudentsUseCase               - CalculateLPSReportUseCase           │
│  - RecordAttendanceUseCase          - ExecuteAdminCommitUseCase           │
│  - SaveGradesMatrixUseCase          - GenerateGADMDocxUseCase             │
└─────────────────────────────────────▲─────────────────────────────────────┘
                                      │ Data Flow
┌─────────────────────────────────────▼─────────────────────────────────────┐
│                               DATA LAYER                                  │
│  Repository Implementations (Offline-First Single Source of Truth)        │
│          ┌──────────────────────────┴──────────────────────────┐          │
│          ▼                                                     ▼          │
│  Local Data Source                                    Remote Data Source  │
│  - Room Database (SQLite)                             - Firebase RTDB SDK │
│  - Encrypted DataStore                                - Ktor Edge Client  │
│  - Local File Storage                                 - Cloudinary SDK    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. STRUKTUR PAKET PROYEK ANDROID STUDIO (MULTI-MODULE)

Struktur modular menjamin kode bersih, *compile time* cepat, dan isolasi dependensi yang baik:

```
simni-android/
├── app/                                    # Modul aplikasi utama & DI Application class
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   └── kotlin/id/my/simni/app/
│   │       ├── SIMNIApplication.kt         # Hilt Application container & Timber logger
│   │       └── MainActivity.kt             # Single Activity pembawa NavHost Compose
│   └── build.gradle.kts
│
├── core/                                   # Modul pondasi bersama
│   ├── model/                              # Entitas domain murni (Student, Grade, Attendance)
│   ├── database/                           # Room DB, Entity SQLite, DAO, TypeConverters
│   ├── network/                            # Firebase RTDB adapter, Ktor HTTP, OkHttp, Interceptors
│   ├── common/                             # Dispatchers, Result wrapper, Date formatter
│   └── ui/                                 # Material 3 Theme, Typography, Reusable Dialogs
│
└── feature/                                # Modul fungsional per fitur
    ├── auth/                               # Login Google Firebase & Session guard
    ├── dashboard/                          # Ringkasan eksekutif & grafik tren
    ├── students/                           # Direktori siswa, Import/Export Excel, QR Card
    ├── attendance/                         # Scanner QR CameraX & Presensi Harian
    ├── grades/                             # Entri nilai Formatif/Sumatif, Kriteria TP/LM
    ├── journal/                            # Jurnal mengajar harian guru
    ├── notes/                              # Catatan pembinaan anekdot siswa
    ├── gadm/                               # Generator RPP/Modul Ajar & Docx Builder
    ├── lps/                                # Engine Rapor LPS & BLP, Excel & PDF Renderer
    ├── documents/                          # Galeri LKPD & Cloudinary Uploader
    ├── backup/                             # Export/Import JSON database & Checksum
    └── settings/                           # Konfigurasi profil sekolah & ganti tahun
```

---

## 4. DESAIN BASIS DATA LOKAL (ROOM DATABASE)

Room Database bertindak sebagai *Single Source of Truth* di ponsel guru:

### 4.1 Entitas SQLite Utama (`core:database`)

```kotlin
package id.my.simni.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index

// 1. Entitas Siswa
@Entity(
    tableName = "students",
    indices = [Index(value = ["nisn"], unique = true), Index(value = ["workspaceId", "academicYearId"])]
)
data class StudentEntity(
    @PrimaryKey val id: String,
    val workspaceId: String,
    val academicYearId: String,
    val nis: String,
    val nisn: String,
    val name: String,
    val nickname: String,
    val gender: String, // "L" atau "P"
    val birthPlace: String,
    val birthDate: String,
    val parentName: String,
    val parentPhone: String,
    val status: String = "active",
    val syncedAt: Long = System.currentTimeMillis()
)

// 2. Entitas Presensi Harian
@Entity(
    tableName = "attendance",
    indices = [Index(value = ["studentId", "date"], unique = true), Index(value = ["workspaceId", "academicYearId"])]
)
data class AttendanceEntity(
    @PrimaryKey val id: String, // "${studentId}_${date}"
    val studentId: String,
    val workspaceId: String,
    val academicYearId: String,
    val date: String, // "YYYY-MM-DD"
    val status: String, // "H", "S", "I", "A"
    val notes: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val isPendingSync: Boolean = false
)

// 3. Entitas Nilai Asesmen
@Entity(
    tableName = "grades",
    indices = [Index(value = ["studentId", "subjectId", "tpId"], unique = true)]
)
data class GradeEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val subjectId: String,
    val tpId: String,
    val assessmentType: String, // "FORMATIVE" atau "SUMMATIVE_LM"
    val score: Double,
    val semester: Int,
    val academicYearId: String,
    val updatedAt: Long = System.currentTimeMillis(),
    val isPendingSync: Boolean = false
)

// 4. Entitas Jurnal Pembelajaran
@Entity(tableName = "learning_journals")
data class JournalEntity(
    @PrimaryKey val id: String,
    val workspaceId: String,
    val academicYearId: String,
    val date: String,
    val subjectId: String,
    val learningObjective: String,
    val activitySummary: String,
    val reflection: String,
    val updatedAt: Long = System.currentTimeMillis()
)

// 5. Entitas Catatan Perkembangan Siswa
@Entity(tableName = "student_notes")
data class StudentNoteEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val date: String,
    val category: String, // "Karakter", "Akademik", "Sosial"
    val description: String,
    val followUpAction: String?,
    val updatedAt: Long = System.currentTimeMillis()
)
```

---

## 5. MESIN SINKRONISASI REAL-TIME & WORKER LATAR BELAKANG

### 5.1 Adaptor Flow Firebase Realtime Database
Alih-alih listener berbasis callback konvensional, SDK Android dihubungkan ke Kotlin Coroutines Flow:

```kotlin
package id.my.simni.core.network

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

fun DatabaseReference.observeValue(): Flow<DataSnapshot> = callbackFlow {
    val listener = object : ValueEventListener {
        override fun onDataChange(snapshot: DataSnapshot) {
            trySend(snapshot)
        }
        override fun onCancelled(error: DatabaseError) {
            close(error.toException())
        }
    }
    addValueEventListener(listener)
    awaitClose { removeEventListener(listener) }
}
```

### 5.2 Latar Belakang Sinkronisasi Otomatis (`SyncWorker`)
Menggunakan Android `WorkManager` untuk menyalurkan antrean perubahan lokal saat ponsel terhubung ke WiFi/Data:

```kotlin
package id.my.simni.core.network.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import id.my.simni.core.database.dao.AttendanceDao
import id.my.simni.core.database.dao.GradeDao
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.tasks.await

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val attendanceDao: AttendanceDao,
    private val gradeDao: GradeDao,
    private val firebaseDb: FirebaseDatabase
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            // 1. Eksekusi antrean presensi yang belum tersinkron
            val pendingAttendance = attendanceDao.getPendingSyncAttendance()
            for (att in pendingAttendance) {
                val path = "workspaces/${att.workspaceId}/data/${att.academicYearId}/attendance/${att.date}/${att.studentId}"
                firebaseDb.getReference(path).setValue(att).await()
                attendanceDao.markSynced(att.id)
            }
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
```

---

## 6. INTEGRASI WORKER EDGE GATEWAY (KOMUNIKASI REST KTOR/RETROFIT)

Untuk mutasi berisiko tinggi (pemulihan restore, pergantian tahun, dan pembuatan token Cloudinary), Kotlin berkomunikasi ke Cloudflare Worker:

```kotlin
package id.my.simni.core.network.api

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.http.*
import javax.inject.Inject

class SimniEdgeClient @Inject constructor(
    private val httpClient: HttpClient
) {
    private val edgeUrl = "https://simni-assets-gateway.2ndgoal.workers.dev"

    suspend fun commitAdminOperation(
        bearerToken: String,
        operationId: String,
        action: String,
        payloadUpdates: Map<String, Any?>
    ): AdminCommitResponse {
        return httpClient.post("$edgeUrl/v1/admin/commit") {
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Authorization, "Bearer $bearerToken")
            setBody(AdminCommitRequest(operationId, action, payloadUpdates))
        }.body()
    }
}
```

---

## 7. ANTARMUKA JETPACK COMPOSE (PENGGANTI SELURUH HTML/CSS SIMNI)

### 7.1 Presensi Siswa & Pemindai QR Kamera (`CameraX + ML Kit`)

```kotlin
package id.my.simni.feature.attendance

import androidx.camera.core.*
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@Composable
fun QrAttendanceScanner(
    onStudentScanned: (studentId: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val scanner = remember { BarcodeScanning.getClient() }

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            val cameraProviderFuture = androidx.camera.lifecycle.ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build().also { imageAnalysis ->
                        imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                scanner.process(image)
                                    .addOnSuccessListener { barcodes ->
                                        for (barcode in barcodes) {
                                            barcode.rawValue?.let { scannedId ->
                                                onStudentScanned(scannedId)
                                            }
                                        }
                                    }
                                    .addOnCompleteListener { imageProxy.close() }
                            } else {
                                imageProxy.close()
                            }
                        }
                    }
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            }, androidx.core.content.ContextCompat.getMainExecutor(ctx))
            previewView
        },
        modifier = modifier.fillMaxSize()
    )
}
```

---

## 8. EKSPOR RAPOR EXCEL & WORD DOKUMEN MODUL AJAR (KOTLIN NATIVE)

### 8.1 Generator Excel Rapor LPS/BLP Menggunakan Apache POI
Alih-alih `exceljs` peramban, di Android native kita menggunakan **Apache POI untuk Android**:
- Membuka template `assets/templates/BLP_template.xlsx`.
- Mengisi nama siswa, NISN, skor nilai per TP, rumus `AVERAGE()`, dan narasi otomatis.
- Menyimpan berkas ke direktori unduhan pengguna (`Environment.DIRECTORY_DOWNLOADS`).

### 8.2 Generator Dokumen Word GADM (.docx)
- Menggunakan `XWPFDocument` dari Apache POI.
- Mengompilasi format RPP/Modul Ajar Kurikulum Merdeka lengkap dengan tabel instrumen penilaian, rubrik, dan kop resmi SDIT Bina Madani.

---

## 9. SPESIFIKASI DEPENDENSI GRADLE (`app/build.gradle.kts`)

Berikut adalah konfigurasi lengkap `build.gradle.kts` untuk menghasilkan berkas APK rilis yang optimal:

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.google.services)
}

android {
    namespace = "id.my.simni.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.my.simni.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 40702
        versionName = "4.7.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            storeFile = file("../keystore/simni-release-key.jks")
            storePassword = System.getenv("SIMNI_KEYSTORE_PASSWORD") ?: "SimniSecretKey2026"
            keyAlias = "simni-alias"
            keyPassword = System.getenv("SIMNI_KEY_PASSWORD") ?: "SimniSecretKey2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // 1. AndroidX Core & Lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    // 2. Jetpack Compose Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // 3. Dependency Injection (Hilt)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // 4. Room Database (SQLite)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // 5. Firebase Android SDK (BOM)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth.ktx)
    implementation(libs.firebase.database.ktx)

    // 6. CameraX & ML Kit Barcode
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.google.mlkit.barcode.scanning)

    // 7. Network (Ktor Client & OkHttp)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)

    // 8. Office Documents (Apache POI for Android)
    implementation("org.apache.poi:poi:5.2.5")
    implementation("org.apache.poi:poi-ooxml:5.2.5")

    // 9. WorkManager
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.hilt.work)
}
```

---

## 10. PANDUAN EKSEKUSI LANGKAH-DEMI-LANGKAH (DARI NOL SAMPAI MENJADI .APK)

Berikut adalah panduan operasional teknis untuk mewujudkan aplikasi dari nol hingga file APK terpasang di perangkat:

### Langkah 1: Persiapan Lingkungan Pengembangan
1. Pasang **JDK 17** (OpenJDK atau Temurin 17 LTS).
2. Pasang **Android Studio** versi terbaru (Ladybug atau Koala).
3. Unduh **Android SDK Platform 35** dan **Android SDK Build-Tools 35.0.0** melalui SDK Manager.

### Langkah 2: Inisialisasi Proyek Android Studio
Jalankan perintah pembuatan proyek melalui terminal atau wizard Android Studio:
- Pilih template: **Empty Compose Activity**.
- Name: `SIMNI`
- Package name: `id.my.simni.app`
- Language: `Kotlin`
- Minimum SDK: `API 26 (Android 8.0 Oreo)` (mencakup 96%+ perangkat aktif).
- Build configuration language: `Kotlin DSL (build.gradle.kts)`.

### Langkah 3: Menghubungkan Firebase Android
1. Buka konsol Firebase di proyek `admin-kelas-3a`.
2. Klik **Add App** $ightarrow$ pilih platform **Android**.
3. Daftarkan nama paket: `id.my.simni.app`.
4. Unduh berkas `google-services.json` dan letakkan di dalam folder `app/google-services.json`.
5. Daftarkan SHA-1 Fingerprint dari keystore debug dan release Anda di konsol Firebase agar Google Sign-In berfungsi normal.

### Langkah 4: Pembuatan Keystore Rilis Resmi
Buka terminal dan buat kunci penandatanganan APK (*Signing Keystore*):
```bash
mkdir keystore
keytool -genkeypair -v -keystore keystore/simni-release-key.jks   -alias simni-alias -keyalg RSA -keysize 2048 -validity 10000   -dname "CN=Aretha Hafiza, OU=IT SIMNI, O=SDIT Bina Madani, L=Depok, ST=Jawa Barat, C=ID"
```

### Langkah 5: Pengaturan ProGuard Rules (`app/proguard-rules.pro`)
Tambahkan aturan agar model data tidak rusak saat diminifikasi:
```proguard
# Pertahankan data model Room dan Firebase
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.firebase.database.PropertyName <fields>;
}
-keep class id.my.simni.core.model.** { *; }
-keep class id.my.simni.core.database.entity.** { *; }

# Apache POI
-dontwarn org.apache.poi.**
-keep class org.apache.poi.** { *; }
```

### Langkah 6: Kompilasi & Pembuatan File .APK Rilis
Jalankan perintah Gradle Wrapper di direktori proyek:
```bash
# Di Windows PowerShell:
.\gradlew clean assembleRelease

# Di Linux / macOS:
./gradlew clean assembleRelease
```

Proses ini akan menjalankan:
1. Kompilasi kode Kotlin dan dependensi KSP.
2. Kompilasi Jetpack Compose UI.
3. Eksekusi optimasi R8 (penyusutan ukuran berkas dan obfuscation).
4. Penandatanganan otomatis APK (*APK Signing V2/V3*) menggunakan kunci keystore release.
5. Pembuatan berkas biner akhir di:
   `app/build/outputs/apk/release/app-release.apk`

### Langkah 7: Pengujian & Instalasi ke Ponsel Fisik
Hubungkan ponsel pintar Android ke komputer via kabel USB dengan opsi **USB Debugging** aktif, kemudian jalankan:
```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Langkah 8: Verifikasi Fungsional di Ponsel
1. **Buka Aplikasi SIMNI:** Pastikan Splash Screen muncul dan dialihkan ke layar login.
2. **Uji Login Google:** Masuk menggunakan akun `unggaran.sditbm@gmail.com` (Superuser) atau `anur.auliya01@gmail.com` (VIP).
3. **Uji Mode Offline:** Matikan WiFi dan Data Seluler. Catat presensi dan nilai. Pastikan data tersimpan instan ke database Room SQLite lokal.
4. **Uji Kamera Scanner QR:** Berikan izin akses kamera dan pindai kartu pelajar siswa. Pastikan status presensi siswa berubah menjadi Hadir dalam hitungan milidetik.
5. **Uji Latar Belakang:** Nyalakan kembali koneksi internet. Pastikan `SyncWorker` menyinkronkan seluruh perubahan ke Firebase Realtime Database cloud secara transparan.
6. **Uji Ekspor Rapor & Modul Ajar:** Tekan tombol unduh rapor Excel atau cetak PDF; pastikan berkas tersimpan rapi di folder `Downloads` ponsel.

---
*Dokumen Cetak Biru Rekonstruksi SIMNI Android APK (Kotlin Native).*
