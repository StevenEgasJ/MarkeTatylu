(function(){
  // Cart rendering and simple UI updates for cart.html
  
  // Check if business server is down and show warning
  function checkBusinessServerStatus() {
    if (window.__businessUp === false) {
      const alertContainer = document.createElement('div');
      alertContainer.id = 'business-down-alert';
      alertContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show m-3" role="alert">
          <strong><i class="fa-solid fa-server me-2"></i>Servidor No Disponible</strong>
          <p class="mb-0">El servidor de business está temporalmente fuera de servicio. No puedes proceder con el checkout en este momento.</p>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;
      const mainElement = document.querySelector('main') || document.querySelector('.container') || document.body;
      mainElement.insertBefore(alertContainer, mainElement.firstChild);
    }
  }
  
  // Check status when page loads
  document.addEventListener('DOMContentLoaded', checkBusinessServerStatus);
  // Also check immediately in case DOMContentLoaded has already fired
  if (document.readyState !== 'loading') {
    checkBusinessServerStatus();
  }
  
  function formatCurrency(n){
    return '$' + Number(n || 0).toFixed(2);
  }

  function refreshCartUI(){
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountLabel = document.getElementById('cart-count-label');
    const cartCountBadge = document.getElementById('cart-count');
    const quickSubtotal = document.getElementById('quick-subtotal');
    const quickShipping = document.getElementById('quick-shipping');
    const quickTotal = document.getElementById('quick-total');
    const confirmarBtn = document.getElementById('confirmar-productos');

    let carrito = [];
    try { carrito = JSON.parse(localStorage.getItem('carrito') || '[]'); } catch(e){ carrito = []; }
    const userLogged = (localStorage.getItem('userLoggedIn') === 'true');

    const count = Array.isArray(carrito) ? carrito.length : 0;
    if (cartCountLabel) cartCountLabel.textContent = `(${count} artículo${count===1?'':'s'})`;
    if (cartCountBadge) cartCountBadge.textContent = count > 0 ? String(count) : '';

    // If cart is empty (regardless of login) show only the left cart column centered
    if (count === 0) {
      if (cartItemsEl) {
        cartItemsEl.innerHTML = `
          <div class="text-center py-4">
            <h5>Tu carrito está vacío</h5>
            <p class="text-muted">Añade productos para comenzar tu compra.</p>
            <a href="product.html" class="btn btn-outline-primary mt-2">Ver productos</a>
          </div>
        `;
      }
      if (quickSubtotal) quickSubtotal.textContent = formatCurrency(0);
      if (quickShipping) quickShipping.textContent = formatCurrency(0);
      if (quickTotal) quickTotal.textContent = formatCurrency(0);
      if (confirmarBtn) confirmarBtn.classList.add('disabled');

      // Hide the right-side summary/shipping column and center the cart column
      try {
        const rightCol = document.getElementById('cart-right-col') || document.querySelector('.col-12.col-lg-7');
        const leftCol = document.getElementById('cart-left-col') || document.querySelector('.col-12.col-lg-5');
        if (rightCol) rightCol.style.display = 'none';
        if (leftCol) {
          leftCol.classList.remove('col-lg-5');
          leftCol.classList.add('col-lg-8','mx-auto');
        }
      } catch(e){ /* ignore layout errors */ }

      return;
    }

    // Otherwise render cart items (simple rendering)
    if (cartItemsEl) {
      cartItemsEl.innerHTML = '';
      let subtotal = 0;
      carrito.forEach((item, idx) => {
        const name = item.nombre || item.name || 'Producto';
        const qty = Number(item.cantidad || item.qty || item.quantity || 1) || 1;
        const price = Number(item.precio || item.price || 0) || 0;
        const img = item.imagen || item.image || './static/img/producto.png';
        subtotal += price * qty;
        const node = document.createElement('div');
        node.className = 'd-flex align-items-center gap-3 border rounded p-2';
        node.dataset.index = String(idx);
        node.innerHTML = `
          <img src="${img}" alt="${name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
          <div class="flex-grow-1">
            <div class="fw-bold">${name}</div>
            <div class="small text-muted">Precio: ${formatCurrency(price)} c/u</div>
            <div class="mt-2">
              <div class="d-flex align-items-center gap-2">
                <div class="input-group input-group-sm" style="width:130px;">
                  <button class="btn btn-outline-secondary decrement" type="button" data-index="${idx}">-</button>
                  <input type="text" readonly class="form-control text-center qty-input" value="${qty}" data-index="${idx}" style="max-width:48px;padding:6px;">
                  <button class="btn btn-outline-secondary increment" type="button" data-index="${idx}">+</button>
                </div>
              </div>
              <div class="mt-1">
                <button class="remove-item simple-remove" data-index="${idx}">Remover</button>
              </div>
            </div>
          </div>
          <div class="text-end fw-bold">${formatCurrency(price * qty)}</div>
        `;
        cartItemsEl.appendChild(node);
      });

      if (quickSubtotal) quickSubtotal.textContent = formatCurrency(subtotal);
      // Restore previously selected shipping method (if any) - saved token like 'standard'|'express'|'pickup'
      try {
        const savedShip = localStorage.getItem('selectedShipping');
        if (savedShip) {
          const id = 'ship-' + String(savedShip || '');
          const savedRadio = document.getElementById(id);
          if (savedRadio && savedRadio.name === 'shipping') savedRadio.checked = true;
        }
      } catch(e){}

      // shipping default (choose selected radio) and apply visual selected class to cards
      let shippingVal = 0;
      try {
        const selected = document.querySelector('input[name="shipping"]:checked');
        if (selected) {
          // Map shipping method ids to desired prices
          if (selected.id === 'ship-standard') shippingVal = 1;
          else if (selected.id === 'ship-express') shippingVal = 2;
          else if (selected.id === 'ship-pickup') shippingVal = 0;
          else shippingVal = Number(selected.value) || 0;
        }

        // apply .selected to the containing .shipping-option cards
        try {
          document.querySelectorAll('.shipping-option').forEach(function(card){
            try {
              const r = card.querySelector('input[type="radio"]');
              if (r && r.checked) card.classList.add('selected'); else card.classList.remove('selected');
            } catch(_){ }
          });
        } catch(_){ }

      } catch(e){ shippingVal = 0; }
      if (quickShipping) quickShipping.textContent = formatCurrency(shippingVal);
      if (quickTotal) quickTotal.textContent = formatCurrency(subtotal + shippingVal);
      if (confirmarBtn) confirmarBtn.classList.remove('disabled');
      // Restore or adjust layout depending on login status
      try {
        const rightCol = document.getElementById('cart-right-col') || document.querySelector('.col-12.col-lg-7');
        const leftCol = document.getElementById('cart-left-col') || document.querySelector('.col-12.col-lg-8.mx-auto, .col-12.col-lg-6.mx-auto, .col-12.col-lg-5');
        // Always show the right-side summary/shipping column when there are products.
        // Guests can view shipping options and totals but will be prompted to log in when proceeding to checkout.
        try {
          if (rightCol) rightCol.style.display = '';
          if (leftCol) {
            leftCol.classList.remove('col-lg-8','col-lg-6','mx-auto');
            leftCol.classList.add('col-lg-5');
          }
        } catch(e) { /* ignore layout errors */ }
      } catch(e){ }
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function(){
    try { refreshCartUI(); } catch(e){ console.error('cart init error', e); }

    // Recompute when storage changes in other tabs
    window.addEventListener('storage', function(e){
      if (e.key === 'carrito' || e.key === 'userLoggedIn') refreshCartUI();
    });

    // Recompute when shipping option changes and persist selection (store token: 'standard'|'express'|'pickup')
    document.addEventListener('change', function(e){
      if (e.target && e.target.name === 'shipping') {
        try {
          let id = e.target.id || '';
          let token = id.replace(/^ship[-_]?/i, '');
          token = token.replace(/^ci_ship[-_]?/i, '');
          localStorage.setItem('selectedShipping', token);
        } catch(_){}
        refreshCartUI();
      }
    });

    // Handle increment/decrement/remove using event delegation on the cart items container
    document.addEventListener('click', function(e){
      const target = e.target;
      if (!target) return;
      // If user clicked a shipping-option card (or any child), toggle the radio and refresh
      const shippingCard = target.closest && target.closest('.shipping-option');
      if (shippingCard) {
        try {
          const radio = shippingCard.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            try {
              let token = (radio.id || '').replace(/^ship[-_]?/i, '');
              token = token.replace(/^ci_ship[-_]?/i, '');
              localStorage.setItem('selectedShipping', token);
            } catch(_){}
            refreshCartUI();
          }
        } catch(_){}
        return;
      }
      // find dataset index
      const idx = target.dataset && target.dataset.index ? Number(target.dataset.index) : null;
      if (target.classList.contains('increment') && idx !== null) {
        try {
          const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
          if (Array.isArray(cart) && cart[idx]) {
            const qty = Number(cart[idx].cantidad || cart[idx].qty || cart[idx].quantity || 1) || 1;
            cart[idx].cantidad = qty + 1;
            localStorage.setItem('carrito', JSON.stringify(cart));
            refreshCartUI();
          }
        } catch(e){ console.error(e); }
      }
      if (target.classList.contains('decrement') && idx !== null) {
        try {
          const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
          if (Array.isArray(cart) && cart[idx]) {
            const qty = Number(cart[idx].cantidad || cart[idx].qty || cart[idx].quantity || 1) || 1;
            const newQty = Math.max(1, qty - 1);
            cart[idx].cantidad = newQty;
            localStorage.setItem('carrito', JSON.stringify(cart));
            refreshCartUI();
          }
        } catch(e){ console.error(e); }
      }
      if (target.classList.contains('remove-item') && idx !== null) {
        try {
          const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
          if (Array.isArray(cart) && cart[idx]) {
            cart.splice(idx, 1);
            localStorage.setItem('carrito', JSON.stringify(cart));
            refreshCartUI();
          }
        } catch(e){ console.error(e); }
      }
    });

    // Simple listener to the confirmar-productos link to guard navigation
    const confirmarBtn = document.getElementById('confirmar-productos');
    if (confirmarBtn) {
      confirmarBtn.addEventListener('click', async function(e){
        // Check if business server is available with real-time health check
        let businessAvailable = true;
        try {
          const businessHealthCheck = await fetch('/api/health/business', {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (businessHealthCheck.ok) {
            try {
              const data = await businessHealthCheck.json();
              businessAvailable = data && data.status === 'ok' && data.service === 'backend-business';
            } catch (parseErr) {
              businessAvailable = false;
            }
          } else {
            businessAvailable = false;
          }
        } catch (error) {
          businessAvailable = false;
        }
        
        if (!businessAvailable) {
          e.preventDefault();
          e.stopPropagation();
          try { 
            Swal.fire({ 
              title: 'Servidor No Disponible', 
              text: 'El servidor de business está temporalmente fuera de servicio. No puedes proceder con el checkout en este momento.', 
              icon: 'error',
              confirmButtonText: 'Entendido'
            }); 
          } catch(_){ }
          return;
        }
        
        // If button has .disabled class, prevent navigation
        if (confirmarBtn.classList.contains('disabled')) {
          e.preventDefault();
          e.stopPropagation();
          // show message to user
          try { Swal.fire({ title: 'Carrito vacío', text: 'Agrega productos antes de continuar', icon: 'info' }); } catch(_){ }
        }
      });
    }
  });

})();
