document.addEventListener('DOMContentLoaded', function() {
    // If already logged in via localStorage (legacy), redirect to index
    if (localStorage.getItem('userLoggedIn') === 'true') {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('email')?.value || '').trim().toLowerCase();
        const password = (document.getElementById('password')?.value || '');

        // Validate required
        if (!email || !password) {
            Swal.fire({ title: 'Campos requeridos', text: 'Por favor ingresa email y contraseña', icon: 'error' });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire({ title: 'Email inválido', text: 'Por favor ingresa un email válido', icon: 'error' });
            return;
        }

        // Admin shortcut: authenticate against backend and store token in sessionStorage (volatile)
        if (email === 'admin@gmail.com' && password === '123456') {
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    Swal.fire({ title: 'Error de autenticación', text: body.error || body.message || 'No se pudo autenticar como admin', icon: 'error' });
                    return;
                }

                if (body.token) sessionStorage.setItem('token', body.token);

                await Swal.fire({ title: '¡Bienvenido Administrador!', text: 'Accediendo al panel de administración...', icon: 'success' });

                // set admin flags in sessionStorage (do not use localStorage)
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminEmail', email);
                sessionStorage.setItem('adminName', 'Administrador');
                sessionStorage.setItem('loginTimestamp', Date.now().toString());

                window.location.href = 'admin.html';
                return;
            } catch (err) {
                console.error('Admin login error:', err);
                Swal.fire({ title: 'Error', text: 'Error conectando con el servidor para autenticar admin', icon: 'error' });
                return;
            }
        }

        // Regular user: try API login (window.api bridge if present), otherwise call /api/auth/login
        try {
            if (window.api && typeof window.api.login === 'function') {
                const res = await window.api.login({ email, password });
                if (res && res.token) {
                    // legacy behavior: keep token in localStorage for app flows
                    localStorage.setItem('token', res.token);
                    localStorage.setItem('userLoggedIn', 'true');
                    localStorage.setItem('userEmail', res.user.email || '');
                    localStorage.setItem('userNombre', res.user.nombre || '');
                    localStorage.setItem('userApellido', res.user.apellido || '');
                    if (res.user.photo) localStorage.setItem('userPhoto', res.user.photo);
                    window.location.href = 'index.html';
                    return;
                }
            } else {
                const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                const body = await r.json().catch(() => ({}));
                if (r.ok && body.token) {
                    localStorage.setItem('token', body.token);
                    localStorage.setItem('userLoggedIn', 'true');
                    localStorage.setItem('userEmail', body.user?.email || '');
                    localStorage.setItem('userNombre', body.user?.nombre || '');
                    localStorage.setItem('userApellido', body.user?.apellido || '');
                    if (body.user?.photo) localStorage.setItem('userPhoto', body.user.photo);
                    window.location.href = 'index.html';
                    return;
                }
            }
        } catch (err) {
            console.error('API login failed, falling back to local:', err);
        }

        // Fallback to localStorage-registered users (offline/testing)
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = registeredUsers.find(u => (u.email || '').toLowerCase() === email && u.password === password);
        if (user) {
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userNombre', user.nombre || '');
            localStorage.setItem('userApellido', user.apellido || '');
            if (user.photo) localStorage.setItem('userPhoto', user.photo);
            window.location.href = 'index.html';
            return;
        }

        Swal.fire({ title: 'Error de autenticación', text: 'Email o contraseña incorrectos.', icon: 'error' });
    });

    // Ask for notification permission on load (non-blocking)
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});