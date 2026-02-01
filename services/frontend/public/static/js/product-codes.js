// =================== FUNCIONES DE CÓDIGOS ÚNICOS PARA PRODUCTOS ===================

// Generar código único para productos
function generateUniqueProductCode() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `PRD-${timestamp}-${randomStr}`.toUpperCase();
}

// Validar código único de producto
function validateProductCode(code, productos = null) {
    // Verificar formato básico
    const codeRegex = /^PRD-[A-Z0-9]+-[A-Z0-9]+$/;
    
    if (!codeRegex.test(code)) {
        return { valid: false, message: 'Formato de código inválido. Use: PRD-XXXXX-XXXXX' };
    }
    
    // Verificar si el código ya existe
    let existingProducts = productos;
    if (!existingProducts) {
        existingProducts = JSON.parse(localStorage.getItem('products') || '[]');
    }
    
    const codeExists = existingProducts.some(product => product.codigo === code);
    
    if (codeExists) {
        return { valid: false, message: 'El código ya existe' };
    }
    
    return { valid: true, message: 'Código válido' };
}

// Buscar producto por código
function findProductByCode(code) {
    const productos = JSON.parse(localStorage.getItem('products') || '[]');
    return productos.find(product => product.codigo === code);
}

// Función para mostrar información de código en el modal
function showCodeInfo() {
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
                
                <div class="alert alert-info mt-3">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Nota:</strong> Los códigos se generan automáticamente al crear productos
                </div>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido',
        width: '600px'
    });
}

// Generar código para producto existente (si no tiene)
function assignCodeToProduct(productId) {
    const productos = JSON.parse(localStorage.getItem('products') || '[]');
    const productIndex = productos.findIndex(p => p.id === productId);
    
    if (productIndex !== -1 && !productos[productIndex].codigo) {
        const newCode = generateUniqueProductCode();
        productos[productIndex].codigo = newCode;
        productos[productIndex].fechaModificacion = new Date().toISOString();
        
        localStorage.setItem('products', JSON.stringify(productos));
        
        return { success: true, code: newCode };
    }
    
    return { success: false, message: 'Producto no encontrado o ya tiene código' };
}

// Verificar y asignar códigos a productos sin código
function ensureAllProductsHaveCodes() {
    const productos = JSON.parse(localStorage.getItem('products') || '[]');
    let updated = false;
    
    productos.forEach(product => {
        if (!product.codigo) {
            product.codigo = generateUniqueProductCode();
            product.fechaModificacion = new Date().toISOString();
            updated = true;
        }
    });
    
    if (updated) {
        localStorage.setItem('products', JSON.stringify(productos));
        console.log('✅ Códigos asignados a productos sin código');
    }
    
    return updated;
}

// =================== FUNCIONES DE VALIDACIÓN DE PAGOS ===================

// Validación de tarjeta de crédito usando algoritmo de Luhn
function validateCreditCard(cardNumber) {
    // Remover espacios y caracteres no numéricos
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // Verificar longitud (13-19 dígitos para la mayoría de tarjetas)
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        return false;
    }
    
    // Algoritmo de Luhn
    let sum = 0;
    let isEven = false;
    
    // Procesar dígitos de derecha a izquierda
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cleanNumber.charAt(i));
        
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

// Detectar tipo de tarjeta
function getCardType(cardNumber) {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // Patrones para diferentes tipos de tarjeta
    const patterns = {
        visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
        mastercard: /^5[1-5][0-9]{14}$/,
        amex: /^3[47][0-9]{13}$/,
        discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
        dinersclub: /^3[0689][0-9]{11}$/,
        jcb: /^(?:2131|1800|35\d{3})\d{11}$/
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(cleanNumber)) {
            return type;
        }
    }
    
    return 'unknown';
}

// Validación de email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Formatear número de tarjeta con espacios
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formattedValue;
}

// Formatear fecha de vencimiento MM/AA
function formatExpiryDate(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value.length >= 2) {
        value = value.substring(0,2) + '/' + value.substring(2,4);
    }
    input.value = value;
}

// =================== INICIALIZACIÓN ===================

// Asegurar que todos los productos tengan códigos al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    ensureAllProductsHaveCodes();
});

// Exponer funciones globalmente para que puedan ser usadas desde otros archivos
window.generateUniqueProductCode = generateUniqueProductCode;
window.validateProductCode = validateProductCode;
window.findProductByCode = findProductByCode;
window.showCodeInfo = showCodeInfo;
window.assignCodeToProduct = assignCodeToProduct;
window.ensureAllProductsHaveCodes = ensureAllProductsHaveCodes;
window.validateCreditCard = validateCreditCard;
window.getCardType = getCardType;
window.validateEmail = validateEmail;
window.formatCardNumber = formatCardNumber;
window.formatExpiryDate = formatExpiryDate;
