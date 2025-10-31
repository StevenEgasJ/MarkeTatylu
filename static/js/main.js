// DEBUG: monitor changes to localStorage 'carrito' to trace unexpected clears
(function(){
    try {
        const _setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'carrito') {
                try {
                    const parsed = JSON.parse(value || 'null');
                    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
                        console.warn('DEBUG: carrito being set to empty or null', { key, value });
                        console.trace();
                    } else {
                        console.log('DEBUG: carrito updated', { key, length: Array.isArray(parsed)? parsed.length : null });
                    }
                } catch (e) {
                    console.warn('DEBUG: carrito set with non-JSON value', value);
                }
            }
            return _setItem.apply(this, arguments);
        };
    } catch (err) {
        console.warn('Could not install carrito debug wrapper', err);
    }
})();

document.addEventListener("DOMContentLoaded", async function() {
    // Inicializar sistemas principales
    actualizarCarritoUI();
    cargarCarrito();
    updateUserInterface();
    
    // Asegurar que productManager existe y está inicializado
    if (typeof productManager === 'undefined') {
        console.log('📦 Inicializando productManager...');
        // Assign to the declared global variable AND mirror to window so
        // other scripts referencing either `productManager` or `window.productManager`
        // will work without race conditions.
        productManager = new ProductManager();
        window.productManager = productManager;
    }

    // Preferir cargar productos desde la API (Atlas) antes de renderizar
    if (typeof productManager !== 'undefined' && window.api && typeof productManager.fetchProductsFromApi === 'function') {
        try {
            await productManager.fetchProductsFromApi();
            console.log('🔄 Productos cargados desde API en init');
        } catch (err) {
            console.warn('No se pudieron cargar productos desde API en init:', err && err.message ? err.message : err);
            // fallback: merge admin/local
            productManager.syncWithAdminProducts();
            console.log('🔄 Productos sincronizados con admin al inicio (fallback)');
        }
    } else {
        // No hay API disponible, sincronizar con admin/local
        if (typeof productManager !== 'undefined') {
            productManager.syncWithAdminProducts();
            console.log('🔄 Productos sincronizados con admin al inicio (no API)');
        }
    }
    
    // Cargar productos si hay un contenedor (después de sincronizar)
    if (document.getElementById('products-container')) {
        // Inicializar productos automáticamente si no existen
        const existingProducts = localStorage.getItem('productos');
        if (!existingProducts || JSON.parse(existingProducts).length === 0) {
            console.log('🛠️ No hay productos, forzando inicialización...');
            if (typeof productManager !== 'undefined') {
                productManager.initializeDefaultProducts();
            }
        }
        
        loadProductsFromManager();
    }
    
    // Inicializar búsqueda
    initializeSearch();

    // NOTE: Removed automatic notification permission requests per user preference.

    // Evento para confirmar el carrito
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

    // Asignar el evento submit al formulario de dirección
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
    console.log('📦 Cargando productos desde productManager...');
    
    if (typeof productManager !== 'undefined') {
        // Forzar recarga de productos
        productManager.syncWithAdminProducts();
        
        const products = productManager.getAllProducts();
        console.log('📋 Productos obtenidos:', products.length);
        
        // Log del stock de algunos productos para debugging
        products.slice(0, 3).forEach(product => {
            console.log(`📦 ${product.nombre}: Stock ${product.stock}`);
        });
        
        const productContainer = document.getElementById('products-container');
        
        if (productContainer) {
            productContainer.innerHTML = '';
            
            if (products.length === 0) {
                productContainer.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-info">
                            <i class="fa-solid fa-box-open fa-3x mb-3"></i>
                            <h4>No hay productos disponibles</h4>
                            <p>Los productos se cargarán automáticamente cuando estén disponibles.</p>
                            <button class="btn btn-primary" onclick="loadProductsFromManager()">
                                <i class="fa-solid fa-refresh me-2"></i>Actualizar Productos
                            </button>
                        </div>
                    </div>
                `;
            } else {
                products.forEach(product => {
                    const productCard = createProductCard(product);
                    productContainer.appendChild(productCard);
                });
                
                console.log('✅ Productos renderizados en el contenedor');
            }
        } else {
            console.log('❌ Contenedor products-container no encontrado');
        }
    } else {
        console.log('❌ productManager no está disponible');
        
        const productContainer = document.getElementById('products-container');
        if (productContainer) {
            productContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="alert alert-warning">
                        <i class="fa-solid fa-exclamation-triangle fa-2x mb-3"></i>
                        <h4>Sistema de productos no disponible</h4>
                        <p>Recarga la página para intentar nuevamente.</p>
                        <button class="btn btn-warning" onclick="location.reload()">
                            <i class="fa-solid fa-refresh me-2"></i>Recargar Página
                        </button>
                    </div>
                </div>
            `;
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
                                        <div class="d-grid gap-2">
                                            <button class="btn btn-outline-secondary" onclick="openProductModal('${product.id || product._id}')">Ver más</button>
                                            <button class="btn btn-primary" 
                                                            onclick="agregarAlCarrito('${product.id}', '${product.nombre}', ${product.precio}, '${product.imagen}', '${product.capacidad || 'N/A'}')"
                                                            ${(product.stock || 0) <= 0 ? 'disabled' : ''}>
                                                    ${(product.stock || 0) <= 0 ? 'Sin Stock' : 'Agregar al Carrito'}
                                            </button>
                                        </div>
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
    
    // Actualizar botones activos
    const buttons = document.querySelectorAll('#category-filters .btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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

// --- FUNCIONES DEL CARRITO - LA PARTE MÁS IMPORTANTE ---

function agregarAlCarrito(id, nombre, precio, imagen, mililitros) {
    console.log('🛒 agregarAlCarrito called with:', { id, nombre, precio, tipo: typeof id });
    
    // Verificar si el usuario está logueado
    if (localStorage.getItem('userLoggedIn') !== 'true') {
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

    // Verificar stock disponible usando productManager
    if (typeof productManager !== 'undefined') {
        let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        let productoExistente = carrito.find(p => p.id.toString() === id.toString());
        let cantidadActualEnCarrito = productoExistente ? productoExistente.cantidad : 0;
        let cantidadSolicitada = cantidadActualEnCarrito + 1;

        console.log('🔍 Checking stock for product:', { id, cantidadSolicitada, cantidadActualEnCarrito });

        const stockCheck = productManager.checkStock(id, cantidadSolicitada);
        console.log('📦 Stock check result:', stockCheck);
        
        if (!stockCheck.available) {
            Swal.fire({
                title: 'Stock insuficiente',
                text: stockCheck.message,
                icon: 'warning',
                confirmButtonText: 'Entendido'
            });
            return;
        }
    }

    // Agregar al carrito
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

    let productoExistente = carrito.find(p => p.id.toString() === id.toString());
    if (productoExistente) {
        productoExistente.cantidad++;
        console.log('✅ Product quantity updated:', productoExistente);
    } else {
        const nuevoProducto = { 
            id: id.toString(), 
            nombre, 
            precio: parseFloat(precio), 
            imagen, 
            mililitros, 
            cantidad: 1 
        };
        carrito.push(nuevoProducto);
        console.log('✅ New product added to cart:', nuevoProducto);
    }

    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarCarritoUI();

    // Animación del carrito
    let cartIcon = document.getElementById("cart-icon");
    if (cartIcon) {
        cartIcon.classList.add("cart-animate");
        setTimeout(() => cartIcon.classList.remove("cart-animate"), 300);
    }

    Swal.fire({
        title: "Producto agregado",
        text: `"${nombre}" ha sido añadido al carrito.`,
        icon: "success",
        showConfirmButton: false,
        timer: 2000
    });

    // Refrescar productos para mostrar stock actualizado
    setTimeout(() => {
        refreshProductDisplay();
    }, 100);

    // Intentar sincronizar carrito con servidor si existe API y token
    try {
        if (window.api && typeof window.api.updateCart === 'function') {
            window.api.updateCart(carrito).catch(err => console.warn('Sync cart failed:', err));
        }
    } catch (err) {
        console.warn('Cart sync skipped:', err);
    }

    console.log('🛒 Cart updated successfully');
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

function updateCartCount() {
    actualizarCarritoUI();
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
        // Verificar stock antes de aumentar cantidad
        if (cambio > 0 && typeof productManager !== 'undefined') {
            const nuevaCantidad = carrito[index].cantidad + cambio;
            const stockCheck = productManager.checkStock(carrito[index].id, nuevaCantidad);
            
            if (!stockCheck.available) {
                Swal.fire({
                    title: 'Stock insuficiente',
                    text: stockCheck.message,
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }
        }
        
        carrito[index].cantidad += cambio;
    } else {
        carrito.splice(index, 1);
    }
    
    localStorage.setItem("carrito", JSON.stringify(carrito));
    cargarCarrito();
    actualizarCarritoUI();
    
    // Refrescar productos para mostrar stock actualizado
    setTimeout(() => {
        refreshProductDisplay();
    }, 100);

    // Sync cart to server if available
    try {
        if (window.api && typeof window.api.updateCart === 'function') {
            window.api.updateCart(carrito).catch(err => console.warn('Sync cart failed:', err));
        }
    } catch (err) {
        console.warn('Cart sync skipped:', err);
    }
}

function eliminarDelCarrito(index) {
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    carrito.splice(index, 1);
    localStorage.setItem("carrito", JSON.stringify(carrito));
    cargarCarrito();
    actualizarCarritoUI();
    
    // Refrescar productos para mostrar stock actualizado
    setTimeout(() => {
        refreshProductDisplay();
    }, 100);

    // Sync cart to server if available
    try {
        if (window.api && typeof window.api.updateCart === 'function') {
            window.api.updateCart(carrito).catch(err => console.warn('Sync cart failed:', err));
        }
    } catch (err) {
        console.warn('Cart sync skipped:', err);
    }
}

// --- FUNCIONES DE USUARIO ---

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
                         onmouseout="this.style.transform='scale(1)'"
                         onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user-check fa-2x text-success user-icon\\' style=\\'filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));\\' title=\\'Error cargando imagen de perfil\\'></i>';">
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
                <h6 class="mb-0 fw-bold">Bienvenido a El Valle</h6>
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
            localStorage.removeItem('userPhoto'); // Limpiar foto de perfil
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

// Función para refrescar productos en la página
function refreshProductDisplay() {
    console.log('🔄 Refrescando display de productos...');

    // Defensive: only proceed if productManager is initialized
    if (typeof productManager === 'undefined') {
        console.warn('refreshProductDisplay: productManager no disponible');
        return;
    }

    // Prefer a fresh fetch from API when available, otherwise fall back to local merge + render
    if (window.api && typeof productManager.fetchProductsFromApi === 'function') {
        productManager.fetchProductsFromApi()
            .then(() => {
                console.log('� Productos actualizados desde API (refresh)');
                loadProductsFromManager();
            })
            .catch(err => {
                console.warn('No se pudo actualizar productos desde API (refresh):', err && err.message ? err.message : err);
                // Merge admin/local and render
                productManager.syncWithAdminProducts();
                loadProductsFromManager();
            });
    } else {
        productManager.syncWithAdminProducts();
        loadProductsFromManager();
        console.log('🔄 Productos refrescados desde local/admin (no API)');
    }
}

// Función para refrescar productos automáticamente
// Auto-refresh: periodically refresh product display (safe, non-recursive)
function autoRefreshProducts() {
    const productContainer = document.getElementById('products-container');
    if (productContainer && typeof productManager !== 'undefined') {
        console.log('🔄 Auto-recargando productos...');
        refreshProductDisplay();
    }
}

// Configurar recarga automática de productos cada 30 segundos
setInterval(autoRefreshProducts, 30000);

// Hacer función global para uso manual
window.refreshProducts = function() {
    loadProductsFromManager();
};

// Forzar recarga desde el servidor (Atlas) y reemplazar cache local
window.forceFetchServerProducts = async function() {
    if (typeof productManager === 'undefined' || !window.api || typeof productManager.fetchProductsFromApi !== 'function') {
        console.warn('forceFetchServerProducts: productManager o api no disponibles');
        return;
    }

    try {
        console.log('🔁 Forzando fetch de productos desde el servidor (Atlas)...');
        // Clear local cache to ensure we don't read stale defaults
        localStorage.removeItem('productos');
        await productManager.fetchProductsFromApi();
        // Ensure admin merge/sync then render
        productManager.syncWithAdminProducts();
        loadProductsFromManager();
        console.log('✅ Productos actualizados desde el servidor y cache reemplazada');
    } catch (err) {
        console.error('❌ forceFetchServerProducts error:', err && err.message ? err.message : err);
        // fallback to merge + render
        productManager.syncWithAdminProducts();
        loadProductsFromManager();
    }
};

// Función global para refrescar productos
// Bind the existing function directly to avoid creating a wrapper that
// resolves to the same global name and causes recursion (Maximum call stack).
// The top-level function declaration `refreshProductDisplay` already creates
// a global symbol, but assigning a wrapper that calls the global name can
// accidentally call the wrapper itself. Use direct reference instead.
window.refreshProductDisplay = refreshProductDisplay;

// Evento para detectar cuando se vuelve a la página de productos después de una compra
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.location.pathname.includes('product.html')) {
        console.log('🔄 Página de productos visible, refrescando stock...');
        setTimeout(() => {
            refreshProductDisplay();
        }, 500);
    }
});

// Evento para detectar cuando se navega de vuelta a la página
window.addEventListener('pageshow', function(event) {
    if (window.location.pathname.includes('product.html')) {
        console.log('🔄 Página de productos mostrada, refrescando stock...');
        setTimeout(() => {
            refreshProductDisplay();
        }, 500);
    }
});

// Función de debugging para verificar stock
function debugStock() {
    console.log('🔍 DEBUG - Verificando estado del stock:');
    
    if (typeof productManager !== 'undefined') {
        const products = productManager.getAllProducts();
        console.log('📦 Total productos:', products.length);
        
        products.forEach(product => {
            console.log(`📋 ${product.nombre}: Stock ${product.stock} (ID: ${product.id})`);
        });
        
        // Verificar localStorage directamente
        const storedProducts = JSON.parse(localStorage.getItem('productos') || '[]');
        console.log('💾 Productos en localStorage:', storedProducts.length);
        
        storedProducts.slice(0, 3).forEach(product => {
            console.log(`💾 ${product.nombre}: Stock ${product.stock} (ID: ${product.id})`);
        });
        
    } else {
        console.log('❌ productManager no disponible');
    }
}

// Función global para debugging
window.debugStock = function() {
    debugStock();
};

// =================== FUNCIONES DE CANTIDAD DEL CARRITO ===================

// Función para aumentar cantidad de un producto en el carrito
function increaseQuantity(productId) {
    try {
        console.log('➕ Aumentando cantidad para producto ID:', productId);
        const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        const productoIndex = carrito.findIndex(item => item.id === productId);
        
        if (productoIndex !== -1) {
            // Verificar stock disponible
            let maxStock = 999; // Stock por defecto
            
            if (typeof productManager !== 'undefined') {
                const product = productManager.getProductById(productId);
                if (product && product.stock !== undefined) {
                    maxStock = product.stock;
                }
            }
            
            if (carrito[productoIndex].cantidad < maxStock) {
                carrito[productoIndex].cantidad += 1;
                localStorage.setItem("carrito", JSON.stringify(carrito));
                
                // Actualizar UI
                if (typeof actualizarCarritoUI === 'function') {
                    actualizarCarritoUI();
                }
                
                console.log(`✅ Cantidad aumentada: ${carrito[productoIndex].nombre} = ${carrito[productoIndex].cantidad}`);
                return true;
            } else {
                console.warn('⚠️ Stock insuficiente');
                Swal.fire({
                    title: 'Stock insuficiente',
                    text: `Solo hay ${maxStock} unidades disponibles`,
                    icon: 'warning',
                    timer: 2000
                });
                return false;
            }
        }
    } catch (error) {
        console.error('❌ Error aumentando cantidad:', error);
        return false;
    }
}

// Función para disminuir cantidad de un producto en el carrito
function decreaseQuantity(productId) {
    try {
        console.log('➖ Disminuyendo cantidad para producto ID:', productId);
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
                
                console.log(`✅ Cantidad disminuida: ${carrito[productoIndex].nombre} = ${carrito[productoIndex].cantidad}`);
                return true;
            } else {
                // Si la cantidad es 1, preguntar si quiere eliminar
                const productName = carrito[productoIndex].nombre;
                console.log('🤔 Cantidad mínima alcanzada, preguntando si eliminar');
                
                Swal.fire({
                    title: '¿Eliminar producto?',
                    text: `¿Quieres eliminar "${productName}" del carrito?`,
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
                return false;
            }
        }
    } catch (error) {
        console.error('❌ Error disminuyendo cantidad:', error);
        return false;
    }
}

// Función para eliminar un producto del carrito
function removeFromCart(productId) {
    try {
        console.log('🗑️ Eliminando producto del carrito ID:', productId);
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
                timerProgressBar: true,
                icon: 'success',
                title: 'Producto eliminado',
                text: `${productName} eliminado del carrito`
            });
            
            console.log(`✅ Producto eliminado: ${productName}`);
            // Sync cart to server if available
            try {
                if (window.api && typeof window.api.updateCart === 'function') {
                    window.api.updateCart(carrito).catch(err => console.warn('Sync cart failed:', err));
                }
            } catch (err) {
                console.warn('Cart sync skipped:', err);
            }
            return true;
        }
    } catch (error) {
        console.error('❌ Error eliminando del carrito:', error);
        return false;
    }
}


// Exponer funciones globalmente
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeFromCart = removeFromCart;