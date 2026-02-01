document.addEventListener("DOMContentLoaded", function() {
    // Inicializar sistemas principales
    actualizarCarritoUI();
    cargarCarrito();
    updateUserInterface();
    
    // Cargar productos si hay un contenedor
    if (document.getElementById('products-container')) {
        loadProductsFromManager();
    }
    
    // Sincronizar productos con admin si existe productManager
    if (typeof productManager !== 'undefined') {
        productManager.syncWithAdminProducts();
    }
    
    // Inicializar búsqueda
    initializeSearch();

    // Solicitar permisos de notificación
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Evento para confirmar el carrito (ya implementado)
    const confirmarBtn = document.getElementById("confirmar-productos");
    if (confirmarBtn) {
        confirmarBtn.addEventListener("click", function(event) {
            event.preventDefault();
            console.log('🛒 Checkout button clicked from main.js');
            if (typeof window.enviarCarrito === 'function') {
                window.enviarCarrito();
            } else if (typeof window.testCheckout === 'function') {
                window.testCheckout();
            } else {
                console.error('No checkout function available');
                alert('Sistema de checkout no disponible');
            }
        });
    }

    // Nuevo: Asignar el evento submit al formulario de dirección
    const addressForm = document.getElementById("address-form");
    if (addressForm) {
        addressForm.addEventListener("submit", function(e) {
            e.preventDefault();

            const provincia = document.getElementById("provincia").value;
            const canton = document.getElementById("canton").value;
            const parroquia = document.getElementById("parroquia").value;
            const calle_principal = document.getElementById("calle_principal").value;
            const calle_secundaria = document.getElementById("calle_secundaria").value;
            const codigo_postal = document.getElementById("codigo_postal").value;

            const addressData = {
                provincia: provincia,
                canton: canton,
                parroquia: parroquia,
                calle_principal: calle_principal,
                calle_secundaria: calle_secundaria,
                codigo_postal: parseInt(codigo_postal)
            };

            console.log('Dirección simulada guardada:', addressData);
            
            Swal.fire({
                title: 'Dirección guardada',
                text: 'Tu dirección ha sido registrada exitosamente.',
                icon: 'success',
                confirmButtonText: 'Continuar'
            }).then(() => {
                window.location.href = "cart.html";
            });
        });
    }

    // Agregar botones de filtro por categoría si existe el contenedor
    const filtersContainer = document.getElementById('category-filters');
    if (filtersContainer) {
        filtersContainer.innerHTML = `
            <div class="btn-group mb-3" role="group">
                <button type="button" class="btn btn-outline-primary active" onclick="filterByCategory('all')">Todos</button>
                <button type="button" class="btn btn-outline-primary" onclick="filterByCategory('electrodomesticos')">Electrodomésticos</button>
                <button type="button" class="btn btn-outline-primary" onclick="filterByCategory('cocina')">Cocina</button>
                <button type="button" class="btn btn-outline-primary" onclick="filterByCategory('hogar')">Hogar</button>
            </div>
        `;
    }
});

// --- Funciones de gestión de productos mejoradas ---

// Cargar productos dinámicamente
function loadProductsFromManager() {
    if (typeof productManager !== 'undefined') {
        const products = productManager.getAllProducts();
        const productContainer = document.getElementById('products-container');
        
        if (productContainer) {
            productContainer.innerHTML = '';
            
            products.forEach(product => {
                const productCard = createProductCard(product);
                productContainer.appendChild(productCard);
            });
        }
    }
}

// Crear tarjeta de producto
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'col-md-4 mb-4';
    
    card.innerHTML = `
        <div class="card product-card h-100">
            <img src="${product.imagen}" class="card-img-top" alt="${product.nombre}" style="height: 250px; object-fit: cover;">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${product.nombre}</h5>
                <p class="card-text">${product.descripcion}</p>
                <p class="text-muted"><small>${product.capacidad || 'N/A'}</small></p>
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="h5 text-primary mb-0">$${product.precio.toFixed(2)}</span>
                        <small class="text-muted">
                            <span class="badge ${product.stock <= 5 ? 'bg-danger' : product.stock <= 10 ? 'bg-warning text-dark' : 'bg-success'}">
                                Stock: ${product.stock || 0}
                            </span>
                        </small>
                    </div>
                    <button class="btn btn-primary w-100" 
                            onclick="agregarAlCarrito('${product.id}', '${product.nombre}', ${product.precio}, '${product.imagen}', '${product.capacidad || 'N/A'}')"
                            ${(product.stock || 0) <= 0 ? 'disabled' : ''}>
                        ${(product.stock || 0) <= 0 ? 'Sin Stock' : 'Agregar al Carrito'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Buscar productos
function searchProducts(query) {
    if (typeof productManager !== 'undefined') {
        const results = productManager.searchProducts(query);
        displaySearchResults(results);
    }
}

// Mostrar resultados de búsqueda
function displaySearchResults(products) {
    const productContainer = document.getElementById('products-container');
    
    if (productContainer) {
        productContainer.innerHTML = '';
        
        if (products.length === 0) {
            productContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fa-solid fa-search fa-2x mb-3"></i>
                        <h5>No se encontraron productos</h5>
                        <p>Intenta con otros términos de búsqueda</p>
                    </div>
                </div>
            `;
        } else {
            products.forEach(product => {
                const productCard = createProductCard(product);
                productContainer.appendChild(productCard);
            });
        }
    }
}

// Filtrar productos por categoría
function filterByCategory(category) {
    if (typeof productManager !== 'undefined') {
        const products = category === 'all' ? 
            productManager.getAllProducts() : 
            productManager.getProductsByCategory(category);
        displaySearchResults(products);
    }
}

// Inicializar barra de búsqueda
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                searchProducts(query);
            } else {
                loadProductsFromManager();
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    searchProducts(query);
                } else {
                    loadProductsFromManager();
                }
            }
        });
    }
}

// Función para mostrar historial de compras
function showPurchaseHistory() {
    if (localStorage.getItem('userLoggedIn') !== 'true') {
        Swal.fire({
            title: 'Acceso denegado',
            text: 'Necesitas iniciar sesión para ver tu historial',
            icon: 'warning',
            confirmButtonText: 'OK'
        });
        return;
    }

    if (typeof checkoutManager !== 'undefined') {
        const orders = checkoutManager.getUserOrders();
        
        if (orders.length === 0) {
            Swal.fire({
                title: 'Sin compras',
                text: 'Aún no has realizado ninguna compra',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }

        const ordersList = orders.map(order => `
            <div class="order-item mb-3 p-3 border rounded">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6>Pedido #${order.id}</h6>
                        <small class="text-muted">${new Date(order.fecha).toLocaleDateString()}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-success">${order.estado}</span>
                        <div><strong>$${order.resumen.total.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div class="mt-2">
                    <small>${order.resumen.cantidadProductos} productos</small>
                </div>
            </div>
        `).join('');

        Swal.fire({
            title: 'Historial de Compras',
            html: `<div style="max-height: 400px; overflow-y: auto;">${ordersList}</div>`,
            confirmButtonText: 'Cerrar',
            width: '600px'
        });
    }
}

// --- Funciones existentes para el carrito ---

function agregarAlCarrito(id, nombre, precio, imagen, mililitros) {
    console.log('🛒 agregarAlCarrito called with:', { id, nombre, precio, tipo: typeof id });
    
    try {
        // Verificar si el usuario está logueado
        if (localStorage.getItem('userLoggedIn') !== 'true') {
            console.log('User not logged in');
            Swal.fire({
                title: 'Necesitas una cuenta',
                text: 'Para comprar productos necesitas iniciar sesión o crear una cuenta',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Iniciar Sesión',
                cancelButtonText: 'Crear Cuenta',
                showDenyButton: true,
                denyButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'login.html';
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    window.location.href = 'signUp.html';
                }
            });
            return;
        }

        console.log('User is logged in, proceeding...');

        // Verificar stock disponible
        if (typeof productManager !== 'undefined') {
            console.log('ProductManager available, checking stock...');
            let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
            let productoExistente = carrito.find(p => p.id.toString() === id.toString());
            let cantidadActualEnCarrito = productoExistente ? productoExistente.cantidad : 0;
            let cantidadSolicitada = cantidadActualEnCarrito + 1;

            const stockCheck = productManager.checkStock(id, cantidadSolicitada);
            console.log('Stock check result:', stockCheck);
            
            if (!stockCheck.available) {
                Swal.fire({
                    title: 'Stock insuficiente',
                    text: stockCheck.message,
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }
        } else {
            console.log('ProductManager not available, skipping stock check');
        }

        console.log('Adding product to cart...');
        let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

        let productoExistente = carrito.find(p => p.id.toString() === id.toString());
        if (productoExistente) {
            productoExistente.cantidad++;
            console.log('Updated existing product quantity');
        } else {
            carrito.push({ id, nombre, precio: parseFloat(precio), imagen, mililitros, cantidad: 1 });
            console.log('Added new product to cart');
        }

        localStorage.setItem("carrito", JSON.stringify(carrito));
        actualizarCarritoUI();

        let cartIcon = document.getElementById("cart-icon");
        if (cartIcon) {
            cartIcon.classList.add("cart-animate");
            setTimeout(() => cartIcon.classList.remove("cart-animate"), 300);
        }

        console.log('Product added successfully, showing success message');
        Swal.fire({
            title: "Producto agregado",
            text: `"${nombre}" ha sido añadido al carrito.`,
            icon: "success",
            showConfirmButton: false,
            timer: 2000
        });
        
    } catch (error) {
        console.error('Error in agregarAlCarrito:', error);
        Swal.fire({
            title: 'Error',
            text: 'Hubo un problema al agregar el producto al carrito',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

function actualizarCarritoUI() {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let totalProductos = carrito.reduce((total, p) => total + p.cantidad, 0);
    let cartCount = document.getElementById("cart-count");
    if (cartCount) {
        cartCount.innerText = totalProductos;
        cartCount.style.display = totalProductos > 0 ? "inline-block" : "none";
    }
}

function cargarCarrito() {
    // Verificar si el usuario está logueado para mostrar el carrito
    if (localStorage.getItem('userLoggedIn') !== 'true') {
        let cartItemsContainer = document.getElementById("cart-items");
        if (cartItemsContainer) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart text-center">
                    <i class="fa-solid fa-user-lock fa-3x mb-3 text-muted"></i>
                    <p>Necesitas iniciar sesión para ver tu carrito.</p>
                    <a href="login.html" class="btn btn-1 me-2">Iniciar Sesión</a>
                    <a href="signUp.html" class="btn btn-2">Crear Cuenta</a>
                </div>
            `;
            document.getElementById("total-price").innerText = "$0.00";
            return;
        }
    }

    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let cartItemsContainer = document.getElementById("cart-items");
    let totalPrice = 0;
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";

    if (carrito.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-cart">Tu carrito está vacío.</p>`;
        document.getElementById("total-price").innerText = "$0.00";
        return;
    }

    carrito.forEach((producto, index) => {
        totalPrice += producto.precio * producto.cantidad;
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <img src="${producto.imagen}" alt="${producto.nombre}">
                <div class="item-details">
                    <h2>${producto.nombre}</h2>
                    <p>${producto.mililitros} ml</p>
                    <span class="price">$${(producto.precio * producto.cantidad).toFixed(2)}</span>
                    <div class="quantity-box">
                        <button class="quantity-btn" onclick="actualizarCantidad(${index}, -1)">-</button>
                        <input type="number" value="${producto.cantidad}" class="quantity-input" readonly>
                        <button class="quantity-btn" onclick="actualizarCantidad(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-btn" onclick="eliminarDelCarrito(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <hr>
        `;
    });

    document.getElementById("total-price").innerText = `$${totalPrice.toFixed(2)}`;
}

function actualizarCantidad(index, cambio) {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    if (carrito[index].cantidad + cambio > 0) {
        carrito[index].cantidad += cambio;
    } else {
        carrito.splice(index, 1);
    }
    localStorage.setItem("carrito", JSON.stringify(carrito));
    cargarCarrito();
}

function eliminarDelCarrito(index) {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    carrito.splice(index, 1);
    localStorage.setItem("carrito", JSON.stringify(carrito));
    cargarCarrito();
}

// Checkout function is now handled by checkoutManager.js
// The global window.enviarCarrito function provides the full functionality

// Función para actualizar la interfaz de usuario según el estado de login
function updateUserInterface() {
    const userDropdownButton = document.getElementById('userDropdown');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (!userDropdownButton || !dropdownMenu) return;
    
    if (localStorage.getItem('userLoggedIn') === 'true') {
        const userEmail = localStorage.getItem('userEmail') || 'usuario@demo.com';
        const userNombre = localStorage.getItem('userNombre') || 'Usuario';
        const userApellido = localStorage.getItem('userApellido') || 'Demo';
        const userPhoto = localStorage.getItem('userPhoto');
        
        // Mostrar foto del usuario o icono por defecto
        if (userPhoto) {
            userDropdownButton.innerHTML = `
                <div class="user-avatar position-relative">
                    <img src="${userPhoto}" alt="Foto de usuario" class="rounded-circle user-photo" 
                         style="width: 45px; height: 45px; object-fit: cover; border: 3px solid #ffffff; 
                                box-shadow: 0 3px 8px rgba(0,0,0,0.2); transition: transform 0.2s ease;"
                         onmouseover="this.style.transform='scale(1.1)'" 
                         onmouseout="this.style.transform='scale(1)'">
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success" 
                          style="font-size: 0.6em; padding: 2px 4px; border: 2px solid white;">
                        <i class="fa-solid fa-check" style="font-size: 8px;"></i>
                    </span>
                </div>
            `;
        } else {
            userDropdownButton.innerHTML = '<i class="fa-solid fa-user-check fa-2x text-success user-icon" style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));"></i>';
        }
        
        // Actualizar contenido del dropdown para usuarios logueados
        const userInfoElements = {
            userEmail: document.getElementById('userEmail'),
            userNombre: document.getElementById('userNombre'),
            userApellido: document.getElementById('userApellido')
        };
        
        if (userInfoElements.userEmail) userInfoElements.userEmail.textContent = userEmail;
        if (userInfoElements.userNombre) userInfoElements.userNombre.textContent = userNombre;
        if (userInfoElements.userApellido) userInfoElements.userApellido.textContent = userApellido;
        
        // Agregar foto en el dropdown si existe
        const dropdownHeader = document.querySelector('.dropdown-header');
        if (dropdownHeader && userPhoto) {
            const existingPhoto = dropdownHeader.querySelector('.user-dropdown-photo');
            if (!existingPhoto) {
                const photoElement = document.createElement('img');
                photoElement.src = userPhoto;
                photoElement.alt = 'Foto de usuario';
                photoElement.className = 'user-dropdown-photo rounded-circle me-2';
                photoElement.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border: 3px solid #007bff; box-shadow: 0 4px 8px rgba(0,0,0,0.15);';
                
                // Reemplazar el icono con la foto
                const icon = dropdownHeader.querySelector('i');
                if (icon) {
                    icon.replaceWith(photoElement);
                }
            } else {
                // Actualizar foto existente si cambió
                existingPhoto.src = userPhoto;
            }
        }
        
        // Si no hay foto, asegurar que el icono esté presente
        if (!userPhoto) {
            const dropdownHeader = document.querySelector('.dropdown-header');
            if (dropdownHeader) {
                const existingPhoto = dropdownHeader.querySelector('.user-dropdown-photo');
                if (existingPhoto) {
                    // Reemplazar foto con icono
                    const iconElement = document.createElement('i');
                    iconElement.className = 'fa-solid fa-user-circle fa-2x text-primary me-2';
                    existingPhoto.replaceWith(iconElement);
                }
            }
        }
        
    } else {
        // Mostrar icono de usuario sin loguear
        userDropdownButton.innerHTML = '<i class="fa-solid fa-user fa-2x text-white user-icon"></i>';
        
        // Cambiar el contenido del dropdown para usuarios no logueados
        dropdownMenu.innerHTML = `
            <div class="dropdown-header d-flex align-items-center mb-3">
                <i class="fa-solid fa-user-circle fa-2x text-secondary me-2"></i>
                <h6 class="mb-0 fw-bold">Bienvenido a Tatylu</h6>
            </div>
            <div class="alert alert-info rounded-2 mb-3">
                <small class="mb-0">Para comprar productos necesitas una cuenta</small>
            </div>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item rounded-2 py-2" href="login.html">
                <i class="fa-solid fa-sign-in-alt text-primary me-2"></i>Iniciar Sesión
            </a>
            <a class="dropdown-item rounded-2 py-2" href="signUp.html">
                <i class="fa-solid fa-user-plus text-success me-2"></i>Registrarse
            </a>
        `;
    }
}

// Función para cerrar sesión
function logout() {
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: 'Se eliminará tu carrito actual y tendrás que iniciar sesión nuevamente',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Limpiar todos los datos del usuario
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userNombre');
            localStorage.removeItem('userApellido');
            localStorage.removeItem('userCedula');
            localStorage.removeItem('userTelefono');
            localStorage.removeItem('loginTimestamp');
            localStorage.removeItem('carrito'); // Limpiar carrito al cerrar sesión
            
            Swal.fire({
                title: 'Sesión cerrada',
                text: 'Has cerrado sesión exitosamente',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                // Actualizar interfaz
                updateUserInterface();
                actualizarCarritoUI();
                
                // Recargar carrito si estamos en la página del carrito
                if (typeof cargarCarrito === 'function') {
                    cargarCarrito();
                }
                
                // Redirigir a página principal si estamos en páginas protegidas
                const currentPage = window.location.pathname.split('/').pop();
                const protectedPages = ['cart.html', 'compras.html'];
                
                if (protectedPages.includes(currentPage)) {
                    window.location.href = 'index.html';
                }
            });
        }
    });
}

// --- Inicialización al cargar la página ---
document.addEventListener('DOMContentLoaded', function() {
    updateUserInterface();
    updateCartCount();
    loadProductsFromManager();

    // Debug para dropdown - fallback manual
    const userDropdownButton = document.getElementById('userDropdown');
    if (userDropdownButton) {
        console.log('Dropdown button encontrado');
        
        // Verificar si Bootstrap está cargado
        if (typeof bootstrap !== 'undefined') {
            console.log('Bootstrap está cargado');
            
            // Inicializar dropdown manualmente si es necesario
            try {
                const dropdownInstance = new bootstrap.Dropdown(userDropdownButton);
                console.log('Dropdown inicializado manualmente');
            } catch (error) {
                console.error('Error inicializando dropdown:', error);
            }
        } else {
            console.error('Bootstrap no está cargado');
            
            // Fallback manual
            userDropdownButton.addEventListener('click', function(e) {
                e.preventDefault();
                const dropdownMenu = this.nextElementSibling;
                if (dropdownMenu) {
                    dropdownMenu.classList.toggle('show');
                }
            });
            
            // Cerrar dropdown al hacer click fuera
            document.addEventListener('click', function(e) {
                if (!userDropdownButton.contains(e.target)) {
                    const dropdownMenu = userDropdownButton.nextElementSibling;
                    if (dropdownMenu) {
                        dropdownMenu.classList.remove('show');
                    }
                }
            });
        }
    } else {
        console.log('Dropdown button no encontrado');
    }

    // === FUNCIÓN DE DEBUG (TEMPORALMENTE DESHABILITADA) ===
/*
function debugProductStock(productId) {
    console.log('=== DEBUG PRODUCT STOCK ===');
    console.log('Product ID received:', productId, 'Type:', typeof productId);
    
    // Verificar productos en localStorage
    const adminProducts = JSON.parse(localStorage.getItem('productos') || '[]');
    console.log('Admin products:', adminProducts.length);
    adminProducts.forEach(p => {
        console.log(`- Admin Product ID: ${p.id} (${typeof p.id}), Name: ${p.nombre}, Stock: ${p.stock}`);
    });
    
    // Verificar productManager
    if (typeof productManager !== 'undefined') {
        const managerProducts = productManager.getAllProducts();
        console.log('Manager products:', managerProducts.length);
        managerProducts.forEach(p => {
            console.log(`- Manager Product ID: ${p.id} (${typeof p.id}), Name: ${p.nombre}, Stock: ${p.stock}`);
        });
        
        // Buscar producto específico
        const foundProduct = productManager.getProductById(productId);
        console.log('Found product:', foundProduct);
        
        if (foundProduct) {
            const stockCheck = productManager.checkStock(productId, 1);
            console.log('Stock check result:', stockCheck);
        }
    } else {
        console.log('ProductManager not available');
    }
    
    // Verificar carrito actual
    const carrito = JSON.parse(localStorage.getItem("carrito") || '[]');
    console.log('Current cart:', carrito);
    const itemInCart = carrito.find(p => p.id.toString() === productId.toString());
    console.log('Item in cart:', itemInCart);
    
    console.log('=== END DEBUG ===');
}
*/

// Llamada de prueba a la función de debug (puedes comentar o eliminar esta línea después de la prueba)
// debugProductStock('63f7e4b8e4b0a65f4c8b4568');

// === FUNCIÓN DE TEST SIMPLE ===
function testAddToCart() {
    console.log('=== TEST ADD TO CART ===');
    
    // Verificar login
    const userLoggedIn = localStorage.getItem('userLoggedIn');
    console.log('User logged in:', userLoggedIn);
    
    // Verificar productManager
    console.log('ProductManager available:', typeof productManager !== 'undefined');
    
    // Verificar productos disponibles
    const productos = JSON.parse(localStorage.getItem('productos') || '[]');
    console.log('Products available:', productos.length);
    
    if (productos.length > 0) {
        const firstProduct = productos[0];
        console.log('Testing with first product:', firstProduct.nombre, 'ID:', firstProduct.id);
        
        // Simular usuario logueado
        localStorage.setItem('userLoggedIn', 'true');
        
        // Intentar agregar al carrito
        try {
            agregarAlCarrito(firstProduct.id, firstProduct.nombre, firstProduct.precio, firstProduct.imagen, 'N/A');
            console.log('✅ Add to cart test completed');
        } catch (error) {
            console.error('❌ Add to cart test failed:', error);
        }
    }
    
    console.log('=== END TEST ===');
}

// === FUNCIÓN DE TEST DE INICIO DE SESIÓN ===
function testLogin() {
    console.log('🔑 Testing login status...');
    
    // Simular que el usuario está logueado
    localStorage.setItem('userLoggedIn', 'true');
    localStorage.setItem('loggedInUser', JSON.stringify({
        email: 'test@test.com',
        nombre: 'Usuario Test'
    }));
    
    console.log('✅ User login simulated');
    console.log('Login status:', localStorage.getItem('userLoggedIn'));
    
    // Actualizar interfaz si existe
    if (typeof updateUserInterface === 'function') {
        updateUserInterface();
    }
}

// === FUNCIÓN DE TEST SIMPLE DE CARRITO ===
function testSimpleAddToCart() {
    console.log('🛒 Testing simple add to cart...');
    
    // Asegurar que el usuario esté logueado
    testLogin();
    
    // Intentar agregar un producto simple
    try {
        const testProduct = {
            id: 1,
            nombre: 'Producto Test',
            precio: 99.99,
            imagen: './static/img/producto.png'
        };
        
        console.log('Calling agregarAlCarrito with:', testProduct);
        agregarAlCarrito(testProduct.id, testProduct.nombre, testProduct.precio, testProduct.imagen, 'Test');
        
        console.log('✅ Add to cart function called successfully');
    } catch (error) {
        console.error('❌ Error in testSimpleAddToCart:', error);
    }
}
