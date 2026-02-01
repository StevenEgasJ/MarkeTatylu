// Carga y edición de perfil
(async () => {
  const qs = sel => document.querySelector(sel);
  const profileForm = qs('#profileForm');
  const alertBox = qs('#profileAlert');
  const fields = ['nombre','apellido','telefono','cedula','photo'];
  const fileInput = qs('#photoFile');
  const photoPreview = qs('#photoPreview');

  function showAlert(msg, type = 'danger') {
    alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }
  function clearAlert(){ alertBox.innerHTML = ''; }

  function getToken() {
    return sessionStorage.getItem('token') || localStorage.getItem('token') || null;
  }

  async function fetchJson(url, opts = {}) {
    const token = getToken();
    opts.headers = opts.headers || {};
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';

    const res = await fetch(url, opts);
    const text = await res.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch(e) { body = text; }
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${JSON.stringify(body)}`);
    return body;
  }

  async function loadProfile() {
    try {
      clearAlert();
      const user = await fetchJson('/api/users/me', { method: 'GET' });
      fields.forEach(f => {
        const el = qs('#' + f);
        if (el) el.value = user[f] ?? '';
      });

      // show photo preview if available
      if (user.photo) {
        photoPreview.src = user.photo;
        photoPreview.style.display = 'inline-block';
      }
        // render loyalty summary for this user
        try {
          const emailForLoyalty = user.email || localStorage.getItem('userEmail') || JSON.parse(localStorage.getItem('currentUser')||'{}').email;
          renderLoyaltySummaryFor(emailForLoyalty);
        } catch(e){}
    } catch (err) {
      console.error('Error cargando perfil', err);
      showAlert('No fue posible cargar tu perfil. Asegúrate de estar autenticado.', 'warning');
    }
  }

  // Loyalty display helpers
  function renderLoyaltySummaryFor(email) {
    const panel = qs('#loyaltyPanel');
    const pointsEl = qs('#lp_points');
    const tierEl = qs('#lp_tier');
    const availEl = qs('#lp_availableDiscount');
    if (!panel || !pointsEl || !tierEl || !availEl) return;

    try {
      if (!email) {
        panel.style.display = 'none';
        return;
      }

      if (!window.loyaltyManager || typeof window.loyaltyManager.getLoyaltySummary !== 'function') {
        // If loyaltyManager not available, still show panel with note
        panel.style.display = 'block';
        pointsEl.innerText = 'N/D';
        tierEl.innerText = 'N/D';
        availEl.innerText = 'N/D';
        return;
      }

      const summary = window.loyaltyManager.getLoyaltySummary(email);
      if (!summary) {
        panel.style.display = 'none';
        return;
      }

      panel.style.display = 'block';
      pointsEl.innerText = summary.points ?? 0;
      tierEl.innerText = summary.tierName || (summary.tier || '--');
      availEl.innerText = (summary.availableDiscount != null) ? ('$' + Number(summary.availableDiscount).toFixed(2)) : '$0.00';
    } catch (e) {
      console.warn('renderLoyaltySummaryFor error', e);
    }
  }

  // Refresh loyalty when user clicks
  const lpRefreshBtn = qs('#lp_refresh');
  if (lpRefreshBtn) lpRefreshBtn.addEventListener('click', () => {
    const email = qs('#email') ? qs('#email').value.trim() : (localStorage.getItem('userEmail') || JSON.parse(localStorage.getItem('currentUser')||'{}').email);
    renderLoyaltySummaryFor(email);
    lpRefreshBtn.disabled = true;
    setTimeout(()=>{ lpRefreshBtn.disabled = false; }, 800);
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      clearAlert();
      const payload = {};
      fields.forEach(f => {
        const v = qs('#' + f).value.trim();
        payload[f] = v;
      });
      const saveBtn = qs('#saveBtn');
      saveBtn.disabled = true;
      const updated = await fetchJson('/api/users/me', { method: 'PUT', body: JSON.stringify(payload) });

      // Sync common localStorage keys used across the app so header and invoices reflect changes
      try {
        localStorage.setItem('userNombre', updated.nombre || '');
        localStorage.setItem('userApellido', updated.apellido || '');
        localStorage.setItem('userTelefono', updated.telefono || '');
        localStorage.setItem('userCedula', updated.cedula || '');
        if (updated.photo) {
          localStorage.setItem('userPhoto', updated.photo);
        }
        // also update currentUser snapshot used by cart/checkout
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        currentUser.nombre = updated.nombre || currentUser.nombre || '';
        currentUser.apellido = updated.apellido || currentUser.apellido || '';
        currentUser.email = currentUser.email || localStorage.getItem('userEmail') || currentUser.email;
        currentUser.telefono = updated.telefono || currentUser.telefono || '';
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Update UI if possible
        if (typeof updateUserInterface === 'function') {
          updateUserInterface();
        }
      } catch (err) {
        console.warn('Could not sync localStorage after profile update:', err);
      }

      showAlert('Perfil actualizado correctamente.', 'success');
      saveBtn.disabled = false;
    } catch (err) {
      console.error('Error guardando perfil', err);
      showAlert('Error al guardar: ' + err.message, 'danger');
      qs('#saveBtn').disabled = false;
    }
  });

  // Handle file selection and convert to data URL
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        // show preview
        if (photoPreview) {
          photoPreview.src = dataUrl;
          photoPreview.style.display = 'inline-block';
        }
        // put dataUrl into hidden/photo input so it will be sent to server
        const photoInput = qs('#photo');
        if (photoInput) photoInput.value = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  // cerrar sesión simple (solo borra token en sesión)
  qs('#logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    showAlert('Sesión cerrada (token eliminado)', 'info');
  });

  // inicializar
  loadProfile();
})();
