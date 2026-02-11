console.log('🔍 === DIAGNÓSTICO DEL CARRITO ===');

// Verificar el estado del localStorage
console.log('📋 Estado del localStorage:');
console.log('- userLoggedIn:', localStorage.getItem('userLoggedIn'));
console.log('- userEmail:', localStorage.getItem('userEmail'));

// Verificar el carrito actual
const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
console.log('🛒 Carrito actual:', carrito);
console.log('🛒 Cantidad de items:', carrito.length);

if (carrito.length > 0) {
    console.log('📦 Items en el carrito:');
    carrito.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.nombre} - $${item.precio} (Cantidad: ${item.cantidad})`);
    });
}

// Verificar productos disponibles
const productos = JSON.parse(localStorage.getItem('productos') || '[]');
console.log('📦 Productos en storage:', productos.length);

if (productos.length > 0) {
    console.log('📦 Primeros 3 productos:');
    productos.slice(0, 3).forEach((prod, index) => {
        console.log(`  ${index + 1}. ${prod.nombre} - $${prod.precio}`);
    });
}

// Verificar si hay datos de sesiones anteriores
const keys = Object.keys(localStorage);
console.log('🔑 Todas las claves en localStorage:', keys);

// Función para limpiar solo el carrito
function limpiarCarrito() {
    localStorage.removeItem('carrito');
    console.log('🧹 Carrito limpiado');
    if (typeof cargarCarrito === 'function') {
        cargarCarrito();
    }
}

// Función para agregar producto de prueba
function agregarProductoPrueba() {
    const productoPrueba = {
        id: 'test-999',
        nombre: 'Producto de Prueba',
        precio: 19.99,
        cantidad: 1,
        imagen: './static/img/producto.png',
        capacidad: 'Test'
    };
    
    let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    carrito.push(productoPrueba);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    
    console.log('✅ Producto de prueba agregado');
    if (typeof cargarCarrito === 'function') {
        cargarCarrito();
    }
}

// Hacer funciones disponibles globalmente
window.limpiarCarrito = limpiarCarrito;
window.agregarProductoPrueba = agregarProductoPrueba;

console.log('🔧 Funciones disponibles: limpiarCarrito(), agregarProductoPrueba()');
console.log('=== FIN DIAGNÓSTICO ===');
