// Admin Panel Manager - Gestión completa con localStorage
class AdminPanelManager {
    constructor() {
        this.initializeAdmin();
        this.initializeAllData();
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
            preConfirm: () => {
                const email = document.getElementById('adminEmail').value;
                const password = document.getElementById('adminPassword').value;
                
                if (!email || !password) {
                    Swal.showValidationMessage('Completa todos los campos');
                    return false;
                }
                
                if (email === 'admin@gmail.com' && password === '123456') {
                    localStorage.setItem('adminLoggedIn', 'true');
                    localStorage.setItem('adminEmail', email);
                    return true;
                } else {
                    Swal.showValidationMessage('Credenciales incorrectas');
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.showAdminPanel();
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
        if (!localStorage.getItem('products')) {
            const defaultProducts = [
                {
                    id: 1,
                    nombre: "Refrigeradora Samsung RF28T5001SR",
                    precio: 1299.99,
                    categoria: "refrigeracion",
                    imagen: "./static/img/refrigeradora.png",
                    descripcion: "Refrigeradora de 28 pies cúbicos con tecnología Twin Cooling Plus"
                },
                {
                    id: 2,
                    nombre: "Microondas LG MS2596OB",
                    precio: 189.99,
                    categoria: "cocina",
                    imagen: "./static/img/microondas.png",
                    descripcion: "Microondas de 25 litros con grill y función auto-cook"
                },
                {
                    id: 3,
                    nombre: "Licuadora Oster BLSTPB-WBL",
                    precio: 89.99,
                    categoria: "pequenos",
                    imagen: "./static/img/licuadora.png",
                    descripcion: "Licuadora de 6 velocidades con jarra de vidrio"
                },
                {
                    id: 4,
                    nombre: "Cafetera Hamilton Beach 49980A",
                    precio: 79.99,
                    categoria: "pequenos",
                    imagen: "./static/img/cafetera.png",
                    descripcion: "Cafetera programable de 12 tazas con jarra térmica"
                },
                {
                    id: 5,
                    nombre: "Hervidor Eléctrico Cuisinart CPK-17",
                    precio: 99.99,
                    categoria: "pequenos",
                    imagen: "./static/img/hervidor.png",
                    descripcion: "Hervidor eléctrico de acero inoxidable con control de temperatura"
                }
            ];
            localStorage.setItem('products', JSON.stringify(defaultProducts));
        }
    }

    // Inicializar usuarios de ejemplo
    initializeUsers() {
        const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        if (existingUsers.length === 0) {
            const defaultUsers = [
                {
                    email: "juan.perez@email.com",
                    nombre: "Juan",
                    apellido: "Pérez",
                    cedula: "1234567890",
                    telefono: "0987654321",
                    password: "123456",
                    fechaRegistro: new Date().toISOString()
                },
                {
                    email: "maria.garcia@email.com",
                    nombre: "María",
                    apellido: "García",
                    cedula: "0987654321",
                    telefono: "0912345678",
                    password: "123456",
                    fechaRegistro: new Date().toISOString()
                }
            ];
            localStorage.setItem('registeredUsers', JSON.stringify(defaultUsers));
        }
    }

    // Inicializar pedidos de ejemplo
    initializeOrders() {
        if (!localStorage.getItem('pedidos')) {
            const defaultOrders = [
                {
                    id: "ORD-001",
                    numeroOrden: "ORD-001",
                    cliente: {
                        nombre: "Juan Pérez",
                        email: "juan.perez@email.com",
                        telefono: "0987654321"
                    },
                    productos: [
                        {
                            id: 1,
                            nombre: "Refrigeradora Samsung RF28T5001SR",
                            precio: 1299.99,
                            cantidad: 1,
                            imagen: "./static/img/refrigeradora.png"
                        }
                    ],
                    totales: {
                        subtotal: 1299.99,
                        iva: 155.99,
                        envio: 3.50,
                        total: 1459.48
                    },
                    estado: "confirmado",
                    fecha: new Date().toISOString(),
                    entrega: {
                        direccion: "Av. Amazonas 123, Quito"
                    },
                    pago: {
                        metodo: "tarjeta_credito"
                    }
                }
            ];
            localStorage.setItem('pedidos', JSON.stringify(defaultOrders));
        }
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
        
        // Cargar pedidos recientes
        this.loadRecentOrders();
        this.loadTopProducts();
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
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center py-2">
                <div>Refrigeradora Samsung</div>
                <span class="badge bg-primary">5 ventas</span>
            </div>
            <div class="d-flex justify-content-between align-items-center py-2">
                <div>Microondas LG</div>
                <span class="badge bg-primary">3 ventas</span>
            </div>
            <div class="d-flex justify-content-between align-items-center py-2">
                <div>Licuadora Oster</div>
                <span class="badge bg-primary">2 ventas</span>
            </div>
        `;
    }

    // Obtener color del estado
    getStatusColor(estado) {
        switch(estado) {
            case 'confirmado': return 'success';
            case 'enviado': return 'info';
            case 'entregado': return 'success';
            case 'cancelado': return 'danger';
            default: return 'warning';
        }
    }

    // === GESTIÓN DE PRODUCTOS ===
    
    // Mostrar productos
    showProducts() {
        const productos = this.getProducts();
        const tbody = document.getElementById('productsTable');
        
        tbody.innerHTML = productos.map(producto => `
            <tr>
                <td>${producto.id}</td>
                <td>
                    <img src="${producto.imagen}" alt="${producto.nombre}" 
                         style="width: 50px; height: 50px; object-fit: cover;" class="rounded">
                </td>
                <td>${producto.nombre}</td>
                <td>$${producto.precio.toFixed(2)}</td>
                <td>${this.getCategoryName(producto.categoria)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="adminManager.editProduct(${producto.id})">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminManager.deleteProduct(${producto.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Obtener productos
    getProducts() {
        return JSON.parse(localStorage.getItem('products') || '[]');
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
        const productos = this.getProducts();
        const newId = Math.max(...productos.map(p => p.id), 0) + 1;
        
        // Generar código único si no se proporciona
        let codigoUnico = productData.codigo;
        if (!codigoUnico) {
            codigoUnico = this.generateUniqueProductCode();
            
            // Verificar que el código sea único
            let codeExists = productos.some(p => p.codigo === codigoUnico);
            while (codeExists) {
                codigoUnico = this.generateUniqueProductCode();
                codeExists = productos.some(p => p.codigo === codigoUnico);
            }
        } else {
            // Validar el código proporcionado
            const validation = this.validateProductCode(codigoUnico, productos);
            if (!validation.valid) {
                Swal.fire('Error', validation.message, 'error');
                return;
            }
        }
        
        const newProduct = {
            id: newId,
            ...productData,
            codigo: codigoUnico,
            precio: parseFloat(productData.precio),
            fechaCreacion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString()
        };
        
        productos.push(newProduct);
        localStorage.setItem('products', JSON.stringify(productos));
        
        // Actualizar productManager.js también
        if (typeof productManager !== 'undefined') {
            productManager.products = productos;
        }
        
        this.showProducts();
        
        Swal.fire({
            title: '¡Éxito!',
            text: 'Producto agregado correctamente',
            icon: 'success',
            timer: 2000
        });
    }

    // Editar producto
    editProduct(id) {
        const productos = this.getProducts();
        const producto = productos.find(p => p.id === id);
        
        if (!producto) {
            Swal.fire('Error', 'Producto no encontrado', 'error');
            return;
        }
        
        // Llenar formulario con datos del producto
        document.getElementById('productId').value = producto.id;
        document.getElementById('productName').value = producto.nombre;
        document.getElementById('productPrice').value = producto.precio;
        document.getElementById('productCategory').value = producto.categoria;
        document.getElementById('productImage').value = producto.imagen;
        document.getElementById('productDescription').value = producto.descripcion || '';
        
        // Cambiar título del modal
        document.querySelector('#productModal .modal-title').textContent = 'Editar Producto';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        modal.show();
    }

    // Actualizar producto
    updateProduct(productData) {
        const productos = this.getProducts();
        const index = productos.findIndex(p => p.id === parseInt(productData.id));
        
        if (index === -1) {
            Swal.fire('Error', 'Producto no encontrado', 'error');
            return;
        }
        
        productos[index] = {
            ...productos[index],
            ...productData,
            id: parseInt(productData.id),
            precio: parseFloat(productData.precio)
        };
        
        localStorage.setItem('products', JSON.stringify(productos));
        
        // Actualizar productManager.js también
        if (typeof productManager !== 'undefined') {
            productManager.products = productos;
        }
        
        this.showProducts();
        
        Swal.fire({
            title: '¡Éxito!',
            text: 'Producto actualizado correctamente',
            icon: 'success',
            timer: 2000
        });
    }

    // Eliminar producto
    deleteProduct(id) {
        Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                const productos = this.getProducts();
                const filteredProducts = productos.filter(p => p.id !== id);
                
                localStorage.setItem('products', JSON.stringify(filteredProducts));
                
                // Actualizar productManager.js también
                if (typeof productManager !== 'undefined') {
                    productManager.products = filteredProducts;
                }
                
                this.showProducts();
                
                Swal.fire({
                    title: '¡Eliminado!',
                    text: 'El producto ha sido eliminado',
                    icon: 'success',
                    timer: 2000
                });
            }
        });
    }

    // === GESTIÓN DE USUARIOS ===
    
    // Mostrar usuarios
    showUsers() {
        const usuarios = this.getUsers();
        const tbody = document.getElementById('usersTable');
        
        tbody.innerHTML = usuarios.map(user => `
            <tr>
                <td>${user.email}</td>
                <td>${user.nombre}</td>
                <td>${user.apellido}</td>
                <td>${user.cedula}</td>
                <td>${user.fechaRegistro ? new Date(user.fechaRegistro).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="adminManager.viewUser('${user.email}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminManager.deleteUser('${user.email}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Obtener usuarios
    getUsers() {
        return JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    }

    // Ver detalles de usuario
    viewUser(email) {
        const usuarios = this.getUsers();
        const user = usuarios.find(u => u.email === email);
        
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
    }

    // Eliminar usuario
    deleteUser(email) {
        Swal.fire({
            title: '¿Eliminar usuario?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                const usuarios = this.getUsers();
                const filteredUsers = usuarios.filter(u => u.email !== email);
                
                localStorage.setItem('registeredUsers', JSON.stringify(filteredUsers));
                this.showUsers();
                
                Swal.fire({
                    title: '¡Eliminado!',
                    text: 'El usuario ha sido eliminado',
                    icon: 'success',
                    timer: 2000
                });
            }
        });
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
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="adminManager.viewOrder('${order.id || order.numeroOrden}')" title="Ver detalles">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="adminManager.changeOrderStatus('${order.id || order.numeroOrden}')" title="Cambiar estado">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info me-1" onclick="adminManager.editInvoice('${order.id || order.numeroOrden}')" title="Editar factura completa">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminManager.deleteOrder('${order.id || order.numeroOrden}')" title="Eliminar pedido">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Obtener pedidos
    getOrders() {
        // Combinar pedidos de diferentes fuentes
        const pedidos = JSON.parse(localStorage.getItem('pedidos') || '[]');
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        
        // Combinar y eliminar duplicados
        const allOrders = [...pedidos, ...comprasHistorial];
        const uniqueOrders = allOrders.filter((order, index, self) => 
            index === self.findIndex(o => (o.id || o.numeroOrden) === (order.id || order.numeroOrden))
        );
        
        return uniqueOrders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }

    // Ver detalles de pedido
    viewOrder(orderId) {
        const pedidos = this.getOrders();
        const order = pedidos.find(o => (o.id || o.numeroOrden) === orderId);
        
        if (!order) {
            Swal.fire('Error', 'Pedido no encontrado', 'error');
            return;
        }
        
        const productosHtml = order.productos ? order.productos.map(p => `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div class="d-flex align-items-center">
                    <img src="${p.imagen || './static/img/producto.png'}" alt="${p.nombre}" 
                         style="width: 40px; height: 40px; object-fit: cover;" class="rounded me-2">
                    <div>
                        <div class="fw-bold">${p.nombre}</div>
                        <small class="text-muted">Cantidad: ${p.cantidad}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold">$${(p.precio * p.cantidad).toFixed(2)}</div>
                    <small class="text-muted">$${p.precio.toFixed(2)} c/u</small>
                </div>
            </div>
        `).join('') : '<p>No hay productos disponibles</p>';
        
        Swal.fire({
            title: `Pedido #${order.id || order.numeroOrden}`,
            html: `
                <div class="text-start">
                    <h6>Cliente:</h6>
                    <p>${order.cliente?.nombre || 'N/A'}<br>
                    ${order.cliente?.email || ''}<br>
                    ${order.cliente?.telefono || ''}</p>
                    
                    <h6>Productos:</h6>
                    <div class="mb-3">${productosHtml}</div>
                    
                    <h6>Totales:</h6>
                    <p>
                        Subtotal: $${order.totales?.subtotal?.toFixed(2) || '0.00'}<br>
                        IVA (15%): $${order.totales?.iva?.toFixed(2) || '0.00'}<br>
                        Envío: $${order.totales?.envio?.toFixed(2) || '0.00'}<br>
                        <strong>Total: $${order.totales?.total?.toFixed(2) || '0.00'}</strong>
                    </p>
                    
                    <h6>Entrega:</h6>
                    <p>${order.entrega?.direccion || 'Dirección no especificada'}</p>
                    
                    <h6>Estado:</h6>
                    <span class="badge bg-${this.getStatusColor(order.estado)}">${order.estado || 'pendiente'}</span>
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
        // Actualizar en pedidos
        const pedidos = JSON.parse(localStorage.getItem('pedidos') || '[]');
        const pedidoIndex = pedidos.findIndex(o => (o.id || o.numeroOrden) === orderId);
        
        if (pedidoIndex !== -1) {
            pedidos[pedidoIndex].estado = newStatus;
            localStorage.setItem('pedidos', JSON.stringify(pedidos));
        }
        
        // Actualizar en historial de compras
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        const compraIndex = comprasHistorial.findIndex(o => (o.id || o.numeroOrden) === orderId);
        
        if (compraIndex !== -1) {
            comprasHistorial[compraIndex].estado = newStatus;
            localStorage.setItem('comprasHistorial', JSON.stringify(comprasHistorial));
        }
        
        this.showOrders();
        
        Swal.fire({
            title: '¡Actualizado!',
            text: `Estado cambiado a: ${newStatus}`,
            icon: 'success',
            timer: 2000
        });
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
                // Eliminar de pedidos
                const pedidos = JSON.parse(localStorage.getItem('pedidos') || '[]');
                const filteredPedidos = pedidos.filter(o => (o.id || o.numeroOrden) !== orderId);
                localStorage.setItem('pedidos', JSON.stringify(filteredPedidos));
                
                // Eliminar del historial de compras
                const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
                const filteredCompras = comprasHistorial.filter(o => (o.id || o.numeroOrden) !== orderId);
                localStorage.setItem('comprasHistorial', JSON.stringify(filteredCompras));
                
                this.showOrders();
                
                Swal.fire({
                    title: '¡Eliminado!',
                    text: 'El pedido ha sido eliminado',
                    icon: 'success',
                    timer: 2000
                });
            }
        });
    }

    // Editar factura completa
    editInvoice(orderId) {
        // Buscar la orden
        const pedidos = JSON.parse(localStorage.getItem('pedidos') || '[]');
        const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        
        let order = pedidos.find(o => (o.id || o.numeroOrden) === orderId) || 
                   comprasHistorial.find(o => (o.id || o.numeroOrden) === orderId);
        
        if (!order) {
            Swal.fire('Error', 'Factura no encontrada', 'error');
            return;
        }

        // Cargar productos disponibles
        const productos = JSON.parse(localStorage.getItem('productos') || '[]');
        
        // Productos actuales de la orden
        const productosOrden = order.productos || [];
        
        // Crear HTML para productos
        const productosHtml = productosOrden.map((prod, index) => `
            <div class="producto-item border rounded p-3 mb-2" data-index="${index}">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <select class="form-select producto-select" onchange="adminManager.updateProductInfo(${index})">
                            <option value="">Seleccionar producto</option>
                            ${productos.map(p => `
                                <option value="${p.id}" data-precio="${p.precio}" data-nombre="${p.nombre}" 
                                        ${p.id == prod.id ? 'selected' : ''}>
                                    ${p.nombre} - $${p.precio}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control cantidad-input" 
                               placeholder="Cant." min="1" value="${prod.cantidad || 1}"
                               onchange="adminManager.calcularSubtotalProducto(${index})">
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control precio-input" 
                               placeholder="Precio" step="0.01" value="${prod.precio || 0}"
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
        `).join('');

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
                                <input id="editClienteName" class="form-control mb-2" placeholder="Nombre completo" value="${order.cliente?.nombre || ''}">
                            </div>
                            <div class="col-md-6">
                                <input id="editClienteEmail" class="form-control mb-2" placeholder="Email" value="${order.cliente?.email || ''}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editClienteTelefono" class="form-control mb-2" placeholder="Teléfono" value="${order.cliente?.telefono || ''}">
                            </div>
                            <div class="col-md-6">
                                <input id="editClienteCedula" class="form-control mb-2" placeholder="Cédula" value="${order.cliente?.cedula || ''}">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dirección y Entrega -->
                    <div class="mb-4">
                        <h6 class="border-bottom pb-2"><i class="fa-solid fa-map-marker-alt me-2"></i>Dirección y Entrega</h6>
                        <textarea id="editDireccion" class="form-control mb-2" rows="2" placeholder="Dirección completa">${order.entrega?.direccion || ''}</textarea>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editCiudad" class="form-control mb-2" placeholder="Ciudad" value="${order.entrega?.ciudad || ''}">
                            </div>
                            <div class="col-md-6">
                                <input id="editProvincia" class="form-control mb-2" placeholder="Provincia" value="${order.entrega?.provincia || ''}">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <input id="editCodigoPostal" class="form-control mb-2" placeholder="Código Postal" value="${order.entrega?.codigoPostal || ''}">
                            </div>
                            <div class="col-md-6">
                                <select id="editMetodoEntrega" class="form-select">
                                    <option value="domicilio" ${order.entrega?.metodo === 'domicilio' ? 'selected' : ''}>Envío a domicilio</option>
                                    <option value="retiro" ${order.entrega?.metodo === 'retiro' ? 'selected' : ''}>Retiro en tienda</option>
                                </select>
                            </div>
                        </div>
                        <textarea id="editInstrucciones" class="form-control" rows="2" placeholder="Instrucciones de entrega">${order.entrega?.instrucciones || ''}</textarea>
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
                                <input id="editSubtotal" class="form-control" type="number" step="0.01" value="${order.totales?.subtotal || 0}" readonly>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Envío:</label>
                                <input id="editEnvio" class="form-control" type="number" step="0.01" value="${order.totales?.envio || 0}" onchange="adminManager.recalcularTotales()">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">IVA (15%):</label>
                                <input id="editIva" class="form-control" type="number" step="0.01" value="${order.totales?.iva || 0}" readonly>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-md-12">
                                <label class="form-label"><strong>Total:</strong></label>
                                <input id="editTotal" class="form-control fw-bold" type="number" step="0.01" value="${order.totales?.total || 0}" readonly>
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

    // Funciones auxiliares para edición de facturas
    
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
        const productos = JSON.parse(localStorage.getItem('productos') || '[]');
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
        try {
            // Actualizar en pedidos
            const pedidos = JSON.parse(localStorage.getItem('pedidos') || '[]');
            const pedidoIndex = pedidos.findIndex(o => (o.id || o.numeroOrden) === orderId);
            
            if (pedidoIndex !== -1) {
                // Mantener datos originales importantes
                const originalOrder = pedidos[pedidoIndex];
                pedidos[pedidoIndex] = {
                    ...originalOrder,
                    ...updatedData,
                    id: originalOrder.id || originalOrder.numeroOrden,
                    numeroOrden: originalOrder.numeroOrden || originalOrder.id,
                    fechaModificacion: new Date().toISOString()
                };
                localStorage.setItem('pedidos', JSON.stringify(pedidos));
            }
            
            // Actualizar en historial de compras
            const comprasHistorial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
            const compraIndex = comprasHistorial.findIndex(o => (o.id || o.numeroOrden) === orderId);
            
            if (compraIndex !== -1) {
                const originalOrder = comprasHistorial[compraIndex];
                comprasHistorial[compraIndex] = {
                    ...originalOrder,
                    ...updatedData,
                    id: originalOrder.id || originalOrder.numeroOrden,
                    numeroOrden: originalOrder.numeroOrden || originalOrder.id,
                    fechaModificacion: new Date().toISOString()
                };
                localStorage.setItem('comprasHistorial', JSON.stringify(comprasHistorial));
            }
            
            // Actualizar órdenes específicas del usuario si existen
            const userEmail = updatedData.cliente?.email;
            if (userEmail) {
                const userOrders = JSON.parse(localStorage.getItem(`orders_${userEmail}`) || '[]');
                const userOrderIndex = userOrders.findIndex(o => (o.id || o.numeroOrden) === orderId);
                
                if (userOrderIndex !== -1) {
                    const originalOrder = userOrders[userOrderIndex];
                    userOrders[userOrderIndex] = {
                        ...originalOrder,
                        ...updatedData,
                        fechaModificacion: new Date().toISOString()
                    };
                    localStorage.setItem(`orders_${userEmail}`, JSON.stringify(userOrders));
                }
            }
            
            this.showOrders();
            
            Swal.fire({
                title: '¡Factura Actualizada Completamente!',
                text: 'Todos los cambios han sido guardados exitosamente',
                icon: 'success',
                timer: 3000
            });
            
        } catch (error) {
            console.error('Error guardando cambios:', error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un problema al guardar los cambios: ' + error.message,
                icon: 'error'
            });
        }
    }

    // =================== FUNCIONES DE CÓDIGOS ÚNICOS ===================

    // Generar código único para productos
    generateUniqueProductCode() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `PRD-${timestamp}-${randomStr}`.toUpperCase();
    }

    // Validar código único de producto
    validateProductCode(code, productos = null) {
        // Verificar formato básico
        const codeRegex = /^PRD-[A-Z0-9]+-[A-Z0-9]+$/;
        
        if (!codeRegex.test(code)) {
            return { valid: false, message: 'Formato de código inválido. Use: PRD-XXXXX-XXXXX' };
        }
        
        // Verificar si el código ya existe
        const existingProducts = productos || this.getProducts();
        const codeExists = existingProducts.some(product => product.codigo === code);
        
        if (codeExists) {
            return { valid: false, message: 'El código ya existe' };
        }
        
        return { valid: true, message: 'Código válido' };
    }

    // Buscar producto por código
    findProductByCode(code) {
        const productos = this.getProducts();
        return productos.find(product => product.codigo === code);
    }

    // Función para mostrar información de código en el modal
    showCodeInfo() {
        Swal.fire({
            title: 'Información de Códigos de Producto',
            html: `
                <div class="text-start">
                    <h6>📋 Formato del Código:</h6>
                    <p><code>PRD-[TIMESTAMP]-[RANDOM]</code></p>
                    <p><strong>Ejemplo:</strong> <code>PRD-L7K2M9-A8F5G3</code></p>
                    
                    <h6>✨ Características:</h6>
                    <ul>
                        <li>Único e irrepetible</li>
                        <li>Generado automáticamente</li>
                        <li>Basado en timestamp + números aleatorios</li>
                        <li>Fácil de identificar con prefijo "PRD-"</li>
                    </ul>
                    
                    <h6>🔍 Usos:</h6>
                    <ul>
                        <li>Identificación única de productos</li>
                        <li>Seguimiento de inventario</li>
                        <li>Referencias en facturas</li>
                        <li>Control de stock</li>
        });
    }
}

// =================== FUNCIONES DE CÓDIGOS ÚNICOS ===================

// Generar código único para productos
AdminPanelManager.prototype.generateUniqueProductCode = function() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `PRD-${timestamp}-${randomStr}`.toUpperCase();
};

// Validar código único de producto
AdminPanelManager.prototype.validateProductCode = function(code, productos = null) {
    // Verificar formato básico
    const codeRegex = /^PRD-[A-Z0-9]+-[A-Z0-9]+$/;
    
    if (!codeRegex.test(code)) {
        return { valid: false, message: 'Formato de código inválido. Use: PRD-XXXXX-XXXXX' };
    }
    
    // Verificar si el código ya existe
    const existingProducts = productos || this.getProducts();
    const codeExists = existingProducts.some(product => product.codigo === code);
    
    if (codeExists) {
        return { valid: false, message: 'El código ya existe' };
    }
    
    return { valid: true, message: 'Código válido' };
};

// Buscar producto por código
AdminPanelManager.prototype.findProductByCode = function(code) {
    const productos = this.getProducts();
    return productos.find(product => product.codigo === code);
};

// Función para mostrar información de código en el modal
AdminPanelManager.prototype.showCodeInfo = function() {
    Swal.fire({
        title: 'Información de Códigos de Producto',
        html: `
            <div class="text-start">
                <h6>📋 Formato del Código:</h6>
                <p><code>PRD-[TIMESTAMP]-[RANDOM]</code></p>
                <p><strong>Ejemplo:</strong> <code>PRD-L7K2M9-A8F5G3</code></p>
                
                <h6>✨ Características:</h6>
                <ul>
                    <li>Único e irrepetible</li>
                    <li>Generado automáticamente</li>
                    <li>Basado en timestamp + números aleatorios</li>
                    <li>Fácil de identificar con prefijo "PRD-"</li>
                </ul>
                
                <h6>🔍 Usos:</h6>
                <ul>
                    <li>Identificación única de productos</li>
                    <li>Seguimiento de inventario</li>
                    <li>Referencias en facturas</li>
                    <li>Control de stock</li>
                </ul>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido'
    });
};

// Instanciar el administrador
const adminManager = new AdminPanelManager();

// Funciones globales para el HTML
function adminLogout() {
    if (adminManager) {
        adminManager.logout();
    }
}

// Funciones para mostrar secciones
function showDashboard() { 
    showSection('dashboard'); 
    adminManager.loadDashboard();
}

function showProducts() { 
    showSection('products'); 
    adminManager.showProducts();
}

function showUsers() { 
    showSection('users'); 
    adminManager.showUsers();
}

function showOrders() { 
    showSection('orders'); 
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
    // Limpiar formulario
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.querySelector('#productModal .modal-title').textContent = 'Agregar Producto';
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Guardar producto (agregar o editar)
function saveProduct() {
    const form = document.getElementById('productForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const productData = {
        nombre: document.getElementById('productName').value,
        precio: document.getElementById('productPrice').value,
        categoria: document.getElementById('productCategory').value,
        imagen: document.getElementById('productImage').value,
        descripcion: document.getElementById('productDescription').value
    };
    
    const productId = document.getElementById('productId').value;
    
    if (productId) {
        // Editar producto existente
        productData.id = productId;
        adminManager.updateProduct(productData);
    } else {
        // Agregar nuevo producto
        adminManager.addProduct(productData);
    }
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
}
