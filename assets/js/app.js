(() => {
  const configuredApiBase = window.DSS_CONFIG?.API_BASE_URL || '';
  const apiBase = configuredApiBase.replace(/\/+$/, '');
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const authLoadingView = document.getElementById('authLoadingView');
  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');
  const loginButton = document.getElementById('loginButton');
  const passwordInput = document.getElementById('password');
  let authToken = sessionStorage.getItem('dss_token') || '';
  let currentUser = null;
  let editingSuggestionId = null;
  const pageNames = {
    dashboard: ['Dashboard', 'Pantau aktivitas suggestion dan proses improvement Maintenance.'],
    suggestions: ['Data Suggestion', 'Daftar dan pengelolaan seluruh usulan improvement.'],
    approvals: ['Approval', 'Alur persetujuan KaSie, Supervisor, dan Manager.'],
    kpi: ['KPI Suggestion', 'Pantau poin kontribusi dan ranking improvement karyawan.'],
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
    if (authLoadingView) authLoadingView.hidden = true;
    document.body.classList.remove('auth-pending');
  }

  function renderUser(user) {
    document.getElementById('userName').textContent = user.full_name || user.username;
    document.getElementById('userRole').textContent = ({ LEADER: 'KaSie' })[user.role] || user.role || 'USER';
    const avatar = document.getElementById('userAvatar');
    if (user.profile_photo_url) { avatar.textContent = ''; avatar.style.backgroundImage = `url("${apiBase}${user.profile_photo_url}")`; avatar.classList.add('has-photo'); }
    else { avatar.style.backgroundImage = ''; avatar.classList.remove('has-photo'); avatar.textContent = (user.full_name || user.username || 'U').trim().charAt(0).toUpperCase(); }
    document.getElementById('todayLabel').textContent =
      new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
  }

  function openPage(page) {
    if ((page === 'employees' || page === 'departments') && currentUser?.role !== 'ADMIN') {
      page = 'suggestions';
    }
    const info = pageNames[page] || pageNames.dashboard;
    document.getElementById('pageTitle').textContent = info[0];
    document.getElementById('welcomeText').textContent = info[1];
    document.getElementById('dashboardPage').hidden = page !== 'dashboard';
    document.querySelector('.page-content')?.classList.toggle('is-dashboard', page === 'dashboard');
    document.getElementById('employeesPage').hidden = page !== 'employees';
    document.getElementById('suggestionsPage').hidden = page !== 'suggestions';
    const approvalsPage = document.getElementById('approvalsPage');
    if (approvalsPage) approvalsPage.hidden = page !== 'approvals';
    const kpiPage = document.getElementById('kpiPage');
    if (kpiPage) kpiPage.hidden = page !== 'dashboard' && page !== 'kpi';
    const departmentsPage = document.getElementById('departmentsPage');
    if (departmentsPage) departmentsPage.hidden = page !== 'departments';
    document.getElementById('placeholderPage').hidden =
      page === 'dashboard' || page === 'kpi' || page === 'employees' || page === 'suggestions' || page === 'approvals' || page === 'departments';
    document.getElementById('placeholderTitle').textContent = info[0];
    document.getElementById('placeholderDescription').textContent =
      'Modul ' + info[0] + ' akan diaktifkan setelah API dan alur datanya selesai dibuat.';
    if (page === 'employees' && authToken && currentUser?.role === 'ADMIN') {
      loadDepartments().then(loadEmployees);
    }
    if (page === 'departments' && authToken && currentUser?.role === 'ADMIN') loadDepartments();
    if (page === 'suggestions' && authToken) loadSuggestions();
    if (page === 'approvals' && authToken) loadApprovals();
    if ((page === 'dashboard' || page === 'kpi') && authToken) loadKpi();
    if (page === 'dashboard' && authToken) {
      if (currentUser?.role === 'ADMIN') loadDashboard(authToken);
      else document.querySelectorAll('.stats-grid .stat-card small').forEach(note => { note.textContent = 'Statistik lengkap khusus Admin'; });
    }
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
      authToken = '';
      currentUser = null;
      setView('login');
      showMessage('Sesi berakhir. Silakan login kembali.');
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

  const departmentState = { rows: [], editingId: null };
  const departmentEl = id => document.getElementById(id);

  function departmentEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function departmentMessage(text, error = false) {
    const el = departmentEl('departmentFormMessage');
    el.textContent = text || '';
    el.style.color = error ? '#b45309' : '#16836b';
  }

  function renderDepartmentSelects(rows) {
    const active = rows.filter(row => row.is_active);
    const employeeSelect = employeeEl('employeeDepartmentInput');
    if (employeeSelect) {
      const selected = employeeSelect.value;
      employeeSelect.innerHTML = active.map(row =>
        `<option value="${row.id}">${departmentEscape(row.name)}</option>`).join('');
      if (active.some(row => String(row.id) === selected)) employeeSelect.value = selected;
    }
  }

  function renderDepartments(rows) {
    departmentState.rows = rows;
    departmentEl('departmentCount').textContent = rows.length.toLocaleString('id-ID');
    departmentEl('departmentActiveCount').textContent = rows.filter(row => row.is_active).length.toLocaleString('id-ID');
    departmentEl('departmentEmployeeCount').textContent = rows.reduce((sum, row) => sum + Number(row.active_employees || 0), 0).toLocaleString('id-ID');
    const body = departmentEl('departmentTableBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">Belum ada departemen.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(row => {
      const approvers = row.approvers?.length
        ? row.approvers.map(item => `<span class="department-approver"><b>${departmentEscape(item.label)}:</b> ${departmentEscape(item.full_name)}</span>`).join('')
        : '<span class="muted">Belum lengkap</span>';
      return `<tr>
        <td><b>${departmentEscape(row.code)}</b></td>
        <td><b>${departmentEscape(row.name)}</b></td>
        <td>${Number(row.active_employees || 0).toLocaleString('id-ID')} aktif<small>${Number(row.total_employees || 0).toLocaleString('id-ID')} total</small></td>
        <td><div class="department-approvers">${approvers}</div></td>
        <td><span class="status-chip ${row.is_active ? 'status-active' : 'status-inactive'}">${row.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
        <td><div class="row-actions">
          <button class="table-action edit" data-department-edit="${row.id}" type="button">Edit</button>
          <button class="table-action ${row.is_active ? 'deactivate' : 'activate'}" data-department-toggle="${row.id}" data-active="${row.is_active}" type="button">${row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  async function loadDepartments() {
    const state = departmentEl('departmentLoadState');
    if (state) state.textContent = 'Memuat data...';
    const params = new URLSearchParams();
    const search = departmentEl('departmentSearch')?.value.trim();
    const status = departmentEl('departmentStatusFilter')?.value || 'all';
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    try {
      const result = await apiRequest('/admin/departments' + (params.toString() ? '?' + params.toString() : ''), authToken);
      const rows = Array.isArray(result.data) ? result.data : [];
      renderDepartments(rows);
      const activeResult = await apiRequest('/admin/departments?status=active', authToken);
      renderDepartmentSelects(Array.isArray(activeResult.data) ? activeResult.data : []);
      if (state) state.textContent = 'Data berhasil dimuat';
    } catch (error) {
      if (state) state.textContent = 'Gagal memuat data';
      if (departmentEl('departmentTableBody')) {
        departmentEl('departmentTableBody').innerHTML =
          `<tr><td colspan="6" class="table-empty">${departmentEscape(error.message)}</td></tr>`;
      }
    }
  }

  function openDepartmentModal(row = null) {
    departmentState.editingId = row?.id || null;
    departmentEl('departmentModalTitle').textContent = row ? 'Edit Departemen' : 'Tambah Departemen';
    departmentEl('departmentRecordId').value = row?.id || '';
    departmentEl('departmentNameInput').value = row?.name || '';
    departmentEl('departmentCodeInput').value = row?.code || '';
    departmentMessage('');
    departmentEl('departmentModal').hidden = false;
    departmentEl('departmentNameInput').focus();
  }

  function closeDepartmentModal() {
    departmentEl('departmentModal').hidden = true;
    departmentEl('departmentForm').reset();
    departmentState.editingId = null;
    departmentMessage('');
  }

  async function saveDepartment(event) {
    event.preventDefault();
    const id = departmentState.editingId;
    const payload = {
      name: departmentEl('departmentNameInput').value.trim(),
      code: departmentEl('departmentCodeInput').value.trim().toUpperCase()
    };
    const button = departmentEl('saveDepartmentButton');
    button.disabled = true;
    button.textContent = 'Menyimpan...';
    departmentMessage('');
    try {
      const result = await apiRequest(id ? `/admin/departments/${id}` : '/admin/departments', authToken, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      closeDepartmentModal();
      await loadDepartments();
      departmentEl('departmentLoadState').textContent = result.message || 'Departemen tersimpan';
    } catch (error) {
      departmentMessage(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Simpan Departemen';
    }
  }

  async function toggleDepartment(id, active) {
    const row = departmentState.rows.find(item => item.id === id);
    const action = active ? 'menonaktifkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} departemen ${row?.name || ''}?`)) return;
    try {
      const result = await apiRequest(`/admin/departments/${id}/status`, authToken, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !active })
      });
      await loadDepartments();
      departmentEl('departmentLoadState').textContent = result.message || 'Status departemen diperbarui';
    } catch (error) {
      alert(error.message);
    }
  }

  function employeeMessage(text, error = false) {
    const el = employeeEl('employeeFormMessage');
    el.textContent = text || '';
    el.style.color = error ? '#b45309' : '#16836b';
  }

  let selectedEmployeePhoto = null;

  function closeEmployeeModal() {
    employeeEl('employeeModal').hidden = true;
    selectedEmployeePhoto = null;
    employeeEl('employeePhotoInput').value = '';
    employeeEl('employeePhotoPreview').textContent = 'Belum ada foto dipilih';
    employeeEl('employeePhotoStatus').textContent = '';
    employeeEl('uploadEmployeePhotoButton').hidden = true;
    employeeEl('employeeForm').reset();
    employeeEl('employeeRecordId').value = '';
    employeeState.editingId = null;
    employeeEl('saveEmployeeButton').disabled = false;
    employeeMessage('');
  }

  async function loadEmployeeDepartmentOptions(selectedDepartmentId = null) {
    const select = employeeEl('employeeDepartmentInput');
    select.disabled = true;
    select.innerHTML = '<option value="">Memuat departemen aktif...</option>';

    try {
      // Read the same active department master used by the Department page.
      const result = await apiRequest('/admin/departments?status=active', authToken);
      const departments = Array.isArray(result.data) ? result.data : [];

      if (!departments.length) {
        select.innerHTML = '<option value="">Belum ada departemen aktif</option>';
        employeeMessage('Tambahkan atau aktifkan departemen terlebih dahulu.', true);
        return false;
      }

      select.innerHTML = departments.map(department =>
        `<option value="${Number(department.id)}">${escapeHtml(department.name)}${department.code ? ` · ${escapeHtml(department.code)}` : ''}</option>`
      ).join('');

      const wanted = selectedDepartmentId == null ? '' : String(selectedDepartmentId);
      if (wanted && departments.some(item => String(item.id) === wanted)) {
        select.value = wanted;
      } else {
        select.selectedIndex = 0;
      }

      select.disabled = false;
      return true;
    } catch (error) {
      select.innerHTML = '<option value="">Gagal memuat departemen</option>';
      employeeMessage(`Tidak dapat memuat departemen aktif: ${error.message}`, true);
      return false;
    }
  }

  async function openEmployeeModal(row = null) {
    employeeState.editingId = row ? row.id : null;
    employeeEl('employeeModalTitle').textContent = row ? 'Edit Karyawan' : 'Tambah Karyawan';
    employeeEl('employeeRecordId').value = row?.id || '';
    employeeEl('employeeIdInput').value = row?.employee_id || '';
    employeeEl('employeeNameInput').value = row?.full_name || '';
    employeeEl('employeeUsernameInput').value = row?.username || '';
    employeeEl('employeeEmailInput').value = row?.email || '';
    employeeEl('employeeDepartmentInput').value = '';
    employeeEl('employeeRoleInput').value = row?.role || 'EMPLOYEE';
    employeeEl('employeePasswordField').hidden = !!row;
    employeeEl('employeePasswordInput').required = !row;
    employeeEl('employeePasswordInput').value = '';
    selectedEmployeePhoto = null;
    employeeEl('employeePhotoInput').value = '';
    employeeEl('employeePhotoPreview').textContent = row?.profile_photo_url ? 'Foto profil sudah tersedia. Pilih file baru untuk menggantinya.' : 'Belum ada foto dipilih';
    employeeEl('employeePhotoStatus').textContent = '';
    employeeEl('uploadEmployeePhotoButton').hidden = !row;
    employeeMessage('');
    employeeEl('employeeModal').hidden = false;
    const departmentsReady = await loadEmployeeDepartmentOptions(row?.department_id ?? null);
    if (!departmentsReady) {
      employeeEl('saveEmployeeButton').disabled = true;
    } else {
      employeeEl('saveEmployeeButton').disabled = false;
    }
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
        <td><div class="employee-name-with-photo">${row.profile_photo_url ? `<img src="${apiBase}${safe(row.profile_photo_url)}" alt="" class="employee-list-avatar">` : `<span class="employee-list-avatar employee-list-initial">${safe((row.full_name || 'U').trim().charAt(0).toUpperCase())}</span>`}<span><b>${safe(row.full_name)}</b><small>${safe(row.employee_id)}</small></span></div></td>
        <td>${safe(row.username)}<small>${safe(row.email || '—')}</small></td>
        <td>${safe(row.department_name || '—')}</td>
        <td><span class="role-chip role-${safe(row.role).toLowerCase()}">${safe(row.role === "LEADER" ? "KaSie" : row.role)}</span></td>
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
      const result = await apiRequest('/admin/employees' + (params.toString() ? '?' + params.toString() : ''), authToken);
      employeeState.rows = Array.isArray(result.data) ? result.data : [];
      renderEmployees(employeeState.rows);
      state.textContent = 'Data berhasil dimuat';
    } catch (error) {
      state.textContent = 'Gagal memuat data';
      employeeEl('employeeTableBody').innerHTML =
        `<tr><td colspan="6" class="table-empty">${String(error.message).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</td></tr>`;
    }
  }

  employeeEl('employeePhotoInput').addEventListener('change', () => {
    const file = employeeEl('employeePhotoInput').files?.[0] || null;
    selectedEmployeePhoto = file;
    const preview = employeeEl('employeePhotoPreview');
    employeeEl('employeePhotoStatus').textContent = '';
    employeeEl('uploadEmployeePhotoButton').hidden = !(file && employeeState.editingId);
    if (!file) { preview.textContent = 'Belum ada foto dipilih'; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      selectedEmployeePhoto = null; employeeEl('employeePhotoInput').value = '';
      preview.textContent = 'Format harus JPG/PNG/WebP dan ukuran maksimal 2 MB.'; return;
    }
    const reader = new FileReader();
    reader.onload = () => { preview.innerHTML = `<img src="${reader.result}" alt="Preview foto karyawan" style="width:64px;height:64px;object-fit:cover;border-radius:50%;vertical-align:middle;margin-right:10px"> ${escapeHtml(file.name)}`; };
    reader.readAsDataURL(file);
  });

  async function uploadSelectedEmployeePhoto() {
    const employeeId = employeeState.editingId;
    const file = selectedEmployeePhoto;
    const status = employeeEl('employeePhotoStatus');
    const button = employeeEl('uploadEmployeePhotoButton');
    if (!employeeId) { status.textContent = 'Simpan data karyawan terlebih dahulu.'; return; }
    if (!file) { status.textContent = 'Pilih foto terlebih dahulu.'; return; }
    button.disabled = true; button.textContent = 'Mengunggah...';
    status.textContent = 'Mengirim foto ke server...';
    try {
      const form = new FormData(); form.append('photo', file);
      const response = await fetch(`${apiBase}/admin/employees/${employeeId}/photo`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + authToken }, body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || `Upload gagal (HTTP ${response.status}).`);
      status.textContent = 'Foto berhasil disimpan ke server.';
      selectedEmployeePhoto = null;
      employeeEl('employeePhotoInput').value = '';
      employeeEl('employeePhotoPreview').textContent = 'Foto berhasil diunggah. Tutup lalu buka kembali data karyawan untuk melihatnya.';
      await loadEmployees();
      if (typeof loadKpi === 'function') await loadKpi();
    } catch (error) {
      status.textContent = `Gagal upload: ${error.message}`;
    } finally {
      button.disabled = false; button.textContent = 'Upload Foto ke Server';
    }
  }
  employeeEl('uploadEmployeePhotoButton').addEventListener('click', uploadSelectedEmployeePhoto);

  async function saveEmployee(event) {
    event.preventDefault();
    const id = employeeState.editingId;
    const departmentSelect = employeeEl('employeeDepartmentInput');
    if (departmentSelect.disabled || !departmentSelect.value) {
      employeeMessage('Pilih departemen aktif terlebih dahulu.', true);
      return;
    }
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
      const savedId = id || result.data?.id;
      if (selectedEmployeePhoto && savedId) {
        const photoData = new FormData(); photoData.append('photo', selectedEmployeePhoto);
        const response = await fetch(`${apiBase}/admin/employees/${savedId}/photo`, { method: 'POST', headers: { Authorization: 'Bearer ' + authToken }, body: photoData });
        const photoResult = await response.json().catch(() => ({}));
        if (!response.ok || !photoResult.success) throw new Error(photoResult.message || 'Data tersimpan, tetapi foto gagal diunggah. Buka Edit Karyawan untuk mencoba lagi.');
      }
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


  // DATA SUGGESTION
  const suggestionEl = id => document.getElementById(id);
  let suggestionMeta = { categories: [], employees: [] };
  let suggestionRows = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function suggestionMessage(text, error = false) {
    const el = suggestionEl('suggestionFormMessage');
    el.textContent = text || '';
    el.style.color = error ? '#b45309' : '#16836b';
  }

  async function loadSuggestionMeta() {
    const result = await apiRequest('/suggestions/meta', authToken);
    suggestionMeta = result.data || { categories: [], employees: [] };

    suggestionEl('suggestionCategory').innerHTML =
      '<option value="">Pilih kategori</option>' +
      (suggestionMeta.categories || []).map(item =>
        `<option value="${Number(item.id)}">${escapeHtml(item.name)}</option>`
      ).join('');

    suggestionEl('suggestionContributors').innerHTML =
      (suggestionMeta.employees || [])
        .filter(item => Number(item.id) !== Number(suggestionMeta.current_user_id))
        .map(item =>
          `<option value="${Number(item.id)}">${escapeHtml(item.full_name)} (${escapeHtml(item.employee_id)})</option>`
        ).join('');
  }

  async function loadSuggestions() {
    const state = suggestionEl('suggestionLoadState');
    const body = suggestionEl('suggestionTableBody');
    state.textContent = 'Memuat data...';
    const params = new URLSearchParams();
    const search = suggestionEl('suggestionSearch').value.trim();
    if (search) params.set('search', search);

    try {
      const result = await apiRequest(
        '/suggestions' + (params.toString() ? '?' + params.toString() : ''),
        authToken
      );
      suggestionRows = Array.isArray(result.data) ? result.data : [];
      suggestionEl('suggestionCount').textContent = suggestionRows.length.toLocaleString('id-ID');
      suggestionEl('suggestionDraftCount').textContent =
        suggestionRows.filter(row => row.status === 'DRAFT').length.toLocaleString('id-ID');
      suggestionEl('suggestionSubmittedCount').textContent =
        suggestionRows.filter(row => row.status !== 'DRAFT').length.toLocaleString('id-ID');

      if (!suggestionRows.length) {
        body.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada suggestion. Klik “Buat Suggestion” untuk memulai.</td></tr>';
      } else {
        body.innerHTML = suggestionRows.map(row => {
          const status = String(row.status || 'DRAFT').toLowerCase();
          const contributors = Array.isArray(row.contributors) ? row.contributors : [];
          return `<tr>
            <td><b>${escapeHtml(row.ss_number || '—')}</b><small>${escapeHtml(row.created_at || '')}</small></td>
            <td><b>${escapeHtml(row.title)}</b><small>${escapeHtml(row.department_name || 'Maintenance')}</small></td>
            <td>${escapeHtml(row.category_name || '—')}</td>
            <td>${escapeHtml(row.submitter_name || '—')}</td>
            <td><span class="suggestion-contributor-count">${contributors.length} orang</span></td>
            <td><span class="suggestion-status status-${escapeHtml(status)}">${escapeHtml(row.status || 'DRAFT')}</span></td>
            <td><div class="ss-row-actions">
              <button type="button" class="ss-action-btn" data-detail="${Number(row.id)}">Detail</button>
              ${['DRAFT','REVISION_REQUESTED'].includes(row.status) && (currentUser?.role === 'ADMIN' || Number(row.submitted_by) === Number(currentUser?.id))
                ? `<button type="button" class="ss-action-btn" data-edit="${Number(row.id)}">Edit</button>${row.status === 'DRAFT' ? `<button type="button" class="ss-action-btn danger" data-delete="${Number(row.id)}">Hapus</button>` : ''}` : ''}
            </div></td>
          </tr>`;
        }).join('');
      }
      state.textContent = 'Data berhasil dimuat';
    } catch (error) {
      state.textContent = 'Gagal memuat data';
      body.innerHTML = `<tr><td colspan="7" class="table-empty">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function openSuggestionModal() {
    editingSuggestionId = null;
    suggestionEl('suggestionModalTitle').textContent = 'Buat Suggestion';
    suggestionEl('suggestionForm').reset();
    suggestionEl('ssIndicatorRows').innerHTML = '';
    addIndicatorRow();
    suggestionEl('suggestionBeforePreview').innerHTML = '<span>Belum ada foto dipilih</span>';
    suggestionEl('suggestionAfterPreview').innerHTML = '<span>Belum ada foto dipilih</span>';
    suggestionMessage('');
    suggestionEl('suggestionModal').hidden = false;
    suggestionEl('suggestionCategory').innerHTML = '<option value="">Memuat kategori...</option>';
    suggestionEl('suggestionContributors').innerHTML = '';
    try {
      await loadSuggestionMeta();
    } catch (error) {
      suggestionMessage(error.message, true);
    }
    suggestionEl('suggestionTitle').focus();
  }

  function closeSuggestionModal() {
    editingSuggestionId = null;
    suggestionEl('suggestionModal').hidden = true;
    suggestionEl('suggestionForm').reset();
    suggestionMessage('');
  }

  function addIndicatorRow(values = {}) {
    const tbody = suggestionEl('ssIndicatorRows');
    const tr = document.createElement('tr');
    const fields = [
      ['indicator_name','Indikator','indicator-name'],
      ['unit','Satuan',''],
      ['before_value','Sebelum',''],
      ['after_value','Sesudah',''],
      ['saving_value','Selisih / Hemat',''],
      ['pic','PIC',''],
      ['measured_at','Tanggal ukur','', 'date'],
      ['notes','Catatan','']
    ];
    tr.innerHTML = fields.map(([key, placeholder, cls, type]) =>
      `<td><input ${cls ? `class="${cls}"` : ''} data-indicator="${key}" type="${type || 'text'}" placeholder="${placeholder}" value="${escapeHtml(values[key] ?? '')}"></td>`
    ).join('') + '<td><button type="button" class="remove-indicator" title="Hapus baris">×</button></td>';
    tr.querySelector('.remove-indicator').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  }

  function selectedAspects() {
    return [...document.querySelectorAll('input[name="ssAspect"]:checked')].map(el => el.value);
  }

  function previewFiles(inputId, previewId) {
    const input = suggestionEl(inputId);
    const preview = suggestionEl(previewId);
    preview.querySelectorAll('img').forEach(img => { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
    preview.innerHTML = '';
    const files = [...input.files];
    if (!files.length) {
      preview.innerHTML = '<span>Belum ada foto dipilih</span>';
      return;
    }
    files.forEach(file => {
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    });
  }

  async function uploadSuggestionFiles(submissionId, inputId, type) {
    const files = [...suggestionEl(inputId).files];
    if (!files.length) return;
    const fd = new FormData();
    fd.append('attachment_type', type);
    files.forEach(file => fd.append('files', file));
    const response = await fetch(`${apiBase}/suggestions/${submissionId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: fd
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || `Upload foto ${type} gagal.`);
  }

  async function saveSuggestion(submit) {
    const payload = {
      title: suggestionEl('suggestionTitle').value.trim(),
      category_id: suggestionEl('suggestionCategory').value,
      condition_before: suggestionEl('suggestionBefore').value.trim(),
      improvement_action: suggestionEl('suggestionAction').value.trim(),
      result_after: suggestionEl('suggestionAfter').value.trim(),
      expected_benefit: suggestionEl('suggestionExpected').value.trim(),
      actual_benefit: suggestionEl('suggestionActual').value.trim()
    };
    const contributors = [...suggestionEl('suggestionContributors').selectedOptions].map(option => Number(option.value));
    const button = submit ? suggestionEl('submitSuggestionButton') : suggestionEl('saveSuggestionDraft');
    suggestionEl('saveSuggestionDraft').disabled = true;
    suggestionEl('submitSuggestionButton').disabled = true;
    suggestionMessage('');
    try {
      let id = editingSuggestionId;
      let number = '';
      if (id) {
        await apiRequest(`/suggestions/${id}`, authToken, { method: 'PUT', body: JSON.stringify(payload) });
        await apiRequest(`/suggestions/${id}/contributors`, authToken, { method: 'PUT', body: JSON.stringify({ contributors }) });
        number = suggestionRows.find(row => Number(row.id) === Number(id))?.ss_number || '';
      } else {
        const created = await apiRequest('/suggestions', authToken, { method: 'POST', body: JSON.stringify({ ...payload, contributors, submit: false }) });
        id = created.data?.id; number = created.data?.ss_number || '';
        if (!id) throw new Error('Suggestion dibuat tetapi ID tidak diterima server.');
      }
      const indicators = [...suggestionEl('ssIndicatorRows').querySelectorAll('tr')].map(tr => {
        const item = {};
        tr.querySelectorAll('[data-indicator]').forEach(input => item[input.dataset.indicator] = input.value.trim());
        return item;
      }).filter(item => item.indicator_name);
      const detailPayload = {
        location_machine: suggestionEl('suggestionLocation').value.trim(),
        risk_before: suggestionEl('suggestionRiskBefore').value.trim(),
        risk_reduced: suggestionEl('suggestionRiskReduced').value.trim(),
        work_process_before: suggestionEl('suggestionProcessBefore').value.trim(),
        work_process_after: suggestionEl('suggestionProcessAfter').value.trim(),
        aspects: selectedAspects(), indicators
      };
      await apiRequest(`/suggestions/${id}/form-details`, authToken, { method: 'PUT', body: JSON.stringify(detailPayload) });
      await uploadSuggestionFiles(id, 'suggestionBeforeFiles', 'BEFORE');
      await uploadSuggestionFiles(id, 'suggestionAfterFiles', 'AFTER');
      if (submit) await apiRequest(`/suggestions/${id}/submit`, authToken, { method: 'POST' });
      const wasEditing = Boolean(editingSuggestionId);
      closeSuggestionModal(); editingSuggestionId = null;
      await loadSuggestions();
      alert(`${submit ? 'Suggestion berhasil disubmit.' : wasEditing ? 'Draft berhasil diperbarui.' : 'Draft berhasil disimpan.'} Nomor: ${number}`);
    } catch (error) {
      suggestionMessage(error.message + ' Data utama mungkin sudah tersimpan sebagai Draft; periksa daftar Suggestion.', true);
      await loadSuggestions();
    } finally {
      suggestionEl('saveSuggestionDraft').disabled = false;
      suggestionEl('submitSuggestionButton').disabled = false;
      button.disabled = false;
    }
  }

  let suggestionDetailUrls = [];
  function releaseSuggestionDetailUrls() {
    suggestionDetailUrls.forEach(url => URL.revokeObjectURL(url));
    suggestionDetailUrls = [];
  }

  async function openSuggestionDetail(id) {
    releaseSuggestionDetailUrls();
    const body = suggestionEl('suggestionDetailBody');
    body.innerHTML = '<p>Memuat detail...</p>';
    suggestionEl('suggestionDetailModal').hidden = false;
    try {
      const [main, detail, attachmentResult] = await Promise.all([
        apiRequest(`/suggestions/${id}`, authToken),
        apiRequest(`/suggestions/${id}/form-details`, authToken),
        apiRequest(`/suggestions/${id}/attachments`, authToken)
      ]);
      const s = main.data || {}, d = detail.data || {}, attachments = attachmentResult.data || [];
      const photos = [];
      for (const file of attachments) {
        const response = await fetch(`${apiBase}/suggestions/${id}/attachments/${file.id}/file`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (response.ok) { const url = URL.createObjectURL(await response.blob()); suggestionDetailUrls.push(url); photos.push({ ...file, url }); }
      }
      const photoHtml = type => {
        const selected = photos.filter(p => p.attachment_type === type);
        return selected.length ? selected.map(p => `<figure><img src="${p.url}" alt="${escapeHtml(p.original_name)}"><figcaption>${escapeHtml(p.original_name)}</figcaption></figure>`).join('') : '<span class="muted">Belum ada foto</span>';
      };
      const contributors = (s.contributors || []).map(x => escapeHtml(x.full_name)).join(', ') || '—';
      body.innerHTML = `
        <div class="ss-detail-grid">
          <div><small>Nomor SS</small><b>${escapeHtml(s.ss_number)}</b></div><div><small>Status</small><b>${escapeHtml(s.status)}</b></div>
          <div><small>Judul</small><b>${escapeHtml(s.title)}</b></div><div><small>Kategori</small><b>${escapeHtml(s.category_name || '—')}</b></div>
          <div><small>Pengusul</small><b>${escapeHtml(s.submitter_name || '—')}</b></div><div><small>Kontributor</small><b>${contributors}</b></div>
          <div><small>Lokasi / Mesin</small><b>${escapeHtml(d.location_machine || '—')}</b></div>
        </div>
        <section class="ss-detail-section"><h3>Dokumentasi Before–After</h3><div class="ss-detail-photos"><div><h4>BEFORE</h4><div class="ss-detail-photo-list">${photoHtml('BEFORE')}</div></div><div><h4>AFTER</h4><div class="ss-detail-photo-list">${photoHtml('AFTER')}</div></div></div></section>
        <section class="ss-detail-section"><h3>Kondisi dan tindakan improvement</h3><div class="ss-detail-grid">
          <div><small>Kondisi sebelum</small><p>${escapeHtml(s.condition_before || '—')}</p></div><div><small>Tindakan improvement</small><p>${escapeHtml(s.improvement_action || '—')}</p></div>
          <div><small>Hasil sesudah</small><p>${escapeHtml(s.result_after || '—')}</p></div><div><small>Risiko sebelum</small><p>${escapeHtml(d.risk_before || '—')}</p></div>
          <div><small>Risiko berkurang</small><p>${escapeHtml(d.risk_reduced || '—')}</p></div><div><small>Proses sebelum</small><p>${escapeHtml(d.work_process_before || '—')}</p></div>
          <div><small>Proses sesudah</small><p>${escapeHtml(d.work_process_after || '—')}</p></div>
        </div></section>
        <section class="ss-detail-section"><h3>Aspek SS</h3><div>${(d.aspects || []).map(a => `<span class="ss-detail-aspect">${escapeHtml(a)}</span>`).join('') || '—'}</div></section>
        <section class="ss-detail-section"><h3>Perbandingan hasil / dampak</h3><div class="ss-indicator-wrap"><table class="ss-indicator-table"><thead><tr><th>Indikator</th><th>Satuan</th><th>Sebelum</th><th>Sesudah</th><th>Selisih</th><th>PIC</th><th>Tanggal</th><th>Catatan</th></tr></thead><tbody>${(d.indicators || []).map(x => `<tr>${['indicator_name','unit','before_value','after_value','saving_value','pic','measured_at','notes'].map(k => `<td>${escapeHtml(x[k] ?? '—')}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="8">Belum ada indikator</td></tr>'}</tbody></table></div></section>`;
    } catch (error) { body.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; }
  }

  async function editSuggestion(id) {
    const row = suggestionRows.find(x => Number(x.id) === Number(id));
    if (!row || !['DRAFT','REVISION_REQUESTED'].includes(row.status)) return;
    await openSuggestionModal();
    editingSuggestionId = id;
    suggestionEl('suggestionModalTitle').textContent = `Edit Suggestion · ${row.ss_number}`;
    try {
      const [main, detail] = await Promise.all([apiRequest(`/suggestions/${id}`, authToken), apiRequest(`/suggestions/${id}/form-details`, authToken)]);
      const s = main.data || {}, d = detail.data || {};
      suggestionEl('suggestionTitle').value = s.title || '';
      suggestionEl('suggestionCategory').value = s.category_id || '';
      suggestionEl('suggestionBefore').value = s.condition_before || '';
      suggestionEl('suggestionAction').value = s.improvement_action || '';
      suggestionEl('suggestionAfter').value = s.result_after || '';
      suggestionEl('suggestionExpected').value = s.expected_benefit || '';
      suggestionEl('suggestionActual').value = s.actual_benefit || '';
      suggestionEl('suggestionLocation').value = d.location_machine || '';
      suggestionEl('suggestionRiskBefore').value = d.risk_before || '';
      suggestionEl('suggestionRiskReduced').value = d.risk_reduced || '';
      suggestionEl('suggestionProcessBefore').value = d.work_process_before || '';
      suggestionEl('suggestionProcessAfter').value = d.work_process_after || '';
      const ids = (s.contributors || []).map(x => Number(x.id));
      [...suggestionEl('suggestionContributors').options].forEach(o => o.selected = ids.includes(Number(o.value)));
      document.querySelectorAll('input[name="ssAspect"]').forEach(el => el.checked = (d.aspects || []).includes(el.value));
      suggestionEl('ssIndicatorRows').innerHTML = '';
      (d.indicators || []).forEach(item => addIndicatorRow(item));
      if (!(d.indicators || []).length) addIndicatorRow();
      suggestionMessage('Foto yang sudah terunggah tetap tersimpan. Foto baru dapat ditambahkan.', true);
    } catch (error) { suggestionMessage(error.message, true); }
  }

  async function deleteSuggestion(id) {
    const row = suggestionRows.find(x => Number(x.id) === Number(id));
    if (!row || row.status !== 'DRAFT') return;
    if (!confirm(`Hapus Draft ${row.ss_number} (${row.title}) beserta detail dan lampirannya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const result = await apiRequest(`/suggestions/${id}`, authToken, { method: 'DELETE' });
      alert(result.message || 'Draft berhasil dihapus.');
      await loadSuggestions();
    } catch (error) { alert(error.message); }
  }

  let approvalRows = [];
  let activeApprovalId = null;
  let approvalAssignmentData = { departments: [], employees: [], assignments: [] };

  async function loadApprovals() {
    const state = document.getElementById('approvalLoadState');
    const tbody = document.getElementById('approvalTableBody');
    state.textContent = 'Memuat...';
    try {
      const result = await apiRequest('/approvals', authToken);
      approvalRows = result.data || [];
      const pending = approvalRows.filter(x => x.decision === 'PENDING' && x.can_decide).length;
      const approved = approvalRows.filter(x => x.decision === 'APPROVED').length;
      const issues = approvalRows.filter(x => ['REVISION','REJECTED'].includes(x.decision)).length;
      document.getElementById('approvalPendingCount').textContent = pending;
      document.getElementById('approvalApprovedCount').textContent = approved;
      document.getElementById('approvalRevisionCount').textContent = issues;
      tbody.innerHTML = approvalRows.length ? approvalRows.map(row => `
        <tr>
          <td><b>${escapeHtml(row.ss_number)}</b></td>
          <td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.department_name || '—')}</td>
          <td>${escapeHtml(row.submitter_name || '—')}</td>
          <td>${escapeHtml(row.approval_label)}</td>
          <td><span class="suggestion-status status-${escapeHtml(String(row.decision).toLowerCase())}">${escapeHtml(row.decision)}</span></td>
          <td>${escapeHtml(row.submission_status)}</td>
          <td>${row.can_decide ? `<button class="ss-action-btn" data-approval="${row.submission_id}">Proses</button>` : '<span class="muted">—</span>'}</td>
        </tr>`).join('') : '<tr><td colspan="8" class="table-empty">Belum ada tugas approval untuk akun ini.</td></tr>';
      state.textContent = 'Data berhasil dimuat';
      const assignmentPanel = document.getElementById('approvalAssignmentPanel');
      assignmentPanel.hidden = currentUser?.role !== 'ADMIN';
      if (currentUser?.role === 'ADMIN') await loadApprovalAssignments();
    } catch (error) {
      state.textContent = 'Gagal memuat';
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  function updateApprovalEmployeeOptions() {
    const deptId = Number(document.getElementById('approvalDepartmentSelect').value);
    const level = document.getElementById('approvalLevelSelect').value;
    const employee = document.getElementById('approvalUserSelect');
    const eligible = approvalAssignmentData.employees.filter(person =>
      Number(person.department_id) === deptId &&
      (person.role === level || person.role === 'ADMIN')
    );
    employee.innerHTML = eligible.length
      ? eligible.map(person => `<option value="${person.id}">${escapeHtml(person.full_name)} · ${escapeHtml(person.role === 'LEADER' ? 'KaSie' : person.role)}</option>`).join('')
      : '<option value="">Tidak ada karyawan dengan role sesuai di departemen ini</option>';
    employee.disabled = eligible.length === 0;
    document.getElementById('saveApprovalAssignment').disabled = eligible.length === 0;
  }

  async function loadApprovalAssignments() {
    try {
      const result = await apiRequest('/approvals/assignments', authToken);
      approvalAssignmentData = result.data || approvalAssignmentData;
      const dept = document.getElementById('approvalDepartmentSelect');
      dept.innerHTML = approvalAssignmentData.departments.length
        ? approvalAssignmentData.departments.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')
        : '<option value="">Belum ada departemen aktif</option>';
      updateApprovalEmployeeOptions();
      document.getElementById('approvalAssignmentList').innerHTML = approvalAssignmentData.assignments.length
        ? approvalAssignmentData.assignments.map(x => `<div class="approval-assignment-chip"><b>${escapeHtml(x.department_name)}</b><span>${escapeHtml(x.approval_label)}: ${escapeHtml(x.full_name)}</span></div>`).join('')
        : '<p class="muted">Belum ada approver yang ditetapkan.</p>';
    } catch (error) {
      document.getElementById('approvalAssignmentList').textContent = error.message;
    }
  }

  async function saveApprovalAssignment() {
    const payload = {
      department_id: Number(document.getElementById('approvalDepartmentSelect').value),
      approval_level: document.getElementById('approvalLevelSelect').value,
      user_id: Number(document.getElementById('approvalUserSelect').value)
    };
    if (!payload.department_id || !payload.user_id || !payload.approval_level) {
      alert('Pilih departemen dan approver dengan role yang sesuai terlebih dahulu.');
      return;
    }
    try {
      const result = await apiRequest('/approvals/assignments', authToken, { method: 'PUT', body: JSON.stringify(payload) });
      alert(result.message || 'Penugasan tersimpan.');
      await loadApprovalAssignments();
    } catch (error) { alert(error.message); }
  }

  let approvalAttachmentUrls = [];

  async function openApprovalDecision(submissionId) {
    const row = approvalRows.find(x => Number(x.submission_id) === Number(submissionId) && x.can_decide);
    if (!row) return;
    activeApprovalId = submissionId;
    document.getElementById('approvalDecisionTitle').textContent = `${row.approval_label} · ${row.ss_number}`;
    document.getElementById('approvalDecisionSubtitle').textContent = `${row.title} · ${row.submitter_name}`;
    document.getElementById('approvalDecisionNote').value = '';
    document.getElementById('approvalDecisionMessage').textContent = '';
    document.getElementById('approvalDetailState').textContent = 'Memuat detail...';
    document.getElementById('approvalSubmissionDetail').innerHTML = '<p class="muted">Memuat informasi pengajuan...</p>';
    document.getElementById('approvalAttachmentList').innerHTML = '';
    approvalAttachmentUrls.forEach(url => URL.revokeObjectURL(url));
    approvalAttachmentUrls = [];
    const stages = ['LEADER','SUPERVISOR','MANAGER'];
    const stageRows = approvalRows.filter(x => Number(x.submission_id) === Number(submissionId));
    document.getElementById('approvalWorkflow').innerHTML = stages.map(level => {
      const item = stageRows.find(x => x.approval_level === level);
      const label = level === 'LEADER' ? 'KaSie' : level === 'SUPERVISOR' ? 'Supervisor' : 'Manager';
      return `<div class="approval-stage"><b>${label}</b><span>${escapeHtml(item?.decision || 'PENDING')}</span><small>${escapeHtml(item?.note || 'Belum ada catatan')}</small></div>`;
    }).join('');
    document.getElementById('approvalDecisionModal').hidden = false;

    try {
      const [baseResult, detailResult, attachmentResult] = await Promise.all([
        apiRequest(`/suggestions/${submissionId}`, authToken),
        apiRequest(`/suggestions/${submissionId}/form-details`, authToken),
        apiRequest(`/suggestions/${submissionId}/attachments`, authToken)
      ]);
      const item = baseResult.data || {};
      const detail = detailResult.data || {};
      const fields = [
        ['Pengaju', item.submitter_name], ['Departemen', item.department_name],
        ['Kategori', item.category_name], ['Lokasi / Mesin', detail.location_machine],
        ['Kondisi Sebelum', item.condition_before], ['Risiko Sebelum', detail.risk_before],
        ['Tindakan Improvement', item.improvement_action], ['Risiko Setelah', detail.risk_reduced],
        ['Hasil Setelah', item.result_after], ['Manfaat yang Diharapkan', item.expected_benefit],
        ['Manfaat Aktual', item.actual_benefit], ['Proses Kerja Sebelum', detail.work_process_before],
        ['Proses Kerja Sesudah', detail.work_process_after]
      ];
      const contributors = (item.contributors || []).map(x => x.full_name).filter(Boolean);
      const aspects = (detail.aspects || []).join(', ');
      const indicators = (detail.indicators || []).map(x =>
        `${x.indicator_name || 'Indikator'}: ${x.before_value ?? '—'} ${x.unit || ''} → ${x.after_value ?? '—'} ${x.unit || ''} (Selisih: ${x.saving_value ?? '—'} ${x.unit || ''})${x.pic ? ' · PIC: ' + x.pic : ''}`
      ).join('\n');
      fields.push(['Kontributor', contributors.join(', ') || '—']);
      fields.push(['Aspek Improvement', aspects || '—']);
      fields.push(['Indikator Hasil', indicators || '—']);
      document.getElementById('approvalSubmissionDetail').innerHTML = `<div class="approval-detail-grid">${fields.map(([label,value]) =>
        `<div class="approval-detail-item ${['Kondisi Sebelum','Tindakan Improvement','Hasil Setelah','Manfaat yang Diharapkan','Manfaat Aktual','Proses Kerja Sebelum','Proses Kerja Sesudah','Indikator Hasil'].includes(label) ? 'approval-detail-wide' : ''}"><small>${escapeHtml(label)}</small><div>${escapeHtml(value || '—')}</div></div>`
      ).join('')}</div>`;
      const attachments = attachmentResult.data || [];
      const attachmentHost = document.getElementById('approvalAttachmentList');
      if (!attachments.length) {
        attachmentHost.innerHTML = '<span class="muted">Belum ada lampiran.</span>';
      } else {
        for (const file of attachments) {
          const response = await fetch(`${apiBase}/suggestions/${submissionId}/attachments/${file.id}/file`, {
            headers: { Authorization: 'Bearer ' + authToken }
          });
          if (!response.ok) continue;
          const blobUrl = URL.createObjectURL(await response.blob());
          approvalAttachmentUrls.push(blobUrl);
          const isImage = /^image\//i.test(file.mime_type || '');
          const node = document.createElement('div');
          node.className = 'approval-attachment';
          node.innerHTML = `${isImage ? `<img src="${blobUrl}" alt="${escapeHtml(file.original_name)}">` : '<span>PDF</span>'}<a href="${blobUrl}" target="_blank" rel="noopener">${escapeHtml(file.original_name)} · ${escapeHtml(file.attachment_type || 'SUPPORTING')}</a>`;
          attachmentHost.appendChild(node);
        }
      }
      document.getElementById('approvalDetailState').textContent = 'Detail dan lampiran berhasil dimuat';
    } catch (error) {
      document.getElementById('approvalDetailState').textContent = 'Gagal memuat detail';
      document.getElementById('approvalSubmissionDetail').textContent = error.message;
    }
  }

  async function submitApprovalDecision(decision) {
    if (!activeApprovalId) return;
    const note = document.getElementById('approvalDecisionNote').value.trim();
    if (['REVISION','REJECTED'].includes(decision) && !note) {
      document.getElementById('approvalDecisionMessage').textContent = 'Catatan wajib diisi untuk revisi atau penolakan.';
      return;
    }
    document.querySelectorAll('.approval-decision-action').forEach(b => b.disabled = true);
    try {
      const result = await apiRequest(`/approvals/${activeApprovalId}/decision`, authToken, {
        method: 'POST', body: JSON.stringify({ decision, note })
      });
      document.getElementById('approvalDecisionModal').hidden = true;
      alert(result.message || 'Keputusan tersimpan.');
      await loadApprovals();
    } catch (error) {
      document.getElementById('approvalDecisionMessage').textContent = error.message;
    } finally {
      document.querySelectorAll('.approval-decision-action').forEach(b => b.disabled = false);
    }
  }


  // Self-service profile photo upload. The server validates ownership, type and size.
  const profileModal = document.getElementById('profileModal');
  const profileInput = document.getElementById('profilePhotoInput');
  let selectedProfileFile = null;
  const openProfileModal = () => {
    if (!profileModal || !profileInput) return;
    selectedProfileFile = null; profileInput.value = '';
    document.getElementById('profileMessage').textContent = '';
    document.getElementById('profileInitialPreview').textContent = (currentUser?.full_name || 'U').trim().charAt(0).toUpperCase();
    const preview = document.getElementById('profilePreview');
    if (currentUser?.profile_photo_url) {
      preview.src = `${apiBase}${currentUser.profile_photo_url}`;
      preview.hidden = false;
      document.getElementById('profileInitialPreview').hidden = true;
    } else {
      preview.removeAttribute('src'); preview.hidden = true;
      document.getElementById('profileInitialPreview').hidden = false;
    }
    profileModal.hidden = false;
  };
  document.getElementById('profileTrigger')?.addEventListener('click', openProfileModal);
  document.querySelector('.user-meta')?.addEventListener('click', openProfileModal);
  document.querySelector('.top-user')?.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.user-meta')) {
      event.preventDefault(); openProfileModal();
    }
  });
  const closeProfile = () => { profileModal.hidden = true; };
  document.getElementById('closeProfileModal')?.addEventListener('click', closeProfile);
  document.getElementById('cancelProfileModal')?.addEventListener('click', closeProfile);
  profileInput?.addEventListener('change', () => {
    const file = profileInput.files?.[0]; selectedProfileFile = file || null;
    const msg = document.getElementById('profileMessage');
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2*1024*1024) {
      selectedProfileFile = null; profileInput.value = ''; msg.textContent = 'Format harus JPG/PNG/WebP dan ukuran maksimal 2 MB.'; return;
    }
    const reader = new FileReader(); reader.onload = () => { const img=document.getElementById('profilePreview'); img.src=reader.result; img.hidden=false; document.getElementById('profileInitialPreview').hidden=true; }; reader.readAsDataURL(file);
  });
  document.getElementById('saveProfilePhoto')?.addEventListener('click', async () => {
    const msg=document.getElementById('profileMessage'); if (!selectedProfileFile) { msg.textContent='Pilih foto terlebih dahulu.'; return; }
    const fd=new FormData(); fd.append('photo', selectedProfileFile);
    const btn=document.getElementById('saveProfilePhoto'); btn.disabled=true; msg.textContent='Mengunggah...';
    try { const response=await fetch(apiBase+'/profile/photo',{method:'POST',headers:{Authorization:'Bearer '+authToken},body:fd}); const data=await response.json().catch(()=>({})); if(!response.ok||!data.success) throw new Error(data.message||'Gagal menyimpan foto.'); currentUser.profile_photo_url=data.profile_photo_url; renderUser(currentUser); msg.textContent='Foto profil berhasil diperbarui.'; setTimeout(closeProfile,700); } catch(e) { msg.textContent=e.message; } finally { btn.disabled=false; }
  });

  const kpiMonthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function initializeKpiFilters() {
    const yearSelect = document.getElementById('kpiYear');
    const now = new Date();
    const currentYear = now.getFullYear();
    yearSelect.innerHTML = Array.from({length: 7}, (_, i) => currentYear - 3 + i)
      .map(year => `<option value="${year}">${year}</option>`).join('');
    yearSelect.value = String(currentYear);
    document.getElementById('kpiMonth').value = String(now.getMonth() + 1);
  }

  async function loadKpi() {
    const period = document.getElementById('kpiPeriod').value;
    const month = document.getElementById('kpiMonth').value;
    const year = document.getElementById('kpiYear').value;
    const state = document.getElementById('kpiLoadState');
    const params = new URLSearchParams({period});
    if (period !== 'all') params.set('year', year);
    if (period === 'month') params.set('month', month);
    state.textContent = 'Memuat...';
    document.getElementById('kpiRankingBody').innerHTML = '<tr><td colspan="5" class="table-empty">Memuat data KPI...</td></tr>';
    try {
      const result = await apiRequest(`/kpi/summary?${params.toString()}`, authToken);
      const data = result.data || {};
      const summary = data.summary || {};
      const mine = data.my_kpi || {};
      const fmt = value => Number(value || 0).toLocaleString('id-ID');
      document.getElementById('kpiTotalPoints').textContent = fmt(summary.total_points);
      document.getElementById('kpiApprovedSuggestions').textContent = fmt(summary.approved_suggestions);
      document.getElementById('kpiParticipants').textContent = fmt(summary.participating_employees);
      document.getElementById('kpiMyPoints').textContent = fmt(mine.total_points);
      document.getElementById('kpiRankingSubtitle').textContent = period === 'all'
        ? `Seluruh periode sejak DSS digunakan · ${data.scope === 'all' ? 'Seluruh departemen' : 'Departemen Anda'}`
        : period === 'month'
          ? `Periode ${kpiMonthNames[Number(month) - 1]} ${year} · ${data.scope === 'all' ? 'Seluruh departemen' : 'Departemen Anda'}`
          : `Tahun ${year} · ${data.scope === 'all' ? 'Seluruh departemen' : 'Departemen Anda'}`;
      const rows = data.leaderboard || [];
      const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
      const podium = document.getElementById('kpiPodium');
      const podiumOrder = [rows[1], rows[0], rows[2]];
      const podiumRanks = [2, 1, 3];
      podium.innerHTML = rows.length ? podiumOrder.slice(0, 3).map((row, index) => {
        if (!row) return '<div class="kpi-podium-slot is-empty"></div>';
        const rank = podiumRanks[index];
        return `<article class="kpi-podium-card rank-${rank}">
          <div class="kpi-podium-medal">${rank === 1 ? '🏆' : rank === 2 ? '🥈' : '🥉'}</div>
          <div class="kpi-podium-avatar">${row.profile_photo_url ? `<img src="${apiBase}${row.profile_photo_url}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${escapeHtml(initials(row.full_name))}</span>` : escapeHtml(initials(row.full_name))}</div>
          <b class="kpi-podium-name">${escapeHtml(row.full_name)}</b>
          <span class="kpi-podium-department">${escapeHtml(row.department_name || '—')}</span>
          <strong>${fmt(row.total_points)} <small>poin</small></strong>
          <span class="kpi-podium-base">${rank}</span>
        </article>`;
      }).join('') : '<div class="kpi-podium-empty">Belum ada karyawan yang memperoleh poin pada periode ini.</div>';
      document.getElementById('kpiRankingBody').innerHTML = rows.length ? rows.map((row, index) => `
        <tr><td><b>${index + 1}</b></td><td><span class="kpi-name-cell">${row.profile_photo_url ? `<img src="${apiBase}${row.profile_photo_url}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="kpi-table-avatar" hidden>${escapeHtml(initials(row.full_name))}</span>` : `<span class="kpi-table-avatar">${escapeHtml(initials(row.full_name))}</span>`}<b>${escapeHtml(row.full_name)}</b></span><small class="kpi-employee-id">${escapeHtml(row.employee_id || '')}</small></td>
        <td>${escapeHtml(row.department_name || '—')}</td><td>${fmt(row.approved_suggestions)}</td><td><b>${fmt(row.total_points)}</b></td></tr>`).join('')
        : '<tr><td colspan="5" class="table-empty">Belum ada poin KPI pada periode ini.</td></tr>';
      const trend = data.monthly_trend || [];
      const maxPoints = Math.max(1, ...trend.map(item => Number(item.total_points || 0)));
      document.getElementById('kpiTrend').innerHTML = trend.length ? trend.map(item => {
        const value = Number(item.total_points || 0);
        const width = Math.max(3, Math.round(value / maxPoints * 100));
        const label = item.period_label && period === 'all'
          ? item.period_label
          : kpiMonthNames[Number(item.month_number) - 1];
        return `<div class="kpi-trend-row"><span>${escapeHtml(label)}</span><div class="kpi-trend-track"><i style="width:${width}%"></i></div><b>${fmt(value)} poin</b></div>`;
      }).join('') : '<p class="muted">Belum ada tren poin pada tahun ini.</p>';

      // Department comparison is derived from the same global leaderboard response.
      const departmentTotals = new Map();
      rows.forEach(row => {
        const name = row.department_name || 'Tanpa Departemen';
        const current = departmentTotals.get(name) || { points: 0, people: 0, suggestions: 0 };
        current.points += Number(row.total_points || 0);
        current.people += 1;
        current.suggestions += Number(row.approved_suggestions || 0);
        departmentTotals.set(name, current);
      });
      const departments = [...departmentTotals.entries()].sort((a, b) => b[1].points - a[1].points);
      const maxDepartmentPoints = Math.max(1, ...departments.map(item => item[1].points));
      const departmentBox = document.getElementById('kpiDepartmentPerformance');
      if (departmentBox) departmentBox.innerHTML = departments.length ? departments.map(([name, stats]) => {
        const width = Math.max(3, Math.round(stats.points / maxDepartmentPoints * 100));
        return `<div class="kpi-trend-row"><span>${escapeHtml(name)}</span><div class="kpi-trend-track"><i style="width:${width}%"></i></div><b>${fmt(stats.points)} poin</b><small>${fmt(stats.people)} karyawan · ${fmt(stats.suggestions)} kontribusi final</small></div>`;
      }).join('') : '<p class="muted">Belum ada data performa departemen.</p>';
      state.textContent = 'Data berhasil dimuat';
    } catch (error) {
      state.textContent = 'Gagal memuat';
      document.getElementById('kpiRankingBody').innerHTML = `<tr><td colspan="5" class="table-empty">${escapeHtml(error.message)}</td></tr>`;
      document.getElementById('kpiTrend').textContent = error.message;
    }
  }

  async function downloadReport(format) {
    const period = document.getElementById('kpiPeriod').value;
    const month = document.getElementById('kpiMonth').value;
    const year = document.getElementById('kpiYear').value;
    const params = new URLSearchParams({ period });
    if (period !== 'all') params.set('year', year);
    if (period === 'month') params.set('month', month);
    const button = document.getElementById(format === 'xlsx' ? 'exportKpiExcel' : 'exportKpiPdf');
    const original = button.textContent;
    button.disabled = true; button.textContent = 'Menyiapkan...';
    try {
      const response = await fetch(`${apiBase}/reports/suggestions.${format}?${params}`, {
        headers: { Authorization: 'Bearer ' + authToken }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Export laporan gagal.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'xlsx' ? 'DSS-Rekap-Suggestion.xlsx' : 'DSS-Rekap-Suggestion.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false; button.textContent = original;
    }
  }

  document.getElementById('exportKpiExcel')?.addEventListener('click', () => downloadReport('xlsx'));
  document.getElementById('exportKpiPdf')?.addEventListener('click', () => downloadReport('pdf'));

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
    currentUser = user;
    renderUser(user);

    const employeeNav = document.querySelector('[data-page="employees"]');
    const departmentNav = document.querySelector('[data-page="departments"]');
    if (employeeNav) employeeNav.hidden = user.role !== 'ADMIN';
    if (departmentNav) departmentNav.hidden = user.role !== 'ADMIN';

    setView('dashboard');
    if (user.role === 'ADMIN') {
      openPage('dashboard');
    } else {
      openPage('suggestions');
    }
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


  departmentEl('addDepartmentButton').addEventListener('click', () => openDepartmentModal());
  departmentEl('closeDepartmentModal').addEventListener('click', closeDepartmentModal);
  departmentEl('cancelDepartmentButton').addEventListener('click', closeDepartmentModal);
  departmentEl('departmentForm').addEventListener('submit', saveDepartment);
  departmentEl('departmentSearchButton').addEventListener('click', loadDepartments);
  departmentEl('departmentSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadDepartments();
  });
  departmentEl('departmentStatusFilter').addEventListener('change', loadDepartments);
  departmentEl('departmentModal').addEventListener('click', event => {
    if (event.target === departmentEl('departmentModal')) closeDepartmentModal();
  });
  departmentEl('departmentTableBody').addEventListener('click', event => {
    const edit = event.target.closest('[data-department-edit]');
    const toggle = event.target.closest('[data-department-toggle]');
    if (edit) {
      const row = departmentState.rows.find(item => item.id === Number(edit.dataset.departmentEdit));
      if (row) openDepartmentModal(row);
    }
    if (toggle) toggleDepartment(Number(toggle.dataset.departmentToggle), toggle.dataset.active === 'true');
  });

  initializeKpiFilters();
  document.getElementById('kpiMonth').disabled = document.getElementById('kpiPeriod').value !== 'month';
  document.getElementById('kpiYear').disabled = document.getElementById('kpiPeriod').value === 'all';
  document.getElementById('kpiRefreshButton').addEventListener('click', loadKpi);
  document.getElementById('kpiPeriod').addEventListener('change', () => {
    const period = document.getElementById('kpiPeriod').value;
    document.getElementById('kpiMonth').disabled = period !== 'month';
    document.getElementById('kpiYear').disabled = period === 'all';
  });

  document.getElementById('refreshApprovalsButton').addEventListener('click', loadApprovals);
  document.getElementById('saveApprovalAssignment').addEventListener('click', saveApprovalAssignment);
  document.getElementById('approvalDepartmentSelect').addEventListener('change', updateApprovalEmployeeOptions);
  document.getElementById('approvalLevelSelect').addEventListener('change', updateApprovalEmployeeOptions);
  document.getElementById('approvalTableBody').addEventListener('click', event => {
    const button = event.target.closest('[data-approval]');
    if (button) openApprovalDecision(Number(button.dataset.approval));
  });
  document.querySelectorAll('.approval-decision-action').forEach(button => {
    button.addEventListener('click', () => submitApprovalDecision(button.dataset.decision));
  });
  document.getElementById('closeApprovalDecision').addEventListener('click', () => document.getElementById('approvalDecisionModal').hidden = true);
  document.getElementById('cancelApprovalDecision').addEventListener('click', () => document.getElementById('approvalDecisionModal').hidden = true);
  suggestionEl('addSuggestionButton').addEventListener('click', openSuggestionModal);
  suggestionEl('closeSuggestionModal').addEventListener('click', closeSuggestionModal);
  suggestionEl('cancelSuggestionButton').addEventListener('click', closeSuggestionModal);
  suggestionEl('suggestionModal').addEventListener('click', event => {
    if (event.target === suggestionEl('suggestionModal')) closeSuggestionModal();
  });
  suggestionEl('suggestionForm').addEventListener('submit', event => {
    event.preventDefault();
    saveSuggestion(true);
  });
  suggestionEl('saveSuggestionDraft').addEventListener('click', () => saveSuggestion(false));
  suggestionEl('addIndicatorButton').addEventListener('click', () => addIndicatorRow());
  suggestionEl('suggestionBeforeFiles').addEventListener('change', () => previewFiles('suggestionBeforeFiles', 'suggestionBeforePreview'));
  suggestionEl('suggestionAfterFiles').addEventListener('change', () => previewFiles('suggestionAfterFiles', 'suggestionAfterPreview'));
  suggestionEl('suggestionTableBody').addEventListener('click', event => {
    const detail = event.target.closest('[data-detail]'), edit = event.target.closest('[data-edit]'), del = event.target.closest('[data-delete]');
    if (detail) openSuggestionDetail(Number(detail.dataset.detail));
    if (edit) editSuggestion(Number(edit.dataset.edit));
    if (del) deleteSuggestion(Number(del.dataset.delete));
  });
  const closeSuggestionDetail = () => { suggestionEl('suggestionDetailModal').hidden = true; releaseSuggestionDetailUrls(); };
  suggestionEl('closeSuggestionDetail').addEventListener('click', closeSuggestionDetail);
  suggestionEl('closeSuggestionDetailBottom').addEventListener('click', closeSuggestionDetail);
  suggestionEl('suggestionDetailModal').addEventListener('click', event => { if (event.target === suggestionEl('suggestionDetailModal')) closeSuggestionDetail(); });
  suggestionEl('suggestionSearchButton').addEventListener('click', loadSuggestions);
  suggestionEl('suggestionSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadSuggestions();
  });

  document.getElementById('logoutButton').addEventListener('click', () => {
    sessionStorage.removeItem('dss_token');
    authToken = '';
    currentUser = null;
    setView('login');
    showMessage('Anda sudah keluar dari DSS.', true);
  });

  const appShell = document.getElementById('dashboardView');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function closeMobileSidebar() {
    sidebar.classList.remove('sidebar-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('title', 'Buka atau ciutkan navigasi');
// Interactive login lamp: click shade for power, pull chain to cycle colors.
  const loginLamp = document.getElementById('loginLamp');
  const lampPowerToggle = document.getElementById('lampPowerToggle');
  const lampPull = document.getElementById('lampPull');
  const lampCaption = document.getElementById('lampCaption');

  if (loginLamp && lampPowerToggle && lampPull) {
    const lampColors = [
      { id: 'warm', label: 'WARM', color: '#ffd66b' },
      { id: 'white', label: 'COOL WHITE', color: '#eaf5ff' },
      { id: 'cyan', label: 'CYAN BLUE', color: '#69e7ff' }
    ];
    let lampColorIndex = 0;
    // Flexible pull cord: draw a live curved rope and simulate a soft spring return.
    let pullStartX = null;
    let pullStartY = null;
    let pullPointerId = null;
    let pullHandled = false;
    let pullResetFrame = 0;
    let ropeX = 0;
    let ropeY = 0;

    const svgNS = 'http://www.w3.org/2000/svg';
    const ropeSvg = document.createElementNS(svgNS, 'svg');
    ropeSvg.setAttribute('class', 'lamp-rope-svg');
    ropeSvg.setAttribute('viewBox', '0 0 150 240');
    ropeSvg.setAttribute('aria-hidden', 'true');

    const ropeShadow = document.createElementNS(svgNS, 'path');
    ropeShadow.setAttribute('class', 'lamp-rope-shadow');
    const ropePath = document.createElementNS(svgNS, 'path');
    ropePath.setAttribute('class', 'lamp-rope-line');
    const ropeHighlight = document.createElementNS(svgNS, 'path');
    ropeHighlight.setAttribute('class', 'lamp-rope-highlight');

    ropeSvg.append(ropeShadow, ropePath, ropeHighlight);
    lampPull.insertBefore(ropeSvg, lampPull.firstChild);

    function updateRopePath(x, y) {
      // Anchor at the top; the rope naturally bows under gravity as it is pulled sideways.
      const anchorX = 0;
      const anchorY = 0;
      const endX = 6 + x;
      const endY = 45 + y;
      const distance = Math.hypot(x, y);
      const sag = Math.min(30, distance * 0.16);
      const curve1X = anchorX + (endX - anchorX) * 0.22;
      const curve2X = anchorX + (endX - anchorX) * 0.78;
      const curve1Y = anchorY + 15 + y * 0.20 + sag;
      const curve2Y = anchorY + 32 + y * 0.78 + sag * 0.72;
      const d = `M ${anchorX} ${anchorY} C ${curve1X} ${curve1Y}, ${curve2X} ${curve2Y}, ${endX} ${endY}`;

      ropePath.setAttribute('d', d);
      ropeShadow.setAttribute('d', d);
      ropeHighlight.setAttribute('d', d);
      // Match the CSS variables consumed by .lamp-pull-knob.
      lampPull.style.setProperty('--rope-x', `${x}px`);
      lampPull.style.setProperty('--rope-y', `${y}px`);
      // Bandul ikut miring searah ujung tali.
      const tilt = -Math.atan2(endX - curve2X, endY - curve2Y) * 180 / Math.PI;
      lampPull.style.setProperty('--rope-r', `${tilt.toFixed(1)}deg`);
    }

    function updateLampCaption() {
      const powerOn = loginLamp.dataset.power === 'on';
      lampCaption.textContent = `${lampColors[lampColorIndex].label} • ${powerOn ? 'ON' : 'OFF'}`;
      lampPowerToggle.setAttribute('aria-pressed', String(powerOn));
      lampPowerToggle.setAttribute('aria-label', powerOn ? 'Matikan lampu' : 'Nyalakan lampu');
      lampPowerToggle.title = powerOn ? 'Klik kap lampu untuk mematikan' : 'Klik kap lampu untuk menyalakan';
    }

    function toggleLampPower() {
      loginLamp.dataset.power = loginLamp.dataset.power === 'on' ? 'off' : 'on';
      updateLampCaption();
    }

    function cycleLampColor() {
      lampColorIndex = (lampColorIndex + 1) % lampColors.length;
      loginLamp.dataset.color = lampColors[lampColorIndex].id;
      loginLamp.classList.add('is-pulled');
      window.setTimeout(() => loginLamp.classList.remove('is-pulled'), 260);
      updateLampCaption();
    }

    lampPowerToggle.addEventListener('click', toggleLampPower);

    function stopRopeReturn() {
      if (pullResetFrame) cancelAnimationFrame(pullResetFrame);
      pullResetFrame = 0;
    }

    function returnRopeNaturally() {
      stopRopeReturn();
      const fromX = ropeX;
      const fromY = ropeY;
      const startedAt = performance.now();
      const duration = 520;

      function step(now) {
        const t = Math.min(1, (now - startedAt) / duration);
        // Damped spring: slight overshoot and settle, rather than a rigid snap.
        const decay = Math.exp(-6.5 * t);
        const oscillation = Math.cos(10.5 * t);
        const factor = t === 1 ? 0 : decay * oscillation;

        ropeX = fromX * factor;
        ropeY = fromY * factor;
        updateRopePath(ropeX, ropeY);

        if (t < 1) {
          pullResetFrame = requestAnimationFrame(step);
        } else {
          ropeX = ropeY = 0;
          updateRopePath(0, 0);
          pullResetFrame = 0;
          loginLamp.classList.remove('is-pulled');
        }
      }

      pullResetFrame = requestAnimationFrame(step);
    }

    lampPull.addEventListener('pointerdown', event => {
      stopRopeReturn();
      pullStartX = event.clientX;
      pullStartY = event.clientY;
      pullPointerId = event.pointerId;
      pullHandled = false;
      try { lampPull.setPointerCapture(event.pointerId); } catch (_) {}
      lampPull.classList.add('is-dragging');
      event.preventDefault();
    });

    lampPull.addEventListener('pointermove', event => {
      if (pullStartX === null || event.pointerId !== pullPointerId) return;

      let dx = event.clientX - pullStartX;
      let dy = event.clientY - pullStartY;
      const distance = Math.hypot(dx, dy);
      const maxDistance = 112;

      if (distance > maxDistance) {
        const ratio = maxDistance / distance;
        dx *= ratio;
        dy *= ratio;
      }

      ropeX = dx;
      ropeY = dy;
      updateRopePath(ropeX, ropeY);
      loginLamp.classList.toggle('is-pulled', Math.hypot(dx, dy) > 3);
    });

    function finishPull(event) {
      if (pullStartX === null ||
          (pullPointerId !== null && event.pointerId !== pullPointerId)) return;

      let dx = event.clientX - pullStartX;
      let dy = event.clientY - pullStartY;
      const didPull = Math.hypot(dx, dy) >= 14;
      const distance = Math.hypot(dx, dy);
      const maxDistance = 112;
      if (distance > maxDistance) {
        const ratio = maxDistance / distance;
        dx *= ratio;
        dy *= ratio;
      }
      ropeX = dx;
      ropeY = dy;
      updateRopePath(ropeX, ropeY);

      pullStartX = pullStartY = pullPointerId = null;
      lampPull.classList.remove('is-dragging');

      if (didPull) {
        pullHandled = true;
        cycleLampColor();
      }

      returnRopeNaturally();
    }

    lampPull.addEventListener('pointerup', finishPull);
    lampPull.addEventListener('pointercancel', event => {
      if (pullPointerId !== null && event.pointerId !== pullPointerId) return;
      pullStartX = pullStartY = pullPointerId = null;
      lampPull.classList.remove('is-dragging');
      returnRopeNaturally();
    });

    // Native button keyboard activation also emits click (detail === 0).
    // Handle it here only, avoiding a second color change from keydown.
    lampPull.addEventListener('click', event => {
      if (event.detail === 0) cycleLampColor();
      pullHandled = false;
    });

    updateRopePath(0, 0);
    updateLampCaption();
  }


  menuToggle.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 700px)').matches) {
      const isOpen = sidebar.classList.toggle('sidebar-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    } else {
      appShell.classList.toggle('sidebar-collapsed');
      menuToggle.setAttribute('aria-expanded', String(!appShell.classList.contains('sidebar-collapsed')));
    }
  });

  sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeMobileSidebar();
    const closers = [
      ['profileModal', () => { profileModal.hidden = true; }],
      ['approvalDecisionModal', () => { document.getElementById('approvalDecisionModal').hidden = true; }],
      ['suggestionDetailModal', closeSuggestionDetail],
      ['suggestionModal', closeSuggestionModal],
      ['departmentModal', closeDepartmentModal],
      ['employeeModal', closeEmployeeModal]
    ];
    const open = closers.find(([id]) => { const el = document.getElementById(id); return el && !el.hidden; });
    if (open) open[1]();
  });
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 700px)').matches) closeMobileSidebar();
  });

  (async () => {
    if (!apiBase) {
      setView('login');
      return showMessage('Konfigurasi server belum tersedia.');
    }
    const token = sessionStorage.getItem('dss_token');
    authToken = token || '';
    if (!token) {
      setView('login');
      return;
    }
    try {
      await enterDashboard(token);
    } catch (error) {
      sessionStorage.removeItem('dss_token');
      setView('login');
      showMessage(error.message || 'Silakan login kembali.');
    }
  })();
})();
