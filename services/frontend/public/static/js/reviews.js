// reviews.js - client widget to list and submit product reviews
(function(){
  async function fetchJson(path, options){
    const res = await fetch(path, options);
    if (!res.ok) {
      // try to extract server error body for debugging
      let bodyText = '';
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.json(); bodyText = JSON.stringify(j);
        } else {
          bodyText = await res.text();
        }
      } catch (e) {
        bodyText = '<unable to read response body>';
      }
      throw new Error(`HTTP ${res.status} - ${bodyText}`);
    }
    return await res.json();
  }

  function escapeHtml(s){ if (s===null||s===undefined) return ''; return String(s).replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]||m)); }

  function renderStars(n){ n = Number(n)||0; let out=''; for(let i=0;i<5;i++) out += (i<n)?'★':'☆'; return `<span class="text-warning">${out}</span>`; }

  async function loadProducts(select){
    try{
      const products = await fetchJson('/api/products');
      select.innerHTML = '';
      // Only include products that provide an id to avoid empty productId queries
      let added = 0;
      products.forEach(p=>{
        const id = p._id || p.id || '';
        if (!id) return; // skip malformed product
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = p.nombre || p.name || p.title || 'Producto';
        select.appendChild(opt);
        added++;
      });
      if (added === 0) {
        // No usable products returned
        select.innerHTML = '<option value="">(No hay productos disponibles)</option>';
      }
    }catch(err){
      console.error('loadProducts', err);
    }
  }

  async function loadReviews(productId, container){
    if (!productId) {
      container.innerHTML = '<div class="p-2">Selecciona un producto para ver reseñas.</div>';
      return;
    }

    container.innerHTML = '<div class="p-2">Cargando reseñas...</div>';
    try{
      const data = await fetchJson('/api/reviews?productId=' + encodeURIComponent(productId));
      if (!Array.isArray(data) || data.length===0){ container.innerHTML = '<div class="p-2">No hay reseñas para este producto.</div>'; return; }
      container.innerHTML = '';
      data.forEach(r=>{
        const card = document.createElement('div'); card.className = 'card mb-2';
        const name = escapeHtml(r.name || 'Anónimo');
        const title = escapeHtml(r.title || '');
        const body = escapeHtml(r.body || '');
        const date = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
        card.innerHTML = `<div class="card-body"><div class="d-flex justify-content-between"><div><strong>${title}</strong><div class="text-muted small">por ${name} • ${date}</div></div><div>${renderStars(r.rating)}</div></div><p class="mt-2 mb-0">${body}</p></div>`;
        container.appendChild(card);
      });
    }catch(err){ 
      console.error('loadReviews', err);
      const msg = err && err.message ? err.message : 'Error desconocido';
      container.innerHTML = `<div class="p-2 text-danger">Error cargando reseñas: ${escapeHtml(msg)}</div>`;
    }
  }

  // Expose helper to other scripts (product detail modal)
  window.loadReviews = loadReviews;

  document.addEventListener('DOMContentLoaded', function(){
    const container = document.getElementById('reviewsWidget');
    if (!container) return;
    const select = container.querySelector('#reviewProductSelect');
    const list = container.querySelector('#reviewsList');
    const form = container.querySelector('#reviewForm');
    if (!select || !list || !form) return;

    loadProducts(select).then(()=>{
      if (select.options.length>0) loadReviews(select.value, list);
    });

    select.addEventListener('change', ()=> loadReviews(select.value, list));

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const productId = select.value;
      const name = form.querySelector('#reviewName').value.trim();
      const email = form.querySelector('#reviewEmail').value.trim();
      const rating = Number(form.querySelector('#reviewRating').value) || 5;
      const title = form.querySelector('#reviewTitle').value.trim();
      const body = form.querySelector('#reviewBody').value.trim();
      if (!body) { Swal.fire('Falta contenido', 'Escribe tu reseña antes de enviar', 'warning'); return; }
      try{
        const res = await fetch('/api/reviews', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ productId, name, email, rating, title, body }) });
        if (!res.ok) throw new Error('Server '+res.status);
        Swal.fire('Gracias', 'Tu reseña fue enviada y quedará pendiente de aprobación', 'success');
        form.reset();
      }catch(err){ console.error('submit review', err); Swal.fire('Error','No se pudo enviar la reseña','error'); }
    });
  });
})();
