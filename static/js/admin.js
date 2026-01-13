// Admin Panel Manager - Gestión completa con localStorage

// Helper to prefer sessionStorage token (volatile) over localStorage token.
// This avoids persisting admin tokens to localStorage while keeping compatibility.
function getAuthToken() {
    try {
        return sessionStorage.getItem('token') || localStorage.getItem('token');
    } catch (e) { return localStorage.getItem('token'); }
}
// Escape a string so it can be safely embedded inside a single-quoted JS string in an HTML attribute
function escapeJsStringSingle(v) {
    if (v === undefined || v === null) return '';
    return String(v)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Utility function to escape HTML and prevent XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

class AdminPanelManager {
    constructor() {
        this.initializeAdmin();
        this.initializeAllData();
        // in-memory caches populated from the server (do NOT persist to localStorage)
        this._productos = [];
        this._usuarios = [];
        this._pedidos = [];
        // internal counter for automatic fetchUsers retries (to avoid infinite loops)
        this._fetchUsersAttempts = 0;
        // Kick off background sync from server (non-blocking)
        try {
            // Only start loading server data immediately if admin is already logged in.
            // If not logged in yet, wait for the auth token to be set (dispatched as 'auth:token-set')
            // to avoid making unauthenticated requests that can fail and show an error to the user.
            if (this.isAdminLoggedIn()) {
                this.loadServerData();
            } else {
                window.addEventListener('auth:token-set', () => {
                    try { this.loadServerData(); } catch (e) { console.warn('Error starting server data load after token set:', e); }
                }, { once: true });
            }
        } catch (err) {
            console.warn('Error starting server data load:', err);
        }
    }

    // Attempt to fetch products and orders from the server (Atlas) and populate local cache
    async loadServerData() {
        // Products
        try {
            // Prefer the token-aware helper that already handles api client and fallbacks
            const products = await this.fetchProducts();
            if (products && products.length) {
                // keep server data in-memory
                this._productos = products;
                // TAMBIÉN actualizar localStorage para que el frontend pueda acceder
                localStorage.setItem('productos', JSON.stringify(products));
                console.log('Admin: productos cargados desde server y guardados en localStorage:', products.length);
            } else {
                console.log('Admin: no se recibieron productos desde el server');
            }
        } catch (err) {
            console.warn('No se pudo cargar productos desde server:', err);
        }

        // Orders
        try {
            const orders = await this.fetchOrders();
            if (orders && orders.length) {
                // keep server data in-memory only (do NOT persist to localStorage)
                this._pedidos = orders;
                console.log('Admin: pedidos cargados desde server (in-memory):', orders.length);

                // For orders missing cliente info but containing userId, try to populate cliente using the
                // users cache. We wait for fetchUsers() to finish so we avoid firing many per-order
                // requests (which could return 404 during initial load) and causing noisy errors.
                try {
                    await this.fetchUsers().catch(() => []);
                    const usersById = {};
                    (this._usuarios || []).forEach(u => {
                        const idVal = u._id || u.id || u.email || '';
                        if (idVal) usersById[String(idVal)] = u;
                    });

                    for (const ord of this._pedidos) {
                        try {
                            if ((!ord.cliente || Object.keys(ord.cliente).length === 0) && (ord.userId || ord.user || ord.usuario || ord.user_id)) {
                                const uid = String(ord.userId || ord.user || ord.usuario || ord.user_id);
                                const cached = usersById[uid];
                                if (cached) {
                                    ord.cliente = { nombre: cached.nombre || cached.name || `${cached.nombre || ''} ${cached.apellido || ''}`.trim(), email: cached.email || '' };
                                } else {
                                    // If not found in the cached users, fallback to showing the raw id so admin sees an identifier.
                                    ord.cliente = { nombre: uid, email: '' };
                                }
                            }
                        } catch (e) {
                            try { if (!ord.cliente || Object.keys(ord.cliente).length === 0) ord.cliente = { nombre: String(ord.userId || ord.user || ord.usuario || ord.user_id || ''), email: '' }; } catch(_){ }
                        }
                    }
                } catch (e) {
                    console.warn('Could not populate order client info from users cache:', e);
                }
            } else {
                console.log('Admin: no se recibieron pedidos desde el server');
            }
        } catch (err) {
            console.warn('No se pudo cargar pedidos desde server:', err);
        }

        // Users
        try {
            await this.fetchUsers();
        } catch (err) {
            console.warn('No se pudo cargar usuarios desde server:', err);
        }
        // Refresh UI
        try {
            this.loadDashboard();
            this.showProducts();
            this.showOrders();
        } catch (err) {
            console.warn('Error refrescando UI admin tras carga server:', err);
        }
    }

    // Verificar autenticación de administrador
    initializeAdmin() {
        if (this.isAdminLoggedIn()) {
            this.showAdminPanel();
        } else {
            this.showLoginModal();
        }
    }

    // Verificar si el admin está logueado
    isAdminLoggedIn() {
        return localStorage.getItem('adminLoggedIn') === 'true';
    }

    // Mostrar modal de login
    showLoginModal() {
        Swal.fire({
            title: 'Acceso de Administrador',
            html: `
                <input type="email" id="adminEmail" class="swal2-input" placeholder="Email de administrador">
                <input type="password" id="adminPassword" class="swal2-input" placeholder="Contraseña">
            `,
            showCancelButton: false,
            confirmButtonText: 'Iniciar Sesión',
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: async () => {
                const email = document.getElementById('adminEmail').value;
                const password = document.getElementById('adminPassword').value;
                
                if (!email || !password) {
                    Swal.showValidationMessage('Completa todos los campos');
                    return false;
                }
                
                // Attempt to create/promote admin in the backend (persist to Mongo Atlas)
                try {
                    const payload = { nombre: 'Administrador', email, password };
                    const res = await fetch('/api/create-admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        const txt = await res.text().catch(()=>null);
                        Swal.showValidationMessage('No se pudo crear el administrador: ' + (txt || res.statusText));
                        return false;
                    }

                    const body = await res.json();
                    console.log('Admin create response:', body);

                    // Persist admin state locally for UI
                    localStorage.setItem('adminLoggedIn', 'true');
                    localStorage.setItem('adminEmail', email);

                    // Attempt to obtain a JWT token by logging in immediately so admin UI actions that require
                    // Authorization (moderation endpoints) will work without additional prompts.
                    try {
                        const loginRes = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
                        if (loginRes.ok) {
                            const loginBody = await loginRes.json();
                            if (loginBody && loginBody.token) {
                                try { 
                                    sessionStorage.setItem('token', loginBody.token);
                                    // notify other parts of the app that a token is now available
                                    try { window.dispatchEvent(new Event('auth:token-set')); } catch(e) { /* ignore */ }
                                } catch(e) { console.warn('Could not set session token', e); }
                            }
                        } else {
                            console.warn('Admin login after create-admin returned', loginRes.status);
                        }
                    } catch(e) { console.warn('Error during admin auto-login:', e); }

                    return true;
                } catch (err) {
                    console.error('Error creating admin:', err);
                    Swal.showValidationMessage('Error conectando con el servidor: ' + (err.message || err));
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.showAdminPanel();
                // After a successful admin creation/login, ensure server data is loaded now that we have a token.
                try { this.loadServerData(); } catch (e) { console.warn('Error loading server data after login:', e); }
            }
        });
    }

    // Mostrar panel de admin
    showAdminPanel() {
        // Panel ya está visible, solo cargar dashboard
        this.loadDashboard();
    }

    // Logout de administrador
    logout() {
        Swal.fire({
            title: '¿Cerrar sesión?',
            text: 'Se cerrará la sesión de administrador',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar sesión',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('adminLoggedIn');
                localStorage.removeItem('adminEmail');
                window.location.href = 'index.html';
            }
        });
    }

    // Inicializar datos de ejemplo
    initializeAllData() {
        this.initializeProducts();
        this.initializeUsers();
        this.initializeOrders();
    }

    // Inicializar productos si no existen
    initializeProducts() {
        // Do NOT seed or persist products locally. Admin data must come from the server (MongoDB).
        // Keep in-memory array empty until the server populates it via loadServerData().
        this._productos = this._productos || [];
    }

    // Inicializar usuarios de ejemplo
    initializeUsers() {
        // Admin users must come from the server; do not seed local users here.
        this._usuarios = this._usuarios || [];
    }

    // Inicializar pedidos de ejemplo
    initializeOrders() {
        // Do not seed or persist orders locally. Use server data.
        this._pedidos = this._pedidos || [];
    }

    // Cargar dashboard con estadísticas
    loadDashboard() {
        const productos = this.getProducts();
        const usuarios = this.getUsers();
        const pedidos = this.getOrders();

        // Actualizar contadores
        document.getElementById('totalProducts').textContent = productos.length;
        document.getElementById('totalUsers').textContent = usuarios.length;
        document.getElementById('totalOrders').textContent = pedidos.length;
        
        // Calcular ventas totales
        const totalSales = pedidos.reduce((sum, order) => sum + (order.totales?.total || 0), 0);
        document.getElementById('totalSales').textContent = `$${totalSales.toFixed(2)}`;
        
        // Verificar stock bajo y mostrar alertas
        this.checkLowStock();
        
        // Cargar pedidos recientes
        this.loadRecentOrders();
        this.loadTopProducts();
    }

    // Verificar productos con stock bajo
    checkLowStock() {
        const productos = this.getProducts();
        const lowStockProducts = productos.filter(product => {
            const stock = Number(product.stock) || 0;
            return stock > 0 && stock <= 5;
        });
        
        if (lowStockProducts.length > 0) {
            const lowStockList = lowStockProducts.map(product => {
                const stock = Number(product.stock) || 0;
                return `<li><strong>${escapeHtml(product.nombre)}</strong>: ${stock} unidades</li>`;
            }).join('');
            
            Swal.fire({
                title: '⚠️ Alerta de Stock Bajo',
                html: `
                    <div class="text-start">
                        <p>Los siguientes productos tienen stock bajo (5 o menos unidades):</p>
                        <ul>${lowStockList}</ul>
                        <p><small class="text-muted">Se recomienda reabastecer estos productos.</small></p>
                    </div>
                `,
                icon: 'warning',
                confirmButtonText: 'Entendido',
                toast: false,
                position: 'center'
            });
        }
    }
    
    // Cargar pedidos recientes
    loadRecentOrders() {
        const pedidos = this.getOrders().slice(0, 5);
        const container = document.getElementById('recentOrders');
        
        if (pedidos.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay pedidos recientes</p>';
            return;
        }
        
        container.innerHTML = pedidos.map(order => `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                    <strong>#${order.id || order.numeroOrden}</strong><br>
                    <small class="text-muted">${order.cliente?.nombre || 'N/A'}</small>
                </div>
                <div class="text-end">
                    <strong>$${order.totales?.total?.toFixed(2) || '0.00'}</strong><br>
                    <span class="badge bg-${this.getStatusColor(order.estado)}">${order.estado || 'pendiente'}</span>
                </div>
            </div>
        `).join('');
    }

    // Cargar productos más vendidos
    loadTopProducts() {
        const container = document.getElementById('topProducts');
        try {
            const productos = this.getProducts() || [];
            if (!productos || productos.length === 0) {
                container.innerHTML = '<div class="text-muted">No hay productos disponibles</div>';
                return;
            }

            // Build a map of productId -> sold count by aggregating in-memory orders (this._pedidos)
            const salesMap = {};
            try {
                const orders = this._pedidos || [];
                orders.forEach(order => {
                    const items = order.productos || order.items || [];
                    items.forEach(item => {
                        const id = String(item.id || item.productId || '');
                        const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                        salesMap[id] = (salesMap[id] || 0) + qty;
                    });
                });
            } catch (e) {
                console.warn('Error building sales map:', e);
            }

            // Merge product list with sales counts; prefer explicit sold field if present
            const scored = productos.map(p => {
                const id = String(p.id || '');
                const sold = Number(p.sold || p.ventas || salesMap[id] || 0);
                return { ...p, sold };
            });

            const top = scored.slice().sort((a,b) => b.sold - a.sold).slice(0,5);
            if (top.length === 0 || top.every(t => t.sold === 0)) {
                container.innerHTML = '<div class="text-muted">Sin datos de ventas aún</div>';
                return;
            }

            container.innerHTML = top.map(t => `
                <div class="d-flex justify-content-between align-items-center py-2">
                    <div>${escapeHtml(t.nombre || 'Producto')}</div>
                    <span class="badge bg-primary">${t.sold} ventas</span>
                </div>
            `).join('');
        } catch (err) {
            console.warn('loadTopProducts error:', err);
            container.innerHTML = '<div class="text-muted">No se pudo cargar top de productos</div>';
        }
    }

    // Obtener color del estado
    getStatusColor(estado) {
        switch(estado) {
            case 'confirmado': return 'success';
            case 'enviado': return 'info';
            case 'entregado': return 'success';
            case 'cancelado': return 'danger';
            case 'preparando': return 'warning';
            case 'pendiente': return 'secondary';
            default: return 'secondary';
        }
    }

    // === GESTIÓN DE PRODUCTOS ===
    
    // Mostrar productos
    showProducts() {
        const productos = this.getProducts();
        const tbody = document.getElementById('productsTable');
        
        tbody.innerHTML = productos.map(producto => {
            const stock = Number(producto.stock) || 0;
            const stockBadgeClass = stock === 0 ? 'bg-danger' : 
                                   stock <= 5 ? 'bg-danger' : 
                                   stock <= 10 ? 'bg-warning' : 
                                   'bg-success';
            
            return `
                <tr>
                    <td>${escapeHtml(producto.id)}</td>
                    <td>
                        <img src="${escapeHtml(producto.imagen)}" alt="${escapeHtml(producto.nombre)}" 
                             style="width: 50px; height: 50px; object-fit: cover;" class="rounded">
                    </td>
                    <td>${escapeHtml(producto.nombre)}</td>
                    <td>$${Number(producto.precio || 0).toFixed(2)}</td>
                    <td>${this.getCategoryName(producto.categoria)}</td>
                    <td>
                        <span class="badge ${stockBadgeClass}">
                            ${stock}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-2" data-action="edit-product" data-id="${escapeHtml(producto.id)}" title="Editar producto">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${escapeHtml(producto.id)}" title="Eliminar producto">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Obtener productos
    getProducts() {
        // Return in-memory products loaded from server. Do NOT read from localStorage.
        return this._productos || [];
    }

    // Obtener nombre de categoría
    getCategoryName(categoria) {
        const categories = {
            'cocina': 'Cocina',
            'refrigeracion': 'Refrigeración',
            'lavanderia': 'Lavandería',
            'climatizacion': 'Climatización',
            'pequenos': 'Pequeños Electrodomésticos'
        };
        return categories[categoria] || categoria;
    }

    // Agregar producto
    addProduct(productData) {
        // Persist the product to the server (Atlas). No localStorage fallback - show error if server unavailable.
        (async () => {
            Swal.fire({ title: 'Guardando producto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                // Build payload - server expects fields like nombre, precio, categoria, stock, imagen, descripcion
                const payload = {
                    nombre: productData.nombre,
                    precio: parseFloat(productData.precio),
                    categoria: productData.categoria,
                    stock: parseInt(productData.stock) || 0,
                    imagen: productData.imagen,
                    descuento: parseFloat(productData.descuento) || 0,
                    descripcion: productData.descripcion || ''
                };

                if (window.api && typeof window.api.createProduct === 'function') {
                    const created = await window.api.createProduct(payload);
                    console.log('Producto creado en server:', created);
                    // Refresh local cache from server
                    await this.loadServerData();
                } else {
                    throw new Error('API client no disponible');
                }

                Swal.fire({ title: '¡Éxito!', text: 'Producto agregado correctamente', icon: 'success', timer: 2000 });
            } catch (err) {
                console.error('Error creating product on server:', err);
                Swal.fire({ title: 'Error', text: 'No se pudo crear el producto en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
            }
        })();
    }

    // Editar producto
    editProduct(id) {
        console.log('editProduct called with ID:', id, 'Type:', typeof id);
        
        const productos = this.getProducts();
        console.log('Available products:', productos.map(p => ({ id: p.id, type: typeof p.id, name: p.nombre })));
        
        // Convertir tanto el ID buscado como los IDs de productos a string para comparación
        const idString = String(id);
        const producto = productos.find(p => String(p.id) === idString);
        
        console.log('Found product:', producto);
        
        if (!producto) {
            Swal.fire('Error', 'Producto no encontrado', 'error');
            return;
        }
        
        // Helper: sanitize strings to remove control chars that can break HTML or scripts
        const sanitize = (v) => {
            if (v === undefined || v === null) return '';
            try {
                return String(v).replace(/[\u0000-\u001F\uFFFE\uFFFF]/g, '').trim();
            } catch (e) { return '' + v; }
        };

        document.getElementById('productId').value = sanitize(producto.id);
        document.getElementById('productName').value = sanitize(producto.nombre || producto.name || '');
        document.getElementById('productPrice').value = sanitize(producto.precio ?? producto.price ?? 0);
        
        // Ensure category select contains the product's category value
        const catSelect = document.getElementById('productCategory');
        const prodCat = sanitize(producto.categoria || producto.category || '');
        if (prodCat) {
            let found = false;
            for (let i = 0; i < catSelect.options.length; i++) {
                if (String(catSelect.options[i].value) === prodCat) { 
                    found = true; 
                    break; 
                }
            }
            if (!found) {
                const opt = document.createElement('option');
                opt.value = prodCat;
                opt.textContent = prodCat;
                try { 
                    catSelect.appendChild(opt); 
                } catch(e){ 
                    catSelect.options[catSelect.options.length] = opt; 
                }
            }
            catSelect.value = prodCat;
        } else {
            catSelect.value = '';
        }

        document.getElementById('productStock').value = sanitize(producto.stock ?? producto.cant ?? 0) || 0;
        document.getElementById('productImage').value = sanitize(producto.imagen || producto.image || producto.imageUrl || '');
        document.getElementById('productDescription').value = sanitize(producto.descripcion || producto.description || '');
        // Fill discount field if present
        try {
            const discountEl = document.getElementById('productDiscount');
            if (discountEl) discountEl.value = sanitize(producto.descuento ?? producto.desc ?? producto.discount ?? 0);
        } catch (e) { /* ignore */ }
        
        console.log('Form filled with product data');
        
        // Mostrar preview de imagen si existe
        if (producto.imagen) {
            if (typeof showImagePreview === 'function') {
                showImagePreview(producto.imagen);
            }
        } else {
            if (typeof clearImagePreview === 'function') {
                clearImagePreview();
            }
        }
        
        // Cambiar título del modal
        const modalTitle = document.querySelector('#productModal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Producto';
        
        console.log('About to show modal');
        
        // Mostrar modal
        try {
            const modalEl = document.getElementById('productModal');
            if (!modalEl) {
                console.error('Modal element not found');
                Swal.fire('Error', 'No se pudo abrir el modal de edición', 'error');
                return;
            }
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            console.log('Modal shown successfully');
        } catch (e) {
            console.error('Error mostrando modal de producto:', e);
            Swal.fire('Error', 'No se pudo abrir el modal de edición. Revisa la consola para más detalles.', 'error');
        }
    }

    // Actualizar producto
    updateProduct(productData) {
        // Try to update on server first, fallback to localStorage
        (async () => {
            Swal.fire({ title: 'Actualizando producto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const id = productData.id;
                const payload = {
                    nombre: productData.nombre,
                    precio: parseFloat(productData.precio),
                    categoria: productData.categoria,
                    stock: parseInt(productData.stock) || 0,
                    imagen: productData.imagen,
                    descuento: parseFloat(productData.descuento) || 0,
                    descripcion: productData.descripcion || ''
                };

                if (window.api && typeof window.api.updateProduct === 'function') {
                    await window.api.updateProduct(id, payload);
                    await this.loadServerData();
                } else {
                    throw new Error('API client no disponible');
                }

                Swal.fire({ title: '¡Producto actualizado!', text: 'El producto ha sido actualizado correctamente', icon: 'success', timer: 2000 });
            } catch (err) {
                console.error('Error updating product on server:', err);
                Swal.fire({ title: 'Error', text: 'No se pudo actualizar el producto en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
            }
        })();
    }

    // Eliminar producto
    deleteProduct(id) {
        console.log('deleteProduct called with ID:', id);
        
        Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        }).then((result) => {
            if (result.isConfirmed) {
                (async () => {
                    Swal.fire({ 
                        title: 'Eliminando...', 
                        allowOutsideClick: false, 
                        didOpen: () => Swal.showLoading() 
                    });
                    try {
                        if (window.api && typeof window.api.deleteProduct === 'function') {
                            await window.api.deleteProduct(id);
                            // Refresh in-memory cache from server
                            await this.fetchProducts();
                            this.showProducts();
                            Swal.fire({ 
                                title: '¡Eliminado!', 
                                text: 'El producto ha sido eliminado', 
                                icon: 'success', 
                                timer: 2000,
                                showConfirmButton: false
                            });
                        } else {
                            throw new Error('API client no disponible');
                        }
                    } catch (err) {
                        console.error('Error deleting product on server:', err);
                        Swal.fire({ 
                            title: 'Error', 
                            text: 'No se pudo eliminar el producto en el servidor. Asegúrate de que el backend esté activo.', 
                            icon: 'error' 
                        });
                    }
                })();
            }
        });
    }

    // === GESTIÓN DE USUARIOS ===
    
    // Mostrar usuarios
    showUsers() {
        const usuarios = this.getUsers();
        const tbody = document.getElementById('usersTable');
        if (!tbody) {
            console.warn('usersTable element not found in DOM');
            return;
        }

        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay usuarios registrados</td></tr>';
            return;
        }

        // If we have users to show, ensure any prior error/status message is hidden
        try {
            const errEl = document.getElementById('usersError');
            if (errEl) errEl.style.display = 'none';
        } catch (e) { /* ignore */ }

        tbody.innerHTML = usuarios.map(user => `
            <tr>
                <td>${escapeHtml(user.email || '')}</td>
                <td>${escapeHtml(user.nombre || '')}</td>
                <td>${escapeHtml(user.apellido || '')}</td>
                <td>${escapeHtml(user.cedula || '')}</td>
                <td>${user.fechaRegistro ? new Date(user.fechaRegistro).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="adminManager.viewUser('${escapeJsStringSingle(user.id || user._id || user.email)}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success me-2" onclick="adminManager.editUser('${escapeJsStringSingle(user.id || user._id || user.email)}')">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminManager.deleteUser('${escapeJsStringSingle(user.id || user._id || user.email)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Obtener usuarios
    getUsers() {
        // Return in-memory users loaded from server. Do NOT read from localStorage.
        return this._usuarios || [];
    }

    // Fetch users from server and cache in localStorage (non-blocking)
    async fetchUsers() {
        try {
            // Prefer using api client if available
            let users = null;
            if (window.api && typeof window.api.getUsers === 'function') {
                users = await window.api.getUsers();
            } else {
                // First, try an unauthenticated request so the users section can work
                // even when no token is present (if the backend allows public access).
                try {
                    const unauthRes = await fetch('/api/users');
                    if (unauthRes.ok) {
                        users = await unauthRes.json();
                    } else if (unauthRes.status === 401 || unauthRes.status === 403) {
                        // Backend requires auth: fall back to token-based request
                        const token = getAuthToken();
                        const headers = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        const res = await fetch('/api/users', { headers });
                        if (!res.ok) {
                            const txt = await res.text().catch(() => res.statusText || '');
                            throw new Error(`HTTP ${res.status} ${txt}`);
                        }
                        users = await res.json();
                    } else {
                        // Other non-auth error: include status/text to bubble up
                        const txt = await unauthRes.text().catch(() => unauthRes.statusText || '');
                        throw new Error(`HTTP ${unauthRes.status} ${txt}`);
                    }
                } catch (fetchErr) {
                    // Re-throw network errors to be handled by the outer catch/retry logic
                    throw fetchErr;
                }
            }

            // Normalize shape expected by admin UI
            const normalized = users.map(u => ({
                _id: u._id || u.id,
                id: u._id || u.id,
                email: u.email,
                nombre: u.nombre || '',
                apellido: u.apellido || '',
                cedula: u.cedula || '',
                telefono: u.telefono || '',
                photo: u.photo || u.photoUrl || null,
                fechaRegistro: u.createdAt || u.fechaRegistro || u.createdAt
            }));

            // keep users in-memory only
            this._usuarios = normalized;
            console.log('Admin: usuarios cargados desde server (in-memory):', normalized.length);
            // Reset fetch attempts counter on success
            this._fetchUsersAttempts = 0;
            // Clear any previous UI error
            try {
                const errEl = document.getElementById('usersError');
                if (errEl) { errEl.style.display = 'none'; }
                // If the users section is currently visible, re-render the table so the UI updates
                try {
                    const usersSection = document.getElementById('users-section');
                    if (usersSection && usersSection.classList.contains('active')) {
                        try { this.showUsers(); } catch(e){ console.warn('showUsers after fetchUsers success failed:', e); }
                    }
                } catch(e) { /* ignore */ }
            } catch (_) {}
            return normalized;
        } catch (err) {
            console.warn('fetchUsers error:', err);
            // Ensure in-memory users cleared on error
            this._usuarios = [];

            // Increment attempt counter
            this._fetchUsersAttempts = (this._fetchUsersAttempts || 0) + 1;

            // Detect likely auth errors (401/403) and, when detected, wait for a token to be set
            const errStr = String(err || '').toLowerCase();
            const isAuthError = errStr.includes('401') || errStr.includes('forbidden') || errStr.includes('unauthorized') || (err && err.status && (err.status === 401 || err.status === 403));

            // If it's an auth problem and we still have retries left, wait for auth:token-set (or a short timeout) before retrying
            if (isAuthError && this._fetchUsersAttempts <= 3) {
                console.log('fetchUsers: probable auth error, waiting for auth:token-set before retrying (attempt', this._fetchUsersAttempts + ')');
                try {
                    await new Promise((resolve) => {
                        let resolved = false;
                        const onToken = () => { if (!resolved) { resolved = true; try { window.removeEventListener('auth:token-set', onToken); } catch(_){}; resolve(); } };
                        window.addEventListener('auth:token-set', onToken, { once: true });
                        // fallback timeout if token event doesn't fire
                        setTimeout(() => { if (!resolved) { resolved = true; try { window.removeEventListener('auth:token-set', onToken); } catch(_){}; resolve(); } }, 1500 * this._fetchUsersAttempts);
                    });
                    return await this.fetchUsers();
                } catch (e) {
                    console.warn('fetchUsers auth wait failed:', e);
                }
            }

            // Automatic retry with backoff for transient errors (up to 3 attempts)
            if (this._fetchUsersAttempts <= 3) {
                try {
                    const backoff = 500 * this._fetchUsersAttempts; // 500ms, 1000ms, 1500ms
                    console.log(`fetchUsers failed, will retry automatically in ${backoff}ms (attempt ${this._fetchUsersAttempts})`);
                    await new Promise(res => setTimeout(res, backoff));
                    return await this.fetchUsers();
                } catch (retryErr) {
                    console.warn('Automatic retry failed:', retryErr);
                }
            }

            // After exhausting automatic retries, show a visible error message in the Users section (if present)
            try {
                const errEl = document.getElementById('usersError');
                const msgEl = document.getElementById('usersErrorMsg');
                const retryBtn = document.getElementById('usersRetryBtn');
                if (msgEl) msgEl.textContent = 'Error cargando usuarios: ' + (err && err.message ? err.message : String(err));
                if (errEl) errEl.style.display = 'flex';
                if (retryBtn) retryBtn.disabled = false;
            } catch (e) {
                // ignore UI errors
            }

            return [];
        }
    }

    // Fetch orders from server and cache in localStorage
    async fetchOrders() {
        try {
            let orders = null;
            if (window.api && typeof window.api.getOrders === 'function') {
                orders = await window.api.getOrders();
            } else {
                const token = getAuthToken();
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch('/api/orders', { headers });
                if (!res.ok) throw new Error('Failed fetching orders');
                orders = await res.json();
            }

            const normalized = orders.map(o => ({
                id: o._id || o.id,
                numeroOrden: o._id || o.numeroOrden,
                cliente: o.resumen?.cliente || o.cliente || {},
                productos: o.items || o.productos || [],
                totales: o.resumen || o.totales || {},
                estado: o.estado || 'pendiente',
                fecha: o.fecha || o.createdAt
            }));

            // keep orders in-memory only
            this._pedidos = normalized;
            console.log('Admin: pedidos cargados desde server (in-memory):', normalized.length);
            return normalized;
        } catch (err) {
            console.warn('fetchOrders error:', err);
            throw err;
        }
    }

    // Fetch products from server and cache in localStorage
    async fetchProducts() {
        try {
            let products = null;
            if (window.api && typeof window.api.getProducts === 'function') {
                products = await window.api.getProducts();
            } else {
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error('Failed fetching products');
                products = await res.json();
            }

            const normalized = products.map(p => ({
                id: p._id || p.id,
                nombre: p.nombre,
                precio: p.precio,
                categoria: p.categoria,
                stock: p.stock,
                descuento: p.descuento ?? p.desc ?? p.discount ?? 0,
                imagen: p.imagen,
                descripcion: p.descripcion,
                fechaCreacion: p.fechaCreacion || p.createdAt
            }));

            // keep products in-memory only
            this._productos = normalized;
            console.log('Admin: productos cargados desde server (fetchProducts, in-memory):', normalized.length);
            return normalized;
        } catch (err) {
            console.warn('fetchProducts error:', err);
            throw err;
        }
    }

    // Ver detalles de usuario
    async viewUser(id) {
        try {
            let user = null;
            // Try to fetch single user from server
            try {
                const token = getAuthToken();
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`/api/users/${id}`, { headers });
                if (res.ok) user = await res.json();
            } catch (err) {
                console.warn('Could not fetch user from server, falling back to localStorage', err);
            }

            if (!user) {
                const usuarios = this.getUsers();
                user = usuarios.find(u => (u._id === id || u.id === id || u.email === id));
            }

            if (!user) {
                Swal.fire('Error', 'Usuario no encontrado', 'error');
                return;
            }

            Swal.fire({
                title: 'Detalles del Usuario',
                html: `
                    <div class="text-start">
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Nombre:</strong> ${user.nombre}</p>
                        <p><strong>Apellido:</strong> ${user.apellido}</p>
                        <p><strong>Cédula:</strong> ${user.cedula}</p>
                        <p><strong>Teléfono:</strong> ${user.telefono || 'No especificado'}</p>
                        <p><strong>Fecha de Registro:</strong> ${user.fechaRegistro ? new Date(user.fechaRegistro).toLocaleString() : 'N/A'}</p>
                    </div>
                `,
                confirmButtonText: 'Cerrar'
            });
        } catch (err) {
            console.error('viewUser error:', err);
            Swal.fire('Error', 'Error al obtener los detalles del usuario', 'error');
        }
    }

    // Eliminar usuario (by id)
    deleteUser(id) {
        Swal.fire({
            title: '¿Eliminar usuario?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'Eliminando usuario...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                try {
                    const token = getAuthToken();
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers });
                    if (!res.ok) throw new Error('Server delete failed');

                    // Remove from in-memory cache
                    this._usuarios = (this._usuarios || []).filter(u => (u._id || u.id) !== id);
                    this.showUsers();

                    Swal.fire({ title: '¡Eliminado!', text: 'El usuario ha sido eliminado', icon: 'success', timer: 2000 });
                } catch (err) {
                    console.error('Error deleting user on server:', err);
                    Swal.fire({ title: 'Error', text: 'No se pudo eliminar el usuario en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
                }
            }
        });
    }

    // Editar usuario (by id)
    async editUser(id) {
        console.log('🔧 editUser llamado con id:', id);
        try {
            let user = null;
            // Try server
            try {
                const token = getAuthToken();
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`/api/users/${id}`, { headers });
                if (res.ok) user = await res.json();
            } catch (err) {
                console.warn('No se pudo obtener usuario desde servidor, usando cache local', err);
            }

            if (!user) {
                const usuarios = this.getUsers();
                user = usuarios.find(u => (u._id === id || u.id === id || u.email === id));
            }

            if (!user) {
                console.error('❌ Usuario no encontrado en editUser:', id);
                Swal.fire('Error', 'Usuario no encontrado', 'error');
                return;
            }

            // Rellenar formulario con datos del usuario
            document.getElementById('editUserId').value = user._id || user.id || user.email;
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userName').value = user.nombre || '';
            document.getElementById('userLastName').value = user.apellido || '';
            document.getElementById('userCedula').value = user.cedula || '';
            document.getElementById('userPhone').value = user.telefono || '';
            document.getElementById('userPassword').value = '';
            document.getElementById('userPhoto').value = user.photo || '';

            // Mostrar foto del usuario si existe
            if (user.photo) {
                showUserPhotoPreview(user.photo);
            } else {
                clearUserPhoto();
            }

            // Cambiar título del modal y hacer la contraseña opcional
            document.getElementById('userModalTitle').textContent = 'Editar Usuario';
            document.getElementById('passwordRequiredText').textContent = '';
            document.getElementById('passwordHelp').style.display = 'block';
            document.getElementById('userPassword').required = false;

            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('userModal'));
            modal.show();
        } catch (err) {
            console.error('editUser error:', err);
            Swal.fire('Error', 'No se pudo cargar el usuario para edición', 'error');
        }
    }

    // Actualizar usuario
    // Update user (attempt server PUT, fallback to localStorage)
    async updateUser(userData) {
        try {
            const id = userData.id || userData._id || document.getElementById('editUserId').value;
            if (!id) throw new Error('Missing user id');

            const payload = {
                nombre: userData.nombre,
                apellido: userData.apellido,
                email: userData.email,
                cedula: userData.cedula,
                telefono: userData.telefono,
                photo: userData.photo || null
            };

            const token = getAuthToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('Server update failed');
            const updated = await res.json();

            // Update in-memory cache
            const idx = (this._usuarios || []).findIndex(u => (u._id === id || u.id === id || u.email === id));
            if (idx !== -1) {
                this._usuarios[idx] = { ...this._usuarios[idx], ...updated, id: updated._id || updated.id };
            } else {
                this._usuarios.push({ ...updated, id: updated._id || updated.id });
            }
            this.showUsers();

            Swal.fire({ title: '¡Éxito!', text: 'Usuario actualizado correctamente', icon: 'success', timer: 2000 });
        } catch (err) {
            console.error('Error updating user on server:', err);
            Swal.fire({ title: 'Error', text: 'No se pudo actualizar el usuario en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
        }
    }

    // === GESTIÓN DE PEDIDOS ===
    
    // Mostrar pedidos
    showOrders() {
        const pedidos = this.getOrders();
        const tbody = document.getElementById('ordersTable');
        
        tbody.innerHTML = pedidos.map(order => `
            <tr>
                <td>${order.id || order.numeroOrden}</td>
                <td>${order.cliente?.nombre || 'N/A'}<br><small class="text-muted">${order.cliente?.email || ''}</small></td>
                <td>${order.fecha ? new Date(order.fecha).toLocaleDateString() : 'N/A'}</td>
                <td>$${order.totales?.total?.toFixed(2) || '0.00'}</td>
                <td>
                    <span class="badge bg-${this.getStatusColor(order.estado)}">
                        ${order.estado || 'pendiente'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="adminManager.viewOrder('${escapeJsStringSingle(order.id || order.numeroOrden)}')" title="Ver detalles">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="adminManager.changeOrderStatus('${escapeJsStringSingle(order.id || order.numeroOrden)}')" title="Cambiar estado">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info me-1" onclick="adminManager.editInvoice('${escapeJsStringSingle(order.id || order.numeroOrden)}')" title="Editar factura completa">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminManager.deleteOrder('${escapeJsStringSingle(order.id || order.numeroOrden)}')" title="Eliminar pedido">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Obtener pedidos
    getOrders() {
        // Return in-memory orders loaded from server. Do NOT read from localStorage.
        const pedidos = this._pedidos || [];
        return pedidos.slice().sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }

    // Ver detalles de pedido
    async viewOrder(orderId) {
        const pedidos = this.getOrders();
        let order = pedidos.find(o => (o.id || o.numeroOrden) === orderId);

        // If not found in memory, try fetching the order from server
        if (!order && orderId) {
            try {
                const r = await fetch(`/api/orders/${orderId}`);
                if (r.ok) order = await r.json();
            } catch (e) { /* ignore */ }
        }

        if (!order) {
            Swal.fire('Error', 'Pedido no encontrado', 'error');
            return;
        }

        // Ensure productos/cliente/totales are populated by trying to fetch full order when needed
        if ((!order.productos || order.productos.length === 0) && (order.id || order._id || order.numeroOrden)) {
            const oid = order.id || order._id || order.numeroOrden;
            try {
                const res = await fetch(`/api/orders/${oid}`);
                if (res.ok) {
                    const full = await res.json();
                    order.productos = full.items || full.productos || full.resumen?.productos || order.productos || [];
                    order.totales = full.totales || full.resumen || order.totales || {};
                    order.cliente = order.cliente || full.resumen?.cliente || full.cliente || null;
                    if ((!order.cliente || Object.keys(order.cliente).length === 0) && full.userId) {
                        try {
                            const ures = await fetch(`/api/users/${full.userId}`);
                            if (ures.ok) {
                                const u = await ures.json();
                                order.cliente = { nombre: u.nombre || u.name || '', email: u.email || '' };
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            } catch (err) {
                console.warn('Could not fetch full order details:', err);
            }
        }

        // Normalize items: order.productos may contain only { id, cantidad } references. Resolve product details from in-memory cache or from server.
        const rawItems = order.productos || order.items || [];
        const resolvedItems = await Promise.all(rawItems.map(async (p) => {
            // Determine id and quantity from common shapes
            const itemId = p.id || p.productId || p._id || p.codigo || p.sku || null;
            const cantidadNum = Number(p.cantidad ?? p.qty ?? p.quantity ?? p.cantidad ?? p.cant) || 0;

            // Try to find product in memory cache
            let prod = null;
            if (itemId) prod = (this._productos || []).find(x => String(x.id) === String(itemId) || String(x._id) === String(itemId));

            // If not found, attempt to fetch product from server
            if (!prod && itemId) {
                try {
                    const pres = await fetch(`/api/products/${itemId}`);
                    if (pres.ok) {
                        const pbody = await pres.json();
                        prod = {
                            id: pbody._id || pbody.id,
                            nombre: pbody.nombre || pbody.name || pbody.title,
                            precio: pbody.precio ?? pbody.price ?? pbody.cost ?? 0,
                            imagen: pbody.imagen || pbody.image || pbody.imageUrl || ''
                        };
                        // Also add to in-memory cache for faster subsequent lookups
                        this._productos = this._productos || [];
                        if (!this._productos.find(x => String(x.id) === String(prod.id))) this._productos.push(prod);
                    }
                } catch (e) { /* ignore fetch errors */ }
            }

            // Build resolved item object used for rendering
            return {
                id: itemId,
                nombre: prod ? (prod.nombre || prod.name || prod.title || 'Producto') : (p.nombre || p.name || 'Producto'),
                precio: prod ? (prod.precio ?? prod.price ?? 0) : (p.precio ?? p.price ?? 0),
                cantidad: cantidadNum || (p.cantidad || p.qty || p.quantity) || 0,
                imagen: (prod && (prod.imagen || prod.image || prod.imageUrl)) || p.imagen || p.image || p.imageUrl || ''
            };
        }));

        const productosHtml = resolvedItems.length ? resolvedItems.map(p => {
            const precioNum = Number(p.precio ?? 0) || 0;
            const cantidadNum = Number(p.cantidad ?? 0) || 0;
            const lineTotal = precioNum * cantidadNum;
            let imgSrc = (p.imagen || '').toString().trim() || '';
            if (imgSrc && !/^(https?:)?\/\//i.test(imgSrc) && !imgSrc.startsWith('/') && !imgSrc.startsWith('./')) {
                if (/^\d+x\d+\?/i.test(imgSrc) || imgSrc.includes('?text=')) {
                    // Use local placeholder instead of external via.placeholder.com
                    imgSrc = './static/img/placeholder.svg';
                } else {
                    imgSrc = './static/img/' + imgSrc;
                }
            }
            if (!imgSrc) imgSrc = './static/img/producto.png';
            const nombre = p.nombre || p.name || p.title || 'Producto';
            return `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div class="d-flex align-items-center">
                    <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(nombre)}" 
                         style="width: 40px; height: 40px; object-fit: cover;" class="rounded me-2">
                    <div>
                        <div class="fw-bold">${escapeHtml(nombre)}</div>
                        <small class="text-muted">Cantidad: ${escapeHtml(String(cantidadNum))}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold">$${lineTotal.toFixed(2)}</div>
                    <small class="text-muted">$${precioNum.toFixed(2)} c/u</small>
                </div>
            </div>
        `;
        }).join('') : '<p>No hay productos disponibles</p>';

        Swal.fire({
            title: `Pedido #${order.id || order.numeroOrden}`,
            html: `
                <div class="text-start">
                    <h6>Cliente:</h6>
                    <p>${escapeHtml(order.cliente?.nombre || order.cliente?.name || order.cliente?.email || 'N/A')}<br>
                    ${escapeHtml(order.cliente?.email || '')}<br>
                    ${escapeHtml(order.cliente?.telefono || '')}</p>
                    
                    <h6>Productos:</h6>
                    <div class="mb-3">${productosHtml}</div>
                    
                    <h6>Totales:</h6>
                    <p>
                        Subtotal: $${(Number(order.totales?.subtotal || order.totales?.subtotalTotal || 0)).toFixed(2)}<br>
                        IVA (15%): $${(Number(order.totales?.iva || 0)).toFixed(2)}<br>
                        Envío: $${(Number(order.totales?.envio || order.totales?.shipping || 0)).toFixed(2)}<br>
                        <strong>Total: $${(Number(order.totales?.total || order.totales?.monto || 0)).toFixed(2)}</strong>
                    </p>
                    
                    <h6>Entrega:</h6>
                    <p>${escapeHtml(order.entrega?.direccion || 'Dirección no especificada')}</p>
                    
                    <h6>Estado:</h6>
                    <span class="badge bg-${this.getStatusColor(order.estado || order.state || order.status)}">${escapeHtml(order.estado || order.state || order.status || 'pendiente')}</span>
                </div>
            `,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: 'Editar Factura',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#ffc107'
        }).then((result) => {
            if (result.isConfirmed) {
                this.editInvoice(orderId);
            }
        });
    }

    // Cambiar estado de pedido
    changeOrderStatus(orderId) {
        const estados = [
            { value: 'pendiente', text: 'Pendiente' },
            { value: 'confirmado', text: 'Confirmado' },
            { value: 'preparando', text: 'Preparando' },
            { value: 'enviado', text: 'Enviado' },
            { value: 'entregado', text: 'Entregado' },
            { value: 'cancelado', text: 'Cancelado' }
        ];
        
        const optionsHtml = estados.map(estado => 
            `<option value="${estado.value}">${estado.text}</option>`
        ).join('');
        
        Swal.fire({
            title: 'Cambiar Estado del Pedido',
            html: `<select id="newStatus" class="swal2-input">${optionsHtml}</select>`,
            showCancelButton: true,
            confirmButtonText: 'Actualizar',
            preConfirm: () => {
                return document.getElementById('newStatus').value;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const newStatus = result.value;
                this.updateOrderStatus(orderId, newStatus);
            }
        });
    }

    // Actualizar estado de pedido
    updateOrderStatus(orderId, newStatus) {
        // Try to update on server and refresh UI. Fallback to localStorage on error.
        (async () => {
            Swal.fire({ title: 'Actualizando estado...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                if (window.api && typeof window.api.updateOrder === 'function') {
                    await window.api.updateOrder(orderId, { estado: newStatus });
                    await this.loadServerData();
                } else {
                    throw new Error('API client no disponible');
                }
                Swal.fire({ title: '¡Actualizado!', text: `Estado cambiado a: ${newStatus}`, icon: 'success', timer: 2000 });
            } catch (err) {
                console.error('Error updating order status on server:', err);
                Swal.fire({ title: 'Error', text: 'No se pudo actualizar el estado en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
            }
        })();
    }

    // Eliminar pedido
    deleteOrder(orderId) {
        Swal.fire({
            title: '¿Eliminar pedido?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                (async () => {
                    Swal.fire({ title: 'Eliminando pedido...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    try {
                        if (window.api && typeof window.api.deleteOrder === 'function') {
                            await window.api.deleteOrder(orderId);
                            await this.loadServerData();
                        } else {
                            throw new Error('API client no disponible');
                        }
                        Swal.fire({ title: '¡Eliminado!', text: 'El pedido ha sido eliminado', icon: 'success', timer: 2000 });
                    } catch (err) {
                        console.error('Error deleting order on server:', err);
                        Swal.fire({ title: 'Error', text: 'No se pudo eliminar el pedido en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
                    }
                })();
            }
        });
    }

    // Editar factura completa
    editInvoice(orderId) {
        // Buscar la orden en la caché en memoria (no usar localStorage)
        const pedidos = this._pedidos || [];
        let order = pedidos.find(o => (o.id || o.numeroOrden) === orderId);
        
        if (!order) {
            Swal.fire('Error', 'Factura no encontrada', 'error');
            return;
        }

        // Cargar productos disponibles desde la caché en memoria
        const productos = this._productos || [];
        
        // Productos actuales de la orden
        const productosOrden = order.productos || [];
        
        // Crear HTML para productos
        const productosHtml = productosOrden.map((prod, index) => {
            const productoId = escapeHtml(prod.id || '');
            const productoPrecio = escapeHtml(prod.precio || 0);
            const productoNombre = escapeHtml(prod.nombre || '');
            const productoCantidad = escapeHtml(prod.cantidad || 1);
            
            return `
                <div class="producto-item border rounded p-3 mb-2" data-index="${index}">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <select class="form-select producto-select" onchange="adminManager.updateProductInfo(${index})">
                                <option value="">Seleccionar producto</option>
                                ${productos.map(p => {
                                    const selected = p.id == prod.id ? 'selected' : '';
                                    return `<option value="${escapeHtml(p.id)}" data-precio="${escapeHtml(p.precio)}" data-nombre="${escapeHtml(p.nombre)}" ${selected}>${escapeHtml(p.nombre)} - $${escapeHtml(p.precio)}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <input type="number" class="form-control cantidad-input" 
                                   placeholder="Cant." min="1" value="${productoCantidad}"
                                   onchange="adminManager.calcularSubtotalProducto(${index})">
                        </div>
                        <div class="col-md-2">
                            <input type="number" class="form-control precio-input" 
                                   placeholder="Precio" step="0.01" value="${productoPrecio}"
                                   onchange="adminManager.calcularSubtotalProducto(${index})">
                        </div>
                        <div class="col-md-2">
                            <input type="number" class="form-control subtotal-input" 
                                   placeholder="Subtotal" step="0.01" value="${(prod.precio * prod.cantidad) || 0}" readonly>
                        </div>
                        <div class="col-md-2">
                            <button type="button" class="btn btn-outline-danger btn-sm" 
                                    onclick="adminManager.eliminarProductoFactura(${index})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Escapar valores para uso seguro en HTML
        const clienteNombre = escapeHtml(order.cliente?.nombre || '');
        const clienteEmail = escapeHtml(order.cliente?.email || '');
        const clienteTelefono = escapeHtml(order.cliente?.telefono || '');
        const clienteCedula = escapeHtml(order.cliente?.cedula || '');
        const entregaDireccion = escapeHtml(order.entrega?.direccion || '');
        const entregaCiudad = escapeHtml(order.entrega?.ciudad || '');
        const entregaProvincia = escapeHtml(order.entrega?.provincia || '');
        const entregaCodigoPostal = escapeHtml(order.entrega?.codigoPostal || '');
        const entregaInstrucciones = escapeHtml(order.entrega?.instrucciones || '');
        const subtotal = escapeHtml(order.totales?.subtotal || 0);
        const envio = escapeHtml(order.totales?.envio || 0);
        const iva = escapeHtml(order.totales?.iva || 0);
        const total = escapeHtml(order.totales?.total || 0);

        // Mostrar formulario de edición completo
        Swal.fire({
            title: 'Editar Factura Completa',
            html: `
                <div class="text-start" style="max-height: 70vh; overflow-y: auto;">
                    <!-- Datos del Cliente -->
                    <div class="mb-4">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-user me-2"></i>Datos del Cliente</h6>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editClienteName" class="form-control mb-2" placeholder="Nombre completo" value="${clienteNombre}">
                            </div>
                            <div class="col-md-6">
                                <input id="editClienteEmail" class="form-control mb-2" placeholder="Email" value="${clienteEmail}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editClienteTelefono" class="form-control mb-2" placeholder="Teléfono" value="${clienteTelefono}">
                            </div>
                            <div class="col-md-6">
                                <input id="editClienteCedula" class="form-control mb-2" placeholder="Cédula" value="${clienteCedula}">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dirección y Entrega -->
                    <div class="mb-4">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-map-marker-alt me-2"></i>Dirección y Entrega</h6>
                        <textarea id="editDireccion" class="form-control mb-2" rows="2" placeholder="Dirección completa">${entregaDireccion}</textarea>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editCiudad" class="form-control mb-2" placeholder="Ciudad" value="${entregaCiudad}">
                            </div>
                            <div class="col-md-6">
                                <input id="editProvincia" class="form-control mb-2" placeholder="Provincia" value="${entregaProvincia}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editCodigoPostal" class="form-control mb-2" placeholder="Código Postal" value="${entregaCodigoPostal}">
                            </div>
                            <div class="col-md-6">
                                <select id="editMetodoEntrega" class="form-select">
                                    <option value="domicilio" ${order.entrega?.metodo === 'domicilio' ? 'selected' : ''}>Envío a domicilio</option>
                                    <option value="retiro" ${order.entrega?.metodo === 'retiro' ? 'selected' : ''}>Retiro en tienda</option>
                                </select>
                            </div>
                        </div>
                        <textarea id="editInstrucciones" class="form-control" rows="2" placeholder="Instrucciones de entrega">${entregaInstrucciones}</textarea>
                    </div>
                    
                    <!-- Productos -->
                    <div class="mb-4">
                        <h6 class="border-bottom pb-2">
                            <i class="fa-solid fa-shopping-cart me-2"></i>Productos
                            <button type="button" class="btn btn-outline-success btn-sm float-end" onclick="adminManager.agregarProductoFactura()">
                                <i class="fa-solid fa-plus me-1"></i>Agregar
                            </button>
                        </h6>
                        <div id="productos-container">
                            ${productosHtml}
                        </div>
                    </div>
                    
                    <!-- Pago y Estado -->
                    <div class="mb-4">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-credit-card me-2"></i>Pago y Estado</h6>
                        <div class="row">
                            <div class="col-md-6">
                                <select id="editMetodoPago" class="form-select mb-2">
                                    <option value="efectivo" ${order.pago?.metodo === 'efectivo' ? 'selected' : ''}>Efectivo (Contra entrega)</option>
                                    <option value="tarjeta_credito" ${order.pago?.metodo === 'tarjeta_credito' ? 'selected' : ''}>Tarjeta de Crédito</option>
                                    <option value="tarjeta_debito" ${order.pago?.metodo === 'tarjeta_debito' ? 'selected' : ''}>Tarjeta de Débito</option>
                                    <option value="transferencia" ${order.pago?.metodo === 'transferencia' ? 'selected' : ''}>Transferencia Bancaria</option>
                                    <option value="paypal" ${order.pago?.metodo === 'paypal' ? 'selected' : ''}>PayPal</option>
                                    <option value="bitcoin" ${order.pago?.metodo === 'bitcoin' ? 'selected' : ''}>Bitcoin</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <select id="editEstado" class="form-select mb-2">
                                    <option value="pendiente" ${order.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="confirmado" ${order.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                                    <option value="preparando" ${order.estado === 'preparando' ? 'selected' : ''}>Preparando</option>
                                    <option value="enviado" ${order.estado === 'enviado' ? 'selected' : ''}>Enviado</option>
                                    <option value="entregado" ${order.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                                    <option value="cancelado" ${order.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Totales -->
                    <div class="mb-3">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-calculator me-2"></i>Totales</h6>
                        <div class="row">
                            <div class="col-md-4">
                                <label class="form-label">Subtotal:</label>
                                <input id="editSubtotal" class="form-control" type="number" step="0.01" value="${subtotal}" readonly>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Envío:</label>
                                <input id="editEnvio" class="form-control" type="number" step="0.01" value="${envio}" onchange="adminManager.recalcularTotales()">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">IVA (15%):</label>
                                <input id="editIva" class="form-control" type="number" step="0.01" value="${iva}" readonly>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-md-12">
                                <label class="form-label"><strong>Total:</strong></label>
                                <input id="editTotal" class="form-control fw-bold" type="number" step="0.01" value="${total}" readonly>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Fechas -->
                    <div class="mb-3">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-calendar me-2"></i>Fechas</h6>
                        <div class="row">
                            <div class="col-md-6">
                                <label class="form-label">Fecha del Pedido:</label>
                                <input id="editFechaPedido" class="form-control" type="datetime-local" value="${order.fecha ? new Date(order.fecha).toISOString().slice(0, 16) : ''}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Fecha Estimada de Entrega:</label>
                                <input id="editFechaEntrega" class="form-control" type="datetime-local" value="${order.entrega?.fechaEstimada ? new Date(order.entrega.fechaEstimada).toISOString().slice(0, 16) : ''}">
                            </div>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar Todos los Cambios',
            cancelButtonText: 'Cancelar',
            width: '900px',
            preConfirm: () => {
                return this.recopilarDatosFactura(order);
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.saveInvoiceChanges(orderId, result.value);
            }
        });
        
        // Calcular totales iniciales
        setTimeout(() => this.recalcularTotales(), 100);
    }

    // Recopilar todos los datos de la factura
    recopilarDatosFactura(originalOrder) {
        // Recopilar productos del formulario
        const productosContainer = document.getElementById('productos-container');
        const productosItems = productosContainer.querySelectorAll('.producto-item');
        const productos = [];
        
        productosItems.forEach((item, index) => {
            const select = item.querySelector('.producto-select');
            const cantidad = item.querySelector('.cantidad-input');
            const precio = item.querySelector('.precio-input');
            const subtotal = item.querySelector('.subtotal-input');
            
            if (select.value && cantidad.value && precio.value) {
                const selectedOption = select.options[select.selectedIndex];
                productos.push({
                    id: parseInt(select.value),
                    nombre: selectedOption.getAttribute('data-nombre') || selectedOption.text.split(' - $')[0],
                    precio: parseFloat(precio.value),
                    cantidad: parseInt(cantidad.value),
                    subtotal: parseFloat(subtotal.value),
                    imagen: originalOrder.productos?.[index]?.imagen || './static/img/producto.png'
                });
            }
        });
        
        // Recopilar totales
        const subtotal = parseFloat(document.getElementById('editSubtotal').value) || 0;
        const envio = parseFloat(document.getElementById('editEnvio').value) || 0;
        const iva = parseFloat(document.getElementById('editIva').value) || 0;
        const total = parseFloat(document.getElementById('editTotal').value) || 0;
        
        return {
            cliente: {
                nombre: document.getElementById('editClienteName').value,
                email: document.getElementById('editClienteEmail').value,
                telefono: document.getElementById('editClienteTelefono').value,
                cedula: document.getElementById('editClienteCedula').value,
                apellido: originalOrder.cliente?.apellido || ''
            },
            entrega: {
                direccion: document.getElementById('editDireccion').value,
                ciudad: document.getElementById('editCiudad').value,
                provincia: document.getElementById('editProvincia').value,
                codigoPostal: document.getElementById('editCodigoPostal').value,
                metodo: document.getElementById('editMetodoEntrega').value,
                instrucciones: document.getElementById('editInstrucciones').value,
                fechaEstimada: document.getElementById('editFechaEntrega').value,
                coordenadas: originalOrder.entrega?.coordenadas || null
            },
            pago: {
                metodo: document.getElementById('editMetodoPago').value,
                metodoPagoNombre: this.getPaymentMethodName(document.getElementById('editMetodoPago').value)
            },
            estado: document.getElementById('editEstado').value,
            productos: productos,
            totales: {
                subtotal: subtotal,
                iva: iva,
                envio: envio,
                total: total
            },
            fecha: document.getElementById('editFechaPedido').value || originalOrder.fecha,
            timestamp: originalOrder.timestamp || Date.now()
        };
    }
    
    // Obtener nombre del método de pago
    getPaymentMethodName(method) {
        const methods = {
            efectivo: 'Efectivo (Contra entrega)',
            tarjeta_credito: 'Tarjeta de Crédito',
            tarjeta_debito: 'Tarjeta de Débito',
            transferencia: 'Transferencia Bancaria',
            paypal: 'PayPal',
            bitcoin: 'Bitcoin'
        };
        return methods[method] || method || 'No especificado';
    }
    
    // Agregar producto a la factura
    agregarProductoFactura() {
        const productos = this.getProducts();
        const container = document.getElementById('productos-container');
        const index = container.querySelectorAll('.producto-item').length;
        
        const nuevoProductoHtml = `
            <div class="producto-item border rounded p-3 mb-2" data-index="${index}">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <select class="form-select producto-select" onchange="adminManager.updateProductInfo(${index})">
                            <option value="">Seleccionar producto</option>
                            ${productos.map(p => `
                                <option value="${p.id}" data-precio="${p.precio}" data-nombre="${p.nombre}">
                                    ${p.nombre} - $${p.precio}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control cantidad-input" 
                               placeholder="Cant." min="1" value="1"
                               onchange="adminManager.calcularSubtotalProducto(${index})">
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control precio-input" 
                               placeholder="Precio" step="0.01" value="0"
                               onchange="adminManager.calcularSubtotalProducto(${index})">
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control subtotal-input" 
                               placeholder="Subtotal" step="0.01" value="0" readonly>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-outline-danger btn-sm" 
                                onclick="adminManager.eliminarProductoFactura(${index})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', nuevoProductoHtml);
    }
    
    // Actualizar información del producto cuando se selecciona
    updateProductInfo(index) {
        const item = document.querySelector(`.producto-item[data-index="${index}"]`);
        const select = item.querySelector('.producto-select');
        const precioInput = item.querySelector('.precio-input');
        
        if (select.value) {
            const selectedOption = select.options[select.selectedIndex];
            const precio = selectedOption.getAttribute('data-precio');
            precioInput.value = precio;
            this.calcularSubtotalProducto(index);
        }
    }
    
    // Calcular subtotal de un producto específico
    calcularSubtotalProducto(index) {
        const item = document.querySelector(`.producto-item[data-index="${index}"]`);
        const cantidad = parseFloat(item.querySelector('.cantidad-input').value) || 0;
        const precio = parseFloat(item.querySelector('.precio-input').value) || 0;
        const subtotalInput = item.querySelector('.subtotal-input');
        
        const subtotal = cantidad * precio;
        subtotalInput.value = subtotal.toFixed(2);
        
        this.recalcularTotales();
    }
    
    // Eliminar producto de la factura
    eliminarProductoFactura(index) {
        const item = document.querySelector(`.producto-item[data-index="${index}"]`);
        if (item) {
            item.remove();
            this.recalcularTotales();
            this.reindexarProductos();
        }
    }
    
    // Reindexar productos después de eliminar uno
    reindexarProductos() {
        const items = document.querySelectorAll('.producto-item');
        items.forEach((item, newIndex) => {
            item.setAttribute('data-index', newIndex);
            
            // Actualizar eventos onclick
            const selectBtn = item.querySelector('.producto-select');
            const cantidadInput = item.querySelector('.cantidad-input');
            const precioInput = item.querySelector('.precio-input');
            const deleteBtn = item.querySelector('.btn-outline-danger');
            
            selectBtn.setAttribute('onchange', `adminManager.updateProductInfo(${newIndex})`);
            cantidadInput.setAttribute('onchange', `adminManager.calcularSubtotalProducto(${newIndex})`);
            precioInput.setAttribute('onchange', `adminManager.calcularSubtotalProducto(${newIndex})`);
            deleteBtn.setAttribute('onclick', `adminManager.eliminarProductoFactura(${newIndex})`);
        });
    }
    
    // Recalcular todos los totales
    recalcularTotales() {
        const container = document.getElementById('productos-container');
        if (!container) return;
        
        const subtotalInputs = container.querySelectorAll('.subtotal-input');
        let subtotalTotal = 0;
        
        subtotalInputs.forEach(input => {
            subtotalTotal += parseFloat(input.value) || 0;
        });
        
        const envio = parseFloat(document.getElementById('editEnvio')?.value) || 0;
        const iva = subtotalTotal * 0.15; // 15% IVA
        const total = subtotalTotal + iva + envio;
        
        // Actualizar campos
        if (document.getElementById('editSubtotal')) {
            document.getElementById('editSubtotal').value = subtotalTotal.toFixed(2);
        }
        if (document.getElementById('editIva')) {
            document.getElementById('editIva').value = iva.toFixed(2);
        }
        if (document.getElementById('editTotal')) {
            document.getElementById('editTotal').value = total.toFixed(2);
        }
    }

    // Guardar cambios en la factura (versión mejorada)

    saveInvoiceChanges(orderId, updatedData) {
        // Persist invoice changes to server only; do not write to localStorage.
        (async () => {
            Swal.fire({ title: 'Guardando cambios en la factura...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                if (window.api && typeof window.api.updateOrder === 'function') {
                    await window.api.updateOrder(orderId, updatedData);
                    // Refresh in-memory orders
                    await this.fetchOrders();
                    this.showOrders();
                    Swal.fire({ title: '¡Factura Actualizada!', text: 'Todos los cambios han sido guardados en el servidor', icon: 'success', timer: 2500 });
                } else {
                    throw new Error('API client no disponible');
                }
            } catch (err) {
                console.error('Error saving invoice changes on server:', err);
                Swal.fire({ title: 'Error', text: 'No se pudo guardar la factura en el servidor. Asegúrate de que el backend esté activo.', icon: 'error' });
            }
        })();
    }

    // === FUNCIÓN PARA RESETEAR DATOS DE PRUEBA ===
    resetearDatosPrueba() {
        Swal.fire({
            title: '¿Resetear datos?',
            text: 'Esto eliminará todos los productos, usuarios y pedidos actuales y los reemplazará con datos de prueba.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, resetear',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Try to call a server endpoint to reset sample data if available.
                try {
                    const res = await fetch('/api/reset-sample-data', { method: 'POST' });
                    if (res.ok) {
                        await this.loadServerData();
                        Swal.fire('¡Datos reseteados en servidor!', 'Los datos de prueba han sido restaurados en el servidor.', 'success');
                    } else {
                        Swal.fire('No disponible', 'La API para resetear datos no está disponible. Realiza el reset en el servidor.', 'warning');
                    }
                } catch (err) {
                    console.error('resetearDatosPrueba error:', err);
                    Swal.fire('Error', 'No se pudo contactar al servidor para resetear datos. Realiza el reset manualmente en el servidor.', 'error');
                }
            }
        });
    }
}

// Instanciar el administrador
const adminManager = new AdminPanelManager();
// Exponer en window para que los manejadores inline (onclick="adminManager....") funcionen
window.adminManager = adminManager;

// Funciones globales para el HTML
function adminLogout() {
    if (adminManager) {
        adminManager.logout();
    }
}

// --- Promo send handler ---
// Attach event listener when DOM is ready. This mirrors the admin modal form in admin.html
document.addEventListener('DOMContentLoaded', () => {
    try {
        const btn = document.getElementById('promoSendBtn');
        if (!btn) return;
        btn.addEventListener('click', async (ev) => {
            try {
                btn.disabled = true;
                const subject = (document.getElementById('promoSubject')?.value || '').trim();
                let html = (document.getElementById('promoHtml')?.value || '').trim();
                const type = (document.getElementById('promoType')?.value || '').trim();
                const sendAll = !!document.getElementById('promoSendAll')?.checked;
                const emailsRaw = (document.getElementById('promoEmails')?.value || '').trim();
                const coupon = (document.getElementById('promoCouponCode')?.value || '').trim();
                const productId = (document.getElementById('promoProductId')?.value || '').trim();

                if (!subject) {
                    Swal.fire('Error', 'Ingrese el asunto de la promoción', 'error');
                    btn.disabled = false;
                    return;
                }
                if (!html) {
                    Swal.fire('Error', 'Ingrese el contenido HTML/texto de la promoción', 'error');
                    btn.disabled = false;
                    return;
                }

                // Optionally inject product/coupon placeholders into html if provided
                if (productId) {
                    // If admin selected a product id, add a simple link placeholder
                    const prodLink = `<p><a href="${location.origin}/product.html?id=${encodeURIComponent(productId)}">Ver producto</a></p>`;
                    html = prodLink + html;
                }
                if (coupon) {
                    html = `<p><strong>Cupón:</strong> ${escapeHtml(coupon)}</p>` + html;
                }

                const payload = { subject, html, target: sendAll ? 'all' : 'emails' };
                if (!sendAll) {
                    const emails = emailsRaw.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
                    if (emails.length === 0) {
                        Swal.fire('Error', 'Ingrese al menos un correo en la lista o marque "Enviar a todos los usuarios"', 'error');
                        btn.disabled = false;
                        return;
                    }
                    payload.emails = emails;
                }

                Swal.fire({ title: 'Enviando promociones...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const res = await fetch('/api/admin/send-promo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const body = await res.json().catch(() => ({}));
                Swal.close();
                if (!res.ok) {
                    console.error('send-promo failed', res.status, body);
                    Swal.fire('Error', `No se pudo enviar la promoción (${res.status})`, 'error');
                    btn.disabled = false;
                    return;
                }

                let msg = `Promoción encolada para ${body.queued || 0} destinatarios`;
                if (body.preview) msg += '<br><a href="' + body.preview + '" target="_blank">Ver email de prueba</a>';
                Swal.fire({ title: 'Enviado', html: msg, icon: 'success' });
                btn.disabled = false;
                // Close modal if open
                try { const modal = bootstrap.Modal.getInstance(document.getElementById('promoModal')); if (modal) modal.hide(); } catch(e){}
            } catch (err) {
                console.error('promoSendBtn handler error:', err);
                Swal.fire('Error', err.message || 'Error enviando la promoción', 'error');
                try { btn.disabled = false; } catch(e){}
            }
        });
    } catch (e) {
        console.warn('Could not attach promoSendBtn handler:', e);
    }
});
// Retry helper exposed globally for the retry button in admin.html
// Converted to an async function that returns true on success, false on failure.
async function retryFetchUsers() {
    try {
        const btn = document.getElementById('usersRetryBtn');
        if (btn) btn.disabled = true;
        if (!adminManager || typeof adminManager.fetchUsers !== 'function') {
            console.warn('adminManager not available for retry');
            if (btn) btn.disabled = false;
            return false;
        }
        const users = await adminManager.fetchUsers();
        adminManager.showUsers();
        // hide error area if successful and users found
        try { const errEl = document.getElementById('usersError'); if (errEl) errEl.style.display = 'none'; } catch(_){ }
        if (!users || users.length === 0) {
            // If still empty, re-enable button so admin can try again
            if (btn) btn.disabled = false;
            return false;
        }
        if (btn) btn.disabled = false;
        return true;
    } catch (err) {
        console.error('retryFetchUsers error:', err);
        try { const btn = document.getElementById('usersRetryBtn'); if (btn) btn.disabled = false; } catch(_){ }
        return false;
    }
}

// Funciones para mostrar secciones
function showDashboard() { 
    showSection('dashboard'); 
    adminManager.loadDashboard();
}

// Show products section and refresh products from server when possible
async function showProducts() {
    showSection('products');
    try {
        if (adminManager && typeof adminManager.fetchProducts === 'function') {
            await adminManager.fetchProducts();
        }
    } catch (err) {
        console.warn('Could not refresh products from server:', err);
    }
    adminManager.showProducts();
}

// Show users section and refresh users from server when possible
// Show users (already implemented above) - keep async signature
async function showUsers() {
    showSection('users');
    // Try the same flow used by the manual "Reintentar" button so the
    // initial navigation behaves exactly like clicking that button.
    try {
        if (typeof retryFetchUsers === 'function') {
            const ok = await retryFetchUsers();
            // If retryFetchUsers succeeded it already called adminManager.showUsers()
            if (ok) return;
            // otherwise fallthrough to show whatever we have (empty state or error)
        } else if (adminManager && typeof adminManager.fetchUsers === 'function') {
            await adminManager.fetchUsers();
        }
    } catch (err) {
        console.warn('Could not refresh users from server:', err);
    }
    // Ensure UI renders current in-memory users (may be empty)
    try { adminManager.showUsers(); } catch (e) { console.warn('showUsers render failed:', e); }
}

// Show orders section and refresh orders from server when possible
async function showOrders() {
    showSection('orders');
    try {
        if (adminManager && typeof adminManager.fetchOrders === 'function') {
            await adminManager.fetchOrders();
        }
    } catch (err) {
        console.warn('Could not refresh orders from server:', err);
    }
    adminManager.showOrders();
}

// Función para cambiar entre secciones
function showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(`${sectionName}-section`).classList.add('active');
    
    // Actualizar navegación activa
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Marcar como activo el enlace correspondiente
    const activeLink = document.querySelector(`[onclick="show${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}()"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Modal de productos
function showAddProductModal() {
    console.log('showAddProductModal called'); // Debug
    
    // Limpiar formulario
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.querySelector('#productModal .modal-title').textContent = 'Agregar Producto';
    
    // Limpiar preview de imagen
    clearImagePreview();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
    
    console.log('Add product modal shown'); // Debug
}

// Modal para agregar usuario
function showAddUserModal() {
    // Reset form
    const form = document.getElementById('userForm');
    if (form) form.reset();

    // Clear edit id
    const editField = document.getElementById('editUserId');
    if (editField) editField.value = '';

    // Set modal title and password requirements for creation
    const title = document.getElementById('userModalTitle');
    if (title) title.textContent = 'Agregar Usuario';
    const passwordRequiredText = document.getElementById('passwordRequiredText');
    if (passwordRequiredText) passwordRequiredText.textContent = '*';
    const passwordHelp = document.getElementById('passwordHelp');
    if (passwordHelp) passwordHelp.style.display = 'none';
    const passwordField = document.getElementById('userPassword');
    if (passwordField) passwordField.required = true;

    // Clear photo preview
    clearUserPhoto();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

// Guardar producto (agregar o editar)
function saveProduct() {
    console.log('saveProduct function called'); // Debug
    
    try {
        const form = document.getElementById('productForm');
        if (!form) {
            throw new Error('No se encontró el formulario de producto');
        }
        
        if (!form.checkValidity()) {
            console.log('Form validation failed'); // Debug
            form.reportValidity();
            return;
        }
        
        // Verificar que todos los campos existen
        const nameField = document.getElementById('productName');
        const priceField = document.getElementById('productPrice');
        const categoryField = document.getElementById('productCategory');
        const stockField = document.getElementById('productStock');
        const imageField = document.getElementById('productImage');
        const descriptionField = document.getElementById('productDescription');
        
        if (!nameField || !priceField || !categoryField || !stockField || !imageField || !descriptionField) {
            throw new Error('Faltan campos del formulario');
        }
        
        const productData = {
            nombre: nameField.value,
            precio: priceField.value,
            categoria: categoryField.value,
            stock: stockField.value,
            imagen: imageField.value,
            descuento: (document.getElementById('productDiscount') ? document.getElementById('productDiscount').value : 0),
            descripcion: descriptionField.value
        };
        
        // Validar datos
        if (!productData.nombre || !productData.precio || !productData.categoria || !productData.imagen) {
            throw new Error('Faltan datos obligatorios del producto');
        }
        
        const productIdField = document.getElementById('productId');
        const productId = productIdField ? productIdField.value : '';
        
        console.log('Product data:', productData); // Debug
        console.log('Product ID:', productId); // Debug
        
        // Verificar que adminManager existe
        if (typeof adminManager === 'undefined') {
            throw new Error('adminManager no está disponible');
        }
        
        if (productId) {
            // Editar producto existente
            // Keep the original ID (string/ObjectId) instead of forcing a numeric parse which
            // breaks MongoDB ObjectId values and causes server-side cast errors.
            productData.id = productId;
            console.log('Updating product with ID:', productData.id); // Debug
            adminManager.updateProduct(productData);
            
            // Mostrar alerta de producto actualizado
            if (typeof showProductRegisteredAlert === 'function') {
                showProductRegisteredAlert(productData);
            }
        } else {
            // Agregar nuevo producto
            console.log('Adding new product'); // Debug
            adminManager.addProduct(productData);
            
            // Mostrar alerta de producto registrado
            if (typeof showProductRegisteredAlert === 'function') {
                showProductRegisteredAlert(productData);
            }
        }
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        if (modal) {
            modal.hide();
        }
        
        console.log('Product saved successfully'); // Debug
        
        // Forzar sincronización completa
        if (typeof forceSync === 'function') {
            forceSync();
        }
        
    } catch (error) {
        console.error('Error saving product:', error);
        Swal.fire({
            title: 'Error al guardar',
            text: `Error: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Función para guardar usuario (faltaba esta función)
async function saveUser() {
    console.log('✅ saveUser function called');
    
    try {
        const form = document.getElementById('userForm');
        if (!form) {
            throw new Error('No se encontró el formulario de usuario');
        }
        
        console.log('✅ Formulario encontrado, validando...');
        
        if (!form.checkValidity()) {
            console.log('❌ Form validation failed');
            form.reportValidity();
            return;
        }
        
        // Obtener datos del formulario
        const editUserId = document.getElementById('editUserId').value;
        const email = document.getElementById('userEmail').value;
        const nombre = document.getElementById('userName').value;
        const apellido = document.getElementById('userLastName').value;
        const cedula = document.getElementById('userCedula').value;
        const telefono = document.getElementById('userPhone').value;
        const password = document.getElementById('userPassword').value;
        const photo = document.getElementById('userPhoto').value;
        
        console.log('📝 Datos obtenidos del formulario:');
        console.log('   - editUserId:', editUserId);
        console.log('   - email:', email);
        console.log('   - nombre:', nombre);
        console.log('   - modo:', editUserId ? 'EDICIÓN' : 'CREACIÓN');
        
        // Validaciones básicas
        if (!email || !nombre || !apellido || !cedula) {
            Swal.fire('Error', 'Complete todos los campos obligatorios', 'error');
            return;
        }
        
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire('Error', 'Formato de email inválido', 'error');
            return;
        }
        
        // Validar cédula (10 dígitos)
        if (!/^\d{10}$/.test(cedula)) {
            Swal.fire('Error', 'La cédula debe tener exactamente 10 dígitos', 'error');
            return;
        }
        
        // Preparar datos del usuario
        const userData = {
            email: email,
            nombre: nombre,
            apellido: apellido,
            cedula: cedula,
            telefono: telefono || '',
            photo: photo || null
        };

        // Si hay contraseña nueva, agregarla (necesaria para creación)
        if (password && password.trim()) {
            userData.password = password;
        }

        // Si estamos editando (editUserId holds user id), call server PUT /api/users/:id
            if (editUserId) {
            // Build payload for update (do not send password here unless explicitly provided)
            const payload = { ...userData };
            if (!payload.password) delete payload.password;

            try {
                await adminManager.updateUser({ id: editUserId, ...payload });
                const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
                if (modal) modal.hide();
                form.reset();
                document.getElementById('editUserId').value = '';
                return;
            } catch (err) {
                console.error('Error updating user on server:', err);
                Swal.fire('Error', 'No se pudo actualizar el usuario en el servidor. Asegúrate de que el backend esté activo.', 'error');
                return;
            }
        }

        // Creation flow: call server /api/auth/register if possible
        try {
            if (!password) {
                Swal.fire('Error', 'La contraseña es obligatoria para nuevos usuarios', 'error');
                return;
            }

            let created = null;
            if (window.api && typeof window.api.register === 'function') {
                const payload = { nombre, apellido, email, password, cedula, telefono, photo };
                const res = await window.api.register(payload).catch(e => { throw e; });
                // api.register returns { token, user }
                created = res.user || null;
            } else {
                const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, apellido, email, password, cedula, telefono, photo }) });
                if (!res.ok) {
                    const txt = await res.text().catch(()=>null);
                    throw new Error(txt || 'Server error creating user');
                }
                const body = await res.json();
                created = body.user || null;
            }

            if (created) {
                // Refresh users from server into memory and update UI
                try {
                    if (adminManager && typeof adminManager.fetchUsers === 'function') {
                        await adminManager.fetchUsers();
                        adminManager.showUsers();
                    }
                } catch (err) {
                    console.warn('Created user but could not refresh users from server:', err);
                }

                const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
                if (modal) modal.hide();
                Swal.fire({ icon: 'success', title: 'Usuario creado', text: `${nombre} ${apellido} ha sido registrado correctamente`, timer: 2000, showConfirmButton: false });
                form.reset();
                return;
            }
        } catch (err) {
            console.warn('Error creating user on server, falling back to localStorage:', err);
            // fallback to localStorage creation
        }

        // If we reach here user creation failed on server; inform user (no local fallback)
        Swal.fire('Error', 'No se pudo crear el usuario en el servidor. Asegúrate de que el backend esté activo.', 'error');
        
    } catch (error) {
        console.error('Error en saveUser:', error);
        Swal.fire('Error', error.message || 'Error al guardar usuario', 'error');
    }
}

// === FUNCIONES PARA MANEJO DE IMÁGENES ===

// Mostrar opciones de imagen
function showImageOptions() {
    Swal.fire({
        title: 'Seleccionar imagen',
        text: '¿Cómo deseas agregar la imagen del producto?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fa-solid fa-camera"></i> Tomar foto',
        denyButtonText: '<i class="fa-solid fa-file-image"></i> Seleccionar archivo',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            startCamera();
        } else if (result.isDenied) {
            document.getElementById('fileInput').click();
        }
    });
}

// Iniciar cámara
async function startCamera() {
    try {
        const video = document.getElementById('cameraVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment' // Usa la cámara trasera si está disponible
            } 
        });
        
        video.srcObject = stream;
        video.style.display = 'block';
        
        // Mostrar modal con cámara
        Swal.fire({
            title: 'Tomar foto del producto',
            html: `
                <div class="text-center">
                    <video id="swalCameraVideo" width="400" height="300" autoplay style="border-radius: 8px;"></video>
                    <br><br>
                    <button type="button" class="btn btn-success me-2" onclick="capturePhoto()">
                        <i class="fa-solid fa-camera"></i> Capturar
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="stopCamera()">
                        <i class="fa-solid fa-times"></i> Cancelar
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: false,
            width: '500px',
            didOpen: () => {
                // Copiar el stream al video del modal
                const modalVideo = document.getElementById('swalCameraVideo');
                modalVideo.srcObject = stream;
            }
        });
        
        // Guardar referencia del stream para poder cerrarlo
        window.currentCameraStream = stream;
    } catch (err) {
        console.error('startCamera error:', err);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo iniciar la cámara. Verifique los permisos.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Capturar foto
function capturePhoto() {
    const video = document.getElementById('swalCameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const ctx = canvas.getContext('2d');
    
    // Establecer el tamaño del canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dibujar el frame actual del video en el canvas
    ctx.drawImage(video, 0, 0);
    
    // Convertir a base64
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Establecer la imagen
    document.getElementById('productImage').value = imageDataUrl;
    showImagePreview(imageDataUrl);
    
    // Cerrar cámara y modal
    stopCamera();
    Swal.close();
    
    Swal.fire({
        title: '¡Foto capturada!',
        text: 'La imagen se ha guardado correctamente.',
        icon: 'success',
        timer: 2000
    });
}

// Detener cámara
function stopCamera() {
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => track.stop());
        window.currentCameraStream = null;
    }
    
    const video = document.getElementById('cameraVideo');
    video.style.display = 'none';
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

// Manejar selección de archivo
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
        Swal.fire('Error', 'Por favor selecciona un archivo de imagen válido.', 'error');
        return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Error', 'La imagen debe ser menor a 5MB.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageDataUrl = e.target.result;
        document.getElementById('productImage').value = imageDataUrl;
        showImagePreview(imageDataUrl);
        
        Swal.fire({
            title: '¡Imagen cargada!',
            text: 'La imagen se ha cargado correctamente.',
            icon: 'success',
            timer: 2000
        });
    };
    
    reader.readAsDataURL(file);
}

// Mostrar preview de imagen
function showImagePreview(imageSrc) {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImage = document.getElementById('imagePreview');
    
    previewImage.src = imageSrc;
    previewContainer.style.display = 'block';
}

// Limpiar preview de imagen
function clearImagePreview() {
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('imagePreview').src = '';
    document.getElementById('fileInput').value = '';
}

// === FUNCIONES PARA MANEJO DE FOTOS DE USUARIOS ===

// Mostrar opciones de imagen para usuario
function showUserImageOptions() {
    Swal.fire({
        title: 'Seleccionar foto de usuario',
        text: '¿Cómo deseas agregar la foto del usuario?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fa-solid fa-camera"></i> Tomar foto',
        denyButtonText: '<i class="fa-solid fa-file-image"></i> Seleccionar archivo',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            startUserCamera();
        } else if (result.isDenied) {
            document.getElementById('userFileInput').click();
        }
    });
}

// Iniciar cámara para usuario
function startUserCamera() {
    const video = document.getElementById('userCameraVideo');
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            video.srcObject = stream;
            video.style.display = 'block';
            
            Swal.fire({
                title: 'Tomar foto del usuario',
                html: `
                    <div class="text-center">
                        <video id="swalUserVideo" width="300" height="200" autoplay></video>
                        <br><br>
                        <button type="button" class="btn btn-primary" onclick="captureUserPhoto()">
                            <i class="fa-solid fa-camera"></i> Capturar
                        </button>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'Cancelar',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isDismissed) {
                    stopUserCamera();
                }
            });
            
            // Conectar el stream al video del modal
            const swalVideo = document.getElementById('swalUserVideo');
            if (swalVideo) {
                swalVideo.srcObject = stream;
            }
        })
        .catch(function(err) {
            console.error('Error accessing camera:', err);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo acceder a la cámara. Verifique los permisos.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        });
}

// Capturar foto del usuario
function captureUserPhoto() {
    const video = document.getElementById('swalUserVideo') || document.getElementById('userCameraVideo');
    const canvas = document.getElementById('userCameraCanvas');
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg');
    
    document.getElementById('userPhoto').value = imageDataUrl;
    showUserPhotoPreview(imageDataUrl);
    
    stopUserCamera();
    Swal.close();
    
    Swal.fire({
        title: '¡Foto capturada!',
        text: 'La foto del usuario se ha capturado correctamente.',
        icon: 'success',
        timer: 2000
    });
}

// Detener cámara del usuario
function stopUserCamera() {
    const video = document.getElementById('userCameraVideo');
    const swalVideo = document.getElementById('swalUserVideo');
    
    [video, swalVideo].forEach(v => {
        if (v && v.srcObject) {
            const tracks = v.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            v.srcObject = null;
            v.style.display = 'none';
        }
    });
}

// Manejar selección de archivo para usuario
function handleUserFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        Swal.fire({
            title: 'Archivo inválido',
            text: 'Por favor seleccione un archivo de imagen válido.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageDataUrl = e.target.result;
        document.getElementById('userPhoto').value = imageDataUrl;
        showUserPhotoPreview(imageDataUrl);
        
        Swal.fire({
            title: '¡Imagen cargada!',
            text: 'La foto del usuario se ha cargado correctamente.',
            icon: 'success',
            timer: 2000
        });
    };
    
    reader.readAsDataURL(file);
}

// Mostrar preview de foto del usuario
function showUserPhotoPreview(imageSrc) {
    const previewImage = document.getElementById('userPhotoPreview');
    try {
        let src = (imageSrc || '').toString().trim();
        // If empty, use default placeholder
        if (!src) {
            src = './static/img/placeholder.svg';
        } else {
            // If it's already a data URL or absolute/relative path, keep it; otherwise normalize
            const looksAbsolute = /^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('/') || src.startsWith('./');
            if (!looksAbsolute) {
                // If it looks like a placeholder size or contains ?text=, prefix via.placeholder
                if (/^\d+x\d+\?/i.test(src) || src.includes('?text=')) {
                    // Use local placeholder instead of external via.placeholder.com
                    src = './static/img/placeholder.svg';
                } else {
                    // Treat as local filename
                    src = './static/img/' + src;
                }
            }
        }

        // Fallback to placeholder if the image fails to load
        previewImage.onerror = function() {
            console.warn('User photo failed to load, falling back to placeholder for', imageSrc);
            previewImage.onerror = null;
            previewImage.src = './static/img/placeholder.svg';
        };

        previewImage.src = src;
        } catch (e) {
        console.error('showUserPhotoPreview error:', e);
        try { document.getElementById('userPhotoPreview').src = './static/img/placeholder.svg'; } catch(_){ }
    }
}

// Limpiar foto del usuario
function clearUserPhoto() {
    document.getElementById('userPhoto').value = '';
    document.getElementById('userPhotoPreview').src = './static/img/placeholder.svg';
    document.getElementById('userFileInput').value = '';
}

// === FUNCIONES DE DEBUG PARA PRODUCTOS ===

// Función de debug para editar producto directamente
function editProductDirect(productId) {
    console.log('DEBUG: editProductDirect llamada con ID:', productId);
    
    const productos = (typeof adminManager !== 'undefined' && adminManager.getProducts) ? adminManager.getProducts() : [];
    console.log('DEBUG: productos encontrados:', productos.length);
    
    const producto = productos.find(p => p.id == productId);
    console.log('DEBUG: producto encontrado:', producto);
    
    if (!producto) {
        console.error('DEBUG: Producto no encontrado');
        Swal.fire('Error', 'Producto no encontrado', 'error');
        return;
    }
    
    // Cambiar título del modal
    document.querySelector('#productModal .modal-title').textContent = 'Editar Producto';
    
    // Llenar campos del formulario
    document.getElementById('productId').value = producto.id;
    document.getElementById('productName').value = producto.nombre || '';
    document.getElementById('productPrice').value = producto.precio || '';
    document.getElementById('productCategory').value = producto.categoria || '';
    document.getElementById('productImage').value = producto.imagen || '';
    document.getElementById('productDescription').value = producto.descripcion || '';
    
    // Mostrar preview de imagen si existe
    if (producto.imagen) {
        showImagePreview(producto.imagen);
    } else {
        clearImagePreview();
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
    
    console.log('DEBUG: Modal mostrado exitosamente');
}

    // Función de test para debugging
    function testEditProduct(productId) {
    console.log('=== TEST EDIT PRODUCT ===');
    console.log('ID recibido:', productId, 'tipo:', typeof productId);
    
    // Verificar elementos del DOM
    const modal = document.getElementById('productModal');
    const productIdField = document.getElementById('productId');
    const nameField = document.getElementById('productName');
    
    console.log('Modal encontrado:', !!modal);
    console.log('Campo productId encontrado:', !!productIdField);
    console.log('Campo nombre encontrado:', !!nameField);
    
    // Verificar datos en memoria (servidor)
    const productos = (typeof adminManager !== 'undefined' && adminManager.getProducts) ? adminManager.getProducts() : [];
    console.log('Total productos en memoria:', productos.length);
    
    const producto = productos.find(p => p.id == productId);
    console.log('Producto encontrado:', !!producto);
    
    if (producto) {
        console.log('Datos del producto:', producto);
        editProductDirect(productId);
    } else {
        console.error('Producto no encontrado en localStorage');
        Swal.fire('Debug', `Producto con ID ${productId} no encontrado. Productos disponibles: ${productos.map(p => p.id).join(', ')}`, 'info');
    }
}

// === FUNCIÓN SIMPLIFICADA PARA PRUEBAS ===
function debugEditProduct(id) {
    console.log('=== DEBUG EDIT PRODUCT ===');
    console.log('ID recibido:', id);
    
    // Verificar que adminManager existe
    console.log('adminManager existe:', typeof adminManager);
    
    // Llamar directamente al método
    if (typeof adminManager !== 'undefined' && adminManager.editProduct) {
        console.log('Llamando a adminManager.editProduct...');
        adminManager.editProduct(id);
    } else {
        console.error('adminManager no está disponible');
        alert('Error: adminManager no está disponible');
    }
}

// === FUNCIÓN PARA SINCRONIZACIÓN COMPLETA ===
function forceSync() {
    console.log('🔄 Forzando sincronización completa...');
    
    if (typeof productManager !== 'undefined') {
        productManager.syncWithAdminProducts();
        console.log('✅ ProductManager sincronizado');
    }
    
    if (typeof adminManager !== 'undefined') {
        adminManager.showProducts();
        console.log('✅ Admin panel actualizado');
    }
    
    // Recargar productos en la vista del cliente si estamos en esa página
    if (typeof loadProducts === 'function') {
        loadProducts();
        console.log('✅ Vista de productos actualizada');
    }
}

// === FUNCIÓN PARA ALERTAS DE PRODUCTOS ===
function showProductRegisteredAlert(productData) {
    console.log('Showing product registered alert for:', productData.nombre);
    
    Swal.fire({
        icon: 'success',
        title: '¡Producto registrado!',
        text: `${productData.nombre} ha sido registrado correctamente`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}
