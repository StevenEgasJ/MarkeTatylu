// Función para mostrar notificaciones estilizadas
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
        ${message}
    `;

    document.body.appendChild(notification);

    // Animación de entrada
    setTimeout(() => notification.classList.add('show'), 100);

    // Eliminar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Función principal para cancelar pedido
async function cancelOrder(orderId) {
    try {
        const { isConfirmed } = await Swal.fire({
            title: '¿Cancelar pedido?',
            text: "El pedido se marcará como cancelado",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#5e422e',
            cancelButtonColor: '#fc894f',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'Volver'
        });

        if (!isConfirmed) return;

        // Ensure backend-business is available
        if (window.api && typeof window.api.pingBusiness === 'function') {
            const up = await window.api.pingBusiness();
            if (!up) {
                await Swal.fire({ icon: 'error', title: 'Servidor de negocio caído', text: 'El servidor de negocio está caído. No se puede cancelar el pedido en este momento.' });
                return;
            }
        }

        const response = await fetch(`/api/orders/${orderId}/cancelar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error al cancelar');

        // Actualizar la tabla
        const row = document.querySelector(`[data-order-id="${orderId}"]`).closest('tr');
        row.remove();

        Swal.fire({
            icon: 'success',
            title: '¡Cancelado!',
            text: 'El pedido ha sido marcado como cancelado',
            confirmButtonColor: '#5e422e'
        });

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#fc894f'
        });
    }
}