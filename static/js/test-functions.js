// Funciones de test para debugging
console.log('🔧 Test functions loaded');

// Test de login
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

// Test simple de carrito
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
        if (typeof agregarAlCarrito === 'function') {
            agregarAlCarrito(testProduct.id, testProduct.nombre, testProduct.precio, testProduct.imagen, 'Test');
            console.log('✅ Add to cart function called successfully');
        } else {
            console.error('❌ agregarAlCarrito function not found');
        }
        
    } catch (error) {
        console.error('❌ Error in testSimpleAddToCart:', error);
    }
}

// Test de estado del sistema
function testSystemStatus() {
    console.log('🔍 System Status Check:');
    console.log('- User logged in:', localStorage.getItem('userLoggedIn'));
    console.log('- ProductManager available:', typeof productManager !== 'undefined');
    console.log('- agregarAlCarrito function:', typeof agregarAlCarrito);
    console.log('- SweetAlert available:', typeof Swal !== 'undefined');
    
    const productos = JSON.parse(localStorage.getItem('productos') || '[]');
    console.log('- Products in storage:', productos.length);
    
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    console.log('- Items in cart:', carrito.length);
}

// Hacer funciones disponibles globalmente
window.testLogin = testLogin;
window.testSimpleAddToCart = testSimpleAddToCart;
window.testSystemStatus = testSystemStatus;

console.log('🔧 Test functions ready: testLogin(), testSimpleAddToCart(), testSystemStatus()');
