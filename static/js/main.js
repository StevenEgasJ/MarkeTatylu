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
    
    // Asegurar que productManager existe y está inicializado (si la clase ProductManager está disponible)
    if (typeof productManager === 'undefined') {
        if (typeof ProductManager !== 'undefined') {
            console.log('📦 Inicializando productManager...');
            // Assign to the declared global variable AND mirror to window so
            // other scripts referencing either `productManager` or `window.productManager`
            // will work without race conditions.
            productManager = new ProductManager();
            window.productManager = productManager;
        } else {
            console.log('ℹ️ ProductManager class no disponible en esta página — omitiendo inicialización');
        }
    }

    // RAIL: measure CTA and schedule a metrics report
    try {
        // Mark CTA interactive
        const cta = document.getElementById('cta-comprar-ahora');
        if (cta) {
            try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonInteractive('cta-comprar-ahora'); } catch(e){}
            cta.addEventListener('click', function(){ 
                try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickStart('cta-comprar-ahora'); } catch(e){}
                // mark end immediately before navigation to ensure metric is recorded
                try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('cta-comprar-ahora'); } catch(e){}
            });
        }

        // Quick report after initial idle (gives Railway visible metrics in console)
        if (window.rail && window.rail.metrics && typeof window.rail.runDuringIdle === 'function') {
            window.rail.runDuringIdle(() => { window.rail.metrics.report({ note: 'initial-idle-report' }); }, { timeout: 2000 });
        } else if (window.rail && window.rail.metrics) {
            setTimeout(() => window.rail.metrics.report({ note: 'initial-delayed-report' }), 2000);
        }
    } catch(e){ /* ignore */ }

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

        // RAIL: programar tareas no críticas durante idle para mejorar percepción de rendimiento
        if (window.rail && typeof window.rail.runDuringIdle === 'function') {
            window.rail.runDuringIdle(() => {
                try { window.rail.lazyLoadImages(document); } catch(e){}
                try {
                    // Stagger small welcome animations without blocking initial paint
                    const animEls = document.querySelectorAll('.banner-title, .banner-subtitle, .btn-1');
                    animEls.forEach((el, i) => setTimeout(()=> el.classList.add('animate__animated', 'animate__fadeInUp'), i*120));
                } catch(e){}
            });
        }
    }
    
    // Inicializar búsqueda
    initializeSearch();

    // Inicializar ordenamiento
    const sortSelectInit = document.getElementById('sort-select');
    if (sortSelectInit) {
        sortSelectInit.addEventListener('change', () => {
            // if a search is active, re-run search so results get sorted as well
            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput.value.trim()) {
                searchProducts(searchInput.value.trim());
            } else {
                loadProductsFromManager();
            }
        });
    }

    // Inicializar selector de categorías (se cargará desde la API)
    try {
        if (typeof initializeCategories === 'function') {
            await initializeCategories();
        }
    } catch (err) {
        console.warn('initializeCategories falló en init:', err);
    }

    // NOTE: Removed automatic notification permission requests per user preference.

    // Evento para confirmar el carrito
    const confirmarBtn = document.getElementById("confirmar-productos");
    if (confirmarBtn) {
        // Mark interactive for metrics
        try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonInteractive('confirmar-productos'); } catch(e){}
        confirmarBtn.addEventListener("click", function(event) {
            // RAIL: mark click start
            try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickStart('confirmar-productos'); } catch(e){}

            // If this is a plain link (<a href="...">), prefer normal navigation
            if (confirmarBtn.tagName === 'A' && confirmarBtn.getAttribute('href')) {
                // If user not logged in, block navigation and prompt to login
                if (localStorage.getItem('userLoggedIn') !== 'true') {
                    event.preventDefault();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            title: '🔒 Necesitas iniciar sesión',
                            text: 'Para realizar una compra debes iniciar sesión',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Iniciar sesión',
                            cancelButtonText: 'Cancelar'
                        }).then((r) => {
                            if (r.isConfirmed) window.location.href = 'login.html';
                        });
                    } else {
                        if (confirm('Necesitas iniciar sesión. Ir a login?')) window.location.href = 'login.html';
                    }
                    try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('confirmar-productos'); } catch(e){}
                    return;
                }

                // Logged in -> allow default navigation to the href (e.g., checkout.html)
                try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('confirmar-productos'); } catch(e){}
                return;
            }

            // Otherwise, this is a JS-driven button: prevent default and run the JS checkout flow
            event.preventDefault();
            console.log('🛒 Checkout button clicked from main.js (JS-driven)');
            try {
                if (typeof window.enviarCarrito === 'function') {
                    window.enviarCarrito();
                } else if (typeof window.testCheckout === 'function') {
                    window.testCheckout();
                } else {
                    console.error('No checkout function available');
                    alert('Sistema de checkout no disponible');
                }
            } finally {
                // mark click end shortly after to capture duration
                try { setTimeout(()=>{ if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('confirmar-productos'); }, 30); } catch(e){}
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

    // Category UI removed — no rendering or sizing logic present.
});

// --- Funciones de gestión de productos mejoradas ---

// --- Reviews cache and rendering helpers ---
// Render stars for a given rating (0-5). Uses FontAwesome if available, otherwise Unicode stars.
function renderStarsInline(rating) {
    const n = Math.round(Number(rating) || 0);
    // If FontAwesome is available, prefer icons
    if (typeof document !== 'undefined' && document && document.createElement) {
        const faAvailable = !!document.querySelector || true; // always true in browser; keep check simple
        let out = '';
        for (let i = 0; i < 5; i++) {
            if (i < n) out += '<i class="fa-solid fa-star" style="color: #f6c84c;"></i>';
            else out += '<i class="fa-regular fa-star" style="color: #dcdcdc;"></i>';
        }
        return out;
    }
    // Fallback to unicode
    let out = '';
    for (let i = 0; i < 5; i++) out += (i < n) ? '★' : '☆';
    return `<span class="text-warning">${out}</span>`;
}

// Initialize a background cache of reviews (admin/all endpoint). When ready, compute averages and re-render product grid.
let __reviewsCacheInit = false;
async function initReviewsCache() {
    if (__reviewsCacheInit) return; // already started
    __reviewsCacheInit = true;

    try {
        // Attempt to fetch all reviews via admin endpoint (returns all reviews). This endpoint is present in the repo.
        const res = await fetch('/api/reviews/admin/all');
        if (!res.ok) throw new Error('Reviews fetch failed: ' + res.status);
        const all = await res.json();
        // Build map: { productId: { avg: Number, count: Number } }
        const map = {};
        (all || []).forEach(r => {
            if (!r || !r.productId) return;
            // Only consider approved reviews for public rating
            if (r.approved !== true) return;
            const id = String(r.productId);
            map[id] = map[id] || { sum: 0, count: 0 };
            map[id].sum += Number(r.rating) || 0;
            map[id].count += 1;
        });

        const reviewsMap = {};
        Object.keys(map).forEach(pid => {
            const entry = map[pid];
            reviewsMap[pid] = { avg: entry.count ? (entry.sum / entry.count) : 0, count: entry.count };
        });

        window._reviewsMap = reviewsMap;

        // Re-render product grid if present so ratings appear
        if (document.getElementById('products-container')) {
            try {
                loadProductsFromManager();
            } catch (e) { console.warn('Could not re-render products after reviews cache', e); }
        }
    } catch (err) {
        console.warn('initReviewsCache error:', err);
    }
}

// Helper to get rating display for a product id using cached reviews map
function getRatingForProduct(productId) {
    try {
        if (window._reviewsMap && window._reviewsMap[productId]) {
            const { avg, count } = window._reviewsMap[productId];
            return { avg: avg, count: count };
        }
    } catch (e) { /* ignore */ }
    return null;
}

function renderProductRatingHtml(product) {
    try {
        // Prefer explicit product.rating if provided by server
        if (product && (product.rating !== undefined && product.rating !== null)) {
            const n = Number(product.rating) || 0;
            const count = product.reviewCount || '';
            return `<span class="stars">${renderStarsInline(n)}</span><small class="text-muted ms-1">${count ? '('+count+')' : ''}</small>`;
        }

        const cached = getRatingForProduct(String(product.id));
        if (cached) {
            const avg = cached.avg || 0;
            const count = cached.count || 0;
            return `<span class="stars">${renderStarsInline(avg)}</span><small class="text-muted ms-1">${count ? '('+count+')' : ''}</small>`;
        }

        // default: no rating yet
        return `<span class="text-muted">Sin reseñas</span>`;
    } catch (e) {
        console.warn('renderProductRatingHtml error', e);
        return '';
    }
}

// Alias para compatibilidad con product.html
async function loadProducts() {
    console.log('📦 loadProducts() llamado - redirigiendo a loadProductsFromManager()');
    return loadProductsFromManager();
}

// Cargar productos dinámicamente
function loadProductsFromManager() {
    console.log('📦 Cargando productos desde productManager...');
    
    if (typeof productManager !== 'undefined') {
        // Forzar recarga de productos
        productManager.syncWithAdminProducts();
        
    let products = productManager.getAllProducts();
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
                // apply current sort selection
                products = applySort(products);

                // Fast first paint: render a small initial batch synchronously to get quick FCP
                const initialCount = Math.min(12, products.length);
                products.slice(0, initialCount).forEach(product => {
                    const productCard = createProductCard(product);
                    productContainer.appendChild(productCard);
                });

                // Render the rest in idle/batched chunks to avoid janking main thread
                if (products.length > initialCount) {
                    const remaining = products.slice(initialCount);
                    if (window.rail && typeof window.rail.batchRender === 'function') {
                        window.rail.batchRender(remaining, p => createProductCard(p), productContainer, 8);
                    } else {
                        // Fallback: simple async append
                        setTimeout(() => {
                            remaining.forEach(product => productContainer.appendChild(createProductCard(product)));
                            if (window.rail && typeof window.rail.lazyLoadImages === 'function') window.rail.lazyLoadImages(productContainer);
                        }, 60);
                    }
                } else {
                    if (window.rail && typeof window.rail.lazyLoadImages === 'function') window.rail.lazyLoadImages(productContainer);
                }

                // Kick off async reviews caching in background (will re-render when ready)
                try { initReviewsCache(); } catch (e) { console.warn('initReviewsCache failed to start', e); }

                // Ensure we have a single delegated listener for add-to-cart buttons
                try {
                    if (productContainer && !productContainer.dataset.railDelegated) {
                        productContainer.dataset.railDelegated = 'true';
                        productContainer.addEventListener('click', function(ev){
                            const btn = ev.target.closest && ev.target.closest('.add-to-cart-btn');
                            if (!btn) return;
                            const pid = btn.dataset.id;
                            try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickStart('addToCart:'+pid); } catch(e){}
                            // Extract name and other data from the card DOM
                            const card = btn.closest('.product-card');
                            const name = card ? (card.querySelector('.card-title')||{}).textContent : '';
                            const price = btn.dataset.price || 0;
                            const image = btn.dataset.imagen || '';
                            const ml = btn.dataset.mililitros || '';
                            // Call existing agregarAlCarrito function (keeps previous behavior)
                            try { agregarAlCarrito(pid, name, parseFloat(price), image, ml); } catch(e){ console.warn('addToCart handler error', e); }
                        }, false);

                        // Mark buttons as interactive once they are present
                        // Single marker for add-to-cart interactivity to avoid per-product clutter
                        try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonInteractive('addToCart:delegate'); } catch(e){};
                    }
                } catch(e){ console.warn('Could not attach delegated add-to-cart listener', e); }

                console.log('✅ Productos renderizados en el contenedor');
                // RAIL: single summary report for products section (avoid per-product clutter)
                try { if (window.rail && window.rail.metrics) window.rail.metrics.report({ section: 'products', action: 'render_complete', itemCount: products.length }); } catch(e){};
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
    // responsive: 2 cols on xs, 3 on md, 4 on lg
    card.className = 'col-6 col-md-4 col-lg-3 mb-4';
    // prepare display values
    const price = Number(product.precio) || 0;
    const descuento = Number(product.descuento) || 0;
    const hasDiscount = descuento > 0;
    const discountedPrice = hasDiscount ? +(price * (1 - descuento / 100)) : price;
    const shortDesc = (product.descripcion || '').length > 110 ? (product.descripcion || '').substring(0, 107).trim() + '...' : (product.descripcion || '');

    card.innerHTML = `
        <div class="card product-card h-100 position-relative">
            ${hasDiscount ? `<div class="discount-badge">-${descuento}%</div>` : ''}
            <!-- Lazy image: placeholder src and data-src for IntersectionObserver -->
            <img data-src="${product.imagen}" src="./static/img/placeholder.svg" loading="lazy" class="card-img-top product-image lazy" alt="${product.nombre}">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${product.nombre}</h5>
                <div class="product-rating" data-product-id="${product.id}">
                    ${renderProductRatingHtml(product)}
                </div>
                <p class="card-text">${shortDesc}</p>
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            ${hasDiscount ? `<div class="price-old text-muted small">$${price.toFixed(2)}</div>
                            <div class="h5 text-primary mb-0">$${discountedPrice.toFixed(2)}</div>` : `<div class="h5 text-primary mb-0">$${price.toFixed(2)}</div>`}
                        </div>
                        <small class="text-muted">
                            <span class="badge ${product.stock <= 5 ? 'bg-danger' : product.stock <= 10 ? 'bg-warning text-dark' : 'bg-success'}">
                                Stock: ${product.stock || 0}
                            </span>
                        </small>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-secondary" onclick="openProductModal('${product.id || product._id}')">Ver más</button>
                        <button class="btn btn-primary add-to-cart-btn" data-id="${product.id}" data-price="${discountedPrice.toFixed(2)}" data-imagen="${product.imagen}" data-mililitros="${product.capacidad || ''}" ${(product.stock || 0) <= 0 ? 'disabled' : ''}>
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
            // apply current sort selection
            products = applySort(products);
            products.forEach(product => {
                const productCard = createProductCard(product);
                productContainer.appendChild(productCard);
            });
        }
    }
}

// Apply sorting based on the select control
function applySort(products) {
    try {
        const sel = document.getElementById('sort-select');
        if (!sel || !Array.isArray(products)) return products;
        const val = sel.value || 'default';
        const copy = products.slice();
        switch (val) {
            case 'alpha-asc':
                copy.sort((a,b) => (a.nombre||'').toString().localeCompare((b.nombre||'').toString(), 'es'));
                break;
            case 'alpha-desc':
                copy.sort((a,b) => (b.nombre||'').toString().localeCompare((a.nombre||'').toString(), 'es'));
                break;
            case 'price-asc':
                copy.sort((a,b) => (Number(a.precio)||0) - (Number(b.precio)||0));
                break;
            case 'price-desc':
                copy.sort((a,b) => (Number(b.precio)||0) - (Number(a.precio)||0));
                break;
            case 'stock-asc':
                copy.sort((a,b) => (Number(a.stock)||0) - (Number(b.stock)||0));
                break;
            case 'stock-desc':
                copy.sort((a,b) => (Number(b.stock)||0) - (Number(a.stock)||0));
                break;
            default:
                return copy;
        }
        return copy;
    } catch (err) {
        console.warn('applySort error', err);
        return products;
    }
}

// Filtrar productos por categoría
function filterByCategory(category, btnEl) {
    if (typeof productManager !== 'undefined') {
        const products = category === 'all' ? 
            productManager.getAllProducts() : 
            productManager.getProductsByCategory(category);
        displaySearchResults(products);
    }

    // Actualizar botones activos (solo si el contenedor de filtros existe)
    const filtersEl = document.getElementById('category-filters');
    if (filtersEl) {
        const buttons = filtersEl.querySelectorAll('.btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        if (btnEl && btnEl.classList) {
            btnEl.classList.add('active');
        } else {
            // fallback: try to find button by data-category attribute
            const fallback = filtersEl.querySelector(`.btn[data-category="${CSS.escape(category)}"]`);
            if (fallback) fallback.classList.add('active');
        }
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

// Cargar categorías desde la API y poblar el select #category-select
async function initializeCategories() {
    const select = document.getElementById('category-select');
    if (!select) return;

    // Asegurar la opción por defecto
    select.innerHTML = '<option value="all">Categoría: Todas</option>';

    try {
        let categories = [];
        if (window.api && typeof window.api.getCategories === 'function') {
            categories = await window.api.getCategories();
        } else {
            // Fallback directo por si no está el cliente
            const res = await fetch('/api/categories');
            if (res.ok) categories = await res.json();
        }

        if (!Array.isArray(categories)) categories = [];

        categories.forEach(cat => {
            if (!cat) return;
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });
    } catch (err) {
        console.warn('No se pudieron cargar categorías:', err);
    }

    // Listener para filtrar por categoría
    select.addEventListener('change', () => {
        const val = select.value || 'all';
        if (val === 'all') {
            // si hay búsqueda activa, respetarla
            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput.value.trim()) {
                searchProducts(searchInput.value.trim());
            } else {
                loadProductsFromManager();
            }
        } else {
            filterByCategory(val);
        }
    });
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

    if (typeof checkoutManager !== 'undefined' && checkoutManager && typeof checkoutManager.getUserOrders === 'function') {
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

async function agregarAlCarrito(id, nombre, precio, imagen, mililitros) {
    console.log('🛒 agregarAlCarrito called with:', { id, nombre, precio, tipo: typeof id });
    // NOTE: Allow adding to cart even when not logged in. Login will be enforced at checkout.

    // Verificar stock disponible usando productManager
    if (typeof productManager !== 'undefined' && typeof productManager.checkStockAvailability === 'function') {
        // Asegurar que los productos estén sincronizados
        await productManager.syncWithAdminProducts();
        
        let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        let productoExistente = carrito.find(p => p.id.toString() === id.toString());
        let cantidadActualEnCarrito = productoExistente ? productoExistente.cantidad : 0;
        let cantidadSolicitada = cantidadActualEnCarrito + 1;

        console.log('🔍 Checking stock for product:', { id, cantidadSolicitada, cantidadActualEnCarrito });

        const stockCheck = productManager.checkStockAvailability(id, cantidadSolicitada);
        console.log('📦 Stock check result:', stockCheck);
        
        if (!stockCheck.available) {
            Swal.fire({
                title: 'Stock insuficiente',
                text: stockCheck.reason || 'No hay suficiente stock disponible',
                icon: 'warning',
                confirmButtonText: 'Entendido'
            });
            try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('addToCart:'+id); } catch(e){}
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

    // Animación del carrito (usando rAF para animaciones suaves y clase `active`)
    let cartIcon = document.getElementById("cart-icon");
    if (cartIcon) {
        // Add both classes to trigger the transform + animation, then remove 'active' quickly
        cartIcon.classList.add("cart-animate", "active");
        requestAnimationFrame(() => {
            // Remove the 'active' bit after a small delay so the transition plays back
            setTimeout(() => cartIcon.classList.remove("active"), 100);
            // Remove the helper class after animation finishes to keep DOM clean
            setTimeout(() => requestAnimationFrame(() => cartIcon.classList.remove("cart-animate")), 340);
        });
    }

    // RAIL: mark add-to-cart click completed for metrics
    try { if (window.rail && window.rail.metrics) window.rail.metrics.markButtonClickEnd('addToCart:'+id); } catch(e){}

    // Mostrar notificación con opción de ir al carrito
    try {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Producto agregado',
                text: `"${nombre}" ha sido añadido al carrito.`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Ir al carrito',
                cancelButtonText: 'Seguir comprando'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'cart.html';
                }
            });
        } else {
            // Fallback simple
            alert(`${nombre} ha sido añadido al carrito.`);
        }
    } catch (err) {
        console.warn('Error mostrando notificación de producto agregado', err);
    }

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
    // Mostrar un banner si el usuario no está logueado, pero seguir renderizando el carrito
    const guestMode = localStorage.getItem('userLoggedIn') !== 'true';
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let cartItemsContainer = document.getElementById("cart-items");
    let totalPrice = 0;
    if (!cartItemsContainer) return;

    // Preparar banner para usuarios no logueados
    const guestBannerHtml = guestMode ? `
        <div class="alert alert-warning d-flex align-items-center" role="alert">
            <i class="fa-solid fa-user-lock fa-lg me-3"></i>
            <div>
                <strong>Estás comprando como invitado.</strong><br>
                Para finalizar la compra necesitarás iniciar sesión. Puedes continuar viendo tu carrito y seleccionar opciones de envío.
            </div>
        </div>
    ` : '';

    cartItemsContainer.innerHTML = guestBannerHtml;

    if (carrito.length === 0) {
        cartItemsContainer.innerHTML += `<p class="empty-cart">Tu carrito está vacío.</p>`;
        // actualizar resumen rápido a cero
        const quickSubtotal = document.getElementById('quick-subtotal');
        const quickShipping = document.getElementById('quick-shipping');
        const quickTotal = document.getElementById('quick-total');
        if (quickSubtotal) quickSubtotal.innerText = `$0.00`;
        if (quickShipping) quickShipping.innerText = `$0.00`;
        if (quickTotal) quickTotal.innerText = `$0.00`;
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

    // actualizar resumen rápido
    updateQuickSummary(totalPrice);
}

// Actualiza el resumen rápido (subtotal, envío y total)
function updateQuickSummary(subtotal) {
    try {
        const quickSubtotal = document.getElementById('quick-subtotal');
        const quickShipping = document.getElementById('quick-shipping');
        const quickTotal = document.getElementById('quick-total');

        const selectedShippingEl = document.querySelector('input[name="shipping"]:checked');
        const shippingCost = selectedShippingEl ? parseFloat(selectedShippingEl.value) : 0;

        if (quickSubtotal) quickSubtotal.innerText = `$${(subtotal || 0).toFixed(2)}`;
        if (quickShipping) quickShipping.innerText = `$${(shippingCost || 0).toFixed(2)}`;
        if (quickTotal) quickTotal.innerText = `$${((subtotal || 0) + (shippingCost || 0)).toFixed(2)}`;
    } catch (err) {
        console.warn('updateQuickSummary error', err);
    }
}

// Escuchar cambios en la selección de envío para recalcular el resumen
document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'shipping') {
        const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
        const subtotal = carrito.reduce((s, p) => s + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
        updateQuickSummary(subtotal);
    }
});

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
        // If the dropdown markup for logged-in users is missing (some pages render the "not-logged-in" HTML by default),
        // replace it with the logged-in template so we can populate the fields below.
        if (!document.getElementById('userEmail') || !document.getElementById('userNombre') || !document.getElementById('userApellido')) {
            dropdownMenu.innerHTML = `
                <div class="dropdown-header d-flex align-items-center mb-3">
                    <i class="fa-solid fa-user-circle fa-2x text-primary me-2"></i>
                    <h6 class="mb-0 fw-bold">Bienvenido a Tatylu</h6>
                </div>
                <div class="user-info bg-light rounded-2 p-2 mb-3">
                    <div class="mb-2">
                      <small class="text-muted"><i class="fa-solid fa-envelope me-1"></i>Correo:</small>
                      <div class="fw-semibold" id="userEmail">--</div>
                    </div>
                    <div class="mb-2">
                      <small class="text-muted"><i class="fa-solid fa-user me-1"></i>Nombre:</small>
                      <div class="fw-semibold" id="userNombre">--</div>
                    </div>
                    <div class="mb-0">
                      <small class="text-muted"><i class="fa-solid fa-id-card me-1"></i>Apellido:</small>
                      <div class="fw-semibold" id="userApellido">--</div>
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item rounded-2 py-2" href="profile.html">
                    <i class="fa-solid fa-user-pen text-primary me-2"></i>Editar cuenta
                </a>
                <a class="dropdown-item rounded-2 py-2" href="compras.html">
                    <i class="fa-solid fa-shopping-bag text-success me-2"></i>Mis Compras
                </a>
                <a class="dropdown-item rounded-2 py-2" href="#" onclick="logout()">
                    <i class="fa-solid fa-right-from-bracket text-danger me-2"></i>Cerrar Sesión
                </a>
            `;
        }
        // Ensure localStorage has up-to-date user fields if token is available
        // (helps when auth response doesn't include all fields or after server-side changes)
        (async function ensureUserLocalStorage() {
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const needFetch = !localStorage.getItem('userNombre') || !localStorage.getItem('userApellido');
                if (!token || !needFetch) return;
                const res = await fetch('/api/users/me', { headers: { Authorization: 'Bearer ' + token } });
                if (!res.ok) return;
                const user = await res.json();
                if (user.nombre) localStorage.setItem('userNombre', user.nombre);
                if (user.apellido) localStorage.setItem('userApellido', user.apellido);
                if (user.telefono) localStorage.setItem('userTelefono', user.telefono);
                if (user.photo) localStorage.setItem('userPhoto', user.photo);
                // refresh UI after fetching
                try { updateUserInterface(); } catch (e) { /* ignore recursive errors */ }
            } catch (err) {
                console.warn('ensureUserLocalStorage failed:', err);
            }
        })();

        const userEmail = localStorage.getItem('userEmail') || 'usuario@demo.com';
    const userNombre = localStorage.getItem('userNombre') || 'Usuario';
    // Don't default to 'Demo' — use empty string so invoice/profile don't show wrong last name
    const userApellido = localStorage.getItem('userApellido') || '';
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

        // Add or update a small points badge next to the user button so it's visible on any page
        try {
            // ensure the button is positioned relatively to anchor the badge
            userDropdownButton.style.position = userDropdownButton.style.position || 'relative';
            let badge = document.getElementById('header-points-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'header-points-badge';
                badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark';
                badge.style.fontSize = '0.65em';
                badge.style.padding = '2px 6px';
                badge.style.cursor = 'pointer';
                badge.title = 'Puntos de lealtad (ver perfil)';
                badge.addEventListener('click', function(ev){ ev.stopPropagation(); window.location.href = 'profile.html'; });
                userDropdownButton.appendChild(badge);
            }
            // Update badge value from loyaltyManager if available, else from localStorage
            (function updateBadge(){
                try {
                    const emailForPoints = localStorage.getItem('userEmail') || userEmail;
                    let pointsText = '';
                    if (window.loyaltyManager && typeof window.loyaltyManager.getLoyaltySummary === 'function') {
                        const summ = window.loyaltyManager.getLoyaltySummary(emailForPoints || '');
                        pointsText = summ && typeof summ.points === 'number' ? String(summ.points) : '';
                    } else {
                        // fallback: if there's a loyalty_{email} entry, parse it
                        try {
                            const raw = localStorage.getItem('loyalty_' + (emailForPoints || ''));
                            if (raw) {
                                const obj = JSON.parse(raw);
                                pointsText = obj && typeof obj.points === 'number' ? String(obj.points) : '';
                            }
                        } catch(e) { pointsText = ''; }
                    }
                    badge.innerText = pointsText || '';
                    badge.style.display = (pointsText || '') ? 'inline-block' : 'none';
                } catch(e) { /* ignore */ }
            })();
        } catch (e) { console.warn('Could not add header points badge', e); }
        
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
        // remove header points badge if present
        try { const badge = document.getElementById('header-points-badge'); if (badge && badge.parentNode) badge.parentNode.removeChild(badge); } catch(e){}
    }
}

// Función para cerrar sesión
function logout() {
    // Fallback si Swal no está disponible
    const performLogout = () => {
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

        // Actualizar interfaz
        try { updateUserInterface(); } catch (e) { console.warn('updateUserInterface missing', e); }
        try { actualizarCarritoUI(); } catch (e) { console.warn('actualizarCarritoUI missing', e); }

        // Recargar carrito si estamos en la página del carrito
        try { if (typeof cargarCarrito === 'function') cargarCarrito(); } catch (e) { /* ignore */ }

        // Redirigir a página principal si estamos en páginas protegidas
        const currentPage = window.location.pathname.split('/').pop();
        const protectedPages = ['cart.html', 'compras.html'];
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'index.html';
        }
    };

    if (typeof Swal === 'undefined') {
        // Use native confirm as fallback
        const ok = confirm('¿Cerrar sesión?\nSe eliminará tu carrito actual y tendrás que iniciar sesión nuevamente');
        if (ok) {
            performLogout();
            try { alert('Sesión cerrada'); } catch(e){}
        }
        return;
    }

    // Use Swal if available
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: 'Se eliminará tu carrito actual y tendrás que iniciar sesión nuevamente',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            performLogout();
            Swal.fire({
                title: 'Sesión cerrada',
                text: 'Has cerrado sesión exitosamente',
                icon: 'success',
                confirmButtonText: 'OK'
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

// Función para verificar si estamos en un servidor o en file://
function isRunningOnServer() {
    const protocol = window.location.protocol;
    return protocol === 'http:' || protocol === 'https:';
}

// Mostrar advertencia si estamos en file://
function checkServerStatus() {
    if (!isRunningOnServer()) {
        console.warn('⚠️ ADVERTENCIA: La aplicación se está ejecutando desde file://');
        console.warn('📌 Para una experiencia completa, ejecuta la aplicación en un servidor HTTP');
        console.warn('💡 Sugerencia: Usa "python -m http.server 8000" o Live Server de VS Code');
        
        // Mostrar banner de advertencia (opcional)
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff9800;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 9999;
            font-size: 14px;
        `;
        banner.innerHTML = `
            ⚠️ Modo offline detectado. Para mejor experiencia, ejecuta en un servidor local.
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">Cerrar</button>
        `;
        document.body.prepend(banner);
    }
}

// Ejecutar verificación al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkServerStatus);
} else {
    checkServerStatus();
}

// DEBUG: Función helper para verificar stock en consola
window.debugStock = function(productId) {
    console.log('=== DEBUG STOCK ===');
    console.log('Product ID:', productId);
    
    if (typeof productManager === 'undefined') {
        console.error('❌ productManager no está disponible');
        return;
    }
    
    console.log('Total productos en memoria:', productManager.products.length);
    
    const product = productManager.getProductById(productId);
    if (!product) {
        console.error('❌ Producto no encontrado');
        console.log('IDs disponibles:', productManager.products.map(p => p.id));
        return;
    }
    
    console.log('✅ Producto encontrado:', {
        id: product.id,
        nombre: product.nombre,
        stock: product.stock,
        stockType: typeof product.stock,
        precio: product.precio
    });
    
    const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    const enCarrito = carrito.find(p => p.id.toString() === productId.toString());
    console.log('En carrito:', enCarrito ? enCarrito.cantidad : 0);
    
    return product;
};

// DEBUG: Listar todos los productos con stock
window.listAllStock = function() {
    console.log('=== TODOS LOS PRODUCTOS ===');
    if (typeof productManager === 'undefined') {
        console.error('❌ productManager no está disponible');
        return;
    }
    
    const products = productManager.products;
    console.table(products.map(p => ({
        id: p.id,
        nombre: p.nombre,
        stock: p.stock,
        precio: p.precio,
        categoria: p.categoria
    })));
};