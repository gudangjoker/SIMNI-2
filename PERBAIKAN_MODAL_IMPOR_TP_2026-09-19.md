# Perbaikan modal pratinjau impor TP

Source aktif dan staging 4.8.0-rc.1 direvisi. Belum build/deploy; pengujian diserahkan kepada Antigravity sesuai pembagian kerja.

## Penyebab dan perbaikan
- Modal Kelola TP membuat sibling inert, termasuk modal pratinjau. Saat pratinjau dibuka, lifecycle dialog sebelumnya tidak melepaskan inert tersebut. navigation.js kini membuka ancestor branch modal teratas dan memulihkan statusnya saat ditutup. Fokus kembali ke modal sebelumnya.
- Panel pratinjau belum memakai flex column dengan batas viewport. grades.html dan shell.css kini menetapkan panel maksimal tinggi viewport, header/footer tidak menyusut, dan hanya isi pratinjau yang menggulir. Tombol minimal 44px, tipe button eksplisit.
- Tidak mengubah parser template, payload, ataupun operasi database impor.

## Uji terarah
1. Buka Kelola TP lalu impor template berisi 10 dan 200 TP. Desktop dengan tinggi 650px serta mobile 360x800: footer Batal/Simpan selalu terlihat, isi dapat digulir sampai baris terakhir.
2. Tutup pratinjau menggunakan ×, Batal, dan Escape pada pembukaan terpisah. Kelola TP kembali interaktif. Tutup Kelola TP: halaman kembali interaktif.
3. Tab/Shift+Tab tetap di modal teratas. Buka ulang pratinjau beberapa kali: tidak ada sisa inert yang mengunci layar.
4. Simpan satu impor ke database mock dan periksa hasil serta kembalinya interaksi ke modal Kelola TP.
5. Karena lifecycle dialog dibagi, lakukan satu cek modal bertingkat lain. Tidak perlu suite menyeluruh.

Sesudah lulus, build dari source yang direvisi dan verifikasi manifest sebelum deployment. Artefak public dan APK belum diubah.
