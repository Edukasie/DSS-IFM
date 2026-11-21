(() => {
  const apiBase = window.DSS_CONFIG?.API_BASE_URL;
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');
  const loginButton = document.getElementById('loginButton');
  const passwordInput = document.getElementById('password');
  const pageNames = {
    dashboard: ['Dashboard', 'Pantau aktivitas suggestion dan proses improvement Maintenance.'],
    suggestions: ['Data Suggestion', 'Daftar dan pengelolaan seluruh usulan improvement.'],
    approvals: ['Approval', 'Pantau proses persetujuan Leader, Supervisor, dan Manager.'],
    employees: ['Data Karyawan', 'Kelola akun dan hak akses pengguna DSS.'],
    departments: ['Departemen', 'Kelola unit atau departemen yang menggunakan DSS.']
  };

  function showMessage(text, ok = false) {
    message.textContent = text;
    message.style.color = ok ? '#16836b' : '#b45309';
  }

  function setView(view) {
    loginView.hidden = view !== 'login';
    dashboardView.hidden = view !== 'dashboard';
  }

  function renderUser(user) {
    document.getElementById('userName').textContent = user.full_name || user.username;
    document.getElementById('userRole').textContent = user.role || 'USER';
    document.getElementById('userAvatar').textContent =
      (user.full_name || user.username || 'U').trim().charAt(0).toUpperCase();
    document.getElementById('todayLabel').textContent =
      new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
  }

  function openPage(page) {
    const info = pageNames[page] || pageNames.dashboard;
    document.getElementById('pageTitle').textContent = info[0];
    document.getElementById('welcomeText').textContent = info[1];
    document.getElementById('dashboardPage').hidden = page !== 'dashboard';
    document.getElementById('placeholderPage').hidden = page === 'dashboard';
    document.getElementById('placeholderTitle').textContent = info[0];
    document.getElementById('placeholderDescription').textContent =
      'Modul ' + info[0] + ' akan diaktifkan setelah API dan alur datanya selesai dibuat.';
    document.querySelectorAll('.nav-link').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.page === page)
    );
    document.getElementById('sidebar').classList.remove('sidebar-open');
  }

  async function apiRequest(path, token, options = {}) {
    const response = await fetch(apiBase + path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: 'Bearer ' + token,
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionStorage.removeItem('dss_token');
      setView('login');
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }
    if (!response.ok || data.success === false) {
      throw new Error(data.message || 'Permintaan ke server gagal.');
    }
    return data;
  }

  async function loadDashboard(token) {
    const statsGrid = document.querySelector('.stats-grid');
    const cards = [...statsGrid.querySelectorAll('.stat-card')];
    const loadingText = 'Memuat data...';
    cards.forEach(card => {
      const value = card.querySelector('strong');
      const note = card.querySelector('small');
      if (value) value.textContent = '…';
      if (note) note.textContent = loadingText;
    });

    try {
      const result = await apiRequest('/admin/dashboard', token);
      const data = result.data || {};
      const values = [
        ['Total Suggestion', data.total_suggestion ?? 0, 'Seluruh suggestion terdaftar'],
        ['Menunggu Approval', data.waiting_approval ?? 0, 'Suggestion dalam antrean persetujuan'],
        ['Disetujui', data.approved ?? 0, 'Suggestion berstatus approved'],
        ['Ditolak', data.rejected ?? 0, 'Suggestion berstatus rejected']
      ];

      values.forEach((item, index) => {
        const card = cards[index];
        if (!card) return;
        const value = card.querySelector('strong');
        const label = card.querySelector('.stat-top span:first-child');
        const note = card.querySelector('small');
        if (label) label.textContent = item[0];
        if (value) value.textContent = Number(item[1]).toLocaleString('id-ID');
        if (note) note.textContent = item[2];
      });

      let employeeCard = statsGrid.querySelector('[data-stat="active-employees"]');
      if (!employeeCard) {
        employeeCard = document.createElement('article');
        employeeCard.className = 'stat-card';
        employeeCard.dataset.stat = 'active-employees';
        employeeCard.innerHTML = `
          <div class="stat-top"><span>Karyawan Aktif</span><span class="stat-icon green">♙</span></div>
          <strong>0</strong>
          <small>Akun karyawan yang aktif</small>`;
        statsGrid.appendChild(employeeCard);
      }
      employeeCard.querySelector('strong').textContent =
        Number(data.active_employees ?? 0).toLocaleString('id-ID');
      employeeCard.querySelector('small').textContent = 'Akun karyawan yang aktif';

      const notice = document.querySelector('.notice');
      if (notice) {
        notice.querySelector('b').textContent = 'Dashboard terhubung';
        notice.querySelector('p').textContent =
          'Statistik berhasil dimuat langsung dari database DSS.';
      }
    } catch (error) {
      cards.forEach(card => {
        const note = card.querySelector('small');
        if (note) note.textContent = 'Gagal memuat data';
      });
      const notice = document.querySelector('.notice');
      if (notice) {
        notice.querySelector('b').textContent = 'Data dashboard belum termuat';
        notice.querySelector('p').textContent = error.message;
      }
    }
  }

  async function verifyToken(token) {
    const response = await fetch(apiBase + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.message || 'Sesi berakhir. Silakan login kembali.');
    }
    return data.user;
  }

  async function enterDashboard(token) {
    const user = await verifyToken(token);
    if (user.role !== 'ADMIN') {
      throw new Error('Login berhasil, tetapi dashboard role ' + user.role + ' belum tersedia.');
    }
    renderUser(user);
    setView('dashboard');
    openPage('dashboard');
    await loadDashboard(token);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const identity = document.getElementById('username').value.trim();
    const password = passwordInput.value;
    if (!identity || !password) return showMessage('Username dan password wajib diisi.');

    loginButton.disabled = true;
    loginButton.textContent = 'Memeriksa...';
    showMessage('Menghubungkan ke server DSS...', true);

    try {
      const response = await fetch(apiBase + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || 'Login gagal. Periksa username dan password.');
      }
      sessionStorage.setItem('dss_token', data.token);
      passwordInput.value = '';
      await enterDashboard(data.token);
    } catch (error) {
      sessionStorage.removeItem('dss_token');
      setView('login');
      showMessage(error.message || 'Tidak dapat terhubung ke server DSS.');
    } finally {
      loginButton.disabled = false;
      loginButton.innerHTML = 'Masuk <span>→</span>';
    }
  });

  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => openPage(button.dataset.page));
  });

  document.getElementById('logoutButton').addEventListener('click', () => {
    sessionStorage.removeItem('dss_token');
    setView('login');
    showMessage('Anda sudah keluar dari DSS.', true);
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('sidebar-open');
  });

  (async () => {
    if (!apiBase) return showMessage('Konfigurasi server belum tersedia.');
    const token = sessionStorage.getItem('dss_token');
    if (!token) return;
    try {
      await enterDashboard(token);
    } catch (error) {
      sessionStorage.removeItem('dss_token');
      setView('login');
      showMessage(error.message || 'Silakan login kembali.');
    }
  })();
})();
