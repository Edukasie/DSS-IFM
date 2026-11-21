(() => {
  const apiBase = window.DSS_CONFIG?.API_BASE_URL;
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');
  const loginButton = document.getElementById('loginButton');
  const passwordInput = document.getElementById('password');
  let authToken = sessionStorage.getItem('dss_token') || '';
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
    document.getElementById('employeesPage').hidden = page !== 'employees';
    document.getElementById('placeholderPage').hidden = page === 'dashboard' || page === 'employees';
    document.getElementById('placeholderTitle').textContent = info[0];
    document.getElementById('placeholderDescription').textContent =
      'Modul ' + info[0] + ' akan diaktifkan setelah API dan alur datanya selesai dibuat.';
    if (page === 'employees' && authToken) loadEmployees();
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


  const employeeState = { rows: [], editingId: null };
  const employeeEl = id => document.getElementById(id);

  function employeeMessage(text, error = false) {
    const el = employeeEl('employeeFormMessage');
    el.textContent = text || '';
    el.style.color = error ? '#b45309' : '#16836b';
  }

  function closeEmployeeModal() {
    employeeEl('employeeModal').hidden = true;
    employeeEl('employeeForm').reset();
    employeeEl('employeeRecordId').value = '';
    employeeState.editingId = null;
    employeeMessage('');
  }

  function openEmployeeModal(row = null) {
    employeeState.editingId = row ? row.id : null;
    employeeEl('employeeModalTitle').textContent = row ? 'Edit Karyawan' : 'Tambah Karyawan';
    employeeEl('employeeRecordId').value = row?.id || '';
    employeeEl('employeeIdInput').value = row?.employee_id || '';
    employeeEl('employeeNameInput').value = row?.full_name || '';
    employeeEl('employeeUsernameInput').value = row?.username || '';
    employeeEl('employeeEmailInput').value = row?.email || '';
    employeeEl('employeeDepartmentInput').value = String(row?.department_id || 1);
    employeeEl('employeeRoleInput').value = row?.role || 'EMPLOYEE';
    employeeEl('employeePasswordField').hidden = !!row;
    employeeEl('employeePasswordInput').required = !row;
    employeeEl('employeePasswordInput').value = '';
    employeeMessage('');
    employeeEl('employeeModal').hidden = false;
    employeeEl('employeeIdInput').focus();
  }

  function renderEmployees(rows) {
    const body = employeeEl('employeeTableBody');
    employeeEl('employeeCount').textContent = rows.length.toLocaleString('id-ID');
    employeeEl('employeeActiveCount').textContent =
      rows.filter(row => row.is_active).length.toLocaleString('id-ID');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">Tidak ada data karyawan yang cocok.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(row => {
      const safe = value => String(value ?? '').replace(/[&<>"']/g, ch =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      return `<tr>
        <td><b>${safe(row.full_name)}</b><small>${safe(row.employee_id)}</small></td>
        <td>${safe(row.username)}<small>${safe(row.email || '—')}</small></td>
        <td>${safe(row.department_name || '—')}</td>
        <td><span class="role-chip role-${safe(row.role).toLowerCase()}">${safe(row.role)}</span></td>
        <td><span class="status-chip ${row.is_active ? 'status-active' : 'status-inactive'}">${row.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
        <td><div class="row-actions"><button class="table-action edit" data-edit="${row.id}" type="button">Edit</button>
        <button class="table-action ${row.is_active ? 'deactivate' : 'activate'}" data-toggle="${row.id}" data-active="${row.is_active}" type="button">${row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
      </tr>`;
    }).join('');
  }

  async function loadEmployees() {
    const state = employeeEl('employeeLoadState');
    state.textContent = 'Memuat data...';
    const params = new URLSearchParams();
    const search = employeeEl('employeeSearch').value.trim();
    const role = employeeEl('employeeRoleFilter').value;
    const status = employeeEl('employeeStatusFilter').value;
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    try {
      const result = await apiRequest('/admin/employees' + (params.size ? '?' + params.toString() : ''), authToken);
      employeeState.rows = Array.isArray(result.data) ? result.data : [];
      renderEmployees(employeeState.rows);
      state.textContent = 'Data berhasil dimuat';
    } catch (error) {
      state.textContent = 'Gagal memuat data';
      employeeEl('employeeTableBody').innerHTML =
        `<tr><td colspan="6" class="table-empty">${String(error.message).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</td></tr>`;
    }
  }

  async function saveEmployee(event) {
    event.preventDefault();
    const id = employeeState.editingId;
    const payload = {
      employee_id: employeeEl('employeeIdInput').value.trim(),
      full_name: employeeEl('employeeNameInput').value.trim(),
      username: employeeEl('employeeUsernameInput').value.trim(),
      email: employeeEl('employeeEmailInput').value.trim(),
      department_id: Number(employeeEl('employeeDepartmentInput').value),
      role: employeeEl('employeeRoleInput').value
    };
    if (!id) payload.password = employeeEl('employeePasswordInput').value;
    const button = employeeEl('saveEmployeeButton');
    button.disabled = true;
    button.textContent = 'Menyimpan...';
    employeeMessage('');
    try {
      const result = await apiRequest(id ? '/admin/employees/' + id : '/admin/employees', authToken, {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
      });
      closeEmployeeModal();
      await loadEmployees();
      employeeEl('employeeLoadState').textContent = result.message || 'Data berhasil disimpan';
    } catch (error) {
      employeeMessage(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Simpan Karyawan';
    }
  }

  async function toggleEmployee(id, active) {
    const action = active ? 'menonaktifkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} akun karyawan ini?`)) return;
    try {
      const result = await apiRequest('/admin/employees/' + id + '/status', authToken, {
        method: 'PATCH', body: JSON.stringify({ is_active: !active })
      });
      await loadEmployees();
      employeeEl('employeeLoadState').textContent = result.message || 'Status akun diperbarui';
    } catch (error) {
      alert(error.message);
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
      authToken = data.token;
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


  employeeEl('addEmployeeButton').addEventListener('click', () => openEmployeeModal());
  employeeEl('closeEmployeeModal').addEventListener('click', closeEmployeeModal);
  employeeEl('cancelEmployeeButton').addEventListener('click', closeEmployeeModal);
  employeeEl('employeeForm').addEventListener('submit', saveEmployee);
  employeeEl('employeeSearchButton').addEventListener('click', loadEmployees);
  employeeEl('employeeSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadEmployees();
  });
  employeeEl('employeeRoleFilter').addEventListener('change', loadEmployees);
  employeeEl('employeeStatusFilter').addEventListener('change', loadEmployees);
  employeeEl('employeeModal').addEventListener('click', event => {
    if (event.target === employeeEl('employeeModal')) closeEmployeeModal();
  });
  employeeEl('employeeTableBody').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const toggle = event.target.closest('[data-toggle]');
    if (edit) {
      const row = employeeState.rows.find(item => item.id === Number(edit.dataset.edit));
      if (row) openEmployeeModal(row);
    }
    if (toggle) toggleEmployee(Number(toggle.dataset.toggle), toggle.dataset.active === 'true');
  });

  document.getElementById('logoutButton').addEventListener('click', () => {
    sessionStorage.removeItem('dss_token');
    authToken = '';
    setView('login');
    showMessage('Anda sudah keluar dari DSS.', true);
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('sidebar-open');
  });

  (async () => {
    if (!apiBase) return showMessage('Konfigurasi server belum tersedia.');
    const token = sessionStorage.getItem('dss_token');
    authToken = token || '';
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
