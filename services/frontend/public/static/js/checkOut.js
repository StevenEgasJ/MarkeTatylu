document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const cartId = urlParams.get('cart_id');
    let addressId = null;

    // Cargar datos del carrito
    const loadCart = async() => {
        try {
            // REMOVED: Don't validate backend on page load (passive operation)
            // Only validate when user clicks "finalizar compra" (checkout action)

            const response = await fetch(`/api/cart/${cartId}`);
            const cart = await response.json();

            if (cart.error) throw new Error(cart.error);

            // Actualizar UI
            document.getElementById('subtotal').textContent = `$${cart.total.toFixed(2)}`;
            document.getElementById('total').textContent = `$${(cart.total + 3).toFixed(2)}`;
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo cargar el carrito.' });
            window.location.href = '/cart';
        }
    };

    // Guardar dirección
    document.getElementById('address-form').addEventListener('submit', async(e) => {
        e.preventDefault();

        try {
            const response = await fetch('/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provincia: document.getElementById('provincia').value,
                    canton: document.getElementById('canton').value,
                    parroquia: document.getElementById('parroquia').value,
                    calle_principal: document.getElementById('calle_principal').value,
                    calle_secundaria: document.getElementById('calle_secundaria').value,
                    codigo_postal: document.getElementById('codigo_postal').value
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            addressId = data.id; // ID de la dirección guardada
            alert('Dirección guardada!');
        } catch (error) {
            alert(error.message);
        }
    });

    // Finalizar compra
    // Dentro del evento click de 'finalizar-compra'
    document.getElementById('finalizar-compra').addEventListener('click', async() => {
        try {
            if (!cartId || !addressId) {
                alert('Primero guarda tu dirección');
                return;
            }

            // Check that the business backend is available before finalizing
            if (window.api && typeof window.api.pingBusiness === 'function') {
                const up = await window.api.pingBusiness();
                if (!up) {
                    await Swal.fire({ icon: 'error', title: 'Servidor de negocio caído', text: 'El servidor de negocio está caído. No se puede procesar el pedido en este momento.' });
                    return;
                }
            }

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address_id: addressId,
                    cart_id: cartId
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al crear pedido');

            // Limpiar datos y redirigir
            localStorage.removeItem('carrito');
            window.location.href = '/index'; // Cambia esta línea

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // Iniciar
    if (cartId) loadCart();
    else window.location.href = '/cart';
});