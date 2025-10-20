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
        
        // También actualizar con ubicación guardada
        this.updateLocationStatusFromStorage();
    }
    
    // Actualizar estado de ubicación desde localStorage
    updateLocationStatusFromStorage() {
        const locationStatus = document.getElementById('locationStatus');
        if (!locationStatus) return;
        
        const savedLocation = localStorage.getItem('userLocation');
        if (savedLocation) {
            try {
                const location = JSON.parse(savedLocation);
                const timeAgo = this.getTimeAgo(location.timestamp);
                
                locationStatus.innerHTML = `
                    <div class="alert alert-info alert-sm d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fa-solid fa-map-marker-alt me-2"></i>
                            <strong>Ubicación guardada:</strong> ${location.address}
                            <br><small class="text-muted">Guardada ${timeAgo}</small>
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
    
    // Obtener tiempo transcurrido desde una fecha
    getTimeAgo(timestamp) {
        if (!timestamp) return 'hace poco';
        
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) return 'hace un momento';
        if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        return past.toLocaleDateString();
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

    // Calcular impuestos y totales
    calculateTotals(carrito) {
        const subtotal = carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
        const impuestos = subtotal * this.TAX_RATE;
        const envio = this.DELIVERY_FEE;
        const total = subtotal + impuestos + envio;

        return {
            subtotal: parseFloat(subtotal.toFixed(2)),
            impuestos: parseFloat(impuestos.toFixed(2)),
            envio: parseFloat(envio.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        };
    }

    // Procesar checkout completo
    async processCheckout() {
        try {
            // Verificar autenticación
            if (localStorage.getItem('userLoggedIn') !== 'true') {
                throw new Error('Usuario no autenticado');
            }

            // Obtener datos del carrito
            const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
            if (carrito.length === 0) {
                throw new Error('Carrito vacío');
            }

            // Obtener datos del usuario
            const userData = {
                email: localStorage.getItem('userEmail'),
                nombre: localStorage.getItem('userNombre'),
                apellido: localStorage.getItem('userApellido'),
                cedula: localStorage.getItem('userCedula'),
                telefono: localStorage.getItem('userTelefono') || ''
            };

            // Solicitar datos adicionales para la factura
            const invoiceData = await this.getInvoiceData(userData);
            
            // Actualizar ubicación si es necesario
            await this.updateLocation();

            // Generar factura
            const invoice = this.generateInvoice(carrito, invoiceData);

            // Mostrar resumen y confirmar
            const confirmed = await this.showCheckoutSummary(invoice);
            
            if (confirmed) {
                // Procesar pedido
                const order = await this.createOrder(invoice);
                
                // Mostrar factura final
                await this.showInvoice(order);
                
                // Limpiar carrito
                localStorage.removeItem("carrito");
                
                // Notificar éxito
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('El Valle', {
                        body: `Pedido #${order.id} procesado exitosamente`,
                        icon: './static/img/logo.png'
                    });
                }

                return order;
            }

        } catch (error) {
            console.error('Error en checkout:', error);
            Swal.fire({
                title: 'Error en el checkout',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'OK'
            });
            throw error;
        }
    }

    // Obtener datos adicionales para la factura (simplificado cuando hay ubicación)
    async getInvoiceData(userData, locationData = null) {
        // Si tenemos datos de ubicación del nuevo sistema, usarlos
        if (locationData) {
            const { value: formData } = await Swal.fire({
                title: 'Confirmar Datos de Entrega',
                html: `
                    <div class="container-fluid">
                        <div class="row g-3">
                            <div class="col-12 mb-3">
                                <div class="alert alert-success">
                                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                                    <strong>Dirección de entrega confirmada:</strong><br>
                                    ${locationData.address.full}
                                    ${locationData.method === 'gps' ? `<br><small class="text-muted">Ubicación GPS detectada automáticamente</small>` : ''}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Teléfono de contacto</label>
                                <input id="telefono" class="form-control" placeholder="Teléfono" value="${userData.telefono || ''}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-bold">Método de pago</label>
                                <select id="metodoPago" class="form-select" required>
                                    <option value="">Seleccionar método</option>
                                    <option value="efectivo">Efectivo (Pago contra entrega)</option>
                                    <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                                    <option value="transferencia">Transferencia Bancaria</option>
                                    <option value="paypal">PayPal</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label">Comentarios adicionales (opcional)</label>
                                <textarea id="comentarios" class="form-control" rows="3" placeholder="Instrucciones especiales de entrega, referencias, etc."></textarea>
                            </div>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Continuar con el pedido',
                cancelButtonText: 'Cancelar',
                width: '600px',
                preConfirm: () => {
                    const telefono = document.getElementById('telefono').value;
                    const metodoPago = document.getElementById('metodoPago').value;

                    if (!telefono || !metodoPago) {
                        Swal.showValidationMessage('Por favor completa todos los campos obligatorios');
                        return false;
                    }

                    return {
                        // Usar datos de ubicación ya obtenidos
                        direccion: locationData.address.full,
                        ciudad: locationData.address.city,
                        provincia: locationData.address.province,
                        codigoPostal: '',
                        telefono: telefono,
                        metodoPago: metodoPago,
                        comentarios: document.getElementById('comentarios').value || '',
                        ubicacionActual: locationData
                    };
                }
            });

            if (!formData) {
                throw new Error('Checkout cancelado por el usuario');
            }

            return formData;
        }

        // Fallback: Sistema anterior para compatibilidad (si no hay locationData)
        const locationInfo = this.currentLocation ? 
            `<div class="col-12 mb-3">
                <div class="alert alert-info">
                    <i class="fa-solid fa-map-marker-alt me-2"></i>
                    <strong>Ubicación actual:</strong> ${this.currentLocation.address || 'Coordenadas detectadas'}
                </div>
            </div>` : '';

        const { value: formData } = await Swal.fire({
            title: 'Datos de Facturación y Entrega',
            html: `
                <div class="container-fluid">
                    <div class="row g-3">
                        ${locationInfo}
                        <div class="col-12">
                            <label class="form-label fw-bold">Dirección de entrega</label>
                            <input id="direccion" class="form-control" placeholder="Dirección completa (Calle, número, etc.)" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Ciudad</label>
                            <input id="ciudad" class="form-control" placeholder="Ciudad" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Código Postal</label>
                            <input id="codigoPostal" class="form-control" placeholder="Código postal" type="number">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Provincia</label>
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
                                <option value="Santo Domingo">Santo Domingo de los Tsáchilas</option>
                                <option value="Otra">Otra</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Teléfono de contacto</label>
                            <input id="telefono" class="form-control" placeholder="Teléfono" value="${userData.telefono || ''}" required>
                        </div>
                        <div class="col-12">
                            <label class="form-label fw-bold">Método de pago</label>
                            <select id="metodoPago" class="form-select" required>
                                <option value="">Seleccionar método</option>
                                <option value="efectivo">Efectivo (Pago contra entrega)</option>
                                <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                                <option value="paypal">PayPal</option>
                            </select>
                        </div>
                        <div class="col-12">
                            <label class="form-label">Comentarios adicionales (opcional)</label>
                            <textarea id="comentarios" class="form-control" rows="3" placeholder="Instrucciones especiales de entrega, referencias, etc."></textarea>
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Continuar con el pedido',
            cancelButtonText: 'Cancelar',
            width: '600px',
            preConfirm: () => {
                const direccion = document.getElementById('direccion').value;
                const ciudad = document.getElementById('ciudad').value;
                const provincia = document.getElementById('provincia').value;
                const telefono = document.getElementById('telefono').value;
                const metodoPago = document.getElementById('metodoPago').value;

                if (!direccion || !ciudad || !provincia || !telefono || !metodoPago) {
                    Swal.showValidationMessage('Por favor completa todos los campos obligatorios');
                    return false;
                }

                return {
                    direccion: direccion,
                    ciudad: ciudad,
                    provincia: provincia,
                    codigoPostal: document.getElementById('codigoPostal').value || '',
                    telefono: telefono,
                    metodoPago: metodoPago,
                    comentarios: document.getElementById('comentarios').value || '',
                    ubicacionActual: this.currentLocation
                };
            }
        });

        if (!formData) {
            throw new Error('Checkout cancelado por el usuario');
        }

        return formData;
    }

    // Generar factura con impuestos
    generateInvoice(carrito, invoiceData) {
        const totals = this.calculateTotals(carrito);
        
        return {
            id: 'INV-' + Date.now(),
            fecha: new Date().toISOString(),
            cliente: {
                nombre: localStorage.getItem('userNombre'),
                apellido: localStorage.getItem('userApellido'),
                email: localStorage.getItem('userEmail'),
                cedula: localStorage.getItem('userCedula'),
                telefono: invoiceData.telefono
            },
            entrega: {
                direccion: invoiceData.direccion,
                ciudad: invoiceData.ciudad,
                provincia: invoiceData.provincia,
                codigoPostal: invoiceData.codigoPostal,
                comentarios: invoiceData.comentarios,
                ubicacion: invoiceData.ubicacionActual
            },
            pago: {
                metodo: invoiceData.metodoPago
            },
            productos: carrito.map(item => ({
                ...item,
                subtotal: item.precio * item.cantidad
            })),
            totales: totals
        };
    }

    // Mostrar resumen del checkout
    async showCheckoutSummary(invoice) {
        const productosHtml = invoice.productos.map(item => `
            <tr>
                <td>${item.nombre}</td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-end">$${item.precio.toFixed(2)}</td>
                <td class="text-end">$${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const locationHtml = invoice.entrega.ubicacion ? `
            <tr>
                <td><strong>Ubicación GPS:</strong></td>
                <td colspan="3">${invoice.entrega.ubicacion.address || 'Coordenadas detectadas'}</td>
            </tr>
        ` : '';

        const result = await Swal.fire({
            title: 'Confirmar Pedido',
            html: `
                <div class="text-start">
                    <h6 class="border-bottom pb-2 mb-3">Datos del Cliente</h6>
                    <p class="mb-1"><strong>Nombre:</strong> ${invoice.cliente.nombre} ${invoice.cliente.apellido}</p>
                    <p class="mb-1"><strong>Email:</strong> ${invoice.cliente.email}</p>
                    <p class="mb-3"><strong>Teléfono:</strong> ${invoice.cliente.telefono}</p>
                    
                    <h6 class="border-bottom pb-2 mb-3">Dirección de Entrega</h6>
                    <p class="mb-1"><strong>Dirección:</strong> ${invoice.entrega.direccion}</p>
                    <p class="mb-1"><strong>Ciudad:</strong> ${invoice.entrega.ciudad}, ${invoice.entrega.provincia}</p>
                    ${invoice.entrega.codigoPostal ? `<p class="mb-1"><strong>Código Postal:</strong> ${invoice.entrega.codigoPostal}</p>` : ''}
                    ${invoice.entrega.comentarios ? `<p class="mb-3"><strong>Comentarios:</strong> ${invoice.entrega.comentarios}</p>` : '<div class="mb-3"></div>'}
                    
                    <h6 class="border-bottom pb-2 mb-3">Productos</h6>
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
                            ${productosHtml}
                            ${locationHtml}
                        </tbody>
                    </table>
                    
                    <div class="border-top pt-3">
                        <div class="row">
                            <div class="col-6"><strong>Subtotal:</strong></div>
                            <div class="col-6 text-end">$${invoice.totales.subtotal.toFixed(2)}</div>
                        </div>
                        <div class="row">
                            <div class="col-6"><strong>IVA (15%):</strong></div>
                            <div class="col-6 text-end">$${invoice.totales.impuestos.toFixed(2)}</div>
                        </div>
                        <div class="row">
                            <div class="col-6"><strong>Envío:</strong></div>
                            <div class="col-6 text-end">$${invoice.totales.envio.toFixed(2)}</div>
                        </div>
                        <div class="row border-top pt-2">
                            <div class="col-6"><strong>TOTAL:</strong></div>
                            <div class="col-6 text-end"><strong>$${invoice.totales.total.toFixed(2)}</strong></div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-12">
                                <small class="text-muted">Método de pago: ${this.getPaymentMethodName(invoice.pago.metodo)}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Pedido',
            cancelButtonText: 'Modificar',
            confirmButtonColor: '#28a745',
            width: '700px'
        });

        return result.isConfirmed;
    }

    // Obtener nombre del método de pago
    getPaymentMethodName(metodo) {
        const metodos = {
            'efectivo': 'Efectivo (Pago contra entrega)',
            'tarjeta': 'Tarjeta de Crédito/Débito',
            'tarjeta_credito': 'Tarjeta de Crédito',
            'tarjeta_debito': 'Tarjeta de Débito',
            'transferencia': 'Transferencia Bancaria',
            'paypal': 'PayPal',
            'bitcoin': 'Bitcoin',
            'efectivo_local': 'Efectivo (Retiro en tienda)'
        };
        return metodos[metodo] || metodo;
    }

    // Crear orden
    async createOrder(invoice) {
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 1500));

        const order = {
            ...invoice,
            estado: 'procesando',
            numeroOrden: 'ORD-' + Date.now(),
            fechaProcesamiento: new Date().toISOString(),
            tiempoEntregaEstimado: this.calculateDeliveryTime()
        };

        // Actualizar stock de productos
        this.updateProductStock(invoice.productos);

        // Guardar en historial de compras
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        comprasHistorial.unshift(order);
        localStorage.setItem('comprasHistorial', JSON.stringify(comprasHistorial));

        return order;
    }

    // Actualizar stock de productos después de la compra
    updateProductStock(productos) {
        try {
            // Actualizar stock en productos del admin
            const adminProducts = JSON.parse(localStorage.getItem('productos') || '[]');
            let stockUpdated = false;

            productos.forEach(item => {
                const productIndex = adminProducts.findIndex(p => p.id.toString() === item.id.toString());
                if (productIndex !== -1) {
                    const newStock = Math.max(0, (adminProducts[productIndex].stock || 0) - item.cantidad);
                    adminProducts[productIndex].stock = newStock;
                    stockUpdated = true;
                    
                    console.log(`📦 Stock actualizado para ${item.nombre}: ${adminProducts[productIndex].stock + item.cantidad} → ${newStock}`);
                }
            });

            if (stockUpdated) {
                // Guardar productos del admin actualizados
                localStorage.setItem('productos', JSON.stringify(adminProducts));
                
                // Sincronizar con productManager si existe
                if (typeof productManager !== 'undefined') {
                    productManager.syncWithAdminProducts();
                }
                
                console.log('✅ Stock actualizado correctamente');
            }
        } catch (error) {
            console.error('Error actualizando stock:', error);
        }
    }

    // Calcular tiempo de entrega estimado
    calculateDeliveryTime() {
        const now = new Date();
        const deliveryDate = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 días
        return deliveryDate.toISOString();
    }

    // Mostrar factura final
    async showInvoice(order) {
        const productosHtml = order.productos.map(item => `
            <tr>
                <td>${item.nombre}</td>
                <td class="text-center">${item.cantidad}</td>
                <td class="text-end">$${item.precio.toFixed(2)}</td>
                <td class="text-end">$${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const locationInfo = order.entrega.metodo === 'gps' ? 
            `<div class="alert alert-success">
                <i class="fa-solid fa-satellite-dish me-2"></i>
                <strong>Ubicación GPS confirmada</strong><br>
                ${order.entrega.direccion}
                ${order.entrega.coordenadas ? `<br><small>Lat: ${order.entrega.coordenadas.lat.toFixed(6)}, Lng: ${order.entrega.coordenadas.lng.toFixed(6)}</small>` : ''}
            </div>` :
            `<div class="alert alert-primary">
                <i class="fa-solid fa-home me-2"></i>
                <strong>Dirección de entrega:</strong><br>
                ${order.entrega.direccion}
                ${order.entrega.instrucciones ? `<br><small>Instrucciones: ${order.entrega.instrucciones}</small>` : ''}
            </div>`;

        await Swal.fire({
            title: '¡Compra Realizada con Éxito!',
            html: `
                <div class="text-start">
                    <div class="alert alert-success text-center mb-4">
                        <i class="fa-solid fa-check-circle fa-3x text-success mb-2"></i>
                        <h5 class="mb-1">Pedido #${order.id}</h5>
                        <p class="mb-0">Factura #${order.numeroFactura}</p>
                        <small class="text-muted">Procesado el ${new Date(order.fecha).toLocaleString('es-EC')}</small>
                    </div>
                    
                    <h6 class="border-bottom pb-2 mb-3">🚚 Información de Entrega</h6>
                    ${locationInfo}
                    <p><strong>📅 Fecha estimada de entrega:</strong> ${new Date(order.entrega.fechaEstimada).toLocaleDateString('es-EC')}</p>
                    
                    <h6 class="border-bottom pb-2 mb-3">💳 Método de Pago</h6>
                    <div class="alert alert-light">
                        <strong>${order.pago?.metodoPagoNombre || getPaymentMethodName(order.pago?.metodo)}</strong>
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
                            ${productosHtml}
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
                        <i class="fa-solid fa-info-circle me-2"></i>
                        <strong>📞 ¿Qué sigue?</strong><br>
                        • Recibirás un email de confirmación<br>
                        • Te contactaremos al ${order.cliente.telefono} para coordinar la entrega<br>
                        • Puedes ver tu pedido en "Mis Compras"
                    </div>
                </div>
            `,
            confirmButtonText: '<i class="fa-solid fa-shopping-bag me-2"></i>Ver Mis Compras',
            showCancelButton: true,
            cancelButtonText: '<i class="fa-solid fa-home me-2"></i>Volver al Inicio',
            confirmButtonColor: '#007bff',
            cancelButtonColor: '#6c757d',
            width: '800px'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'compras.html';
            } else {
                window.location.href = 'index.html';
            }
        });

        // Mostrar notificación del navegador
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('El Valle - Compra Exitosa', {
                body: `Tu pedido #${order.id} ha sido procesado exitosamente`,
                icon: './static/img/logo.png'
            });
        }
    }
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

// Función global para obtener el nombre del método de pago
window.getPaymentMethodName = function(metodo) {
    switch (metodo) {
        case 'efectivo': return 'Efectivo';
        case 'tarjeta': return 'Tarjeta de Crédito/Débito';
        case 'transferencia': return 'Transferencia Bancaria';
        case 'paypal': return 'PayPal';
        case 'crypto': return 'Criptomoneda';
        default: return 'Método desconocido';
    }
};

// DEBUG: Simple test function
window.testCheckout = function() {
    console.log('🧪 Testing checkout system...');
    console.log('User logged in:', localStorage.getItem('userLoggedIn'));
    console.log('Cart items:', JSON.parse(localStorage.getItem('carrito') || '[]'));
    console.log('enviarCarrito function:', typeof window.enviarCarrito);
    
    if (typeof window.enviarCarrito === 'function') {
        console.log('✅ enviarCarrito is available, calling it...');
        return window.enviarCarrito();
    } else {
        console.error('❌ enviarCarrito function not found');
        alert('enviarCarrito function not found');
    }
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
