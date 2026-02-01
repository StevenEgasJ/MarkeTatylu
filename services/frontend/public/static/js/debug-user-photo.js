// Script temporal para debugging de fotos de perfil

function debugUserPhoto() {
    console.log('=== DEBUG FOTO DE PERFIL ===');
    console.log('Usuario actual:', localStorage.getItem('userEmail'));
    console.log('Foto actual:', localStorage.getItem('userPhoto'));
    console.log('Usuario logueado:', localStorage.getItem('userLoggedIn'));
    console.log('===========================');
}

function clearUserData() {
    console.log('🧹 Limpiando datos de usuario...');
    localStorage.removeItem('userLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userNombre');
    localStorage.removeItem('userApellido');
    localStorage.removeItem('userCedula');
    localStorage.removeItem('userTelefono');
    localStorage.removeItem('userPhoto');
    localStorage.removeItem('carrito');
    localStorage.removeItem('loginTimestamp');
    
    if (typeof updateUserInterface === 'function') {
        updateUserInterface();
    }
    
    console.log('✅ Datos de usuario limpiados');
}

// Función para simular cambio de usuario
function simulateUserChange() {
    // Crear dos usuarios de prueba
    const user1 = {
        email: 'usuario1@test.com',
        nombre: 'Usuario',
        apellido: 'Uno',
        cedula: '1234567890',
        telefono: '0991234567',
        photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    };
    
    const user2 = {
        email: 'usuario2@test.com',
        nombre: 'Usuario',
        apellido: 'Dos',
        cedula: '0987654321',
        telefono: '0987654321',
        photo: null // Sin foto
    };
    
    // Simular login del primer usuario
    console.log('🔑 Simulando login del Usuario 1 (con foto)...');
    localStorage.setItem('userLoggedIn', 'true');
    localStorage.setItem('userEmail', user1.email);
    localStorage.setItem('userNombre', user1.nombre);
    localStorage.setItem('userApellido', user1.apellido);
    localStorage.setItem('userPhoto', user1.photo);
    
    if (typeof updateUserInterface === 'function') {
        updateUserInterface();
    }
    
    setTimeout(() => {
        console.log('🔄 Simulando logout y login del Usuario 2 (sin foto)...');
        
        // Verificar si es un usuario diferente y limpiar
        const previousUser = localStorage.getItem('userEmail');
        if (previousUser && previousUser !== user2.email) {
            localStorage.removeItem('userPhoto');
        }
        
        localStorage.setItem('userEmail', user2.email);
        localStorage.setItem('userNombre', user2.nombre);
        localStorage.setItem('userApellido', user2.apellido);
        
        if (user2.photo) {
            localStorage.setItem('userPhoto', user2.photo);
        } else {
            localStorage.removeItem('userPhoto');
        }
        
        if (typeof updateUserInterface === 'function') {
            updateUserInterface();
        }
        
        console.log('✅ Cambio de usuario completado');
    }, 3000);
}

// Hacer funciones globales para testing
window.debugUserPhoto = debugUserPhoto;
window.clearUserData = clearUserData;
window.simulateUserChange = simulateUserChange;
