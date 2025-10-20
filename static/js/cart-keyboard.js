// =================== SISTEMA DE CONTROL DE CARRITO CON TECLADO ===================

// Variables globales para el control del carrito
let selectedProductIndex = 0;
let cartKeyboardMode = false;

// Inicializar controles de teclado
function initializeCartKeyboardControls() {
    document.addEventListener('keydown', handleCartKeyboard);
    
    // Escuchar cambios en el carrito para actualizar controles
    const observer = new MutationObserver(() => {
        updateCartKeyboardIndicators();
    });
    
    // Observar cambios en el contenedor del carrito
    const cartContainer = document.querySelector('.cart-items-container');
    if (cartContainer) {
        observer.observe(cartContainer, { childList: true, subtree: true });
    }
}

// Manejar eventos de teclado para el carrito
function handleCartKeyboard(event) {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    if (cartItems.length === 0) return;
    
    // Activar modo teclado con Ctrl + K
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        toggleCartKeyboardMode();
        return;
    }
    
    // Solo procesar otras teclas si el modo teclado está activo
    if (!cartKeyboardMode) return;
    
    switch(event.key) {
        case 'ArrowUp':
            event.preventDefault();
            navigateCart(-1);
            break;
        case 'ArrowDown':
            event.preventDefault();
            navigateCart(1);
            break;
        case '+':
        case '=':
            event.preventDefault();
            increaseSelectedQuantity();
            break;
        case '-':
        case '_':
            event.preventDefault();
            decreaseSelectedQuantity();
            break;
        case 'Delete':
        case 'Backspace':
            event.preventDefault();
            removeSelectedProduct();
            break;
        case 'Escape':
            event.preventDefault();
            toggleCartKeyboardMode();
            break;
        case 'Enter':
            event.preventDefault();
            if (cartItems.length > 0) {
                proceedToCheckout();
            }
            break;
    }
}

// Alternar modo teclado
function toggleCartKeyboardMode() {
    cartKeyboardMode = !cartKeyboardMode;
    
    if (cartKeyboardMode) {
        selectedProductIndex = 0;
        showKeyboardModeToast(true);
        updateCartSelection();
        showKeyboardInstructions();
    } else {
        clearCartSelection();
        showKeyboardModeToast(false);
    }
}

// Navegar entre productos del carrito
function navigateCart(direction) {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    if (cartItems.length === 0) return;
    
    selectedProductIndex += direction;
    
    if (selectedProductIndex < 0) {
        selectedProductIndex = cartItems.length - 1;
    } else if (selectedProductIndex >= cartItems.length) {
        selectedProductIndex = 0;
    }
    
    updateCartSelection();
}

// Actualizar selección visual del carrito
function updateCartSelection() {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    
    cartItems.forEach((item, index) => {
        item.classList.remove('keyboard-selected');
        if (index === selectedProductIndex && cartKeyboardMode) {
            item.classList.add('keyboard-selected');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

// Limpiar selección del carrito
function clearCartSelection() {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    cartItems.forEach(item => {
        item.classList.remove('keyboard-selected');
    });
}

// Aumentar cantidad del producto seleccionado
function increaseSelectedQuantity() {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    if (cartItems.length === 0 || selectedProductIndex >= cartItems.length) return;
    
    const selectedItem = cartItems[selectedProductIndex];
    const productId = getProductIdFromCartItem(selectedItem);
    
    if (productId) {
        increaseQuantity(productId);
        showQuantityChangeToast('increase');
    }
}

// Disminuir cantidad del producto seleccionado
function decreaseSelectedQuantity() {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    if (cartItems.length === 0 || selectedProductIndex >= cartItems.length) return;
    
    const selectedItem = cartItems[selectedProductIndex];
    const productId = getProductIdFromCartItem(selectedItem);
    
    if (productId) {
        decreaseQuantity(productId);
        showQuantityChangeToast('decrease');
    }
}

// Eliminar producto seleccionado
function removeSelectedProduct() {
    const cartItems = document.querySelectorAll('.cart-item, .producto-carrito');
    if (cartItems.length === 0 || selectedProductIndex >= cartItems.length) return;
    
    const selectedItem = cartItems[selectedProductIndex];
    const productId = getProductIdFromCartItem(selectedItem);
    const productName = getProductNameFromCartItem(selectedItem);
    
    if (productId) {
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
                // Ajustar selección si es necesario
                const newCartItems = document.querySelectorAll('.cart-item, .producto-carrito');
                if (selectedProductIndex >= newCartItems.length) {
                    selectedProductIndex = Math.max(0, newCartItems.length - 1);
                }
                updateCartSelection();
            }
        });
    }
}

// Obtener ID del producto desde el elemento del carrito
function getProductIdFromCartItem(cartItem) {
    // Buscar en diferentes atributos posibles
    return cartItem.getAttribute('data-product-id') || 
           cartItem.getAttribute('data-id') ||
           cartItem.querySelector('[data-product-id]')?.getAttribute('data-product-id') ||
           cartItem.querySelector('[data-id]')?.getAttribute('data-id');
}

// Obtener nombre del producto desde el elemento del carrito
function getProductNameFromCartItem(cartItem) {
    const nameElement = cartItem.querySelector('.product-name, .nombre-producto, h5, h6');
    return nameElement ? nameElement.textContent.trim() : 'Producto';
}

// Mostrar toast de modo teclado
function showKeyboardModeToast(enabled) {
    const icon = enabled ? '⌨️' : '🖱️';
    const title = enabled ? 'Modo Teclado Activado' : 'Modo Teclado Desactivado';
    const text = enabled ? 'Usa las teclas para navegar' : 'Vuelve al modo mouse';
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        icon: 'info',
        title: `${icon} ${title}`,
        text: text
    });
}

// Mostrar toast de cambio de cantidad
function showQuantityChangeToast(action) {
    const icon = action === 'increase' ? '➕' : '➖';
    const actionText = action === 'increase' ? 'Aumentado' : 'Disminuido';
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        icon: 'success',
        title: `${icon} ${actionText}`,
        showCloseButton: false
    });
}

// Actualizar indicadores visuales del teclado
function updateCartKeyboardIndicators() {
    // Agregar indicadores visuales si no existen
    if (!document.querySelector('.keyboard-indicator')) {
        addKeyboardIndicator();
    }
}

// Agregar indicador visual del modo teclado
function addKeyboardIndicator() {
    const cartContainer = document.querySelector('.cart-container, .carrito-container, .container');
    if (!cartContainer) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'keyboard-indicator';
    indicator.innerHTML = `
        <div class="d-flex align-items-center justify-content-between p-2 bg-info text-white rounded mb-2" style="font-size: 0.9em;">
            <span><i class="fas fa-keyboard me-2"></i>Presiona <kbd>Ctrl+K</kbd> para activar modo teclado</span>
            <button class="btn btn-sm btn-outline-light" onclick="toggleCartKeyboardMode()">
                <i class="fas fa-keyboard"></i>
            </button>
        </div>
    `;
    
    cartContainer.insertBefore(indicator, cartContainer.firstChild);
}

// Mostrar instrucciones completas de teclado
function showKeyboardInstructions() {
    Swal.fire({
        title: '⌨️ Controles de Teclado - Carrito',
        html: `
            <div class="text-start">
                <h6>🔧 Activación/Desactivación:</h6>
                <ul>
                    <li><kbd>Ctrl</kbd> + <kbd>K</kbd> - Activar/Desactivar modo teclado</li>
                    <li><kbd>Esc</kbd> - Desactivar modo teclado</li>
                </ul>
                
                <h6>🧭 Navegación:</h6>
                <ul>
                    <li><kbd>↑</kbd> - Producto anterior</li>
                    <li><kbd>↓</kbd> - Producto siguiente</li>
                </ul>
                
                <h6>📊 Cantidad:</h6>
                <ul>
                    <li><kbd>+</kbd> o <kbd>=</kbd> - Aumentar cantidad</li>
                    <li><kbd>-</kbd> - Disminuir cantidad</li>
                </ul>
                
                <h6>🗑️ Eliminar:</h6>
                <ul>
                    <li><kbd>Delete</kbd> o <kbd>Backspace</kbd> - Eliminar producto</li>
                </ul>
                
                <h6>🛒 Comprar:</h6>
                <ul>
                    <li><kbd>Enter</kbd> - Proceder al checkout</li>
                </ul>
                
                <div class="alert alert-info mt-3">
                    <i class="fas fa-lightbulb me-2"></i>
                    <strong>Tip:</strong> El producto seleccionado se destacará con un borde azul
                </div>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido',
        width: '600px'
    });
}

// Proceder al checkout (función auxiliar)
function proceedToCheckout() {
    if (typeof enviarCarrito === 'function') {
        enviarCarrito();
    } else if (typeof window.enviarCarrito === 'function') {
        window.enviarCarrito();
    } else {
        // Buscar botón de checkout y hacer clic
        const checkoutButton = document.querySelector('[onclick*="enviarCarrito"], .checkout-btn, #checkout-btn');
        if (checkoutButton) {
            checkoutButton.click();
        } else {
            Swal.fire('Info', 'No se encontró función de checkout', 'info');
        }
    }
}

// Estilos CSS para la selección por teclado
function addKeyboardStyles() {
    if (document.querySelector('#keyboard-cart-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'keyboard-cart-styles';
    styles.textContent = `
        .keyboard-selected {
            border: 3px solid #007bff !important;
            background-color: rgba(0, 123, 255, 0.1) !important;
            transform: scale(1.02);
            transition: all 0.2s ease;
            box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3) !important;
        }
        
        .keyboard-indicator {
            position: relative;
            z-index: 1000;
        }
        
        .keyboard-indicator kbd {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 3px;
            padding: 2px 4px;
            font-size: 0.8em;
        }
        
        @keyframes keyboard-pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 123, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
        }
        
        .keyboard-selected {
            animation: keyboard-pulse 2s infinite;
        }
    `;
    
    document.head.appendChild(styles);
}

// =================== INICIALIZACIÓN ===================

// Inicializar controles cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    addKeyboardStyles();
    initializeCartKeyboardControls();
    
    // Agregar listener para cuando se actualiza el carrito
    const originalUpdateCarrito = window.actualizarCarritoUI;
    if (originalUpdateCarrito) {
        window.actualizarCarritoUI = function() {
            originalUpdateCarrito.apply(this, arguments);
            setTimeout(() => {
                updateCartKeyboardIndicators();
                if (cartKeyboardMode) {
                    updateCartSelection();
                }
            }, 100);
        };
    }
});

// Exponer funciones globalmente
window.toggleCartKeyboardMode = toggleCartKeyboardMode;
window.showKeyboardInstructions = showKeyboardInstructions;
window.cartKeyboardMode = cartKeyboardMode;
