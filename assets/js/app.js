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
