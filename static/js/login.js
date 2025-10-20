document.addEventListener("DOMContentLoaded", function() {
    // Verificar si ya está logueado
    if (localStorage.getItem('userLoggedIn') === 'true') {
        window.location.href = "index.html";
        return;
    }

    const loginForm = document.getElementById("loginForm");
    loginForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        // Validación de campos vacíos
        if (!email || !password) {
            Swal.fire({
                title: 'Campos requeridos',
                text: 'Por favor ingresa email y contraseña',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        // Validación de formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire({
                title: 'Email inválido',
                text: 'Por favor ingresa un email válido',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        // Verificar si es el admin
        if (email === 'admin@gmail.com' && password === '123456') {
            // Login como administrador
            await Swal.fire({
                title: '¡Bienvenido Administrador!',
                text: 'Accediendo al panel de administración...',
                icon: 'success',
                confirmButtonText: 'Continuar'
            });

            // Guardar datos del admin en localStorage
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', 'admin@gmail.com');
            localStorage.setItem('adminName', 'Administrador');
            localStorage.setItem('loginTimestamp', Date.now().toString());
            
            // Redirigir al panel de administración
            window.location.href = "admin.html";
            return;
        }

        // Obtener usuarios registrados
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        const user = registeredUsers.find(u => u.email.toLowerCase() === email && u.password === password);
        
        if (user) {
            // Login exitoso
            await Swal.fire({
                title: '¡Login exitoso!',
                text: `Bienvenido de vuelta, ${user.nombre}`,
                icon: 'success',
                confirmButtonText: 'Continuar'
            });

            // Limpiar datos de usuario anterior si es un usuario diferente
            const previousUser = localStorage.getItem('userEmail');
            if (previousUser && previousUser !== user.email) {
                console.log('🔄 Cambiando de usuario, limpiando datos anteriores...');
                // Limpiar solo datos de usuario, no productos ni admin
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userNombre');
                localStorage.removeItem('userApellido');
                localStorage.removeItem('userCedula');
                localStorage.removeItem('userTelefono');
                localStorage.removeItem('userPhoto');
                localStorage.removeItem('carrito');
                localStorage.removeItem('loginTimestamp');
            }

            // Guardar datos del usuario en localStorage
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userNombre', user.nombre);
            localStorage.setItem('userApellido', user.apellido);
            localStorage.setItem('userCedula', user.cedula);
            localStorage.setItem('userTelefono', user.telefono || '');
            localStorage.setItem('loginTimestamp', Date.now().toString());
            
            // Guardar foto de usuario (limpiar si no tiene foto)
            if (user.photo) {
                localStorage.setItem('userPhoto', user.photo);
            } else {
                localStorage.removeItem('userPhoto'); // Limpiar foto anterior si el nuevo usuario no tiene
            }
            
            // Mostrar notificación del navegador
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('El Valle', {
                    body: `Bienvenido de vuelta, ${user.nombre}`,
                    icon: './static/img/logo.png'
                });
            }
            
            // Redirigir a la página principal
            window.location.href = "index.html";
        } else {
            // Verificar si el email existe pero la contraseña es incorrecta
            const emailExists = registeredUsers.find(u => u.email.toLowerCase() === email);
            
            if (emailExists) {
                Swal.fire({
                    title: 'Contraseña incorrecta',
                    text: 'El email es correcto, pero la contraseña no coincide.',
                    icon: 'error',
                    confirmButtonText: 'Intentar de nuevo'
                });
            } else {
                // Email no registrado
                Swal.fire({
                    title: 'Usuario no encontrado',
                    text: 'Este email no está registrado. ¿Deseas crear una cuenta?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Crear Cuenta',
                    cancelButtonText: 'Intentar de nuevo'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = "signUp.html";
                    }
                });
            }
        }
    });

    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});