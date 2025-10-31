// =================== SISTEMA MEJORADO DE GEOLOCALIZACIÓN ===================

// Función para obtener ubicación del usuario (VERSION MEJORADA)
async function getLocationForCheckout() {
    try {
        console.log('🔍 Iniciando obtención de ubicación...');
        
        // Verificar si hay ubicación guardada
        const savedLocation = localStorage.getItem('userLocation');
        let currentLocation = null;
        
        if (savedLocation) {
            try {
                currentLocation = JSON.parse(savedLocation);
                console.log('💾 Ubicación guardada encontrada:', currentLocation);
            } catch (error) {
                console.error('❌ Error parsing ubicación guardada:', error);
                localStorage.removeItem('userLocation');
            }
        }
        
        if (currentLocation && currentLocation.address) {
            // Mostrar confirmación con mapa
            const confirmed = await showLocationMapConfirmation(currentLocation);
            if (confirmed === 'use_current') {
                const locationData = {
                    method: 'gps',
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    accuracy: currentLocation.accuracy,
                    address: {
                        full: currentLocation.address,
                        city: currentLocation.address.split(',')[0]?.trim() || 'Ciudad',
                        province: currentLocation.address.split(',')[1]?.trim() || 'Provincia',
                        country: 'Ecuador'
                    },
                    timestamp: currentLocation.timestamp || new Date().toISOString()
                };
                
                localStorage.setItem('userLocation', JSON.stringify(currentLocation));
                return locationData;
            } else if (confirmed === 'change_location') {
                const newLocation = await getNewLocationData();
                if (newLocation && newLocation.method === 'gps') {
                    localStorage.setItem('userLocation', JSON.stringify({
                        latitude: newLocation.latitude,
                        longitude: newLocation.longitude,
                        accuracy: newLocation.accuracy,
                        address: newLocation.address.full,
                        timestamp: newLocation.timestamp
                    }));
                }
                return newLocation;
            } else {
                return null;
            }
        } else {
            // No hay ubicación previa, solicitar nueva
            const newLocation = await getNewLocationData();
            if (newLocation && newLocation.method === 'gps') {
                localStorage.setItem('userLocation', JSON.stringify({
                    latitude: newLocation.latitude,
                    longitude: newLocation.longitude,
                    accuracy: newLocation.accuracy,
                    address: newLocation.address.full,
                    timestamp: newLocation.timestamp
                }));
            }
            return newLocation;
        }
    } catch (error) {
        console.error('💥 Error en getLocationForCheckout:', error);
        return null;
    }
}

// Función para mostrar confirmación de ubicación con mapa
async function showLocationMapConfirmation(currentLocation) {
    const mapId = 'checkout-location-map-' + Date.now();
    
    const { value: action } = await Swal.fire({
        title: 'Ubicación de Entrega',
        html: `
            <div class="text-start">
                <div class="alert alert-success mb-3">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                    <strong>Ubicación conocida:</strong><br>
                    ${currentLocation.address}
                </div>
                
                <div class="mb-3">
                    <h6 class="text-center mb-2">📍 Tu ubicación en el mapa</h6>
                    <div id="${mapId}" style="height: 300px; border-radius: 10px; border: 2px solid #007bff; background: #f8f9fa;"></div>
                </div>
                
                <div class="alert alert-info mt-3">
                    <i class="fa-solid fa-truck me-2"></i>
                    <strong>¿Esta es tu dirección de entrega?</strong><br>
                    Si es correcta, continúa con la compra. Si no, puedes cambiarla.
                </div>
            </div>
            
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
                  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
                  crossorigin=""/>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fa-solid fa-check me-2"></i>Usar esta ubicación',
        denyButtonText: '<i class="fa-solid fa-edit me-2"></i>Cambiar ubicación',
        cancelButtonText: '<i class="fa-solid fa-times me-2"></i>Cancelar compra',
        confirmButtonColor: '#28a745',
        denyButtonColor: '#17a2b8',
        cancelButtonColor: '#dc3545',
        width: '650px',
        didOpen: () => {
            if (typeof L === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                script.crossOrigin = '';
                script.onload = () => {
                    setTimeout(() => initCheckoutLocationMap(mapId, currentLocation), 100);
                };
                document.head.appendChild(script);
            } else {
                setTimeout(() => initCheckoutLocationMap(mapId, currentLocation), 100);
            }
        },
        allowOutsideClick: false
    });

    if (action === true) return 'use_current';
    if (action === false) return 'change_location';
    return null;
}

// Función para obtener nueva ubicación
async function getNewLocationData() {
    const result = await Swal.fire({
        title: 'Obtener Ubicación de Entrega',
        html: `
            <div class="text-start">
                <p class="mb-3">¿Cómo quieres proporcionar tu ubicación para el envío?</p>
                <div class="alert alert-info">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                    <strong>Opciones disponibles:</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>GPS:</strong> Detección automática y precisa</li>
                        <li><strong>Manual:</strong> Ingresar dirección manualmente</li>
                    </ul>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-location-crosshairs me-2"></i>Usar GPS',
        cancelButtonText: '<i class="fa-solid fa-edit me-2"></i>Ingresar manual',
        showDenyButton: true,
        denyButtonText: 'Cancelar compra',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#17a2b8',
        denyButtonColor: '#dc3545',
        allowOutsideClick: false
    });

    // SweetAlert returns an object with flags indicating which button was used.
    // - isConfirmed: user clicked the confirm button (Usar GPS)
    // - isDenied: user clicked the deny button (Cancelar compra)
    // - isDismissed + dismiss === Swal.DismissReason.cancel: user clicked the cancel button (Ingresar manual)
    if (result.isConfirmed) {
        return await getCurrentLocationData();
    }

    if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
        return await getManualLocationData();
    }

    // Deny or any other dismissal means cancel the whole flow
    return null;
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

        // Obtener dirección
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=es`);
            const data = await response.json();
            
            location.address = {
                full: `${data.locality || data.city || 'Ciudad'}, ${data.principalSubdivision || 'Provincia'}, ${data.countryName || 'Ecuador'}`,
                city: data.locality || data.city || 'Ciudad',
                province: data.principalSubdivision || 'Provincia',
                country: data.countryName || 'Ecuador'
            };
        } catch (error) {
            location.address = {
                full: `Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`,
                city: 'Ubicación GPS',
                province: 'Ecuador',
                country: 'Ecuador'
            };
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
                            <label class="form-label fw-bold">Teléfono de contacto *</label>
                            <input id="telefono" class="form-control" placeholder="Número de teléfono" value="${currentData.telefono || userData.telefono || ''}" required>
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
                                    <input id="numeroTarjeta" class="form-control" placeholder="1234 5678 9012 3456" maxlength="19" value="${currentData.numeroTarjeta || ''}" required>
                                    <small class="text-muted">Para pruebas: 4532123456789012 (Visa) o 5555555555554444 (Mastercard)</small>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><strong>Fecha de vencimiento *</strong></label>
                                    <input id="fechaVencimiento" class="form-control" placeholder="MM/AA" maxlength="5" value="${currentData.fechaVencimiento || ''}" required>
                                    <small class="text-muted">Ej: 12/25</small>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><strong>CVV *</strong></label>
                                    <input id="cvv" class="form-control" placeholder="123" maxlength="4" value="${currentData.cvv || ''}" required>
                                    <small class="text-muted">3-4 dígitos</small>
                                </div>
                                <div class="col-12">
                                    <label class="form-label"><strong>Nombre en la tarjeta *</strong></label>
                                    <input id="nombreTarjeta" class="form-control" placeholder="Nombre completo como aparece en la tarjeta" value="${currentData.nombreTarjeta || ''}" required>
                                </div>
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
                                    <input id="emailPaypal" class="form-control" type="email" placeholder="tu@email.com" value="${currentData.emailPaypal || ''}" required>
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
                                        <option value="">Seleccionar banco</option>
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
                                    <input id="numeroCuenta" class="form-control" placeholder="Número de cuenta bancaria" value="${currentData.numeroCuenta || ''}" required>
                                    <small class="text-muted">Cuenta corriente o de ahorros</small>
                                </div>
                                <div class="col-12">
                                    <label class="form-label"><strong>Titular de la cuenta *</strong></label>
                                    <input id="titularCuenta" class="form-control" placeholder="Nombre del titular de la cuenta" value="${currentData.titularCuenta || ''}" required>
                                    <small class="text-muted">Nombre completo como aparece en la cuenta</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-12">
                            <label class="form-label">Instrucciones especiales (opcional)</label>
                            <textarea id="comentarios" class="form-control" rows="3" placeholder="Ej: Timbre del apartamento 3B, entregar en portería, etc.">${currentData.comentarios || ''}</textarea>
                        </div>
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
                const telefono = document.getElementById('telefono').value.trim();
                const metodoPago = document.getElementById('metodoPago').value;

                if (!telefono || !metodoPago) {
                    Swal.showValidationMessage('Por favor completa el teléfono y método de pago');
                    return false;
                }

                let paymentData = {
                    telefono: telefono,
                    metodoPago: metodoPago,
                    comentarios: document.getElementById('comentarios').value.trim() || '',
                    direccion: locationData.address.full,
                    ciudad: locationData.address.city,
                    provincia: locationData.address.province,
                    ubicacionCompleta: locationData
                };

                // Validar campos específicos según método de pago
                if (metodoPago === 'tarjeta') {
                    const numeroTarjeta = document.getElementById('numeroTarjeta').value.replace(/\s/g, '');
                    const fechaVencimiento = document.getElementById('fechaVencimiento').value;
                    const cvv = document.getElementById('cvv').value;
                    const nombreTarjeta = document.getElementById('nombreTarjeta').value.trim();

                    if (!numeroTarjeta || !fechaVencimiento || !cvv || !nombreTarjeta) {
                        Swal.showValidationMessage('Por favor completa todos los campos de la tarjeta de crédito. Revisa que todos los campos estén llenos.');
                        return false;
                    }

                    // Validar formato de tarjeta
                    if (!validateCreditCard(numeroTarjeta)) {
                        Swal.showValidationMessage('Número de tarjeta inválido. Use tarjetas de prueba: 4532123456789012 (Visa) o 5555555555554444 (Mastercard)');
                        return false;
                    }

                    // Validar fecha de vencimiento
                    if (!/^\d{2}\/\d{2}$/.test(fechaVencimiento)) {
                        Swal.showValidationMessage('Formato de fecha incorrecto. Use MM/AA (ej: 12/25)');
                        return false;
                    }

                    // Validar CVV
                    if (cvv.length < 3 || cvv.length > 4 || !/^\d+$/.test(cvv)) {
                        Swal.showValidationMessage('CVV debe tener 3 o 4 dígitos numéricos');
                        return false;
                    }

                    paymentData.tarjetaInfo = {
                        numero: numeroTarjeta,
                        fechaVencimiento: fechaVencimiento,
                        cvv: cvv,
                        nombreTitular: nombreTarjeta
                    };
                } else if (metodoPago === 'paypal') {
                    const emailPaypal = document.getElementById('emailPaypal').value.trim();
                    if (!emailPaypal) {
                        Swal.showValidationMessage('Por favor ingresa tu email de PayPal');
                        return false;
                    }
                    if (!validateEmail(emailPaypal)) {
                        Swal.showValidationMessage('Email de PayPal inválido. Use formato: usuario@dominio.com');
                        return false;
                    }
                    paymentData.paypalInfo = { email: emailPaypal };
                } else if (metodoPago === 'transferencia') {
                    const banco = document.getElementById('banco').value;
                    const numeroCuenta = document.getElementById('numeroCuenta').value.trim();
                    const titularCuenta = document.getElementById('titularCuenta').value.trim();
                    if (!banco || !numeroCuenta || !titularCuenta) {
                        Swal.showValidationMessage('Por favor completa todos los datos de transferencia (banco, número de cuenta y titular)');
                        return false;
                    }
                    paymentData.transferenciaInfo = { 
                        banco: banco, 
                        numeroCuenta: numeroCuenta,
                        titularCuenta: titularCuenta 
                    };
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
        timestamp: Date.now()
    };
}

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
    const productList = order.productos.map(item => 
        `<tr>
            <td>${item.nombre}</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-end">$${item.precio.toFixed(2)}</td>
            <td class="text-end">$${item.subtotal.toFixed(2)}</td>
        </tr>`
    ).join('');

    await Swal.fire({
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
        denyButtonText: 'Volver al Inicio',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#007bff',
        denyButtonColor: '#6c757d',
        width: '800px'
    }).then((result) => {
        if (result.isConfirmed) {
            // Descargar PDF
            downloadInvoicePDF(order);
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Ver Mis Compras
            window.location.href = 'compras.html';
        } else if (result.isDenied) {
            // Volver al Inicio
            window.location.href = 'index.html';
        }
    });
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
            case error.POSITION_UNAVAILABLE:
                message = 'Información de ubicación no disponible.';
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
}

// Instanciar el checkout manager
const checkoutManager = new CheckoutManager();

// Compatibility helper: expose togglePaymentFields and setup listeners globally so Swal-generated content can use them
window.togglePaymentFields = function() {
    try {
        const metodoPagoEl = document.getElementById('metodoPago');
        if (!metodoPagoEl) return;
        const metodoPago = metodoPagoEl.value;

        const tarjetaFields = document.getElementById('tarjeta-fields');
        const paypalFields = document.getElementById('paypal-fields');
        const transferenciaFields = document.getElementById('transferencia-fields');

        if (tarjetaFields) tarjetaFields.style.display = 'none';
        if (paypalFields) paypalFields.style.display = 'none';
        if (transferenciaFields) transferenciaFields.style.display = 'none';

        if (metodoPago === 'tarjeta' && tarjetaFields) tarjetaFields.style.display = 'block';
        if (metodoPago === 'paypal' && paypalFields) paypalFields.style.display = 'block';
        if (metodoPago === 'transferencia' && transferenciaFields) transferenciaFields.style.display = 'block';
    } catch (err) {
        console.warn('togglePaymentFields error:', err);
    }
};

window.setupPaymentFieldListeners = function() {
    try {
        const numeroTarjeta = document.getElementById('numeroTarjeta');
        const fechaVencimiento = document.getElementById('fechaVencimiento');
        const cvv = document.getElementById('cvv');
        const numeroCuenta = document.getElementById('numeroCuenta');

        numeroTarjeta?.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            if (formattedValue.length <= 19) {
                e.target.value = formattedValue;
            }
        });

        fechaVencimiento?.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length >= 2) {
                value = value.substring(0,2) + '/' + value.substring(2,4);
            }
            e.target.value = value;
        });

        cvv?.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = value;
        });

        numeroCuenta?.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = value;
        });
    } catch (err) {
        console.warn('setupPaymentFieldListeners error:', err);
    }
};

// Backwards-compatibility: provide getUserOrders and showInvoice expected by compras.html
checkoutManager.getUserOrders = function() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return [];

        const userOrders = JSON.parse(localStorage.getItem(`orders_${userEmail}`) || '[]');
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]').filter(o => o.cliente && o.cliente.email === userEmail);
        const adminPedidos = JSON.parse(localStorage.getItem('pedidos') || '[]').filter(o => o.cliente && o.cliente.email === userEmail);

        const combined = [...userOrders, ...comprasHistorial, ...adminPedidos];
        const unique = combined.filter((order, index, self) => index === self.findIndex(o => (o.id || o.numeroOrden) === (order.id || order.numeroOrden)));
        return unique;
    } catch (err) {
        console.error('getUserOrders error:', err);
        return [];
    }
};

checkoutManager.showInvoice = async function(order) {
    // reuse existing showFinalInvoice for compatibility
    try {
        await showFinalInvoice(order);
    } catch (err) {
        console.error('showInvoice error:', err);
    }
};

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
            checkoutManager.currentLocation = null;
            checkoutManager.updateLocationStatusFromStorage();
            
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
    // Actualizar estado de ubicación
    setTimeout(() => {
        checkoutManager.updateLocationStatusFromStorage();
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

        // ✅ PASO 4: Obtener datos del usuario
        const userData = {
            email: localStorage.getItem('userEmail'),
            nombre: localStorage.getItem('userNombre'),
            apellido: localStorage.getItem('userApellido'),
            cedula: localStorage.getItem('userCedula'),
            telefono: localStorage.getItem('userTelefono') || ''
        };

        // ✅ PASO 5: Obtener SOLO teléfono y método de pago (ubicación ya confirmada)
        const invoiceData = await getInvoiceDataWithLocation(userData, locationData);
        if (!invoiceData) {
            console.log('❌ Usuario canceló los datos de facturación');
            return;
        }

        // ✅ PASO 6: Calcular totales
        const totals = calculateTotalsWithTax(carrito);

        // ✅ PASO 7: Mostrar confirmación final
        const confirmed = await showInvoicePreview(carrito, userData, locationData, totals, invoiceData);
        if (!confirmed) {
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
                } else {
                    // Server responded but without orderId
                    console.warn('⚠️ Server checkout did not return orderId:', res);
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
                    // Fallback local stock update
                    updateProductStock(carrito);
                }
            } catch (err) {
                console.warn('No se pudo refrescar productos desde API, actualizando localmente:', err);
                updateProductStock(carrito);
            }

            // ✅ PASO 9: Mostrar factura final
            await showFinalInvoice(order);

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
                <title>Factura - El Valle</title>
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
                    <div class="logo">EL VALLE</div>
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
                    <p>¡Gracias por tu compra en El Valle!</p>
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

// Función para actualizar stock después de una compra
function updateProductStock(productos) {
    try {
        console.log('📦 Actualizando stock de productos...');
        
        if (typeof productManager !== 'undefined') {
            productos.forEach(item => {
                // Actualizar en productManager
                const stockResult = productManager.reduceStock(item.id, item.cantidad);
                console.log(`📦 Stock actualizado para ${item.nombre}: ${stockResult.success ? 'OK' : 'ERROR'}`);
                
                if (stockResult.success) {
                    console.log(`✅ ${item.nombre}: ${stockResult.newStock} unidades restantes`);
                } else {
                    console.warn(`⚠️ Advertencia: ${stockResult.message}`);
                }
                
                // IMPORTANTE: También actualizar en los productos del admin
                updateAdminProductStock(item.id, item.cantidad);
            });
            
            productManager.saveProducts();
            console.log('✅ Stock actualizado y guardado en productManager');
            
            // Refrescar la visualización de productos si está disponible
            if (typeof window.refreshProductDisplay === 'function') {
                window.refreshProductDisplay();
                console.log('🔄 Display de productos refrescado');
            }
            
        } else {
            console.warn('⚠️ productManager no disponible');
        }
        
    } catch (error) {
        console.error('❌ Error actualizando stock:', error);
    }
}

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
function updateProductStock(carrito) {
    try {
        // Obtener inventario actual
        const inventario = JSON.parse(localStorage.getItem('productInventory') || '{}');
        
        carrito.forEach(item => {
            if (inventario[item.id]) {
                inventario[item.id] = Math.max(0, inventario[item.id] - item.cantidad);
            }
        });
        
        // Guardar inventario actualizado
        localStorage.setItem('productInventory', JSON.stringify(inventario));
        console.log('📦 Stock actualizado:', inventario);
        
    } catch (error) {
        console.error('Error actualizando stock:', error);
    }
}

// =================== FUNCIONES PARA CAMBIAR CANTIDAD CON TECLADO ===================

// Inicializar listeners para cambiar cantidad con teclado
function initializeQuantityKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        // Solo activar si hay productos en el carrito visible
        const cartItems = document.querySelectorAll('.cart-item');
        if (cartItems.length === 0) return;
        
        const activeElement = document.activeElement;
        
        // Si el foco está en un input de cantidad
        if (activeElement && activeElement.classList.contains('quantity-input')) {
            const productId = activeElement.getAttribute('data-product-id');
            
            if (event.key === 'ArrowUp' || event.key === '+') {
                event.preventDefault();
                increaseQuantity(productId);
            } else if (event.key === 'ArrowDown' || event.key === '-') {
                event.preventDefault();
                decreaseQuantity(productId);
            }
        }
        
        // Atajos globales para el carrito
        if (event.ctrlKey || event.metaKey) {
            switch(event.key) {
                case '+':
                case '=':
                    event.preventDefault();
                    // Aumentar cantidad del primer producto del carrito
                    if (cartItems.length > 0) {
                        const firstProductId = cartItems[0].getAttribute('data-product-id');
                        if (firstProductId) increaseQuantity(firstProductId);
                    }
                    break;
                case '-':
                    event.preventDefault();
                    // Disminuir cantidad del primer producto del carrito
                    if (cartItems.length > 0) {
                        const firstProductId = cartItems[0].getAttribute('data-product-id');
                        if (firstProductId) decreaseQuantity(firstProductId);
                    }
                    break;
            }
        }
    });
}

// Función para aumentar cantidad
function increaseQuantity(productId) {
    try {
        const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        const productoIndex = carrito.findIndex(item => item.id === productId);
        
        if (productoIndex !== -1) {
            carrito[productoIndex].cantidad += 1;
            localStorage.setItem("carrito", JSON.stringify(carrito));
            
            // Actualizar UI
            if (typeof actualizarCarritoUI === 'function') {
                actualizarCarritoUI();
            }
            
            // Mostrar feedback visual
            showQuantityChangeToast(carrito[productoIndex].nombre, carrito[productoIndex].cantidad, 'increase');
        }
    } catch (error) {
        console.error('Error aumentando cantidad:', error);
    }
}

// Función para disminuir cantidad
function decreaseQuantity(productId) {
    try {
        const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        const productoIndex = carrito.findIndex(item => item.id === productId);
        
        if (productoIndex !== -1) {
            if (carrito[productoIndex].cantidad > 1) {
                carrito[productoIndex].cantidad -= 1;
                localStorage.setItem("carrito", JSON.stringify(carrito));
                
                // Actualizar UI
                if (typeof actualizarCarritoUI === 'function') {
                    actualizarCarritoUI();
                }
                
                // Mostrar feedback visual
                showQuantityChangeToast(carrito[productoIndex].nombre, carrito[productoIndex].cantidad, 'decrease');
            } else {
                // Si la cantidad es 1, preguntar si quiere eliminar el producto
                Swal.fire({
                    title: '¿Eliminar producto?',
                    text: `¿Quieres eliminar "${carrito[productoIndex].nombre}" del carrito?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#dc3545'
                }).then((result) => {
                    if (result.isConfirmed) {
                        removeFromCart(productId);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error disminuyendo cantidad:', error);
    }
}

// Mostrar toast de cambio de cantidad
function showQuantityChangeToast(productName, newQuantity, action) {
    const icon = action === 'increase' ? '➕' : '➖';
    const actionText = action === 'increase' ? 'Aumentado' : 'Disminuido';
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        icon: 'success',
        title: `${icon} ${actionText}`,
        text: `${productName}: ${newQuantity} unidades`
    });
}

// Función para eliminar del carrito
function removeFromCart(productId) {
    try {
        let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        const productoIndex = carrito.findIndex(item => item.id === productId);
        
        if (productoIndex !== -1) {
            const productName = carrito[productoIndex].nombre;
            carrito.splice(productoIndex, 1);
            localStorage.setItem("carrito", JSON.stringify(carrito));
            
            // Actualizar UI
            if (typeof actualizarCarritoUI === 'function') {
                actualizarCarritoUI();
            }
            
            // Mostrar confirmación
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                icon: 'success',
                title: 'Producto eliminado',
                text: `${productName} eliminado del carrito`
            });
        }
    } catch (error) {
        console.error('Error eliminando del carrito:', error);
    }
}

// =================== INICIALIZACIÓN ===================

// Inicializar controles cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar controles de teclado para cantidad
    initializeQuantityKeyboardControls();
    
    // Mostrar instrucciones de teclado si hay productos en el carrito
    setTimeout(() => {
        const cartItems = document.querySelectorAll('.cart-item');
        if (cartItems.length > 0) {
            showKeyboardInstructions();
        }
    }, 1000);
});

// Mostrar instrucciones de uso del teclado
function showKeyboardInstructions() {
    const instructionsShown = localStorage.getItem('keyboardInstructionsShown');
    
    if (!instructionsShown) {
        Swal.fire({
            title: '⌨️ Controles de Teclado',
            html: `
                <div class="text-start">
                    <p><strong>Puedes usar el teclado para cambiar cantidades:</strong></p>
                    <ul>
                        <li><kbd>↑</kbd> o <kbd>+</kbd> - Aumentar cantidad</li>
                        <li><kbd>↓</kbd> o <kbd>-</kbd> - Disminuir cantidad</li>
                        <li><kbd>Ctrl</kbd> + <kbd>+</kbd> - Aumentar primer producto</li>
                        <li><kbd>Ctrl</kbd> + <kbd>-</kbd> - Disminuir primer producto</li>
                    </ul>
                    <p><small class="text-muted">Haz clic en el campo de cantidad y usa las teclas</small></p>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Entendido',
            showCancelButton: true,
            cancelButtonText: 'No mostrar de nuevo',
            confirmButtonColor: '#28a745'
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                localStorage.setItem('keyboardInstructionsShown', 'true');
            }
        });
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
function updateProductStock(carrito) {
    try {
        // Obtener inventario actual
        const inventario = JSON.parse(localStorage.getItem('productInventory') || '{}');
        
        carrito.forEach(item => {
            if (inventario[item.id]) {
                inventario[item.id] = Math.max(0, inventario[item.id] - item.cantidad);
            }
        });
        
        // Guardar inventario actualizado
        localStorage.setItem('productInventory', JSON.stringify(inventario));
        console.log('📦 Stock actualizado:', inventario);
        
    } catch (error) {
        console.error('Error actualizando stock:', error);
    }
}