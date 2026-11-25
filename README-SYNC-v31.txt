DSS — SYNC COMPACT v31

File sumber yang disinkronkan:
- index.html: dari index(7).html milik pengguna (tidak diubah).
- manifest.json: dari file manifest.json milik pengguna (tidak diubah).
- assets/: seluruh isi assets.zip milik pengguna dipertahankan.
- assets/css/style.css: ditambahkan aturan compact untuk dashboard landing.
- assets/css/kpi.css: ditambahkan aturan compact untuk halaman KPI.
- service-worker.js: dari service-worker(5).js, cache version dinaikkan ke v31.
  Ikon maskable yang tercantum di manifest juga dimasukkan ke precache.

CATATAN STRUKTUR:
Pada index(7).html, #dashboardPage dan #kpiPage adalah dua section terpisah.
KPI Suggestion dibuka melalui menu sidebar tersendiri. Paket ini menjaga
struktur dan navigasi tersebut; tidak memindahkan ranking/podium ke Dashboard.

CARA PASANG:
1. Backup folder project DSS.
2. Extract isi ZIP ke root folder project, pilih Replace.
3. Pastikan struktur assets/ tetap sama.
4. Buka aplikasi, lalu Ctrl+F5.
5. Periksa DevTools > Application > Service Workers; pastikan dss-app-v31 aktif.
6. Jika cache lama masih tertahan, unregister service worker lama lalu reload.

Catatan: file JavaScript, konfigurasi, backend, dan struktur HTML tidak diubah.
