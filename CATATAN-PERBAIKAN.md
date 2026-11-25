# Catatan perbaikan DSS (service worker v30)

## Bug yang diperbaiki
1. manifest.json tidak ada (404 dan precache service worker gagal) -> dibuat, lengkap dengan ikon PWA.
2. Modal Foto Profil berada setelah <script>, sehingga tombol foto profil tidak berfungsi -> dipindah sebelum script. Class yang tidak ada (modal-card, modal-header, icon-button) diganti class yang ada.
3. Menu "KPI Suggestion" tidak ada di sidebar padahal halaman dan JS-nya ada -> ditambahkan.
4. "Manfaat Aktual" tidak ikut tersimpan -> actual_benefit ditambahkan ke payload.
5. Tombol Hapus muncul untuk status REVISION_REQUESTED tetapi tidak berfungsi -> hanya tampil untuk DRAFT.
6. URLSearchParams.size diganti toString() (kompatibel dengan browser lama).
7. Sesi kedaluwarsa (401) kini mereset token/user dan menampilkan pesan di login.
8. Statistik dashboard dimuat ulang saat membuka Dashboard; non-admin tidak lagi melihat placeholder "Menunggu integrasi data".
9. Kebocoran memori: blob URL foto (preview dan detail suggestion) kini dilepas.
10. Tombol Escape menutup modal yang terbuka.
11. <div> di dalam <button> (avatar) diganti <span>; class tombol yang tidak ada diganti secondary-btn.
12. Service worker: cache.put tidak lagi menggagalkan respons jaringan, respons 206/Range tidak di-cache, daftar precache disesuaikan.
13. Penamaan konsisten: "Digital System Suggestion".

## Logo
- Logo login dipotong rapat (assets/images/edukasie-dss-logo.jpg).
- Sidebar memakai ikon kubus DSS (assets/icons/dss-icon@2x.png) + teks DSS / IMPROVEMENT SYSTEM.
- Favicon, apple-touch-icon, dan ikon PWA ditambahkan di assets/icons/.

## Catatan
- assets/css/kpi-style-base.css, edukasie-logo*.jpg (selain edukasie-dss-logo.jpg), Logo DSS.png, dan logo-edukasie-dss-badge-landscape.jpg tidak dipakai oleh halaman; aman dihapus bila tidak diperlukan.
- Setelah deploy, buka sekali dan refresh agar service worker v30 aktif.
