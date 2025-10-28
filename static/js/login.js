document.addEventListener("DOMContentLoaded", function() {
    // Verificar si ya está logueado
    if (localStorage.getItem('userLoggedIn') === 'true') {
        const loginForm = document.getElementById("loginForm");
        loginForm.addEventListener("submit", async(e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;

            // Validación de formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
            // Verificar si es el admin
            if (email === 'admin@gmail.com' && password === '123456') {
                // Login como administrador
    // Obtener usuarios registrados
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
    const user = registeredUsers.find(u => u.email.toLowerCase() === email && u.password === password);
            // Try to authenticate via API
            try {
                if (window.api && typeof window.api.login === 'function') {
            if (user) {
                // Guardar sesión en localStorage
                localStorage.setItem('userLoggedIn', 'true');
                // Redirigir al índice
                window.location.href = 'index.html';
            } else {
                Swal.fire({
                    title: 'Error de autenticación',
                    text: 'Email o contraseña incorrectos.',
                });
            }
        });
    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
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
        
            // Try to authenticate via API
            try {
                if (window.api && typeof window.api.login === 'function') {
                    const res = await window.api.login({ email, password });
                    if (res && res.token) {
                        localStorage.setItem('token', res.token);
                        localStorage.setItem('userLoggedIn', 'true');
                        localStorage.setItem('userEmail', res.user.email);
                        localStorage.setItem('userNombre', res.user.nombre || '');
                        localStorage.setItem('userApellido', res.user.apellido || '');
                        if (res.user.photo) localStorage.setItem('userPhoto', res.user.photo);
                        window.location.href = 'index.html';
                        return;
                    }
                }
            } catch (err) {
                console.error('API login failed, falling back to local:', err);
                // fallthrough to localStorage fallback
            }

            if (user) {
                // Guardar sesión en localStorage
                localStorage.setItem('userLoggedIn', 'true');
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userNombre', user.nombre || '');
                localStorage.setItem('userApellido', user.apellido || '');
                if (user.photo) localStorage.setItem('userPhoto', user.photo);

                // Redirigir al índice
                window.location.href = 'index.html';
            } else {
                Swal.fire({
                    title: 'Error de autenticación',
                    text: 'Email o contraseña incorrectos.',
                    icon: 'error',
                });
            }
        }
    });

    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});