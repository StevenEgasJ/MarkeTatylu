// Debug script to check cart products and validate against server
(async function debugCartProducts() {
    console.log('🔍 DEBUG: Checking cart products...');
    
    // Get cart from localStorage
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    console.log('📦 Cart has', carrito.length, 'items');
    
    if (carrito.length === 0) {
        console.log('✅ Cart is empty');
        return;
    }
    
    // Display all cart items
    console.table(carrito.map((item, idx) => ({
        index: idx,
        id: item.id,
        nombre: item.nombre,
        precio: item.precio,
        cantidad: item.cantidad
    })));
    
    // Validate each product against server
    console.log('\n🔄 Validating products with server...');
    
    const validationResults = [];
    for (const item of carrito) {
        try {
            const response = await fetch(`/api/products/${item.id}`);
            const exists = response.ok;
            const data = exists ? await response.json() : null;
            
            validationResults.push({
                id: item.id,
                nombre: item.nombre,
                exists: exists,
                serverName: data?.nombre || 'N/A',
                serverStock: data?.stock || 0,
                status: exists ? '✅ OK' : '❌ NOT FOUND'
            });
        } catch (error) {
            validationResults.push({
                id: item.id,
                nombre: item.nombre,
                exists: false,
                serverName: 'ERROR',
                serverStock: 0,
                status: '⚠️ ERROR: ' + error.message
            });
        }
    }
    
    console.table(validationResults);
    
    // Check for invalid products
    const invalidProducts = validationResults.filter(r => !r.exists);
    if (invalidProducts.length > 0) {
        console.warn('\n⚠️ Found', invalidProducts.length, 'invalid product(s) in cart:');
        invalidProducts.forEach(p => {
            console.warn(`   - ${p.id}: ${p.nombre}`);
        });
        
        console.log('\n💡 To fix this issue, you can:');
        console.log('   1. Remove invalid products from cart:');
        console.log('      removeInvalidProductsFromCart()');
        console.log('   2. Clear entire cart:');
        console.log('      localStorage.removeItem("carrito"); location.reload();');
    } else {
        console.log('\n✅ All cart products are valid!');
    }
    
    // Add helper function to remove invalid products
    window.removeInvalidProductsFromCart = function() {
        const invalidIds = invalidProducts.map(p => p.id);
        const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        const cleanedCart = carrito.filter(item => !invalidIds.includes(item.id));
        
        console.log(`🧹 Removing ${carrito.length - cleanedCart.length} invalid product(s)...`);
        localStorage.setItem('carrito', JSON.stringify(cleanedCart));
        console.log('✅ Cart cleaned! Reloading page...');
        location.reload();
    };
    
    return validationResults;
})();
