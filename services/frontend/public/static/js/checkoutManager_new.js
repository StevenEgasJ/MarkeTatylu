// =================== SISTEMA MEJORADO DE GEOLOCALIZACIÓN ===================

// Expose stubs early to avoid ReferenceErrors when other page scripts run before this file finishes parsing
try {
    if (!window.getLocationForCheckout) window.getLocationForCheckout = async function(){ console.warn('getLocationForCheckout stub called before implementation'); return null; };
    if (!window.generateOrder) window.generateOrder = function(){ console.warn('generateOrder stub called before implementation'); return {}; };
} catch(e) { /* ignore */ }

// Función para obtener ubicación del usuario (VERSION MEJORADA)
async function getLocationForCheckout() {
    try {
        const savedLocation = localStorage.getItem('userLocation');
        if (savedLocation) {
            try { return JSON.parse(savedLocation); } catch(e) { /* ignore parse errors */ }
        }

        const choice = await Swal.fire({
            title: '¿Cómo quieres agregar tu dirección?',
            text: 'Puedes usar tu ubicación actual o ingresarla manualmente.',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Usar ubicación GPS',
            denyButtonText: 'Ingresar manual',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745',
            denyButtonColor: '#17a2b8',
            cancelButtonColor: '#6c757d'
        });

        if (choice.isConfirmed) {
            return await getCurrentLocationData();
        }

        if (choice.isDenied) {
            return await getManualLocationData();
        }

        return null;
    } catch (error) {
        console.error('Error en geolocalización, usando entrada manual', error);
        return await getManualLocationData();
    }
}

// Función para obtener ubicación GPS
async function getCurrentLocationData() {
    try {
        Swal.fire({
            title: 'Obteniendo ubicación...',
            html: '<i class="fa-solid fa-spinner fa-spin fa-3x text-primary"></i>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            });
        });

        const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'gps',
            timestamp: new Date().toISOString()
        };

        // Obtener dirección (NO BLOQUEANTE): asignar una dirección provisional y resolver la búsqueda en background
        location.address = {
            full: `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`,
            city: 'Ubicación GPS',
            province: 'Ecuador',
            country: 'Ecuador'
        };

        // Realizar reverse-geocode en background durante tiempo idle para no bloquear la experiencia del usuario
        if (window.rail && typeof window.rail.runDuringIdle === 'function') {
            window.rail.runDuringIdle(async () => {
                try {
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=es`);
                    const data = await response.json();
                    location.address = {
                        full: `${data.locality || data.city || 'Ciudad'}, ${data.principalSubdivision || 'Provincia'}, ${data.countryName || 'Ecuador'}`,
                        city: data.locality || data.city || 'Ciudad',
                        province: data.principalSubdivision || 'Provincia',
                        country: data.countryName || 'Ecuador'
                    };
                    // Actualizar UI si hay un modal visible
                    try {
                        const alertEl = document.querySelector('.swal2-html-container .alert-success');
                        if (alertEl) {
                            alertEl.innerHTML = `<i class="fa-solid fa-map-marker-alt me-2"></i><strong>Ubicación detectada:</strong><br>${location.address.full}`;
                        }
                    } catch(e){}
                } catch(e){ console.warn('reverse geocode failed (background)', e); }
            }, { timeout: 5000 });
        } else {
            // Fallback: background fetch sin bloquear
            setTimeout(async () => {
                try {
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=es`);
                    const data = await response.json();
                    location.address = {
                        full: `${data.locality || data.city || 'Ciudad'}, ${data.principalSubdivision || 'Provincia'}, ${data.countryName || 'Ecuador'}`,
                        city: data.locality || data.city || 'Ciudad',
                        province: data.principalSubdivision || 'Provincia',
                        country: data.countryName || 'Ecuador'
                    };
                } catch(e){ console.warn('reverse geocode background failed', e); }
            }, 100);
        }

        Swal.close();

        // Confirmar ubicación
        const confirmed = await Swal.fire({
            title: '¡Ubicación GPS obtenida!',
            html: `
                <div class="alert alert-success">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                    <strong>Ubicación detectada:</strong><br>
                    ${location.address.full}
                </div>
                <small class="text-muted">
                    Coordenadas: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}<br>
                    Precisión: ±${Math.round(location.accuracy)} metros
                </small>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar ubicación',
            cancelButtonText: 'Usar ubicación manual',
            confirmButtonColor: '#28a745'
        });

        return confirmed.isConfirmed ? location : await getManualLocationData();

    } catch (error) {
        await Swal.fire({
            title: 'Error de ubicación',
            text: 'No se pudo obtener tu ubicación actual. Usaremos ubicación manual.',
            icon: 'warning'
        });
        return await getManualLocationData();
    }
}

// Función para ubicación manual
async function getManualLocationData() {
    const { value: formData } = await Swal.fire({
        title: 'Datos de Entrega',
        html: `
            <div class="text-start">
                <div class="row g-3">
                    <div class="col-12">
                        <label class="form-label fw-bold">Dirección de entrega *</label>
                        <input id="direccion" class="form-control" placeholder="Calle principal, número, referencias" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Ciudad *</label>
                        <input id="ciudad" class="form-control" placeholder="Ciudad" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Provincia *</label>
                        <select id="provincia" class="form-select" required>
                            <option value="">Seleccionar provincia</option>
                            <option value="Pichincha">Pichincha</option>
                            <option value="Guayas">Guayas</option>
                            <option value="Azuay">Azuay</option>
                            <option value="Manabí">Manabí</option>
                            <option value="El Oro">El Oro</option>
                            <option value="Tungurahua">Tungurahua</option>
                            <option value="Los Ríos">Los Ríos</option>
                            <option value="Imbabura">Imbabura</option>
                            <option value="Esmeraldas">Esmeraldas</option>
                            <option value="Loja">Loja</option>
                            <option value="Otra">Otra</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        width: '600px',
        preConfirm: () => {
            const direccion = document.getElementById('direccion').value.trim();
            const ciudad = document.getElementById('ciudad').value.trim();
            const provincia = document.getElementById('provincia').value;

            if (!direccion || !ciudad || !provincia) {
                Swal.showValidationMessage('Por favor completa todos los campos obligatorios');
                return false;
            }

            return {
                method: 'manual',
                address: {
                    full: `${direccion}, ${ciudad}, ${provincia}`,
                    street: direccion,
                    city: ciudad,
                    province: provincia,
                    country: 'Ecuador'
                },
                timestamp: new Date().toISOString()
            };
        }
    });

    return formData || null;
}

// Función para obtener datos de facturación (SOLO teléfono y pago)
async function getInvoiceDataWithLocation(userData, locationData) {
    let methodSelected = false;
    let currentData = {};

    while (!methodSelected) {
        const { value: formData } = await Swal.fire({
            title: 'Datos de Entrega y Pago',
            html: `
                <div class="container-fluid">
                    <div class="row g-3">
                        <div class="col-12 mb-3">
                            <div class="alert alert-success">
                                <i class="fa-solid fa-map-marker-alt me-2"></i>
                                <strong>✅ Dirección de entrega confirmada:</strong><br>
                                ${locationData.address.full}
                                ${locationData.method === 'gps' ? 
                                    `<br><small class="text-muted"><i class="fa-solid fa-satellite-dish me-1"></i>Ubicación GPS detectada automáticamente</small>` : 
                                    `<br><small class="text-muted"><i class="fa-solid fa-edit me-1"></i>Dirección ingresada manualmente</small>`
                                }
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label fw-bold">Teléfono de contacto</label>
                            <input id="telefono" class="form-control" placeholder="Por favor ingrese número de teléfono" value="${currentData.telefono || userData.telefono || ''}" inputmode="numeric" maxlength="10" required>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label fw-bold">Método de pago *</label>
                            <select id="metodoPago" class="form-select" required onchange="togglePaymentFields()">
                                <option value="">Seleccionar método</option>
                                <option value="efectivo" ${currentData.metodoPago === 'efectivo' ? 'selected' : ''}>💵 Efectivo (Pago contra entrega)</option>
                                <option value="tarjeta" ${currentData.metodoPago === 'tarjeta' ? 'selected' : ''}>💳 Tarjeta de Crédito/Débito</option>
                                <option value="transferencia" ${currentData.metodoPago === 'transferencia' ? 'selected' : ''}>🏦 Transferencia Bancaria</option>
                                <option value="paypal" ${currentData.metodoPago === 'paypal' ? 'selected' : ''}>🅿️ PayPal</option>
                            </select>
                            <small class="text-muted">Selecciona el método de pago para ver los campos correspondientes</small>
                        </div>

                        <!-- Campos específicos de tarjeta -->
                        <div id="tarjeta-fields" class="col-12" style="display: ${currentData.metodoPago === 'tarjeta' ? 'block' : 'none'};">
                            <div class="alert alert-info">
                                <i class="fa-solid fa-credit-card me-2"></i>
                                <strong>🔒 Información de Tarjeta de Crédito/Débito</strong>
                                <br><small>Completa TODOS los campos para continuar</small>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label"><strong>Número de tarjeta *</strong></label>
                                    <input id="numeroTarjeta" class="form-control" placeholder="Por favor ingrese número de tarjeta (sin espacios)" maxlength="19" value="${currentData.numeroTarjeta || ''}" required>
                                    <small class="text-muted">Para pruebas: 4532123456789012 (Visa) o 5555555555554444 (Mastercard)</small>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><strong>Fecha de vencimiento *</strong></label>
                                    <input id="fechaVencimiento" class="form-control" placeholder="Por favor ingrese MM/AA" maxlength="5" value="${currentData.fechaVencimiento || ''}" required>
                                    <small class="text-muted">Ej: 12/25</small>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><strong>CVV *</strong></label>
                                    <input id="cvv" class="form-control" placeholder="Por favor ingrese CVV" maxlength="4" value="${currentData.cvv || ''}" required>
                                    <small class="text-muted">3-4 dígitos</small>
                                </div>
                                <!-- Nombre en la tarjeta eliminado por petición del usuario -->
                            </div>
                        </div>

                        <!-- Campos específicos de PayPal -->
                        <div id="paypal-fields" class="col-12" style="display: ${currentData.metodoPago === 'paypal' ? 'block' : 'none'};">
                            <div class="alert alert-info">
                                <i class="fa-brands fa-paypal me-2"></i>
                                <strong>🔒 Información de PayPal</strong>
                                <br><small>Ingresa tu email de PayPal para continuar</small>
                            </div>
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label"><strong>Email de PayPal *</strong></label>
                                    <input id="emailPaypal" class="form-control" type="email" placeholder="Por favor ingrese email de PayPal" value="${currentData.emailPaypal || ''}" required>
                                    <small class="text-muted">El email asociado a tu cuenta de PayPal</small>
                                </div>
                            </div>
                        </div>

                        <!-- Campos específicos de transferencia -->
                        <div id="transferencia-fields" class="col-12" style="display: ${currentData.metodoPago === 'transferencia' ? 'block' : 'none'};">
                            <div class="alert alert-info">
                                <i class="fa-solid fa-university me-2"></i>
                                <strong>🔒 Información para Transferencia Bancaria</strong>
                                <br><small>Completa los datos bancarios para continuar</small>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label"><strong>Banco *</strong></label>
                                    <select id="banco" class="form-select" required>
                                        <option value="">Por favor seleccione banco</option>
                                        <option value="pichincha" ${currentData.banco === 'pichincha' ? 'selected' : ''}>Banco Pichincha</option>
                                        <option value="pacifico" ${currentData.banco === 'pacifico' ? 'selected' : ''}>Banco del Pacífico</option>
                                        <option value="guayaquil" ${currentData.banco === 'guayaquil' ? 'selected' : ''}>Banco de Guayaquil</option>
                                        <option value="produbanco" ${currentData.banco === 'produbanco' ? 'selected' : ''}>Produbanco</option>
                                        <option value="internacional" ${currentData.banco === 'internacional' ? 'selected' : ''}>Banco Internacional</option>
                                        <option value="bolivariano" ${currentData.banco === 'bolivariano' ? 'selected' : ''}>Banco Bolivariano</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><strong>Número de cuenta *</strong></label>
                                    <input id="numeroCuenta" class="form-control" placeholder="Por favor ingrese número de cuenta" value="${currentData.numeroCuenta || ''}" required>
                                    <small class="text-muted">Cuenta corriente o de ahorros</small>
                                </div>
                                <div class="col-12">
                                    <label class="form-label"><strong>Titular de la cuenta *</strong></label>
                                    <input id="titularCuenta" class="form-control" placeholder="Por favor ingrese nombre del titular" value="${currentData.titularCuenta || ''}" required>
                                    <small class="text-muted">Nombre completo como aparece en la cuenta</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Campo de instrucciones especiales eliminado por petición del usuario -->
                    </div>
                </div>

                <!-- payment fields script removed from inline Swal content - using global handlers defined in the main file -->
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Continuar con el pedido',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745',
            width: '700px',
            didOpen: () => {
                // Activar campos dinámicos después del render
                // Setup listeners first (no-op if elements missing), then toggle visibilities
                try {
                    window.setupPaymentFieldListeners?.();
                } catch (err) {
                    console.warn('setupPaymentFieldListeners error on didOpen:', err);
                }

                if (currentData.metodoPago) {
                    setTimeout(() => {
                        window.togglePaymentFields();
                    }, 100);
                }
            },
            preConfirm: () => {
                // Clear any previous inline errors
                try { clearAllPaymentInvalids(); } catch (e) { /* ignore */ }

                const telefonoEl = document.getElementById('telefono');
                const metodoPagoEl = document.getElementById('metodoPago');
                const telefonoRaw = telefonoEl ? telefonoEl.value.trim() : '';
                const telefono = (telefonoRaw || '').replace(/\D/g, ''); // normalized digits-only
                const metodoPago = metodoPagoEl ? metodoPagoEl.value : '';

                const errors = [];

                if (!telefono || telefono.length !== 10) {
                    if (telefonoEl) markInvalid(telefonoEl, 'Por favor ingresa un teléfono válido de 10 dígitos');
                    errors.push('telefono');
                }

                if (!metodoPago) {
                    if (metodoPagoEl) markInvalid(metodoPagoEl, 'Selecciona un método de pago');
                    errors.push('metodoPago');
                }

                    const paymentData = {
                    telefono: telefono,
                    metodoPago: metodoPago,
                    comentarios: '',
                    direccion: locationData.address.full,
                    ciudad: locationData.address.city,
                    provincia: locationData.address.province,
                    ubicacionCompleta: locationData
                };

                // Validate payment-specific fields and mark invalids inline
                if (metodoPago === 'tarjeta') {
                    const numeroTarjetaEl = document.getElementById('numeroTarjeta');
                    const fechaVencimientoEl = document.getElementById('fechaVencimiento');
                    const cvvEl = document.getElementById('cvv');

                    const numeroTarjeta = numeroTarjetaEl ? numeroTarjetaEl.value.replace(/\s/g, '') : '';
                    const fechaVencimiento = fechaVencimientoEl ? fechaVencimientoEl.value : '';
                    const cvv = cvvEl ? cvvEl.value : '';

                    if (!numeroTarjeta) {
                        if (numeroTarjetaEl) markInvalid(numeroTarjetaEl, 'Por favor ingresa el número de la tarjeta');
                        errors.push('numeroTarjeta');
                    } else if (!validateCreditCard(numeroTarjeta)) {
                        if (numeroTarjetaEl) markInvalid(numeroTarjetaEl, 'Número de tarjeta inválido');
                        errors.push('numeroTarjeta');
                    }

                    if (!fechaVencimiento) {
                        if (fechaVencimientoEl) markInvalid(fechaVencimientoEl, 'Por favor ingresa la fecha de vencimiento (MM/AA)');
                        errors.push('fechaVencimiento');
                    } else if (!/^\d{2}\/\d{2}$/.test(fechaVencimiento)) {
                        if (fechaVencimientoEl) markInvalid(fechaVencimientoEl, 'Formato MM/AA requerido (ej: 12/25)');
                        errors.push('fechaVencimiento');
                    }

                    if (!cvv) {
                        if (cvvEl) markInvalid(cvvEl, 'Por favor ingresa el CVV');
                        errors.push('cvv');
                    } else if (cvv.length < 3 || cvv.length > 4 || !/^\d+$/.test(cvv)) {
                        if (cvvEl) markInvalid(cvvEl, 'CVV inválido (3-4 dígitos)');
                        errors.push('cvv');
                    }

                    if (errors.length === 0) {
                        paymentData.tarjetaInfo = { numero: numeroTarjeta, fechaVencimiento: fechaVencimiento, cvv: cvv };
                    }

                } else if (metodoPago === 'paypal') {
                    const emailPaypalEl = document.getElementById('emailPaypal');
                    const emailPaypal = emailPaypalEl ? emailPaypalEl.value.trim() : '';

                    if (!emailPaypal) {
                        if (emailPaypalEl) markInvalid(emailPaypalEl, 'Por favor ingresa tu email de PayPal');
                        errors.push('emailPaypal');
                    } else if (!validateEmail(emailPaypal)) {
                        if (emailPaypalEl) markInvalid(emailPaypalEl, 'Email inválido');
                        errors.push('emailPaypal');
                    } else {
                        paymentData.paypalInfo = { email: emailPaypal };
                    }

                } else if (metodoPago === 'transferencia') {
                    const bancoEl = document.getElementById('banco');
                    const numeroCuentaEl = document.getElementById('numeroCuenta');
                    const titularCuentaEl = document.getElementById('titularCuenta');

                    const banco = bancoEl ? bancoEl.value : '';
                    const numeroCuenta = numeroCuentaEl ? numeroCuentaEl.value.trim() : '';
                    const titularCuenta = titularCuentaEl ? titularCuentaEl.value.trim() : '';

                    if (!banco) {
                        if (bancoEl) markInvalid(bancoEl, 'Selecciona el banco');
                        errors.push('banco');
                    }
                    if (!numeroCuenta) {
                        if (numeroCuentaEl) markInvalid(numeroCuentaEl, 'Ingresa el número de cuenta');
                        errors.push('numeroCuenta');
                    }
                    if (!titularCuenta) {
                        if (titularCuentaEl) markInvalid(titularCuentaEl, 'Ingresa el nombre del titular');
                        errors.push('titularCuenta');
                    }

                    if (errors.length === 0) {
                        paymentData.transferenciaInfo = { banco: banco, numeroCuenta: numeroCuenta, titularCuenta: titularCuenta };
                    }
                }

                if (errors.length > 0) {
                    Swal.showValidationMessage('Por favor corrige los campos resaltados en rojo');
                    return false;
                }

                return paymentData;
            }
        });

        if (formData) {
            methodSelected = true;
            return formData;
        } else {
            return null;
        }
    }
}

// =================== FUNCIONES DE CÁLCULO Y PROCESAMIENTO ===================

// Calcular totales con IVA
function calculateTotalsWithTax(carrito) {
    const subtotal = carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
    const iva = subtotal * 0.15;
    const envio = 3.50;
    const total = subtotal + iva + envio;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        iva: parseFloat(iva.toFixed(2)),
        envio: parseFloat(envio.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        itemCount: carrito.reduce((total, item) => total + item.cantidad, 0)
    };
}

// =================== FUNCIONES DE FACTURACIÓN ===================

// Función para mostrar factura de confirmación
async function showInvoicePreview(carrito, userData, locationData, totals, invoiceData) {
    const productList = carrito.map(item => 
        `<tr>
            <td>${item.nombre}</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-end">$${item.precio.toFixed(2)}</td>
            <td class="text-end">$${(item.precio * item.cantidad).toFixed(2)}</td>
        </tr>`
    ).join('');

    // RAIL: mark popup start so we can measure time to appear
    const popupKey = 'popup:invoice@' + Date.now();
    try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestStart) window.rail.metrics.markRequestStart(popupKey); } catch(e){}

    let popupRec = null;
    const result = await Swal.fire({
        title: 'Confirmar Compra',
        html: `
            <div class="text-start">
                <h6 class="border-bottom pb-2 mb-3">👤 Datos del Cliente</h6>
                <div class="row mb-3">
                    <div class="col-6"><strong>Nombre:</strong> ${userData.nombre} ${userData.apellido}</div>
                    <div class="col-6"><strong>Email:</strong> ${userData.email}</div>
                </div>
                
                <h6 class="border-bottom pb-2 mb-3">🚚 Dirección de Entrega</h6>
                <div class="alert alert-light">
                    <strong>${locationData.address.full}</strong>
                    ${locationData.method === 'gps' ? '<br><small class="text-success">📍 Ubicación GPS</small>' : '<br><small class="text-info">✏️ Dirección manual</small>'}
                </div>
                
                <h6 class="border-bottom pb-2 mb-3">💳 Método de Pago</h6>
                <div class="alert alert-light">
                    <strong>${getPaymentMethodName(invoiceData.metodoPago)}</strong>
                </div>
                
                <h6 class="border-bottom pb-2 mb-3">🛒 Productos (${totals.itemCount} artículos)</h6>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-end">Precio</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productList}
                    </tbody>
                </table>
                
                <div class="border-top pt-3">
                    <div class="row">
                        <div class="col-8"><strong>Subtotal:</strong></div>
                        <div class="col-4 text-end">$${totals.subtotal.toFixed(2)}</div>
                    </div>
                    <div class="row">
                        <div class="col-8"><strong>IVA (15%):</strong></div>
                        <div class="col-4 text-end">$${totals.iva.toFixed(2)}</div>
                    </div>
                    <div class="row">
                        <div class="col-8"><strong>Envío:</strong></div>
                        <div class="col-4 text-end">$${totals.envio.toFixed(2)}</div>
                    </div>
                    <div class="row border-top pt-2 bg-light rounded">
                        <div class="col-8"><strong style="font-size: 1.1em;">TOTAL A PAGAR:</strong></div>
                        <div class="col-4 text-end"><strong style="font-size: 1.1em; color: #28a745;">$${totals.total.toFixed(2)}</strong></div>
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            // Mark popup shown (didOpen) to compute time-to-appear
            try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestEnd) popupRec = window.rail.metrics.markRequestEnd(popupKey, { popup: 'invoice', event: 'didOpen' }); } catch(e){}
            try { if (window.rail && window.rail.metrics && popupRec) window.rail.metrics.report({ type: 'popup', name: 'invoice_appear', duration: popupRec.dur }); } catch(e){}
        },
        showCancelButton: true,
        confirmButtonText: 'Confirmar Compra',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        width: '750px'
    });

    return result.isConfirmed;
}

// Obtener nombre del método de pago
function getPaymentMethodName(metodo) {
    const metodos = {
        'efectivo': '💵 Efectivo (Pago contra entrega)',
        'tarjeta': '💳 Tarjeta de Crédito/Débito',
        'transferencia': '🏦 Transferencia Bancaria',
        'paypal': '🅿️ PayPal'
    };
    return metodos[metodo] || metodo;
}

// Generar orden completa
function generateOrder(carrito, userData, locationData, totals, invoiceData) {
    return {
        id: 'ORD-' + Date.now(),
        numeroFactura: 'FAC-' + Date.now(),
        fecha: new Date().toISOString(),
        estado: 'confirmado',
        cliente: {
            nombre: userData.nombre,
            apellido: userData.apellido,
            email: userData.email,
            cedula: userData.cedula,
            telefono: invoiceData.telefono
        },
        entrega: {
            direccion: locationData.address.full,
            metodo: locationData.method,
            coordenadas: locationData.latitude ? {
                lat: locationData.latitude,
                lng: locationData.longitude,
                accuracy: locationData.accuracy
            } : null,
            instrucciones: invoiceData.comentarios || '',
            fechaEstimada: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString()
        },
        pago: {
            metodo: invoiceData.metodoPago,
            metodoPagoNombre: getPaymentMethodName(invoiceData.metodoPago)
        },
        productos: carrito.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            subtotal: item.precio * item.cantidad,
            imagen: item.imagen
        })),
        totales: totals,
        loyalty: invoiceData.loyaltyRedemption || null,
        timestamp: Date.now()
    };
}

// Expose generateOrder to global scope (ensure other scripts can call it)
try { window.generateOrder = generateOrder; window.getLocationForCheckout = getLocationForCheckout; } catch(e) { /* ignore in non-browser contexts */ }

// Guardar en historial
function saveOrderToHistory(order) {
    try {
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        comprasHistorial.unshift(order);
        localStorage.setItem('comprasHistorial', JSON.stringify(comprasHistorial));
        
        const userEmail = localStorage.getItem('userEmail');
        const userOrders = JSON.parse(localStorage.getItem(`orders_${userEmail}`) || '[]');
        userOrders.unshift(order);
        localStorage.setItem(`orders_${userEmail}`, JSON.stringify(userOrders));
    } catch (error) {
        console.error('Error guardando orden:', error);
    }
}

// Mostrar factura final
async function showFinalInvoice(order) {
    // Prevent showing the invoice modal multiple times concurrently
    if (window.__invoiceModalOpen) {
        console.warn('Invoice modal already open, ignoring duplicate call');
        return;
    }
    window.__invoiceModalOpen = true;

    const productList = order.productos.map(item => 
        `<tr>
            <td>${item.nombre}</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-end">$${item.precio.toFixed(2)}</td>
            <td class="text-end">$${item.subtotal.toFixed(2)}</td>
        </tr>`
    ).join('');
    // Show invoice modal but keep it open when the user clicks "Descargar PDF".
    // We use preConfirm to trigger the PDF download and return false so the modal does not close.
    let result;
    try {
        result = await Swal.fire({
            title: '¡Compra Realizada con Éxito!',
            html: `
            <div class="text-start">
                <div class="alert alert-success text-center mb-4">
                    <i class="fa-solid fa-check-circle fa-3x text-success mb-2"></i>
                    <h5 class="mb-1">Pedido #${order.id}</h5>
                    <small class="text-muted">Procesado el ${new Date(order.fecha).toLocaleString('es-EC')}</small>
                </div>
                
                <h6 class="border-bottom pb-2 mb-3">📋 Resumen de la Compra</h6>
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-end">Precio</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productList}
                    </tbody>
                </table>
                
                <div class="border-top pt-3">
                    <div class="row">
                        <div class="col-8">Subtotal:</div>
                        <div class="col-4 text-end">$${order.totales.subtotal.toFixed(2)}</div>
                    </div>
                    <div class="row">
                        <div class="col-8">IVA (15%):</div>
                        <div class="col-4 text-end">$${order.totales.iva.toFixed(2)}</div>
                    </div>
                    <div class="row">
                        <div class="col-8">Envío:</div>
                        <div class="col-4 text-end">$${order.totales.envio.toFixed(2)}</div>
                    </div>
                    ${order.totales.discount ? `
                    <div class="row">
                        <div class="col-8">Descuento (Puntos):</div>
                        <div class="col-4 text-end">-$${order.totales.discount.toFixed(2)}</div>
                    </div>
                    ` : ''}
                    <div class="row border-top pt-2 bg-light rounded">
                        <div class="col-8"><strong>TOTAL PAGADO:</strong></div>
                        <div class="col-4 text-end"><strong style="color: #28a745; font-size: 1.2em;">$${order.totales.total.toFixed(2)}</strong></div>
                    </div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <strong>📞 ¿Qué sigue?</strong><br>
                    • Te contactaremos al ${order.cliente.telefono} para coordinar la entrega<br>
                    • Puedes ver tu pedido en "Mis Compras"
                </div>
            </div>
        `,
        confirmButtonText: '<i class="fa-solid fa-download me-2"></i>Descargar PDF',
        showCancelButton: true,
        cancelButtonText: 'Ver Mis Compras',
        showDenyButton: true,
        denyButtonText: 'Ir a productos',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#007bff',
        denyButtonColor: '#6c757d',
        width: '800px',
        customClass: {
            container: 'swal2-center',
            popup: 'swal2-center-modal'
        },
        allowOutsideClick: false,
        preConfirm: () => {
            try {
                // Trigger PDF download but prevent modal from closing
                downloadInvoicePDF(order);
            } catch (err) {
                console.error('Error triggering invoice download:', err);
            }
            // Returning false prevents the modal from closing automatically
            return false;
        }
    });

    } finally {
        // Clear guard so future invoice modals can be shown
        try { window.__invoiceModalOpen = false; } catch (e) { window.__invoiceModalOpen = false; }
    }

    // Handle deny/cancel actions after the modal is finally closed by the user
    try {
        if (result && result.isDenied) {
            // Go to products page as requested
            window.location.href = 'product.html';
        } else if (result && result.isDismissed && result.dismiss === 'cancel') {
            // User clicked "Ver Mis Compras" (cancel button)
            window.location.href = 'compras.html';
        } else if (result && result.isDismissed) {
            // User dismissed the modal (no automatic navigation). Keep them on checkout.
        }
    } catch (e) { console.warn('post-invoice action failed', e); }
}

// Función para inicializar mapa en confirmación de ubicación
function initCheckoutLocationMap(mapId, locationData) {
    try {
        const mapElement = document.getElementById(mapId);
        if (!mapElement || !locationData.latitude || !locationData.longitude) {
            if (mapElement) {
                mapElement.innerHTML = `
                    <div class="d-flex align-items-center justify-content-center h-100 bg-light rounded">
                        <div class="text-center text-primary">
                            <i class="fa-solid fa-home fa-3x mb-2"></i><br>
                            <strong>Dirección Confirmada</strong><br>
                            <small class="text-muted">${locationData.address}</small>
                        </div>
                    </div>
                `;
            }
            return;
        }

        // Remove any existing map instance to prevent "already initialized" error
        if (mapElement._leaflet_id) {
            mapElement._leaflet_id = undefined;
            mapElement.innerHTML = '';
        }

        const lat = locationData.latitude;
        const lng = locationData.longitude;
        
        const map = L.map(mapId, {
            zoomControl: true,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            dragging: true
        }).setView([lat, lng], 16);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        const userIcon = L.divIcon({
            className: 'custom-delivery-marker',
            html: `<div style="background: #28a745; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });
        
        L.marker([lat, lng], { icon: userIcon }).addTo(map)
            .bindPopup(`<strong>📦 Punto de Entrega</strong><br>${locationData.address}`)
            .openPopup();
        
        if (locationData.accuracy) {
            L.circle([lat, lng], {
                color: '#007bff',
                fillColor: '#007bff',
                fillOpacity: 0.1,
                radius: locationData.accuracy
            }).addTo(map);
        }
        
        setTimeout(() => map.invalidateSize(), 200);
        
    } catch (error) {
        console.error('Error inicializando mapa:', error);
        const mapElement = document.getElementById(mapId);
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="d-flex align-items-center justify-content-center h-100 bg-light rounded border">
                    <div class="text-center text-success">
                        <i class="fa-solid fa-map-marked-alt fa-3x mb-2"></i><br>
                        <strong>Ubicación Confirmada</strong><br>
                        <small class="text-muted">${locationData.address}</small>
                    </div>
                </div>
            `;
        }
    }
}

// Sistema de checkout mejorado con geolocalización, impuestos y facturación
class CheckoutManager {
    constructor() {
        this.currentLocation = null;
        this.TAX_RATE = 0.15; // 15% IVA Ecuador
        this.DELIVERY_FEE = 3.50; // Tarifa de envío base
        this.initializeGeolocation();
    }

    // Inicializar geolocalización
    async initializeGeolocation() {
        if ('geolocation' in navigator) {
            try {
                const position = await this.getCurrentPosition();
                this.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString(),
                    address: await this.getAddressFromCoordinates(position.coords.latitude, position.coords.longitude)
                };
                console.log('Ubicación obtenida:', this.currentLocation);
                
                // Mostrar ubicación en la interfaz si existe el elemento
                this.displayLocationInUI();
                
            } catch (error) {
                console.error('Error obteniendo ubicación:', error);
                this.showLocationError(error);
            }
        } else {
            console.warn('Geolocalización no disponible');
        }
    }

    // Mostrar error de ubicación
    showLocationError(error) {
        let message = 'No se pudo obtener la ubicación actual.';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Acceso a la ubicación denegado. Por favor, permite el acceso para una mejor experiencia.';
                break;
            case error.TIMEOUT:
                message = 'Tiempo de espera agotado al obtener la ubicación.';
                break;
        }
        
        // Mostrar mensaje discreto
        const locationStatus = document.getElementById('locationStatus');
        if (locationStatus) {
            locationStatus.innerHTML = `
                <div class="alert alert-warning alert-sm">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>${message}
                </div>
            `;
        }
    }

    // Mostrar ubicación en la UI
    displayLocationInUI() {
        if (!this.currentLocation) return;
        
        const locationStatus = document.getElementById('locationStatus');
        if (locationStatus) {
            locationStatus.innerHTML = `
                <div class="alert alert-success alert-sm">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                    <strong>Ubicación detectada:</strong> ${this.currentLocation.address || 'Coordenadas obtenidas'}
                    <br><small class="text-muted">Lat: ${this.currentLocation.latitude.toFixed(6)}, Lng: ${this.currentLocation.longitude.toFixed(6)}</small>
                </div>
            `;
        }
    }

    // Obtener dirección desde coordenadas (usando API de geocodificación)
    async getAddressFromCoordinates(lat, lng) {
        try {
            // Usando una API pública de geocodificación reversa
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`);
            const data = await response.json();
            
            return `${data.locality || data.city || 'Ciudad'}, ${data.principalSubdivision || 'Provincia'}, ${data.countryName || 'País'}`;
        } catch (error) {
            console.error('Error al obtener dirección:', error);
            return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        }
    }

    // Obtener posición actual
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 300000 // 5 minutos
                }
            );
        });
    }

    // Actualizar ubicación si es necesario
    async updateLocation() {
        if (!this.currentLocation || 
            (Date.now() - new Date(this.currentLocation.timestamp).getTime()) > 300000) { // 5 minutos
            await this.initializeGeolocation();
        }
    }

    // Función para actualizar estado de ubicación desde localStorage
    updateLocationStatusFromStorage() {
        const locationStatus = document.getElementById('locationStatus');
        if (!locationStatus) return;
        
        const savedLocation = localStorage.getItem('userLocation');
        if (savedLocation) {
            try {
                const location = JSON.parse(savedLocation);
                locationStatus.innerHTML = `
                    <div class="alert alert-info alert-sm d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fa-solid fa-map-marker-alt me-2"></i>
                            <strong>Ubicación guardada:</strong> ${location.address}
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="clearSavedLocation()">
                            <i class="fa-solid fa-edit me-1"></i>Cambiar
                        </button>
                    </div>
                `;
            } catch (error) {
                console.error('Error parsing ubicación guardada:', error);
            }
        } else if (!this.currentLocation) {
            locationStatus.innerHTML = `
                <div class="alert alert-warning alert-sm">
                    <i class="fa-solid fa-location-dot me-2"></i>
                    <strong>Ubicación no disponible</strong>
                    <br><small class="text-muted">Se solicitará durante el checkout</small>
                </div>
            `;
        }
    }

    async placeOrder() {
        try {
            // ...existing code... (validaciones)

            // Crear el pedido
            const order = {
                id: this.generateOrderId(),
                numeroOrden: this.generateOrderId(),
                cliente: this.orderData.cliente,
                productos: this.cart,
                totales: this.calculateTotals(),
                entrega: this.orderData.entrega,
                pago: this.orderData.pago,
                estado: 'procesando',
                fecha: new Date().toISOString(),
                timestamp: Date.now()
            };

            // NOTE: moved stock reduction to run after the order is persisted (server or local)
            // to avoid double-applying stock changes when both client and server update stock.

            // Guardar el pedido
            await this.saveOrder(order);

            // Limpiar carrito
            localStorage.removeItem('carrito');

            // Disparar evento de actualización de productos
            window.dispatchEvent(new Event('productsUpdated'));

            // ...existing code... (mostrar confirmación)

            return { success: true, order: order };
        } catch (error) {
            console.error('❌ Error al realizar el pedido:', error);
            throw error;
        }
    }

    // ...existing code...
}

// Instanciar el checkout manager solo en la página de checkout o si el DOM indica que se requiere
let checkoutManager = null;
try {
    const shouldInit = (typeof window !== 'undefined') && (
        window.location.pathname.endsWith('checkout.html') ||
        document.getElementById('locationStatus') ||
        document.getElementById('checkout-map')
    );
    if (shouldInit) {
        checkoutManager = new CheckoutManager();
        // Exponer globalmente por compatibilidad
        window.checkoutManager = checkoutManager;
    }
} catch (initErr) {
    console.warn('checkoutManager init skipped or failed:', initErr);
}

// Compatibility helper: expose togglePaymentFields and setup listeners globally so Swal-generated content can use them
window.togglePaymentFields = function() {
    try {
        const metodoPagoEl = document.getElementById('metodoPago');
        if (!metodoPagoEl) return;
        const metodoPago = metodoPagoEl.value;

        const tarjetaFields = document.getElementById('tarjeta-fields');
        const paypalFields = document.getElementById('paypal-fields');
        const transferenciaFields = document.getElementById('transferencia-fields');

        if (tarjetaFields) tarjetaFields.style.display = metodoPago === 'tarjeta' ? 'block' : 'none';
        if (paypalFields) paypalFields.style.display = metodoPago === 'paypal' ? 'block' : 'none';
        if (transferenciaFields) transferenciaFields.style.display = metodoPago === 'transferencia' ? 'block' : 'none';
    } catch (err) {
        console.error('togglePaymentFields error:', err);
    }
};

// Setup listeners for inputs inside Swal modal (called from didOpen)
window.setupPaymentFieldListeners = function() {
    try {
        const telefono = document.getElementById('telefono');
        if (telefono) {
            telefono.setAttribute('inputmode', 'numeric');
            telefono.setAttribute('maxlength', '10');
            telefono.addEventListener('input', () => {
                telefono.value = telefono.value.replace(/\D/g, '').slice(0,10);
            });
        }

        const numeroTarjeta = document.getElementById('numeroTarjeta');
        if (numeroTarjeta) {
            numeroTarjeta.addEventListener('input', () => {
                numeroTarjeta.value = numeroTarjeta.value.replace(/[^0-9\s]/g, '').slice(0,19);
            });
        }

        const fechaVencimiento = document.getElementById('fechaVencimiento');
        if (fechaVencimiento) {
            fechaVencimiento.addEventListener('input', () => {
                // Auto-insert slash for MM/AA
                let v = fechaVencimiento.value.replace(/[^0-9]/g, '');
                if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2,4);
                fechaVencimiento.value = v.slice(0,5);
            });
        }
    } catch (err) {
        console.warn('setupPaymentFieldListeners error:', err);
    }
};

// Helpers to mark/clear inline validation (Bootstrap style)
function markInvalid(el, msg) {
    if (!el) return;
    el.classList.add('is-invalid');
    // remove existing invalid-feedback sibling if any
    let fb = el.parentNode.querySelector('.invalid-feedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.className = 'invalid-feedback';
        el.parentNode.appendChild(fb);
    }
    fb.innerText = msg || 'Campo requerido';
}

function clearInvalid(el) {
    if (!el) return;
    el.classList.remove('is-invalid');
    const fb = el.parentNode.querySelector('.invalid-feedback');
    if (fb) fb.remove();
}

function clearAllPaymentInvalids() {
    const ids = ['telefono','numeroTarjeta','fechaVencimiento','cvv','emailPaypal','banco','numeroCuenta','titularCuenta'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) clearInvalid(el);
    });
}

if (checkoutManager) {
    checkoutManager.showInvoice = async function(order) {
        try {
            await window.showInvoiceSingleton(order);
        } catch (err) {
            console.error('showInvoice error:', err);
        }
    };
} else {
    // Fallback global helper when checkoutManager is not initialized on this page
    window.checkoutShowInvoice = async function(order) {
        try {
            await window.showInvoiceSingleton(order);
        } catch (err) {
            console.error('checkoutShowInvoice error:', err);
        }
    };
}

// Función global para limpiar ubicación guardada
window.clearSavedLocation = function() {
    Swal.fire({
        title: '¿Cambiar ubicación?',
        text: 'Se eliminará tu ubicación guardada y se solicitará una nueva en tu próxima compra.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#17a2b8'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('userLocation');
            if (checkoutManager) {
                checkoutManager.currentLocation = null;
                checkoutManager.updateLocationStatusFromStorage();
            }
            
            Swal.fire({
                title: 'Ubicación eliminada',
                text: 'Se solicitará nuevamente en tu próxima compra',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
};

// Inicializar ubicación cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Actualizar estado de ubicación (solo si el manager fue inicializado)
    setTimeout(() => {
        try {
            if (checkoutManager && typeof checkoutManager.updateLocationStatusFromStorage === 'function') {
                checkoutManager.updateLocationStatusFromStorage();
            }
        } catch (e) {
            console.warn('updateLocationStatusFromStorage guard failed', e);
        }
    }, 500);
    
    // Solicitar permisos de notificación si no se han otorgado
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('Permisos de notificación:', permission);
        });
    }
});

// Función global para procesar checkout con geolocalización y facturación MEJORADA
window.enviarCarrito = async function() {
    // Prevent concurrent execution from other handlers
    if (window.__checkoutInProgress) {
        console.warn('window.enviarCarrito: checkout already in progress, skipping');
        return;
    }
    window.__checkoutInProgress = true;

    try {
        console.log('🛒 Iniciando proceso de checkout mejorado...');
        
        // ✅ PASO 1: Verificar autenticación
        if (localStorage.getItem('userLoggedIn') !== 'true') {
            await Swal.fire({
                title: 'Acceso requerido',
                text: 'Necesitas iniciar sesión para realizar una compra',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Iniciar sesión',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'login.html';
                }
            });
            return;
        }

        // ✅ PASO 2: Verificar carrito
        const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        if (carrito.length === 0) {
            Swal.fire({
                title: 'Carrito vacío',
                text: 'Agrega productos al carrito antes de continuar',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }

        console.log('📦 Carrito validado:', carrito.length, 'productos');

        // ✅ PASO 3: Obtener ubicación (SISTEMA MEJORADO)
        const locationData = await getLocationForCheckout();
        if (!locationData) {
            console.log('❌ Usuario canceló la obtención de ubicación');
            return;
        }

        console.log('📍 Ubicación obtenida:', locationData);

        // ✅ PASO 4: Obtener datos del usuario (preferir datos desde la base de datos vía API cuando haya token)
        let userData = {
            email: localStorage.getItem('userEmail'),
            nombre: localStorage.getItem('userNombre'),
            apellido: localStorage.getItem('userApellido'),
            cedula: localStorage.getItem('userCedula'),
            telefono: localStorage.getItem('userTelefono') || ''
        };
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token && window.api && typeof window.api.getUser === 'function') {
                try {
                    const serverUser = await window.api.getUser('me');
                    if (serverUser) {
                        userData = {
                            email: serverUser.email || userData.email,
                            nombre: serverUser.nombre || userData.nombre,
                            apellido: serverUser.apellido || userData.apellido,
                            cedula: serverUser.cedula || userData.cedula,
                            telefono: serverUser.telefono || serverUser.phone || userData.telefono
                        };
                    }
                } catch(fetchErr){
                    console.warn('Could not fetch user from API during checkout, falling back to local data', fetchErr);
                }
            }
        } catch(e) { /* ignore */ }

        // ✅ PASO 5: Obtener SOLO teléfono y método de pago (ubicación ya confirmada)
        const invoiceData = await getInvoiceDataWithLocation(userData, locationData);
        if (!invoiceData) {
            console.log('❌ Usuario canceló los datos de facturación');
            return;
        }

        // ✅ PASO 6: Calcular totales
        let totals = calculateTotalsWithTax(carrito);

        // ✅ PASO 6.1: Intentar canjear puntos automáticamente (si el usuario tiene suficientes)
        try {
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail && typeof loyaltyManager !== 'undefined') {
                const summary = loyaltyManager.getLoyaltySummary(userEmail) || {};
                const availableDiscount = Number(summary.availableDiscount || 0);

                // Calcular cuántos "bloques" de descuento podemos aplicar.
                // Cada bloque = loyaltyManager.config.pointsToDiscount puntos => loyaltyManager.config.discountValue $.
                const blockValue = Number(loyaltyManager.config.discountValue || 0);
                const blockPoints = Number(loyaltyManager.config.pointsToDiscount || 0);

                if (availableDiscount >= blockValue && blockValue > 0) {
                    // Máximo que podemos aplicar sin exceder el total
                    const maxApplicable = Math.min(availableDiscount, totals.total || 0);
                    const blocks = Math.floor(maxApplicable / blockValue);

                    if (blocks > 0) {
                        const pointsToRedeem = blocks * blockPoints;
                        // Ejecutar canje (esto decrementa los puntos en localStorage)
                        const redeemResult = loyaltyManager.redeemPoints(userEmail, pointsToRedeem);
                        if (redeemResult && redeemResult.success) {
                            const discountApplied = Number(redeemResult.discount || 0);
                            // Registrar el descuento en los totales (no alteramos subtotal/iva/envío para simplificar)
                            totals = Object.assign({}, totals, {
                                discount: (totals.discount || 0) + discountApplied,
                                total: Math.max(0, (totals.total || 0) - discountApplied)
                            });

                            // Mostrar notificación breve al usuario
                            try {
                                Swal.fire({
                                    title: '¡Canje automático aplicado!',
                                    html: `Se han canjeado <strong>${pointsToRedeem} puntos</strong> por <strong>$${discountApplied.toFixed(2)}</strong> de descuento.`,
                                    icon: 'success',
                                    toast: true,
                                    position: 'top-end',
                                    timer: 3500,
                                    showConfirmButton: false
                                });
                            } catch (e) { console.log('Notificación de canje no mostrada', e); }

                            // Guardar metadata para incluirla en la orden
                            invoiceData.loyaltyRedemption = {
                                pointsRedeemed: pointsToRedeem,
                                discountApplied: discountApplied
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Error intentando canjear puntos automáticamente:', e);
        }

        // ✅ PASO 7: Mostrar confirmación final
        const confirmed = await showInvoicePreview(carrito, userData, locationData, totals, invoiceData);
        if (!confirmed) {
            try { if (window.rail && window.rail.metrics) window.rail.metrics.report({ type: 'checkout', result: 'canceled_by_user', popupDuration: popupRec ? popupRec.dur : null }); } catch(e){}
            try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('confirmar-productos'); } catch(e){}
            return;
        }

        // ✅ PASO 8: Generar pedido local para UI
        const order = generateOrder(carrito, userData, locationData, totals, invoiceData);

        // Intentar enviar el checkout al servidor (persistir en MongoDB Atlas)
        let serverOrderId = null;
        try {
            if (window.api && typeof window.api.checkout === 'function') {
                // Resolve item ids to server-side product ids when possible (handle legacy numeric/local ids)
                const resolvedItems = carrito.map(item => {
                    let resolvedId = item.id;
                    try {
                        // If productManager knows this id, prefer its canonical id
                        if (typeof productManager !== 'undefined') {
                            const pmProduct = productManager.getProductById(item.id);
                            if (pmProduct && pmProduct.id) {
                                resolvedId = pmProduct.id;
                            } else {
                                // Try to find by name (fallback when client stored numeric legacy ids)
                                const byName = productManager.getAllProducts().find(p => p.nombre === item.nombre || p.nombre === item.nombre.trim());
                                if (byName && byName.id) {
                                    resolvedId = byName.id;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Could not resolve product id for', item, e);
                    }
                    return { id: resolvedId, cantidad: item.cantidad, originalId: item.id };
                });

                const payload = {
                    items: resolvedItems,
                    resumen: totals,
                    shipping: {
                        direccion: invoiceData.direccion || invoiceData.direccion || locationData.address.full,
                        ciudad: invoiceData.ciudad || locationData.address.city,
                        provincia: invoiceData.provincia || locationData.address.province,
                        ubicacionCompleta: locationData
                    }
                };

                // Debugging: show payload and token presence
                try {
                    console.log('🔎 Checkout payload:', payload);
                    console.log('🔐 Token present:', !!localStorage.getItem('token'));
                } catch (e) { console.warn('Could not log checkout debug info', e); }

                const res = await window.api.checkout(payload);
                console.log('📨 /api/checkout response:', res);
                if (res && res.orderId) {
                    serverOrderId = res.orderId;
                    order.id = res.orderId;
                    console.log('✅ Checkout persisted on server, orderId=', serverOrderId);

                    // RAIL: report successful checkout summary (include popup appearance time when available)
                    try {
                        if (window.rail && window.rail.metrics) window.rail.metrics.report({ type: 'checkout', result: 'success', orderId: serverOrderId, itemCount: carrito.length, totals, popupDuration: popupRec ? popupRec.dur : null });
                        if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('confirmar-productos');
                    } catch(e){}
                } else {
                    // Server responded but without orderId
                    console.warn('⚠️ Server checkout did not return orderId:', res);
                    try { if (window.rail && window.rail.metrics) window.rail.metrics.report({ type: 'checkout', result: 'no-orderId', response: res }); } catch(e){}
                    await Swal.fire({
                        title: 'Error al procesar en el servidor',
                        html: `<div>El servidor respondió pero no devolvió un ID de orden.<br><pre style="text-align:left; white-space:pre-wrap;">${JSON.stringify(res)}</pre></div>`,
                        icon: 'error'
                    });
                }
            }
        } catch (err) {
            console.error('API checkout failed, will fallback to local save:', err);
            // Try to extract JSON message if available
            let message = err && err.message ? err.message : String(err);
            try {
                const parsed = JSON.parse(message);
                if (parsed && parsed.error) message = parsed.error;
            } catch (e) {
                // not JSON
            }

            await Swal.fire({
                title: 'Error comunicándose con el servidor',
                html: `<div>Ocurrió un error al intentar guardar la orden en el servidor:<br><pre style="text-align:left; white-space:pre-wrap;">${escapeHtml(message)}</pre></div><div class="mt-2">La orden será guardada localmente como respaldo.</div>`,
                icon: 'error',
                confirmButtonText: 'OK'
            });

            // RAIL: report checkout error
            try { if (window.rail && window.rail.metrics) window.rail.metrics.report({ type: 'checkout', result: 'error', message }); } catch(e){}
        }

        // Guardar historial local: preferir guardado en servidor
        if (serverOrderId) {
            // Si el servidor procesó la orden correctamente, usar ese ID y marcar como sincronizada
            order.id = serverOrderId;
            order.syncedWithServer = true;
            saveOrderToHistory(order);

            // Si el checkout fue exitoso en servidor, intentar refrescar productos desde API para actualizar stock
            try {
                if (window.api && typeof window.api.getProducts === 'function' && typeof productManager?.fetchProductsFromApi === 'function') {
                    await productManager.fetchProductsFromApi();
                    console.log('🔄 Productos refrescados desde servidor tras checkout');
                } else {
                    // Fallback local stock update (pass order id for idempotency)
                    updateProductStock(carrito, order.id);
                }
            } catch (err) {
                console.warn('No se pudo refrescar productos desde API, actualizando localmente:', err);
                updateProductStock(carrito, order.id);
            }

            // ✅ PASO 9: Mostrar factura final
            await window.showInvoiceSingleton(order);

            // ✅ PASO 10: Limpiar carrito
            try {
                // If server processed the order, also explicitly clear server-side cart for consistency
                if (window.api && typeof window.api.updateCart === 'function') {
                    await window.api.updateCart([]);
                    console.log('✅ Server-side cart cleared via API');
                }
            } catch (err) {
                console.warn('Could not clear server-side cart after checkout:', err);
            }

            // Remove local cart only after attempts to clear server cart (keeps client/server consistent)
            localStorage.removeItem("carrito");
            if (typeof actualizarCarritoUI === 'function') {
                actualizarCarritoUI();
            }
        } else {
            // El servidor no respondió con un orderId o la petición falló.
            // No borrar el carrito local para evitar pérdida de datos.
            order.syncedWithServer = false;
            saveOrderToHistory(order);

            await Swal.fire({
                title: 'Orden guardada localmente',
                html: 'No se pudo guardar la orden en el servidor. Tu pedido fue guardado localmente y no se borró el carrito. Intenta nuevamente más tarde o contacta soporte.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
        }

    } catch (error) {
        console.error('💥 Error en checkout:', error);
        Swal.fire({
            title: 'Error en la compra',
            text: `Ocurrió un error: ${error.message || 'Intenta de nuevo.'}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
    finally {
        try { window.__checkoutInProgress = false; } catch(e){}
    }
};

// =================== FUNCIONALIDAD DE PDF ===================

// Función global para descargar PDF
window.downloadInvoicePDF = function(order) {
    try {
        console.log('🖨️ Iniciando descarga de PDF para orden:', order.id || order.numeroOrden);
        
        const pdfContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Factura - Tatylu, Viveres</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 20px; }
                    .logo { color: #007bff; font-size: 24px; font-weight: bold; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .table th { background-color: #f8f9fa; }
                    .totals { float: right; width: 300px; }
                    .total-final { background-color: #e8f5e8; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">Tatylu, Viveres</div>
                    <p>Electrodomésticos de Calidad</p>
                    <p>Avenida Maldonado S29-106, Quito | +593967967369</p>
                </div>
                
                <div>
                    <h2>FACTURA DE VENTA</h2>
                    <p><strong>Factura #:</strong> ${order.numeroFactura || order.id}</p>
                    <p><strong>Fecha:</strong> ${new Date(order.fecha).toLocaleDateString('es-EC')}</p>
                    <p><strong>Cliente:</strong> ${order.cliente.nombre} ${order.cliente.apellido}</p>
                    <p><strong>Email:</strong> ${order.cliente.email}</p>
                </div>
                
                <h3>Productos</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cantidad</th>
                            <th class="text-right">Precio Unit.</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.productos.map(item => `
                            <tr>
                                <td>${item.nombre}</td>
                                <td class="text-center">${item.cantidad}</td>
                                <td class="text-right">$${item.precio.toFixed(2)}</td>
                                <td class="text-right">$${item.subtotal.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="totals">
                    <table class="table">
                        <tr>
                            <td>Subtotal:</td>
                            <td class="text-right">$${order.totales.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>IVA (15%):</td>
                            <td class="text-right">$${order.totales.iva.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Envío:</td>
                            <td class="text-right">$${order.totales.envio.toFixed(2)}</td>
                        </tr>
                        <tr class="total-final">
                            <td><strong>TOTAL:</strong></td>
                            <td class="text-right"><strong>$${order.totales.total.toFixed(2)}</strong></td>
                        </tr>
                    </table>
                </div>
                
                <div style="clear: both; margin-top: 30px;">
                    <h3>Información de Entrega</h3>
                    <p><strong>Dirección:</strong> ${order.entrega ? order.entrega.direccion : 'No especificada'}</p>
                    <p><strong>Método de pago:</strong> ${order.pago ? (order.pago.metodoPagoNombre || order.pago.metodo) : 'No especificado'}</p>
                </div>
                
                <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                    <p>¡Gracias por tu compra en Tatylu, Viveres!</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
        };
        
        console.log('✅ PDF de factura generado');
        
    } catch (error) {
        console.error('❌ Error generando PDF:', error);
        Swal.fire({
            title: 'Error al generar PDF',
            text: 'No se pudo generar el PDF',
            icon: 'error'
        });
    }
};

// =================== CONTROL DE STOCK ===================

// NOTE: updateProductStock está diseñado para ejecutarse una sola vez por orden.
// Usa el parámetro `orderId` para hacer la operación idempotente en caso de
// que múltiples flujos intenten actualizar el stock para la misma orden.

// Función para actualizar stock en productos del admin
function updateAdminProductStock(productId, quantity) {
    try {
        const adminProducts = JSON.parse(localStorage.getItem('productos') || '[]');
        const productIndex = adminProducts.findIndex(p => p.id.toString() === productId.toString());
        
        if (productIndex !== -1) {
            const currentStock = adminProducts[productIndex].stock || 0;
            const newStock = Math.max(0, currentStock - quantity);
            adminProducts[productIndex].stock = newStock;
            adminProducts[productIndex].fechaModificacion = new Date().toISOString();
            
            localStorage.setItem('productos', JSON.stringify(adminProducts));
            console.log(`📦 Admin stock actualizado para producto ${productId}: ${newStock} unidades`);
            
            return { success: true, newStock: newStock };
        } else {
            console.warn(`⚠️ Producto ${productId} no encontrado en productos admin`);
            return { success: false, message: 'Producto no encontrado en admin' };
        }
    } catch (error) {
        console.error('❌ Error actualizando stock del admin:', error);
               return { success: false, message: 'Error actualizando stock admin' };
    }
}

// =================== FUNCIONES DE VALIDACIÓN ===================

// Función para validar tarjetas de crédito usando algoritmo de Luhn
function validateCreditCard(cardNumber) {
    // Remover espacios y guiones
    cardNumber = cardNumber.replace(/[\s-]/g, '');
    
    // Verificar que solo contenga números
    if (!/^\d+$/.test(cardNumber)) {
        return false;
    }
    
    // Verificar longitud (13-19 dígitos)
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        return false;
    }
    
    // Algoritmo de Luhn
    let sum = 0;
    let isEven = false;
    
    // Procesar de derecha a izquierda
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i));
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return (sum % 10) === 0;
}

// Función para validar email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Función para actualizar stock de productos (simulado en localStorage)
// Acepta `orderId` para asegurar idempotencia por orden.
async function updateProductStock(carrito, orderId) {
    try {
        // Idempotency by orderId preferred
        try {
            if (orderId) {
                if (!window.__processedStockOrderIds) window.__processedStockOrderIds = new Set();
                if (window.__processedStockOrderIds.has(String(orderId))) {
                    console.warn('updateProductStock: order already processed, skipping', orderId);
                    return;
                }
                window.__processedStockOrderIds.add(String(orderId));
            }
        } catch (e) {
            console.warn('updateProductStock: idempotency guard failed', e);
        }

        // First, let productManager handle reduction (it will also attempt server-sync if implemented)
        try {
            if (typeof productManager !== 'undefined' && typeof productManager.reduceStock === 'function') {
                await productManager.reduceStock(carrito, orderId);
                console.log('✅ productManager.reduceStock completed');
            } else {
                console.warn('updateProductStock: productManager.reduceStock not available');
            }
        } catch (e) {
            console.warn('updateProductStock: productManager.reduceStock failed', e);
        }

        // Also update admin products stored in localStorage so admin view stays consistent
        try {
            const adminProducts = JSON.parse(localStorage.getItem('productos') || '[]');
            let changed = false;
            (carrito || []).forEach(item => {
                const idx = adminProducts.findIndex(p => String(p.id) === String(item.id));
                if (idx !== -1) {
                    const currentStock = Number(adminProducts[idx].stock) || 0;
                    const newStock = Math.max(0, currentStock - Number(item.cantidad));
                    if (newStock !== currentStock) {
                        adminProducts[idx].stock = newStock;
                        adminProducts[idx].fechaModificacion = new Date().toISOString();
                        changed = true;
                        console.log(`📦 Admin stock updated for ${adminProducts[idx].nombre || adminProducts[idx].id}: ${currentStock} -> ${newStock}`);
                    }
                }
            });
            if (changed) {
                localStorage.setItem('productos', JSON.stringify(adminProducts));
            }
        } catch (e) {
            console.warn('updateProductStock: failed updating admin products', e);
        }

        // Also update productInventory map (legacy) to keep consistency with other parts of UI
        try {
            const inventario = JSON.parse(localStorage.getItem('productInventory') || '{}');
            (carrito || []).forEach(item => {
                if (inventario[item.id] !== undefined) {
                    inventario[item.id] = Math.max(0, (Number(inventario[item.id]) || 0) - Number(item.cantidad));
                }
            });
            localStorage.setItem('productInventory', JSON.stringify(inventario));
        } catch (e) {
            console.warn('updateProductStock: failed updating productInventory', e);
        }

        console.log('📦 updateProductStock completed for orderId=', orderId || 'none');
    } catch (error) {
        console.error('Error actualizando stock:', error);
    }
}

// Integración con Programa de Lealtad al finalizar compra
// (agregar después de la función placeOrder o al final del archivo)

// Wrapper para otorgar puntos después de completar pedido
if (typeof window.checkoutManager !== 'undefined' && window.checkoutManager) {
    const originalPlaceOrder = window.checkoutManager.placeOrder;
    
    window.checkoutManager.placeOrder = async function() {
        const result = await originalPlaceOrder.call(this);
        
        // Si el pedido fue exitoso, otorgar puntos de lealtad
        if (result && result.success && result.order) {
            try {
                const userEmail = localStorage.getItem('userEmail');
                const totalAmount = result.order.totales?.total || 0;
                const orderId = result.order.id || result.order.numeroOrden;
                
                if (userEmail && totalAmount > 0 && typeof loyaltyManager !== 'undefined') {
                    const loyaltyResult = loyaltyManager.addPointsForPurchase(userEmail, totalAmount, orderId);
                    
                    if (loyaltyResult.success && loyaltyResult.points > 0) {
                        console.log('✅ Puntos de lealtad otorgados:', loyaltyResult);
                        
                        // Mostrar notificación de puntos ganados en pantalla completa
                        setTimeout(() => {
                            Swal.fire({
                                title: '🎉 ¡Felicidades!',
                                html: `
                                    <p class="mb-3">Se han agregado <strong style="font-size: 1.5em; color: #28a745;">${loyaltyResult.points} puntos</strong> a tu cuenta.</p>
                                    <p class="text-muted">Para revisar cuántos puntos acumulados tienes, haz clic aquí:</p>
                                `,
                                icon: 'success',
                                confirmButtonText: 'Ver mis puntos',
                                confirmButtonColor: '#28a745',
                                showCancelButton: true,
                                cancelButtonText: 'Cerrar',
                                allowOutsideClick: false
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    window.location.href = 'profile.html';
                                }
                            });
                        }, 1500);
                    }
                }
            } catch (err) {
                console.warn('No se pudieron otorgar puntos de lealtad:', err);
            }
        }
        
        return result;
    };
}

// Global singleton wrapper to ensure the invoice modal is shown only once per order
window.showInvoiceSingleton = async function(order) {
    try {
        if (!order) return;
        // If modal already open, ignore
        if (window.__invoiceModalOpen) {
            console.warn('showInvoiceSingleton: modal already open, skipping');
            return;
        }

        // If we've already shown this order's invoice in this session, skip
        try {
            if (!window.__shownInvoiceOrders) window.__shownInvoiceOrders = new Set();
            const oid = order.id || order.numeroFactura || order.numeroOrden || '';
            if (oid && window.__shownInvoiceOrders.has(String(oid))) {
                console.warn('showInvoiceSingleton: invoice for this order already shown, skipping', oid);
                return;
            }
            // mark as shown (optimistic) so concurrent callers won't re-show
            if (oid) window.__shownInvoiceOrders.add(String(oid));
        } catch (e) {
            console.warn('showInvoiceSingleton: could not manage shown set', e);
        }

        // Delegate to the actual modal function
        await showFinalInvoice(order);
    } catch (err) {
        console.error('showInvoiceSingleton error:', err);
    }
};