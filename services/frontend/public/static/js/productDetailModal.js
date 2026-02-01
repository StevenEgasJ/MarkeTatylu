// productDetailModal.js - opens modal for a product and loads reviews
(function(){
  async function fetchJson(path, opts){
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error('Network ' + res.status);
    return await res.json();
  }

  function qs(id){ return document.getElementById(id); }

  window.openProductModal = async function(productId){
    try{
      const modalEl = qs('productDetailModal');
      const titleEl = qs('modalProductTitle');
      const imgEl = qs('modalProductImage');
      const descEl = qs('modalProductDescription');
      const priceEl = qs('modalProductPrice');
      const stockEl = qs('modalProductStock');
      const reviewsList = qs('modalReviewsList');
      const addBtn = qs('modalAddReviewBtn');
      const formContainer = qs('modalReviewFormContainer');

      // fetch product
      const product = await fetchJson('/api/products/' + encodeURIComponent(productId));
      titleEl.textContent = product.nombre || product.title || 'Producto';
      imgEl.src = product.imagen || product.image || './static/img/placeholder.png';
      descEl.textContent = product.descripcion || product.description || '';
      priceEl.textContent = product.precio ? ('$' + Number(product.precio).toFixed(2)) : '';
      stockEl.textContent = (product.stock !== undefined) ? ('Stock: ' + product.stock) : '';

      // load reviews using exposed helper from reviews.js
      if (typeof window.loadReviews === 'function') {
        window.loadReviews(productId, reviewsList);
      } else {
        reviewsList.innerHTML = 'Reseñas no disponibles.';
      }

      // show modal
      const modal = new bootstrap.Modal(modalEl, {});
      modal.show();

      // toggle form
      addBtn.onclick = function(){ formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none'; };

      // submit handler
      const modalForm = qs('modalReviewForm');
      if (modalForm) {
        modalForm.onsubmit = async function(e){
          e.preventDefault();
          
          // Validar que business backend está disponible
          const pingBusiness = async () => {
            try {
              const res = await fetch('/api/health/business', { method: 'GET' });
              return res.ok;
            } catch (_) {
              return false;
            }
          };
          
          const businessUp = (window.api && typeof window.api.pingBusiness === 'function')
            ? await window.api.pingBusiness()
            : await pingBusiness();
          
          if (!businessUp) {
            Swal.fire('Servidor caído', 'El servidor de business está caído. No se puede enviar la reseña.', 'error');
            return;
          }
          
          const name = qs('modalReviewName').value.trim();
          const email = qs('modalReviewEmail').value.trim();
          const rating = Number(qs('modalReviewRating').value) || 5;
          const title = qs('modalReviewTitle').value.trim();
          const body = qs('modalReviewBody').value.trim();
          if (!body) { Swal.fire('Falta contenido','Escribe tu reseña antes de enviar','warning'); return; }
          try{
            const res = await fetch('/api/reviews', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ productId, name, email, rating, title, body }) });
            if (!res.ok) throw new Error('Server '+res.status);
            Swal.fire('Gracias','Tu reseña fue enviada y quedará pendiente de aprobación','success');
            modalForm.reset();
            formContainer.style.display = 'none';
            // reload reviews (they will appear once approved)
            if (typeof window.loadReviews === 'function') window.loadReviews(productId, reviewsList);
          }catch(err){ console.error('modal submit review', err); Swal.fire('Error','No se pudo enviar la reseña','error'); }
        };
      }

    }catch(err){
      console.error('openProductModal', err);
      Swal.fire('Error','No se pudo cargar el producto','error');
    }
  };
})();
