import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import Swal from 'sweetalert2';
import './Checkout.css';

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Estándar: Entrega en ~4 horas', price: 1.00 },
  { id: 'express', label: 'Express: Entrega en ~10 minutos', price: 2.00 },
  { id: 'pickup', label: 'Recoger en tienda', price: 0 }
];

const Checkout = () => {
  const { items, subtotal, discount, coupon, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // State
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    direccion: '',
    ciudad: '',
    telefono: '',
    metodoPago: '',
    numeroTarjeta: '',
    fechaVencimiento: '',
    cvv: '',
    emailPaypal: '',
    banco: '',
    numeroCuenta: '',
    titularCuenta: '',
    shippingMethod: 'standard',
    membresia: '',
    pointsToRedeem: 0
  });

  // Computed values
  const shippingCost = SHIPPING_OPTIONS.find(s => s.id === formData.shippingMethod)?.price || 0;
  const iva = subtotal * 0.15;
  const finalTotal = subtotal + iva + shippingCost - discount;

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        telefono: user.telefono || user.phone || ''
      }));
    }
  }, [user]);

  // Initialize map when location is set
  useEffect(() => {
    if (locationData && showMap && mapRef.current && !mapInstanceRef.current) {
      loadLeafletAndInitMap();
    }
  }, [locationData, showMap]);

  const loadLeafletAndInitMap = async () => {
    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }
  };

  const initMap = () => {
    if (!mapRef.current || !locationData || mapInstanceRef.current) return;

    const { latitude, longitude, accuracy } = locationData;
    const L = window.L;

    const map = L.map(mapRef.current).setView([latitude, longitude], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add marker
    const marker = L.marker([latitude, longitude]).addTo(map);
    marker.bindPopup(`<b>📦 Punto de Entrega</b><br>${locationData.address?.full || 'Tu ubicación'}`).openPopup();

    // Add accuracy circle
    if (accuracy) {
      L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.1
      }).addTo(map);
    }

    mapInstanceRef.current = map;
  };

  // GPS Location
  const handleGetLocation = async () => {
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
      await getGPSLocation();
    } else if (choice.isDenied) {
      // Show manual form - just expand the manual inputs
      setShowMap(false);
      setLocationData(null);
    }
  };

  const getGPSLocation = async () => {
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
        address: {
          full: `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`,
          city: 'Ubicación GPS',
          province: 'Ecuador'
        }
      };

      // Reverse geocode
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=es`
        );
        const data = await response.json();
        location.address = {
          full: `${data.locality || data.city || 'Ciudad'}, ${data.principalSubdivision || 'Provincia'}, ${data.countryName || 'Ecuador'}`,
          city: data.locality || data.city || 'Ciudad',
          province: data.principalSubdivision || 'Provincia'
        };
      } catch (e) {
        console.warn('Reverse geocode failed:', e);
      }

      Swal.close();

      // Confirm location
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

      if (confirmed.isConfirmed) {
        setLocationData(location);
        setFormData(prev => ({
          ...prev,
          direccion: location.address.full,
          ciudad: location.address.city
        }));
        setShowMap(true);
      }

    } catch (error) {
      Swal.fire({
        title: 'Error de ubicación',
        text: 'No se pudo obtener tu ubicación. Por favor ingresa la dirección manualmente.',
        icon: 'warning'
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const canProceedToStep2 = () => {
    return formData.direccion.trim() !== '';
  };

  const canProceedToStep3 = () => {
    if (!formData.telefono || formData.telefono.replace(/\D/g, '').length !== 10) return false;
    if (!formData.metodoPago) return false;

    if (formData.metodoPago === 'tarjeta') {
      if (!formData.numeroTarjeta || !formData.fechaVencimiento || !formData.cvv) return false;
    }
    if (formData.metodoPago === 'paypal') {
      if (!formData.emailPaypal) return false;
    }
    if (formData.metodoPago === 'transferencia') {
      if (!formData.banco || !formData.numeroCuenta || !formData.titularCuenta) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    setLoading(true);

    try {
      const orderData = {
        items: items.map(item => ({
          productId: item.productId || item._id,
          nombre: item.nombre || item.name,
          precio: item.precio || item.price,
          quantity: item.quantity
        })),
        subtotal,
        iva,
        envio: shippingCost,
        discount,
        total: finalTotal,
        coupon: coupon?.code,
        direccion: formData.direccion,
        ciudad: formData.ciudad || locationData?.address?.city,
        telefono: formData.telefono,
        metodoPago: formData.metodoPago,
        tipoEnvio: formData.shippingMethod,
        membresia: formData.membresia,
        location: locationData,
        // Add userId and estado confirmado
        userId: user?._id || user?.id,
        estado: 'confirmado',
        cliente: {
          email: user?.email,
          nombre: user?.nombre || user?.name,
          apellido: user?.apellido || ''
        }
      };

      const response = await ordersAPI.create(orderData);
      const orderId = response.data?.orderId || response.data?._id || `ORD-${Date.now()}`;

      // Store order for PDF
      const orderForPDF = { orderId, items: [...items], totals: { subtotal, iva, envio: shippingCost, total: finalTotal }, formData: {...formData} };

      await clearCart();

      // Show success modal
      const result = await Swal.fire({
        title: '¡Compra Realizada con Éxito!',
        html: `
          <div class="success-order-modal">
            <div class="order-header bg-light p-3 rounded mb-3">
              <div class="text-success mb-2">
                <i class="fas fa-check-circle fa-3x"></i>
              </div>
              <h5>Pedido #${orderId}</h5>
              <small class="text-muted">Procesado el ${new Date().toLocaleString()}</small>
            </div>

            <div class="order-summary text-start">
              <h6><i class="fas fa-receipt me-2"></i>Resumen de la Compra</h6>
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderForPDF.items.map(item => `
                    <tr>
                      <td>${item.nombre || item.name}</td>
                      <td>${item.quantity}</td>
                      <td>$${(item.precio || item.price).toFixed(2)}</td>
                      <td>$${((item.precio || item.price) * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="d-flex justify-content-between">
                  <span>Subtotal:</span>
                  <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span>IVA (15%):</span>
                  <span>$${iva.toFixed(2)}</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Envío:</span>
                  <span>$${shippingCost.toFixed(2)}</span>
                </div>
                <hr>
                <div class="d-flex justify-content-between fw-bold fs-5">
                  <span>TOTAL PAGADO:</span>
                  <span class="text-success">$${finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div class="alert alert-info mt-3 small">
                <i class="fas fa-phone me-2"></i>
                <strong>¿Qué sigue?</strong><br>
                • Te contactaremos al ${formData.telefono} para coordinar la entrega<br>
                • Puedes ver tu pedido en "Mis Compras"
              </div>
            </div>
          </div>
        `,
        width: 600,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-download me-2"></i>Descargar PDF',
        denyButtonText: 'Ir a productos',
        cancelButtonText: 'Ver Mis Compras',
        confirmButtonColor: '#28a745',
        denyButtonColor: '#6c757d',
        cancelButtonColor: '#0d6efd'
      });

      if (result.isConfirmed) {
        generateAndDownloadPDF(orderId, orderForPDF.items, orderForPDF.totals);
        navigate('/compras');
      } else if (result.isDenied) {
        navigate('/products');
      } else {
        navigate('/compras');
      }

    } catch (error) {
      console.error('Error procesando orden:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo procesar tu pedido. Intenta nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAndDownloadPDF = (orderId, orderItems, totals) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${orderId}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #8B4513; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #8B4513; color: white; }
          .totals { margin-top: 20px; text-align: right; }
          .total-final { font-size: 1.2em; font-weight: bold; color: #28a745; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Tatylu - Factura</h1>
          <p>Pedido: ${orderId}</p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${orderItems.map(item => `
              <tr>
                <td>${item.nombre || item.name}</td>
                <td>${item.quantity}</td>
                <td>$${(item.precio || item.price).toFixed(2)}</td>
                <td>$${((item.precio || item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>Subtotal: $${totals.subtotal.toFixed(2)}</p>
          <p>IVA (15%): $${totals.iva.toFixed(2)}</p>
          <p>Envío: $${totals.envio.toFixed(2)}</p>
          <p class="total-final">TOTAL: $${totals.total.toFixed(2)}</p>
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <main className="container-fluid py-4">
      <div className="row">
        {/* Left Column - Accordion */}
        <div className="col-12 col-lg-7">
          <div className="card p-3 mb-3">
            <h4>Checkout</h4>
            <div className="accordion" id="checkoutAccordion">
              
              {/* Step 1: Dirección de Entrega */}
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button 
                    className={`accordion-button ${activeStep !== 1 ? 'collapsed' : ''}`}
                    type="button"
                    onClick={() => setActiveStep(1)}
                  >
                    1. Dirección de Entrega
                  </button>
                </h2>
                <div className={`accordion-collapse collapse ${activeStep === 1 ? 'show' : ''}`}>
                  <div className="accordion-body">
                    {/* Map Container */}
                    <div className="mb-3">
                      <div 
                        ref={mapRef}
                        id="checkout-map" 
                        className="checkout-map"
                        style={{ 
                          height: showMap && locationData ? '300px' : '150px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}
                      >
                        {!showMap && (
                          <div className="text-muted text-center">
                            <i className="fas fa-map-marker-alt fa-2x mb-2"></i>
                            <p>Mapa (ubicación GPS aparecerá aquí)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address Input */}
                    <div className="mb-3">
                      <label className="form-label">Dirección</label>
                      <input
                        type="text"
                        className="form-control"
                        name="direccion"
                        value={formData.direccion}
                        onChange={handleChange}
                        placeholder="Calle principal, número, referencias"
                      />
                    </div>

                    <div className="d-flex gap-2">
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleGetLocation}
                      >
                        {locationData ? 'Cambiar ubicación' : 'Obtener ubicación'}
                      </button>
                      <div className="ms-auto">
                        <button 
                          type="button" 
                          className="btn btn-primary"
                          onClick={() => canProceedToStep2() && setActiveStep(2)}
                          disabled={!canProceedToStep2()}
                        >
                          Continuar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Métodos de Pago */}
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button 
                    className={`accordion-button ${activeStep !== 2 ? 'collapsed' : ''}`}
                    type="button"
                    onClick={() => canProceedToStep2() && setActiveStep(2)}
                    disabled={!canProceedToStep2()}
                  >
                    2. Métodos de Pago
                  </button>
                </h2>
                <div className={`accordion-collapse collapse ${activeStep === 2 ? 'show' : ''}`}>
                  <div className="accordion-body">
                    {/* Address Preview */}
                    <div className="alert alert-success mb-3">
                      <i className="fas fa-map-marker-alt me-2"></i>
                      <strong>✅ Dirección de entrega:</strong>
                      <div className="mt-1 small text-muted">{formData.direccion || '--'}</div>
                    </div>

                    <div className="row g-3">
                      {/* Phone */}
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Teléfono de contacto</label>
                        <input
                          type="tel"
                          className="form-control"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleChange}
                          placeholder="0999999999"
                          maxLength="10"
                        />
                      </div>

                      {/* Payment Method */}
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Método de pago *</label>
                        <select
                          className="form-select"
                          name="metodoPago"
                          value={formData.metodoPago}
                          onChange={handleChange}
                        >
                          <option value="">Seleccionar método</option>
                          <option value="efectivo">💵 Efectivo (Pago contra entrega)</option>
                          <option value="tarjeta">💳 Tarjeta de Crédito/Débito</option>
                          <option value="transferencia">🏦 Transferencia Bancaria</option>
                          <option value="paypal">🅿️ PayPal</option>
                        </select>
                      </div>

                      {/* Card Fields */}
                      {formData.metodoPago === 'tarjeta' && (
                        <div className="col-12">
                          <div className="alert alert-info">
                            <i className="fas fa-credit-card me-2"></i>
                            <strong>🔒 Información de Tarjeta</strong>
                          </div>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Número de tarjeta</label>
                              <input
                                type="text"
                                className="form-control"
                                name="numeroTarjeta"
                                value={formData.numeroTarjeta}
                                onChange={handleChange}
                                placeholder="1234 5678 9012 3456"
                                maxLength="19"
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Vencimiento</label>
                              <input
                                type="text"
                                className="form-control"
                                name="fechaVencimiento"
                                value={formData.fechaVencimiento}
                                onChange={handleChange}
                                placeholder="MM/AA"
                                maxLength="5"
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">CVV</label>
                              <input
                                type="text"
                                className="form-control"
                                name="cvv"
                                value={formData.cvv}
                                onChange={handleChange}
                                placeholder="123"
                                maxLength="4"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PayPal Fields */}
                      {formData.metodoPago === 'paypal' && (
                        <div className="col-12">
                          <div className="alert alert-info">
                            <i className="fab fa-paypal me-2"></i>
                            <strong>🔒 Información de PayPal</strong>
                          </div>
                          <div className="row">
                            <div className="col-12">
                              <label className="form-label">Email de PayPal</label>
                              <input
                                type="email"
                                className="form-control"
                                name="emailPaypal"
                                value={formData.emailPaypal}
                                onChange={handleChange}
                                placeholder="tu@email.com"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Transfer Fields */}
                      {formData.metodoPago === 'transferencia' && (
                        <div className="col-12">
                          <div className="alert alert-info">
                            <i className="fas fa-university me-2"></i>
                            <strong>🔒 Información para Transferencia</strong>
                          </div>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Banco</label>
                              <select
                                className="form-select"
                                name="banco"
                                value={formData.banco}
                                onChange={handleChange}
                              >
                                <option value="">Seleccionar banco</option>
                                <option value="pichincha">Banco Pichincha</option>
                                <option value="pacifico">Banco del Pacífico</option>
                                <option value="guayaquil">Banco de Guayaquil</option>
                                <option value="produbanco">Produbanco</option>
                                <option value="internacional">Banco Internacional</option>
                              </select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Número de cuenta</label>
                              <input
                                type="text"
                                className="form-control"
                                name="numeroCuenta"
                                value={formData.numeroCuenta}
                                onChange={handleChange}
                                placeholder="Número de cuenta"
                              />
                            </div>
                            <div className="col-12">
                              <label className="form-label">Titular de la cuenta</label>
                              <input
                                type="text"
                                className="form-control"
                                name="titularCuenta"
                                value={formData.titularCuenta}
                                onChange={handleChange}
                                placeholder="Nombre del titular"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="d-flex justify-content-end mt-3 gap-2">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setActiveStep(1)}
                      >
                        Atrás
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={() => canProceedToStep3() && setActiveStep(3)}
                        disabled={!canProceedToStep3()}
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Opciones de Envío */}
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button 
                    className={`accordion-button ${activeStep !== 3 ? 'collapsed' : ''}`}
                    type="button"
                    onClick={() => canProceedToStep3() && setActiveStep(3)}
                    disabled={!canProceedToStep3()}
                  >
                    3. Opciones de Envío
                  </button>
                </h2>
                <div className={`accordion-collapse collapse ${activeStep === 3 ? 'show' : ''}`}>
                  <div className="accordion-body">
                    {/* Shipping Options */}
                    <div className="mb-3">
                      {SHIPPING_OPTIONS.map(option => (
                        <div className="form-check mb-2" key={option.id}>
                          <input
                            className="form-check-input"
                            type="radio"
                            name="shippingMethod"
                            id={`ship-${option.id}`}
                            value={option.id}
                            checked={formData.shippingMethod === option.id}
                            onChange={handleChange}
                          />
                          <label className="form-check-label" htmlFor={`ship-${option.id}`}>
                            {option.label} {option.price > 0 ? `— $${option.price.toFixed(2)}` : ''}
                          </label>
                        </div>
                      ))}
                    </div>

                    {/* Membership */}
                    <div className="mb-3">
                      <label className="form-label">Número de membresía (opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        name="membresia"
                        value={formData.membresia}
                        onChange={handleChange}
                        placeholder="Número de membresía"
                      />
                      <small className="text-muted">Ingresa tu número de membresía para evitar recargos</small>
                    </div>

                    <div className="d-flex justify-content-end">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setActiveStep(2)}
                      >
                        Atrás
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="col-12 col-lg-5">
          <div className="card p-3 summary-card">
            <h5 className="mb-2">Resumen de la orden</h5>
            
            <div className="summary-content">
              <div className="mb-2">
                <strong>Artículos:</strong> {items.reduce((acc, item) => acc + item.quantity, 0)}
              </div>
              
              <div className="d-flex justify-content-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              
              <div className="d-flex justify-content-between">
                <span>Envío y Manejo</span>
                <span>${shippingCost.toFixed(2)}</span>
              </div>
              
              <div className="d-flex justify-content-between">
                <span>Impuesto estimado</span>
                <span>${iva.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="d-flex justify-content-between discount-line">
                  <span>Descuento</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}

              <hr className="summary-hr" />

              <div className="d-flex justify-content-between">
                <strong>Total</strong>
                <strong>${finalTotal.toFixed(2)}</strong>
              </div>
            </div>

            {/* Points Redemption */}
            <div className="mt-3">
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ingrese puntos a usar (ej: 100)"
                  name="pointsToRedeem"
                  value={formData.pointsToRedeem}
                  onChange={handleChange}
                  min="0"
                />
                <button className="btn btn-outline-secondary" type="button">
                  Aplicar puntos
                </button>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              className="btn btn-order w-100 mt-3 py-3"
              onClick={handleSubmit}
              disabled={loading || !canProceedToStep3()}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Procesando...
                </>
              ) : (
                'Confirmar pago'
              )}
            </button>

            <button
              className="btn btn-secondary w-100 mt-2"
              onClick={() => navigate('/cart')}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Checkout;
