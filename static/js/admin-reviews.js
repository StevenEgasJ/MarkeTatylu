// admin-reviews.js - simple admin moderation UI helpers
(function(){
  async function fetchJson(path, options){
    const res = await fetch(path, options);
    if (!res.ok) throw new Error('Network error ' + res.status);
    return await res.json();
  }

  // No auth required for moderation per user request — keep a no-op token getter for compatibility
  function getAuthToken(){ return null; }

  async function loadAll(container){
    container.innerHTML = '<div class="p-2">Cargando reseñas...</div>';
    try{
      const token = getAuthToken();
      const res = await fetch('/api/reviews/admin/all', { headers: token? { Authorization: 'Bearer '+token } : {} });
      if (!res.ok) throw new Error('Auth required or error '+res.status);
      const data = await res.json();
      if (!Array.isArray(data) || data.length===0){ container.innerHTML = '<div class="p-2">No hay reseñas</div>'; return; }
      container.innerHTML = '';
      data.forEach(r=>{
        const row = document.createElement('div'); row.className = 'card mb-2';
        row.innerHTML = `<div class="card-body d-flex justify-content-between align-items-start"><div><strong>${escapeHtml(r.title||'')}</strong> <div class="text-muted small">${escapeHtml(r.name||r.email||'Anon')} • ${new Date(r.createdAt).toLocaleString()}</div><p class="mt-2">${escapeHtml(r.body||'')}</p></div><div class="text-end"><div class="mb-2">${r.approved?'<span class="badge bg-success">Aprobada</span>':'<span class="badge bg-secondary">Pendiente</span>'}</div><div><button class="btn btn-sm btn-success me-1" data-action="approve" data-id="${r._id}">${r.approved?'Desaprobar':'Aprobar'}</button><button class="btn btn-sm btn-danger" data-action="delete" data-id="${r._id}">Eliminar</button></div></div></div>`;
        container.appendChild(row);
      });
    }catch(err){ 
      console.error('loadAll', err);
      container.innerHTML = '<div class="p-2 text-danger">Error cargando reseñas (revisa la consola para más detalles).</div>';
    }
  }

  function escapeHtml(s){ if (s===null||s===undefined) return ''; return String(s).replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]||m)); }

  document.addEventListener('DOMContentLoaded', function(){
    const container = document.getElementById('adminReviewsList');
    if (!container) return;
    // No auth required: load moderation list immediately
    loadAll(container);

    container.addEventListener('click', async function(e){
      const btn = e.target.closest('button[data-action]'); if (!btn) return;
      const action = btn.getAttribute('data-action'); const id = btn.getAttribute('data-id');
        try{
          if (action === 'approve'){
            const makeApproved = btn.textContent.trim() !== 'Aprobar';
            const res = await fetch('/api/reviews/admin/'+id+'/approve', { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ approved: !makeApproved }) });
            if (!res.ok) throw new Error('Error '+res.status);
            Swal.fire('OK','Operación realizada','success');
          } else if (action === 'delete'){
            const ok = await Swal.fire({ title: 'Eliminar', text: 'Eliminar reseña?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
            if (!ok.isConfirmed) return;
            const res = await fetch('/api/reviews/admin/'+id, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error '+res.status);
            Swal.fire('Eliminada','Reseña eliminada','success');
          }
        // refresh
        loadAll(container);
      }catch(err){ console.error('admin action', err); Swal.fire('Error','No se pudo completar la acción','error'); }
    });
  });
})();
