DSS LOGIN REFINEMENT v30

Paket ini merapikan tampilan login dan sinkronisasi Smart Lamp.
File:
- assets/css/style.css
- assets/js/app.js
- assets/images/edukasie-dss-logo.jpg
- service-worker.js

Perbaikan:
1. CSS login yang sebelumnya memiliki banyak blok override diganti satu blok responsif.
2. Komposisi desktop diseimbangkan di tengah layar.
3. Tinggi lampu disesuaikan agar caption dan petunjuk tidak terpotong.
4. Kotak logo dipertahankan 258 x 81 px; file logo disiapkan dalam rasio banner yang sesuai.
5. Tablet/HP menggunakan susunan vertikal dan dapat discroll pada layar pendek.
6. Titik akhir SVG tali disambungkan ke bagian tengah bandul.
7. Cache Service Worker dinaikkan menjadi dss-app-v30.

Pemasangan:
1. Backup empat file lama.
2. Extract ZIP ke folder utama DSS dan izinkan replace.
3. Jangan mengganti config.js, kpi.css, index.html, atau backend.
4. Hard refresh dengan Ctrl+F5.
5. Pastikan Service Worker dss-app-v30 aktif di DevTools > Application > Service Workers.
