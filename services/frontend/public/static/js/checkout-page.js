// checkout-page.js
// Page-based checkout UI: accordion on left, order summary on right.
(function(){

// Safeguard: provide lightweight fallbacks if checkoutManager_new.js has not loaded yet
if (typeof window.getLocationForCheckout !== 'function') {
  window.getLocationForCheckout = async function(){ console.warn('getLocationForCheckout (stub): manager not loaded'); return null; };
}
if (typeof window.generateOrder !== 'function') {
  window.generateOrder = function(carrito = [], userData = {}, locationData = { address: { full: '' } }, totals = {}, invoiceData = {}) {
    console.warn('generateOrder (stub): manager not loaded');
    return {
      id: 'ORD-' + Date.now(),
      fecha: new Date().toISOString(),
      cliente: userData,
      entrega: locationData,
      productos: carrito,
      totales: totals,
      pago: { metodo: invoiceData.metodoPago || '' }
    };
  };
}
if (typeof window.togglePaymentFields !== 'function') {
  window.togglePaymentFields = function(){
    const metodoPago = (document.getElementById('metodoPago') || {}).value || '';
    const tarjetaFields = document.getElementById('tarjetaFields') || document.getElementById('cardFields');
    const paypalFields = document.getElementById('paypalFields');
    const transferenciaFields = document.getElementById('transferenciaFields');
    try {
      if (tarjetaFields) tarjetaFields.style.display = metodoPago === 'tarjeta' ? 'block' : 'none';
      if (paypalFields) paypalFields.style.display = metodoPago === 'paypal' ? 'block' : 'none';
      if (transferenciaFields) transferenciaFields.style.display = metodoPago === 'transferencia' ? 'block' : 'none';
    } catch(e) { console.warn('togglePaymentFields (stub) failed', e); }
  };
}

function formatMoney(v){ return '$' + Number(v||0).toFixed(2); }

// Validation helpers
function markInvalid(el, msg){
  if(!el) return;
  el.classList.add('is-invalid');
  let fb = el.nextElementSibling;
  if(!(fb && fb.classList && fb.classList.contains('invalid-feedback'))){
    fb = document.createElement('div');
    fb.className = 'invalid-feedback';
    el.parentNode.insertBefore(fb, el.nextSibling);
  }
  fb.innerText = msg;
}
function clearInvalid(el){
  if(!el) return;
  el.classList.remove('is-invalid');
  const fb = el.nextElementSibling;
  if(fb && fb.classList && fb.classList.contains('invalid-feedback')) fb.innerText = '';
}

function isAddressComplete(){
  const manualBlock = document.getElementById('manual-location-block');
  if (manualBlock && manualBlock.style.display === 'block') {
    // Required fields in manual mode: main street, secondary street, house number
    const main = (document.getElementById('ci_main_street') || {}).value?.trim() || '';
    const secondary = (document.getElementById('ci_secondary_street') || {}).value?.trim() || '';
    const house = (document.getElementById('ci_house_number') || {}).value?.trim() || '';
    return !!(main && house && secondary);
  } else {
    const street = (document.getElementById('ci_street') || {}).value?.trim() || '';
    return !!street;
  }
}

function showValidationErrors(){
  const manualBlock = document.getElementById('manual-location-block');
  clearAllValidation();
  if (manualBlock && manualBlock.style.display === 'block') {
    const mainEl = document.getElementById('ci_main_street');
    const secEl = document.getElementById('ci_secondary_street');
    const houseEl = document.getElementById('ci_house_number');
    if(!mainEl || !(mainEl.value||'').trim()) markInvalid(mainEl, 'Por favor, ingrese la calle principal');
    if(!secEl || !(secEl.value||'').trim()) markInvalid(secEl, 'Por favor, ingrese la calle secundaria');
    if(!houseEl || !(houseEl.value||'').trim()) markInvalid(houseEl, 'Por favor, ingrese el número de casa/departamento');
  } else {
    const streetEl = document.getElementById('ci_street');
    if(!streetEl || !(streetEl.value||'').trim()) markInvalid(streetEl, 'Por favor, ingrese la calle principal');
  }
  // focus first invalid
  const first = document.querySelector('.is-invalid');
  if(first) first.focus();
}

function clearAllValidation(){
  ['ci_street','ci_main_street','ci_secondary_street','ci_house_number'].forEach(id=>{
    const el = document.getElementById(id); if(el) clearInvalid(el);
  });
}

// Validate all required fields (address + payment) to decide if final Confirm button should be enabled
function validateAllForFinalButton(){
  try {
    // Address check
    if(!isAddressComplete()) return false;

    // Phone check
    const telEl = document.getElementById('telefono');
    const telVal = telEl ? (telEl.value||'').replace(/\D/g,'') : '';
    if(!telVal || telVal.length !== 10) return false;

    // Payment method check
    const methodEl = document.getElementById('metodoPago') || document.getElementById('ci_paymentMethod');
    const method = methodEl ? (methodEl.value||'') : '';
    if(!method) return false;

    if(method === 'tarjeta'){
      const num = (document.getElementById('numeroTarjeta') || {}).value || '';
      const date = (document.getElementById('fechaVencimiento') || {}).value || '';
      const cvv = (document.getElementById('cvv') || {}).value || '';
      if(!num || !date || !cvv) return false;
      if(!/^\d{2}\/\d{2}$/.test(date)) return false;
      if(!/^\d{3,4}$/.test(cvv)) return false;
      if(typeof validateCreditCard === 'function' && !validateCreditCard(num.replace(/\s/g,''))) return false;
    }

    if(method === 'paypal'){
      const email = (document.getElementById('emailPaypal') || {}).value || '';
      if(!email) return false;
      if(!validateEmail(email)) return false;
    }

    if(method === 'transferencia'){
      const banco = (document.getElementById('banco') || {}).value || '';
      const numCuenta = (document.getElementById('numeroCuenta') || {}).value || '';
      const titular = (document.getElementById('titularCuenta') || {}).value || '';
      if(!banco || !numCuenta || !titular) return false;
    }

    // All checks passed
    return true;
  } catch(e){ return false; }
}

function updateFinalButtonState(){
  const btn = document.getElementById('place-order');
  if(!btn) return;
  try { btn.disabled = !validateAllForFinalButton(); } catch(e) { btn.disabled = true; }
}

function buildAccordion(){
  return `
    <div class="accordion-item">
      <h2 class="accordion-header" id="headingOne">
        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
          1. Dirección de Entrega
        </button>
      </h2>
      <div id="collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#checkoutAccordion">
        <div class="accordion-body">
          <form id="checkout-shipping-form">
            <div class="mb-3">
              <div id="checkout-map" style="height:300px; border-radius:8px; overflow:hidden; background:#f8f9fa; border:1px solid rgba(0,0,0,0.06); display:flex; align-items:center; justify-content:center;">
                <div class="text-muted">Mapa (ubicación GPS aparecerá aquí)</div>
              </div>
            </div>

            <div id="ci_street_block" class="mb-2">
              <label class="form-label">Dirección</label>
              <input id="ci_street" class="form-control" placeholder="Calle principal, número, referencias">
            </div>

            <!-- Manual edit block (hidden by default). Visible when user clicks 'Cambiar ubicación' -->
            <div id="manual-location-block" style="display:none;" class="mb-3">
              <div class="mb-2">
                <label class="form-label">Calle principal</label>
                <input id="ci_main_street" class="form-control" placeholder="Calle principal">
              </div>
              <div class="mb-2">
                <label class="form-label">Calle secundaria (opcional)</label>
                <input id="ci_secondary_street" class="form-control" placeholder="Calle secundaria / referencia corta">
              </div>
              <div class="mb-2">
                <label class="form-label">Número de casa/departamento</label>
                <input id="ci_house_number" class="form-control" placeholder="N. casa / departamento">
              </div>
              <div class="mb-2">
                <label class="form-label">Referencia adicional (opcional)</label>
                <input id="ci_additional_reference" class="form-control" placeholder="Referencia adicional, p.ej. puerta azul, portería">
              </div>
            </div>

            <div class="d-flex gap-2">
              <button type="button" id="ci_change_location" class="btn btn-outline-secondary btn-sm">Cambiar ubicación</button>
              <div class="ms-auto">
                <button type="button" class="btn btn-primary" id="shipping-continue">Continuar</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="accordion-item">
      <h2 class="accordion-header" id="headingTwo">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
          2. Métodos de Pago
        </button>
      </h2>
      <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#checkoutAccordion">
      <div class="accordion-body">
        <form id="checkout-payment-form">
          <!-- Modal-style payment fields inlined so existing helpers (togglePaymentFields/setupPaymentFieldListeners) work -->
          <div class="row g-3">
            <div class="col-12 mb-3">
              <div class="alert alert-success">
                <i class="fa-solid fa-map-marker-alt me-2"></i>
                <strong>✅ Dirección de entrega:</strong>
                <div id="payment-delivery-address" class="mt-1 small text-muted">--</div>
              </div>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-bold">Teléfono de contacto</label>
              <input id="telefono" class="form-control" placeholder="Número de teléfono" inputmode="numeric" pattern="\d*" maxlength="10">
            </div>

            <div class="col-md-6">
              <label class="form-label fw-bold">Método de pago *</label>
              <select id="metodoPago" class="form-select" required>
                <option value="">Seleccionar método</option>
                <option value="efectivo">💵 Efectivo (Pago contra entrega)</option>
                <option value="tarjeta">💳 Tarjeta de Crédito/Débito</option>
                <option value="transferencia">🏦 Transferencia Bancaria</option>
                <option value="paypal">🅿️ PayPal</option>
              </select>
              <small class="text-muted">Selecciona el método de pago para ver los campos correspondientes</small>
            </div>

            <div id="tarjeta-fields" class="col-12" style="display:none;">
              <div class="alert alert-info">
                <i class="fa-solid fa-credit-card me-2"></i>
                <strong>🔒 Información de Tarjeta</strong>
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label"><strong>Número de tarjeta</strong></label>
                  <input id="numeroTarjeta" class="form-control" placeholder="1234 5678 9012 3456" maxlength="19">
                </div>
                <div class="col-md-3">
                  <label class="form-label"><strong>Fecha de vencimiento</strong></label>
                  <input id="fechaVencimiento" class="form-control" placeholder="MM/AA" maxlength="5">
                </div>
                <div class="col-md-3">
                  <label class="form-label"><strong>CVV</strong></label>
                  <input id="cvv" class="form-control" placeholder="123" maxlength="4">
                </div>
                <!-- Nombre en la tarjeta eliminado por petición del usuario -->
              </div>
            </div>

                <div id="paypal-fields" class="col-12" style="display:none;">
              <div class="alert alert-info">
                <i class="fa-brands fa-paypal me-2"></i>
                    <strong>🔒 Información de PayPal</strong>
              </div>
              <div class="row g-3">
                <div class="col-12">
                        <label class="form-label"><strong>Email de PayPal</strong></label>
                        <input id="emailPaypal" class="form-control" type="email" placeholder="tu@email.com">
                </div>
              </div>
            </div>

            <div id="transferencia-fields" class="col-12" style="display:none;">
              <div class="alert alert-info">
                <i class="fa-solid fa-university me-2"></i>
                <strong>🔒 Información para Transferencia Bancaria</strong>
              </div>
              <div class="row g-3">
                        <div class="col-md-6">
                          <label class="form-label"><strong>Banco</strong></label>
                          <select id="banco" class="form-select">
                    <option value="">Seleccionar banco</option>
                    <option value="pichincha">Banco Pichincha</option>
                    <option value="pacifico">Banco del Pacífico</option>
                    <option value="guayaquil">Banco de Guayaquil</option>
                    <option value="produbanco">Produbanco</option>
                    <option value="internacional">Banco Internacional</option>
                    <option value="bolivariano">Banco Bolivariano</option>
                  </select>
                </div>
                        <div class="col-md-6">
                          <label class="form-label"><strong>Número de cuenta</strong></label>
                          <input id="numeroCuenta" class="form-control" placeholder="Número de cuenta bancaria">
                        </div>
                        <div class="col-12">
                          <label class="form-label"><strong>Titular de la cuenta</strong></label>
                          <input id="titularCuenta" class="form-control" placeholder="Nombre del titular de la cuenta">
                        </div>
              </div>
            </div>

            <!-- Se eliminó el campo de instrucciones especiales por petición del usuario -->

          </div>

          <div class="d-flex justify-content-end mt-2">
            <button type="button" class="btn btn-secondary me-2" id="payment-back">Atrás</button>
            <button type="button" class="btn btn-primary" id="payment-continue">Continuar</button>
          </div>
        </form>
      </div>
      </div>
    </div>

    <div class="accordion-item">
      <h2 class="accordion-header" id="headingThree">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
          3. Opciones de Envío
        </button>
      </h2>
      <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#checkoutAccordion">
        <div class="accordion-body">
          <div class="mb-3">
            <div class="form-check">
              <input class="form-check-input" type="radio" name="ci_shipping" id="ci_ship_standard" value="standard" checked>
              <label class="form-check-label" for="ci_ship_standard">Estándar: Entrega en ~4 horas — $1.00</label>
            </div>
            <div class="form-check mt-2">
              <input class="form-check-input" type="radio" name="ci_shipping" id="ci_ship_express" value="express">
              <label class="form-check-label" for="ci_ship_express">Express: Entrega en ~10 minutos — $2.00</label>
            </div>
            <div class="form-check mt-2">
              <input class="form-check-input" type="radio" name="ci_shipping" id="ci_ship_pickup" value="pickup">
              <label class="form-check-label" for="ci_ship_pickup">Recoger en tienda</label>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Número de membresía (opcional)</label>
            <input id="ci_membership" class="form-control" placeholder="Número de membresía">
            <small class="text-muted">Ingresa tu número de membresía para evitar recargos</small>
          </div>

          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-secondary" id="shipping-back">Continuar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSummary(){
  const carrito = JSON.parse(localStorage.getItem('carrito')||'[]');
  const totals = typeof calculateTotalsWithTax === 'function' ? calculateTotalsWithTax(carrito) : { subtotal:0, iva:0, envio:0, total:0 };

  // Loyalty points redemption (stored in localStorage under 'checkoutLoyalty')
  // checkoutLoyalty is JSON: { pointsRedeemed: number, discountApplied: number }
  const loyaltyRaw = localStorage.getItem('checkoutLoyalty') || '';
  let discountAmount = 0;
  let discountLabel = '';
  // Determine shipping cost based on selected shipping option saved from cart or chosen here
  let envioFinal = totals.envio;
  try{
    const selectedRaw = localStorage.getItem('selectedShipping');
    if(selectedRaw){
      // normalize tokens like 'ship-standard', 'ci_ship_standard' or plain 'standard'
      let token = String(selectedRaw || '').toLowerCase();
      token = token.replace(/^ship[-_]?/, '');
      token = token.replace(/^ci_ship[-_]?/, '');
      // Map tokens to the same prices used on cart page: standard $1, express $2, pickup $0
      if(token === 'express') envioFinal = 2.00;
      else if(token === 'standard') envioFinal = 1.00;
      else if(token === 'pickup') envioFinal = 0.00;
    }
  }catch(e){ /* ignore */ }

  if (loyaltyRaw) {
    try {
      const loyaltyObj = JSON.parse(loyaltyRaw);
      if (loyaltyObj && Number(loyaltyObj.discountApplied)) {
        discountAmount = parseFloat(Number(loyaltyObj.discountApplied).toFixed(2));
        discountLabel = 'Descuento (Puntos)';
      }
    } catch (e) { /* ignore parse errors */ }
  }

  const totalAntes = parseFloat((totals.subtotal + totals.iva + envioFinal - discountAmount).toFixed(2));

  let pointsInfo = '';
  if (discountAmount) {
    try {
      const o = JSON.parse(localStorage.getItem('checkoutLoyalty')||'{}');
      pointsInfo = `<div class="text-muted small mt-2">Puntos canjeados: <strong>${(o.pointsRedeemed||0)}</strong></div>`;
    } catch(e){ pointsInfo = ''; }
  }

  const content = `
    <div class="mb-2"><strong>Artículos:</strong> ${totals.itemCount||carrito.length}</div>
    <div class="row"><div class="col-8">Subtotal</div><div class="col-4 text-end">${formatMoney(totals.subtotal)}</div></div>
    <div class="row"><div class="col-8">Envío y Manejo</div><div class="col-4 text-end">${formatMoney(envioFinal)}</div></div>
    <div class="row"><div class="col-8">Impuesto estimado</div><div class="col-4 text-end">${formatMoney(totals.iva)}</div></div>
  ${ discountAmount ? `<div class="row"><div class="col-8 discount-line">${discountLabel}</div><div class="col-4 text-end discount-line">-${formatMoney(discountAmount)}</div></div>` : '' }
    <hr class="summary-hr">
    <div class="row"><div class="col-8"><strong>Total</strong></div><div class="col-4 text-end"><strong>${formatMoney(totalAntes)}</strong></div></div>
  ${ pointsInfo }
  `;

  document.getElementById('inline-summary-content').innerHTML = content;
}

// Apply coupon helper
function applyCouponCode(code){
  if(!code) { localStorage.removeItem('checkoutCoupon'); return { ok:true, message: 'Cupón eliminado' }; }
  const c = (code||'').trim().toUpperCase();
  if(c === 'DESC10' || c === 'ENVIOGRATIS'){
    localStorage.setItem('checkoutCoupon', c);
    return { ok:true, message: `Cupón ${c} aplicado` };
  }
  return { ok:false, message: 'Cupón inválido' };
}

// province/state field removed from inline checkout per UX decision

function prefillShipping(){
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const email = document.getElementById('ci_email');
  const street = document.getElementById('ci_street');
  const telefonoEl = document.getElementById('telefono');
  if(email) email.value = currentUser.email || localStorage.getItem('userEmail') || '';
  // Prefill telefono from current user if available (from localStorage or currentUser object)
  try {
    const phoneFromUser = currentUser.phone || currentUser.telefono || localStorage.getItem('userPhone') || localStorage.getItem('userTelefono');
    if (telefonoEl && phoneFromUser) telefonoEl.value = phoneFromUser;
    // If there is an authenticated API available, prefer fetching the authoritative user record from the server (MongoDB)
    try {
      if (window.api && typeof window.api.getUser === 'function') {
        // getUser('me') maps to GET /api/users/me which is protected and returns the user from MongoDB
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
          window.api.getUser('me').then(serverUser => {
            if (serverUser && (serverUser.telefono || serverUser.phone)) {
              telefonoEl.value = serverUser.telefono || serverUser.phone;
            }
            // also override email if server has more up-to-date one
            if (email && serverUser && serverUser.email) email.value = serverUser.email;
          }).catch(err => {
            // ignore failures (keep local values)
            console.warn('Could not fetch user from API for phone prefill:', err);
          });
        }
      }
    } catch (e) { /* ignore */ }
  } catch(e){}

  // 1) Try fast path: if we have a saved location in localStorage, use it immediately
  try {
    const savedRaw = localStorage.getItem('userLocation');
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      const addr = saved.address && (saved.address.full || saved.address) ? (saved.address.full || saved.address) : (saved.address || '');
      if (street && addr) street.value = addr;
      // render inline map if possible
      ensureLeafletAndInit('checkout-map', saved).catch(()=>{});
      try { const addrPreview = document.getElementById('payment-delivery-address'); if (addrPreview) addrPreview.innerText = addr; } catch(e){}
      return; // saved location is authoritative for initial fill
    }
  } catch(e){ /* ignore parse errors */ }

  // 2) Fallback: if checkoutManager already has a detected location, populate fields and map
  try {
    if (window.checkoutManager && checkoutManager.currentLocation) {
      const loc = checkoutManager.currentLocation;
      const addr = loc.address && (loc.address.full || loc.address) ? (loc.address.full || loc.address) : '';
      if (street && addr) street.value = addr;
      // render inline map if possible
      ensureLeafletAndInit('checkout-map', loc).catch(()=>{});
      try { const addrPreview = document.getElementById('payment-delivery-address'); if (addrPreview) addrPreview.innerText = addr; } catch(e){}
    }
  } catch(e){ /* ignore */ }
}

// Restore shipping selection saved from cart page (localStorage.selectedShipping)
function restoreSelectedShipping(){
  try{
    const raw = localStorage.getItem('selectedShipping');
    if(!raw) return;
    // normalize possible stored values: could be 'standard' or 'ship-standard' or 'ci_ship_standard'
    let token = String(raw || '').toLowerCase();
    token = token.replace(/^ship[-_]?/, '');
    token = token.replace(/^ci_ship[-_]?/, '');
    const id = 'ci_ship_' + token;
    const el = document.getElementById(id);
    if(el){
      el.checked = true;
      // dispatch change so any listeners react
      el.dispatchEvent(new Event('change', { bubbles: true }));
      // also update final button state if needed
      try{ updateFinalButtonState(); }catch(e){}
    }
  }catch(e){ console.warn('restoreSelectedShipping failed', e); }
}

// Ensure Leaflet is loaded then initialize map with provided locationData
async function ensureLeafletAndInit(mapId, locationData){
  return new Promise((resolve, reject) => {
    try {
      if (typeof L === 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          setTimeout(() => { try { initCheckoutLocationMap(mapId, locationData); resolve(); } catch(err){ reject(err); } }, 120);
        };
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      } else {
        setTimeout(() => { try { initCheckoutLocationMap(mapId, locationData); resolve(); } catch(err){ reject(err); } }, 50);
      }
    } catch(err){ reject(err); }
  });
}

// Attempt to auto-detect location on page load (non-blocking)
async function attemptAutoLocation(){
  try {
    if (typeof getLocationForCheckout !== 'function') {
      console.warn('getLocationForCheckout not available, skipping auto location');
      return;
    }
    const loc = await getLocationForCheckout();
    if (!loc) return;
    const addrFull = loc.address && (loc.address.full || loc.address) ? (loc.address.full || loc.address) : '';
    const streetEl = document.getElementById('ci_street');
    const manualBlock = document.getElementById('manual-location-block');
    const changeBtn = document.getElementById('ci_change_location');
    if (streetEl) streetEl.value = addrFull;
    // render map
    await ensureLeafletAndInit('checkout-map', loc);

    // Update payment preview and UI: hide manual block and set change button label
    try {
      const addrPreview = document.getElementById('payment-delivery-address');
      if (addrPreview) addrPreview.innerText = addrFull;
      if (manualBlock) manualBlock.style.display = 'none';
      const mapEl = document.getElementById('checkout-map'); if (mapEl) mapEl.style.display = 'flex';
      if (changeBtn) changeBtn.innerText = 'Cambiar ubicación';
    } catch (e) { /* ignore */ }

    try { checkoutManager.currentLocation = loc; checkoutManager.updateLocationStatusFromStorage(); } catch(e){}
  } catch(err){ console.warn('Auto location failed:', err); }
}

function wirePageEvents(){
  document.getElementById('checkoutAccordion').innerHTML = buildAccordion();
  prefillShipping();
  // restore shipping selection from cart (if user picked one there)
  restoreSelectedShipping();
  renderSummary();

  // Try to auto-detect location and render the inline GPS map when possible
  try { attemptAutoLocation().catch(err => console.warn('attemptAutoLocation error:', err)); } catch(e) { console.warn('attemptAutoLocation scheduling failed', e); }

  // Prevent navigation to Payment/Shipping until address is complete
  const collapseTwo = document.getElementById('collapseTwo');
  const collapseThree = document.getElementById('collapseThree');
  const collapseOne = document.getElementById('collapseOne');
  // disable header buttons initially if address incomplete
  const btnPayment = document.querySelector('[data-bs-target="#collapseTwo"]');
  const btnShipping = document.querySelector('[data-bs-target="#collapseThree"]');
  if(btnPayment) btnPayment.disabled = !isAddressComplete();
  if(btnShipping) btnShipping.disabled = !isAddressComplete();

  if (collapseTwo) collapseTwo.addEventListener('show.bs.collapse', function(e){ if(!isAddressComplete()){ e.preventDefault(); showValidationErrors(); } });
  if (collapseThree) collapseThree.addEventListener('show.bs.collapse', function(e){ if(!isAddressComplete()){ e.preventDefault(); showValidationErrors(); } });
  // Prevent closing the delivery panel until completed
  if (collapseOne) collapseOne.addEventListener('hide.bs.collapse', function(e){ if(!isAddressComplete()){ e.preventDefault(); showValidationErrors(); } });

  // Clear validation while user types and enable sections when complete
  ['ci_street','ci_main_street','ci_secondary_street','ci_house_number'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', ()=>{
      clearInvalid(el);
      const btnPayment2 = document.querySelector('[data-bs-target="#collapseTwo"]');
      const btnShipping2 = document.querySelector('[data-bs-target="#collapseThree"]');
      if(btnPayment2) btnPayment2.disabled = !isAddressComplete();
      if(btnShipping2) btnShipping2.disabled = !isAddressComplete();
      // update final button enablement
      updateFinalButtonState();
    });
  });

  // Persist shipping selection on checkout page as well so it's kept in sync with cart
  try{
    const ciShips = document.querySelectorAll('input[name="ci_shipping"]');
    ciShips.forEach(s => s.addEventListener('change', ()=>{
      try{
        const id = s.id || '';
        const token = id.replace(/^ci_ship[-_]?/,'');
        if(token) localStorage.setItem('selectedShipping', token);
        // visually mark the selected form-check
        try {
          document.querySelectorAll('#collapseThree .form-check').forEach(function(fc){ fc.classList.remove('selected'); });
          const parent = s.closest('.form-check'); if(parent) parent.classList.add('selected');
        } catch(_){}
        // re-render summary in case shipping affects totals/UI
        try{ renderSummary(); } catch(e){}
      }catch(e){ console.warn('failed to persist ci shipping', e); }
    }));
  }catch(e){ /* ignore */ }

  document.getElementById('shipping-continue').addEventListener('click', ()=>{
  // Prefer manual inputs if manual block is visible
  const manualBlock = document.getElementById('manual-location-block');
  let street = '';
  if (manualBlock && manualBlock.style.display === 'block') {
    const main = (document.getElementById('ci_main_street') && document.getElementById('ci_main_street').value.trim()) || '';
    const sec = (document.getElementById('ci_secondary_street') && document.getElementById('ci_secondary_street').value.trim()) || '';
    street = main ? (sec ? `${main}, ${sec}` : main) : '';
  } else {
    street = (document.getElementById('ci_street') || {}).value?.trim() || '';
  }
    const email = (document.getElementById('ci_email') || {}).value?.trim() || '';
  if(!street){
    // Show inline validation same as when trying to open another accordion tab
    showValidationErrors();
    return;
  }
    if(email && !validateEmail(email)){
      const emailEl = document.getElementById('ci_email');
      if(emailEl) markInvalid(emailEl, 'Ingresa un email válido');
      return;
    }
  // update payment preview
  const addrPreview = document.getElementById('payment-delivery-address');
  if(addrPreview) addrPreview.innerText = `${street}`;
    document.getElementById('collapseOne').classList.remove('show');
    document.getElementById('collapseTwo').classList.add('show');
  });

  document.getElementById('payment-back').addEventListener('click', ()=>{
    document.getElementById('collapseTwo').classList.remove('show');
    document.getElementById('collapseOne').classList.add('show');
  });

  // Ensure the modal-style payment fields that we injected are usable by existing helpers
  if (typeof window.setupPaymentFieldListeners === 'function') {
    try { window.setupPaymentFieldListeners(); } catch (e) { console.warn('setupPaymentFieldListeners failed', e); }
  }

  // Wire the modal-style payment select (metodoPago) to the global toggle function
  const metodoEl = document.getElementById('metodoPago');
  if (metodoEl) {
    metodoEl.addEventListener('change', (e) => { try { clearInvalid(metodoEl); window.togglePaymentFields(); } catch (err) { console.warn(err); } });
    // ensure correct initial visibility
    try { window.togglePaymentFields(); } catch (e) { }
  }
  // update final button when payment method changes
  if (metodoEl) metodoEl.addEventListener('change', updateFinalButtonState);

  // Payment field listeners to update final button state live
  ['numeroTarjeta','fechaVencimiento','cvv','emailPaypal','banco','numeroCuenta','titularCuenta'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', (e)=>{ clearInvalid(e.target); updateFinalButtonState(); });
    el.addEventListener('change', (e)=>{ clearInvalid(e.target); updateFinalButtonState(); });
  });

  // Apply points handler (replaces coupon UI). Also keep backward-compatible coupon button if present.
  const applyPointsBtn = document.getElementById('apply-points');
  if (applyPointsBtn) {
    applyPointsBtn.addEventListener('click', async () => {
      const inputEl = document.getElementById('summary-points');
      const raw = inputEl ? (inputEl.value||'').trim() : '';
      const pts = raw === '' ? 0 : parseInt(raw, 10);

      // If input empty or zero -> remove any applied redemption
      if (!pts) {
        localStorage.removeItem('checkoutLoyalty');
        renderSummary();
        Swal.fire({ toast:true, position:'top-end', icon:'info', title: 'Canje eliminado', showConfirmButton:false, timer:1200 });
        return;
      }

      // Validate order total minimum ($10)
      const carrito = JSON.parse(localStorage.getItem('carrito')||'[]');
      const totals = typeof calculateTotalsWithTax === 'function' ? calculateTotalsWithTax(carrito) : { subtotal:0, iva:0, envio:0, total:0 };
      // determine envio as in renderSummary
      let envioFinal = totals.envio;
      try{
        const selectedRaw = localStorage.getItem('selectedShipping');
        if(selectedRaw){
          let token = String(selectedRaw || '').toLowerCase();
          token = token.replace(/^ship[-_]?/, '');
          token = token.replace(/^ci_ship[-_]?/, '');
          if(token === 'express') envioFinal = 2.00;
          else if(token === 'standard') envioFinal = 1.00;
          else if(token === 'pickup') envioFinal = 0.00;
        }
      }catch(e){ }

      const grand = parseFloat((totals.subtotal + totals.iva + envioFinal).toFixed(2));
      if (grand < 10.00) {
        Swal.fire({ icon:'error', title:'No elegible', text:'Los puntos solo se pueden aplicar en compras de $10.00 o más' });
        return;
      }

      // Require authenticated user (loyalty stored per email)
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userEmail = currentUser.email || localStorage.getItem('userEmail') || '';
      if (!userEmail) {
        Swal.fire({ icon:'warning', title:'Inicia sesión', text:'Debes iniciar sesión para canjear puntos' });
        return;
      }

      if (!window.loyaltyManager || typeof window.loyaltyManager.redeemPoints !== 'function') {
        Swal.fire({ icon:'error', title:'Función no disponible', text:'El sistema de puntos no está disponible actualmente' });
        return;
      }

      // Basic client-side checks against available points
      try {
        const summary = window.loyaltyManager.getLoyaltySummary(userEmail);
        if (!summary || typeof summary.points !== 'number' || pts > summary.points) {
          Swal.fire({ icon:'error', title:'Puntos insuficientes', text:'No tienes suficientes puntos para ese canje' });
          return;
        }
        const minBlock = window.loyaltyManager.config.pointsToDiscount || 100;
        if (pts < minBlock) {
          Swal.fire({ icon:'error', title:'Cantidad mínima', text:`Mínimo ${minBlock} puntos para canjear` });
          return;
        }
        if (pts % minBlock !== 0) {
          Swal.fire({ icon:'error', title:'Múltiplos requeridos', text:`Ingresa un múltiplo de ${minBlock} puntos` });
          return;
        }
      } catch (e) {
        console.warn('Loyalty summary check failed', e);
      }

      // Attempt redemption
      try {
        const res = window.loyaltyManager.redeemPoints(userEmail, pts);
        if (res && res.success) {
          const payload = { pointsRedeemed: res.pointsRedeemed || pts, discountApplied: res.discount || 0 };
          localStorage.setItem('checkoutLoyalty', JSON.stringify(payload));
          renderSummary();
          Swal.fire({ toast:true, position:'top-end', icon:'success', title:`${formatMoney(res.discount)} aplicados usando ${res.pointsRedeemed} puntos`, showConfirmButton:false, timer:1600 });
        } else {
          Swal.fire({ icon:'error', title:'Canje fallido', text: (res && res.message) ? res.message : 'No se pudo canjear puntos' });
        }
      } catch (err) {
        console.error('redeemPoints error', err);
        Swal.fire({ icon:'error', title:'Error', text:'Ocurrió un error al canjear puntos' });
      }
    });
  }

  // Backwards-compatible coupon button (if still present)
  const legacyApplyBtn = document.getElementById('apply-coupon');
  if (legacyApplyBtn) {
    legacyApplyBtn.addEventListener('click', () => {
      const codeEl = document.getElementById('summary-coupon');
      const code = codeEl ? (codeEl.value||'').trim() : '';
      const result = applyCouponCode(code);
      if (result.ok) {
        try { if(codeEl) codeEl.classList.remove('is-invalid'); } catch(e){}
        renderSummary();
        Swal.fire({ toast:true, position:'top-end', icon:'success', title: result.message, showConfirmButton:false, timer:1400 });
      } else {
        if (codeEl) markInvalid(codeEl, result.message);
        Swal.fire({ toast:true, position:'top-end', icon:'error', title: result.message, showConfirmButton:false, timer:1400 });
      }
    });
  }

  // Clear email validation on input
  const emailInput = document.getElementById('ci_email');
  if (emailInput) emailInput.addEventListener('input', () => clearInvalid(emailInput));
  const telefonoInputNow = document.getElementById('telefono');
  if (telefonoInputNow) {
    // ensure only digits and max 10
    telefonoInputNow.setAttribute('inputmode','numeric');
    telefonoInputNow.setAttribute('maxlength','10');
    telefonoInputNow.addEventListener('input', (e)=>{
      const v = e.target.value.replace(/\D/g,'').substring(0,10);
      if (e.target.value !== v) e.target.value = v;
      clearInvalid(e.target);
      const btnPayment2 = document.querySelector('[data-bs-target="#collapseTwo"]');
      const btnShipping2 = document.querySelector('[data-bs-target="#collapseThree"]');
      if(btnPayment2) btnPayment2.disabled = !isAddressComplete();
      if(btnShipping2) btnShipping2.disabled = !isAddressComplete();
      updateFinalButtonState();
    });
  }

  // Detect button removed — location is auto-detected and map appears inline. Manual change is available via "Cambiar ubicación".

  // Change location button toggles manual fields and hides/shows the map
  const changeBtn = document.getElementById('ci_change_location');
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      const manual = document.getElementById('manual-location-block');
      const map = document.getElementById('checkout-map');
      if (!manual || !map) return;
      if (manual.style.display === 'none' || manual.style.display === '') {
        // show manual, hide map
  // Do NOT prefill 'Calle principal' when switching to manual per user request.
  const mainEl = document.getElementById('ci_main_street');
  const secondaryEl = document.getElementById('ci_secondary_street');
  const houseEl = document.getElementById('ci_house_number');
  const addRefEl = document.getElementById('ci_additional_reference');
  // Clear manual inputs so user must type them manually
  if (mainEl) mainEl.value = '';
  if (secondaryEl) secondaryEl.value = '';
  if (houseEl) houseEl.value = '';
  if (addRefEl) addRefEl.value = '';
        manual.style.display = 'block';
        map.style.display = 'none';
        // hide the combined 'Dirección' field when manual editing
        const streetBlock = document.getElementById('ci_street_block'); if (streetBlock) streetBlock.style.display = 'none';
        changeBtn.innerText = 'Usar ubicación GPS';
      } else {
        // hide manual, show map
        manual.style.display = 'none';
        map.style.display = 'flex';
        // show the combined 'Dirección' field again
        const streetBlock2 = document.getElementById('ci_street_block'); if (streetBlock2) streetBlock2.style.display = 'block';
        changeBtn.innerText = 'Cambiar ubicación';
      }
    });
  }
  // Ensure final button initial state is correct
  updateFinalButtonState();

  document.getElementById('payment-continue').addEventListener('click', ()=>{
    // Clear previous inline payment validation
    ['telefono','metodoPago','numeroTarjeta','fechaVencimiento','cvv','emailPaypal','banco','numeroCuenta','titularCuenta'].forEach(id=>{ const el = document.getElementById(id); if(el) clearInvalid(el); });

    const methodEl = document.getElementById('metodoPago') || document.getElementById('ci_paymentMethod');
    const method = methodEl ? methodEl.value : '';
    const telEl = document.getElementById('telefono');
    const telRaw = telEl ? (telEl.value||'').trim() : '';
    const telVal = (telRaw || '').replace(/\D/g, ''); // digits-only

    const errors = [];

    if(!method){
      if(methodEl) markInvalid(methodEl, 'Por favor selecciona un método de pago');
      errors.push('metodoPago');
    }

    // Basic phone validation: required and exactly 10 digits
    if(!telVal || telVal.length !== 10){
      if(telEl) markInvalid(telEl, 'Por favor ingresa teléfono válido (10 dígitos)');
      errors.push('telefono');
    }

    // Validate method-specific fields before allowing to continue
    if(method === 'tarjeta'){
      const numEl = document.getElementById('numeroTarjeta');
      const dateEl = document.getElementById('fechaVencimiento');
      const cvvEl = document.getElementById('cvv');
      const num = numEl ? (numEl.value||'').replace(/\s/g,'') : '';
      const date = dateEl ? (dateEl.value||'').trim() : '';
      const cvv = cvvEl ? (cvvEl.value||'').trim() : '';

      if(!num){ if(numEl) markInvalid(numEl, 'Por favor ingresa número de tarjeta'); errors.push('numeroTarjeta'); }
      else if(typeof validateCreditCard === 'function' && !validateCreditCard(num)){ if(numEl) markInvalid(numEl, 'Número de tarjeta inválido'); errors.push('numeroTarjeta'); }

      if(!date){ if(dateEl) markInvalid(dateEl, 'Por favor ingresa fecha MM/AA'); errors.push('fechaVencimiento'); }
      else if(!/^\d{2}\/\d{2}$/.test(date)){ if(dateEl) markInvalid(dateEl, 'Formato MM/AA requerido'); errors.push('fechaVencimiento'); }

      if(!cvv){ if(cvvEl) markInvalid(cvvEl, 'Por favor ingresa CVV'); errors.push('cvv'); }
      else if(!/^\d{3,4}$/.test(cvv)){ if(cvvEl) markInvalid(cvvEl, 'CVV inválido'); errors.push('cvv'); }
    }

    if(method === 'paypal'){
      const emailEl = document.getElementById('emailPaypal');
      const email = emailEl ? (emailEl.value||'').trim() : '';
      if(!email){ if(emailEl) markInvalid(emailEl, 'Por favor ingresa email de PayPal'); errors.push('emailPaypal'); }
      else if(!validateEmail(email)){ if(emailEl) markInvalid(emailEl, 'Email inválido'); errors.push('emailPaypal'); }
    }

    if(method === 'transferencia'){
      const bancoEl = document.getElementById('banco');
      const numCuentaEl = document.getElementById('numeroCuenta');
      const titularEl = document.getElementById('titularCuenta');
      if(!bancoEl || !(bancoEl.value||'').trim()){ if(bancoEl) markInvalid(bancoEl, 'Selecciona banco'); errors.push('banco'); }
      if(!numCuentaEl || !(numCuentaEl.value||'').trim()){ if(numCuentaEl) markInvalid(numCuentaEl, 'Ingresa número de cuenta'); errors.push('numeroCuenta'); }
      if(!titularEl || !(titularEl.value||'').trim()){ if(titularEl) markInvalid(titularEl, 'Ingresa titular de la cuenta'); errors.push('titularCuenta'); }
    }

    if(errors.length>0){
      // focus first invalid
      const first = document.querySelector('.is-invalid'); if(first) first.focus();
      return;
    }

    // copy telefono into shipping phone field if needed (use normalized digits)
    const shipPhoneEl = document.getElementById('ci_phone');
    if(telEl && shipPhoneEl && !shipPhoneEl.value) shipPhoneEl.value = telVal;
    document.getElementById('collapseTwo').classList.remove('show');
    document.getElementById('collapseThree').classList.add('show');
  });

  document.getElementById('shipping-back').addEventListener('click', ()=>{
    // Instead of going back to payment, scroll/focus to the final Confirm button area
    const placeBtn = document.getElementById('place-order');
    const placeWrap = document.getElementById('place-order-wrap');
    const target = placeBtn || placeWrap;
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(e){}
      // If the real button is disabled it cannot receive focus in many browsers,
      // so focus the wrapper (make it focusable) as fallback and give the button a clear outline.
      setTimeout(()=>{
        try {
          if (placeBtn && !placeBtn.disabled) {
            placeBtn.focus();
          } else if (placeWrap) {
            if (!placeWrap.hasAttribute('tabindex')) placeWrap.setAttribute('tabindex','-1');
            placeWrap.focus();
          }
        } catch(e){}
      }, 180);
    }
  });

  // Extract the place-order logic into a callable function so wrapper clicks can invoke it
  async function handlePlaceOrder(e){
    // If invoked from an event, prevent default
    if(e && e.preventDefault) try{ e.preventDefault(); }catch(_){}

    // If manual block is visible, prefer manual street fields
    const manualBlockEl = document.getElementById('manual-location-block');
    let composedStreet = (document.getElementById('ci_street') && document.getElementById('ci_street').value.trim()) || '';
    if (manualBlockEl && manualBlockEl.style.display === 'block') {
      const main = (document.getElementById('ci_main_street') && document.getElementById('ci_main_street').value.trim()) || '';
      const sec = (document.getElementById('ci_secondary_street') && document.getElementById('ci_secondary_street').value.trim()) || '';
      if (main) composedStreet = sec ? `${main}, ${sec}` : main;
    }

    // If manual mode, gather house number and additional reference
    const manualBlockNow = document.getElementById('manual-location-block');
    let houseNumber = '';
    let additionalRef = '';
    if (manualBlockNow && manualBlockNow.style.display === 'block') {
      houseNumber = (document.getElementById('ci_house_number') && document.getElementById('ci_house_number').value.trim()) || '';
      additionalRef = (document.getElementById('ci_additional_reference') && document.getElementById('ci_additional_reference').value.trim()) || '';
      // if house number present, append to composedStreet
      if (houseNumber) composedStreet = `${composedStreet} #${houseNumber}`;
      if (additionalRef) composedStreet = `${composedStreet} (${additionalRef})`;
    }

    const shipping = {
      street: composedStreet,
      email: (document.getElementById('ci_email') && document.getElementById('ci_email').value.trim()) || '',
      phone: (document.getElementById('ci_phone') && document.getElementById('ci_phone').value.trim()) || ''
    };

    const paymentMethod = (document.getElementById('metodoPago') || document.getElementById('ci_paymentMethod')).value;

    // Basic validation: require street
    if(!shipping.street){
      // behave like trying to open the next accordion tab
      showValidationErrors();
      return;
    }
    if(shipping.email && !validateEmail(shipping.email)){
      const emailEl = document.getElementById('ci_email');
      if(emailEl) markInvalid(emailEl, 'Ingresa un email válido');
      return;
    }

  // PAYMENT validation before placing order (same rules as payment-continue)
  ['telefono','metodoPago','numeroTarjeta','fechaVencimiento','cvv','emailPaypal','banco','numeroCuenta','titularCuenta'].forEach(id=>{ const el = document.getElementById(id); if(el) clearInvalid(el); });
  const telEl2 = document.getElementById('telefono'); const telVal2 = telEl2 ? (telEl2.value||'').replace(/\D/g,'') : '';
    const errors2 = [];
  if(!telVal2 || telVal2.length !== 10){ if(telEl2) markInvalid(telEl2, 'Por favor ingresa teléfono válido (10 dígitos)'); errors2.push('telefono'); }

    if(paymentMethod === 'tarjeta'){
      const numEl2 = document.getElementById('numeroTarjeta'); const dateEl2 = document.getElementById('fechaVencimiento'); const cvvEl2 = document.getElementById('cvv');
      const num2 = numEl2 ? (numEl2.value||'').replace(/\s/g,'') : '';
      const date2 = dateEl2 ? (dateEl2.value||'').trim() : '';
      const cvv2 = cvvEl2 ? (cvvEl2.value||'').trim() : '';
      if(!num2){ if(numEl2) markInvalid(numEl2,'Por favor ingresa número de tarjeta'); errors2.push('numeroTarjeta'); }
      else if(typeof validateCreditCard === 'function' && !validateCreditCard(num2)){ if(numEl2) markInvalid(numEl2,'Número de tarjeta inválido'); errors2.push('numeroTarjeta'); }
      if(!date2){ if(dateEl2) markInvalid(dateEl2,'Por favor ingresa fecha MM/AA'); errors2.push('fechaVencimiento'); }
      else if(!/^\d{2}\/\d{2}$/.test(date2)){ if(dateEl2) markInvalid(dateEl2,'Formato MM/AA requerido'); errors2.push('fechaVencimiento'); }
      if(!cvv2){ if(cvvEl2) markInvalid(cvvEl2,'Por favor ingresa CVV'); errors2.push('cvv'); }
      else if(!/^\d{3,4}$/.test(cvv2)){ if(cvvEl2) markInvalid(cvvEl2,'CVV inválido'); errors2.push('cvv'); }
    }
    if(paymentMethod === 'paypal'){
      const emailEl2 = document.getElementById('emailPaypal'); const email2 = emailEl2 ? (emailEl2.value||'').trim() : '';
      if(!email2){ if(emailEl2) markInvalid(emailEl2,'Por favor ingresa email de PayPal'); errors2.push('emailPaypal'); }
      else if(!validateEmail(email2)){ if(emailEl2) markInvalid(emailEl2,'Email inválido'); errors2.push('emailPaypal'); }
    }
    if(paymentMethod === 'transferencia'){
      const bancoEl2 = document.getElementById('banco'); const numCuentaEl2 = document.getElementById('numeroCuenta'); const titularEl2 = document.getElementById('titularCuenta');
  if(!bancoEl2 || !((bancoEl2.value||'').trim())){ if(bancoEl2) markInvalid(bancoEl2,'Selecciona banco'); errors2.push('banco'); }
  if(!numCuentaEl2 || !((numCuentaEl2.value||'').trim())){ if(numCuentaEl2) markInvalid(numCuentaEl2,'Ingresa número de cuenta'); errors2.push('numeroCuenta'); }
  if(!titularEl2 || !((titularEl2.value||'').trim())){ if(titularEl2) markInvalid(titularEl2,'Ingresa titular de la cuenta'); errors2.push('titularCuenta'); }
    }
    if(errors2.length>0){ const first2 = document.querySelector('.is-invalid'); if(first2) first2.focus(); return; }

    const carrito = JSON.parse(localStorage.getItem('carrito')||'[]');
    const totals = typeof calculateTotalsWithTax === 'function' ? calculateTotalsWithTax(carrito) : { subtotal:0, iva:0, envio:0, total:0 };
    // Apply coupon to order totals if present
    const couponCode = localStorage.getItem('checkoutCoupon') || '';
    let adjustedTotals = Object.assign({}, totals);
    if (couponCode === 'DESC10') {
      const discount = parseFloat((totals.subtotal * 0.10).toFixed(2));
      adjustedTotals.subtotal = parseFloat((totals.subtotal - discount).toFixed(2));
      adjustedTotals.iva = parseFloat((adjustedTotals.subtotal * 0.15).toFixed(2));
      adjustedTotals.envio = totals.envio;
      adjustedTotals.total = parseFloat((adjustedTotals.subtotal + adjustedTotals.iva + adjustedTotals.envio).toFixed(2));
    } else if (couponCode === 'ENVIOGRATIS') {
      adjustedTotals = Object.assign({}, totals);
      adjustedTotals.envio = 0.00;
      adjustedTotals.total = parseFloat((adjustedTotals.subtotal + adjustedTotals.iva + adjustedTotals.envio).toFixed(2));
    }

    // Apply loyalty redemption if present (checkoutLoyalty stored by apply-points)
    try {
      const loyaltyRaw = localStorage.getItem('checkoutLoyalty');
      if (loyaltyRaw) {
        const loyaltyObj = JSON.parse(loyaltyRaw);
        const discount = Number(loyaltyObj.discountApplied || 0);
        if (discount > 0) {
          adjustedTotals.discount = parseFloat(discount.toFixed(2));
          adjustedTotals.total = parseFloat((adjustedTotals.subtotal + adjustedTotals.iva + (adjustedTotals.envio||0) - adjustedTotals.discount).toFixed(2));
        }
      }
    } catch (e) { /* ignore */ }

    // Ensure the shipping cost is set based on selectedShipping token (so order totals include it)
    try{
      const raw = localStorage.getItem('selectedShipping');
      if(raw){
        let token = String(raw||'').toLowerCase();
        token = token.replace(/^ship[-_]?/,'');
        token = token.replace(/^ci_ship[-_]?/,'');
        if(token === 'express') adjustedTotals.envio = 2.00;
        else if(token === 'standard') adjustedTotals.envio = 1.00;
        else if(token === 'pickup') adjustedTotals.envio = 0.00;
        adjustedTotals.total = parseFloat((adjustedTotals.subtotal + adjustedTotals.iva + adjustedTotals.envio).toFixed(2));
      }
    }catch(e){ }

    // Build user data from available persistent info (prefer stored user values).
    const userData = {
      email: shipping.email || localStorage.getItem('userEmail') || '',
      nombre: localStorage.getItem('userNombre') || '',
      apellido: localStorage.getItem('userApellido') || '',
      cedula: localStorage.getItem('userCedula') || ''
    };

    const invoiceData = {
      telefono: (document.getElementById('telefono') && document.getElementById('telefono').value.trim()) || shipping.phone,
      metodoPago: paymentMethod,
      comentarios: ''
    };

    // Attach loyalty metadata into invoiceData so generateOrder/save includes it
    try {
      const loyaltyRaw2 = localStorage.getItem('checkoutLoyalty');
      if (loyaltyRaw2) {
        invoiceData.loyaltyRedemption = JSON.parse(loyaltyRaw2);
      }
    } catch(e) { /* ignore */ }

    // If user provided additional reference in manual mode, include it in comments
    if (additionalRef) {
      invoiceData.comentarios = `Ref: ${additionalRef}`;
    }

  const order = generateOrder(carrito, userData, { address: { full: `${shipping.street}` } }, adjustedTotals, invoiceData);

  // Prevent concurrent checkout flows (double-clicks or duplicate handlers)
  if (window.__checkoutInProgress) {
    console.warn('handlePlaceOrder: checkout already in progress, skipping');
    return;
  }
  window.__checkoutInProgress = true;

    // Try to persist the order on the server so stock is decremented in MongoDB.
    let serverOrderId = null;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token && window.api && typeof window.api.checkout === 'function') {
        // Resolve canonical product IDs where possible
        const resolvedItems = (carrito || []).map(item => {
          let resolvedId = item.id;
          try {
            const pm = window.productManager;
            if (pm && typeof pm.getProductById === 'function') {
              const pmProduct = pm.getProductById(item.id);
              if (pmProduct && pmProduct.id) resolvedId = pmProduct.id;
            }
          } catch(e) { /* ignore */ }
          return { id: resolvedId, cantidad: Number(item.cantidad || item.qty || 0) };
        });

        const payload = {
          items: resolvedItems,
          resumen: adjustedTotals,
          shipping: {
            direccion: shipping.street,
            ciudad: '',
            provincia: '',
            ubicacionCompleta: {}
          }
        };

        // Call server checkout endpoint (requires auth)
        const res = await window.api.checkout(payload);
        if (res && res.orderId) {
          serverOrderId = res.orderId;
          order.id = serverOrderId;
          order.syncedWithServer = true;
          console.log('✅ Order persisted on server with id', serverOrderId);
        } else {
          console.warn('⚠️ Server checkout returned no orderId:', res);
        }
      }
    } catch (err) {
      console.warn('⚠️ Server checkout failed, falling back to local save:', err);
    }

    // If server processed the order, refresh products from server to reflect updated stock.
    if (serverOrderId) {
      try {
        if (window.productManager && typeof window.productManager.loadProducts === 'function') {
          await window.productManager.loadProducts();
          console.log('🔄 Products refreshed from server after checkout');
        }
      } catch (e) { console.warn('Could not refresh products after server checkout', e); }

      // Save and cleanup
      saveOrderToHistory(order);
      try { await window.showInvoiceSingleton(order); } catch(e){}
      localStorage.removeItem('carrito');
      if(typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
      // DO NOT redirect automatically — keep user on the checkout page so they can choose options
      window.__checkoutInProgress = false;
      return;
    }

    // If we reach here, server persistence didn't happen (guest checkout or error). Fall back to local handling
    // Reduce local stock so UI reflects the purchase
    try {
      if (window.productManager && typeof window.productManager.reduceStock === 'function') {
        // Pass order.id (if available) to ensure idempotent processing
        await window.productManager.reduceStock(carrito, order.id || serverOrderId);
      }
    } catch (e) { console.warn('Local stock reduction failed:', e); }

  // Save order locally as backup
  saveOrderToHistory(order);
  localStorage.removeItem('carrito');
  if(typeof actualizarCarritoUI === 'function') actualizarCarritoUI();

  await window.showInvoiceSingleton(order);

  // Clear in-progress guard
  window.__checkoutInProgress = false;

  // DO NOT redirect automatically — keep user on the checkout page so they can choose options
  }

  // Helper: show a SweetAlert2 modal listing missing/invalid fields in a friendly way
  function showMissingFieldsNotification(){
    // First, run the inline field-level validation so fields get red outlines and feedback
    showValidationErrors();
    // Then run payment field checks similar to the payment-continue/placeOrder handlers
    // We only mark fields inline and focus the first invalid one — do NOT show a summary box.
    // Phone
    const tel = (document.getElementById('telefono') || {}).value || '';
    const telDigits = (tel||'').replace(/\D/g,'');
    if(!telDigits || telDigits.length !== 10) {
      const el = document.getElementById('telefono'); if(el) markInvalid(el, 'Por favor ingresa teléfono válido (10 dígitos)');
    }

    // Payment
    const method = (document.getElementById('metodoPago') || {}).value || '';
    if(!method){
      const el = document.getElementById('metodoPago'); if(el) markInvalid(el, 'Por favor selecciona un método de pago');
    } else if(method === 'tarjeta'){
      const num = (document.getElementById('numeroTarjeta') || {}).value || '';
      const date = (document.getElementById('fechaVencimiento') || {}).value || '';
      const cvv = (document.getElementById('cvv') || {}).value || '';
      if(!num){ const el = document.getElementById('numeroTarjeta'); if(el) markInvalid(el,'Por favor ingresa número de tarjeta'); }
      if(!date || !/^\d{2}\/\d{2}$/.test(date)){ const el = document.getElementById('fechaVencimiento'); if(el) markInvalid(el,'Formato MM/AA requerido'); }
      if(!cvv || !/^\d{3,4}$/.test(cvv)){ const el = document.getElementById('cvv'); if(el) markInvalid(el,'CVV inválido'); }
    } else if(method === 'paypal'){
      const em = (document.getElementById('emailPaypal') || {}).value || '';
      if(!em || !validateEmail(em)){ const el = document.getElementById('emailPaypal'); if(el) markInvalid(el,'Email inválido'); }
    } else if(method === 'transferencia'){
      const banco = (document.getElementById('banco') || {}).value || '';
      const numC = (document.getElementById('numeroCuenta') || {}).value || '';
      const tit = (document.getElementById('titularCuenta') || {}).value || '';
      if(!banco){ const el = document.getElementById('banco'); if(el) markInvalid(el,'Selecciona banco'); }
      if(!numC){ const el = document.getElementById('numeroCuenta'); if(el) markInvalid(el,'Ingresa número de cuenta'); }
      if(!tit){ const el = document.getElementById('titularCuenta'); if(el) markInvalid(el,'Ingresa titular de la cuenta'); }
    }

    // Focus the first invalid field and ensure it's scrolled into view.
    const firstInvalid = document.querySelector('.is-invalid');
    if (firstInvalid) {
      try {
        // If the invalid field is inside one of the accordion collapse panels,
        // ensure that panel is opened so the field is visible before focusing.
        const collapseEl = firstInvalid.closest('#collapseOne, #collapseTwo, #collapseThree');
        if (collapseEl) {
          try {
            if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
              // Use Bootstrap Collapse API to show the target panel and hide others
              ['collapseOne','collapseTwo','collapseThree'].forEach(id=>{
                const el = document.getElementById(id);
                if(!el) return;
                const inst = bootstrap.Collapse.getOrCreateInstance(el);
                if (el === collapseEl) inst.show(); else inst.hide();
              });
            } else {
              // Fallback: toggle 'show' class directly
              ['collapseOne','collapseTwo','collapseThree'].forEach(id=>{
                const el = document.getElementById(id);
                if(!el) return;
                if (el === collapseEl) el.classList.add('show'); else el.classList.remove('show');
              });
            }
          } catch(e) { /* ignore collapse errors */ }
        }
        // Small timeout to allow expand animation to complete before scrolling/focusing
        setTimeout(()=>{ try { firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstInvalid.focus(); } catch(e){} }, 120);
      } catch(e){}
    }
  }

  // Intercept interactions on the wrapper so clicking the (disabled) button area
  // always runs the inline validation (same behavior as the "Continuar" flow)
  // We listen on pointerdown and click in the capture phase to catch events even
  // when the inner button is disabled in some browsers.
  const placeWrap = document.getElementById('place-order-wrap');
  if (placeWrap) {
    // make wrapper visibly clickable
    try { placeWrap.style.cursor = 'pointer'; } catch(e) {}

    const placeWrapHandler = (ev) => {
      // Prevent default navigation or form submissions
      try { ev.preventDefault(); } catch(e) {}
      // Ensure inline validation is shown if the final validation fails
      if (!validateAllForFinalButton()) {
        showMissingFieldsNotification();
        return;
      }
      // All good — proceed with normal place order flow
      handlePlaceOrder(ev);
    };

    // Attach for pointerdown and click to be robust across browsers and disabled-button behavior
    placeWrap.addEventListener('pointerdown', placeWrapHandler, { capture: true });
    placeWrap.addEventListener('click', placeWrapHandler, { capture: true });
  }

  // Also bind the real place-order button if present (fallback when wrapper is not used)
  const placeBtn = document.getElementById('place-order');
  if (placeBtn) {
    placeBtn.addEventListener('click', (ev) => {
      try { ev.preventDefault(); } catch(e){}
      if (!validateAllForFinalButton()) {
        showMissingFieldsNotification();
        return;
      }
      handlePlaceOrder(ev);
    });
  }

  document.getElementById('checkout-cancel').addEventListener('click', ()=>{
    window.location.href = 'cart.html';
  });
}

function validateEmail(email){ if(!email) return false; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Validate cart products against server and remove invalid ones
async function validateCartProducts() {
  try {
    console.log('🔍 Validating cart products...');
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    
    if (carrito.length === 0) {
      console.log('✅ Cart is empty, no validation needed');
      return true;
    }
    
    const validationPromises = carrito.map(async (item) => {
      try {
        const response = await fetch(`/api/products/${item.id}`);
        return {
          item,
          valid: response.ok,
          status: response.status
        };
      } catch (error) {
        console.warn(`Failed to validate product ${item.id}:`, error);
        return { item, valid: false, status: 0 };
      }
    });
    
    const results = await Promise.all(validationPromises);
    const invalidItems = results.filter(r => !r.valid);
    
    if (invalidItems.length > 0) {
      console.warn(`⚠️ Found ${invalidItems.length} invalid product(s) in cart`);
      
      // Remove invalid products
      const validItems = results.filter(r => r.valid).map(r => r.item);
      localStorage.setItem('carrito', JSON.stringify(validItems));
      
      // Notify user
      await Swal.fire({
        title: 'Productos no disponibles',
        html: `Se han eliminado ${invalidItems.length} producto(s) que ya no están disponibles.<br><small class="text-muted">${invalidItems.map(i => i.item.nombre).join(', ')}</small>`,
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      
      console.log(`✅ Cart cleaned: ${validItems.length} valid products remaining`);
      
      // Reload if no products left
      if (validItems.length === 0) {
        window.location.href = 'cart.html';
        return false;
      }
      
      return true;
    }
    
    console.log('✅ All cart products are valid');
    return true;
  } catch (error) {
    console.error('Cart validation failed:', error);
    return true; // Continue anyway
  }
}

// init
document.addEventListener('DOMContentLoaded', async ()=>{
  // Validate cart before rendering
  await validateCartProducts();
  
  document.getElementById('checkoutAccordion').innerHTML = buildAccordion();
  wirePageEvents();
  renderSummary();
});

})();
