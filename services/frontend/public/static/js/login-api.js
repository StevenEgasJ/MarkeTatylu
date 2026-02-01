document.addEventListener("DOMContentLoaded", function() {
    console.log('[login-api] DOMContentLoaded');
    // Si ya está logueado, ir al index
    if (localStorage.getItem('userLoggedIn') === 'true') {
        window.location.href = "index.html";
        return;
    }

    const loginForm = document.getElementById("loginForm");
    if (!loginForm) {
        console.warn('[login-api] loginForm not found');
        return;
    }

    console.log('[login-api] attaching submit listener to #loginForm');
    // Inline validation helpers
    function showFieldError(fieldId, message) {
        try {
            const f = document.getElementById(fieldId);
            const fb = document.getElementById(fieldId + 'Feedback');
            if (f) f.classList.add('is-invalid');
            if (fb) fb.textContent = message;
        } catch (e) { console.debug('showFieldError failed', e); }
    }

    function clearFieldError(fieldId) {
        try {
            const f = document.getElementById(fieldId);
            const fb = document.getElementById(fieldId + 'Feedback');
            if (f) f.classList.remove('is-invalid');
            if (fb) fb.textContent = '';
        } catch (e) { /* ignore */ }
    }

    // Clear errors on user input
    ['email', 'password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => clearFieldError(id));
    });

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log('[login-api] submit handler fired');
        try {
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        // Clear previous field errors
        clearFieldError('email');
        clearFieldError('password');

        // Validación básica (inline)
        if (!email || !password) {
            if (!email) {
                showFieldError('email', 'Por favor, ingrese correo electrónico');
                const el = document.getElementById('email'); if (el) el.focus();
            }
            if (!password) {
                showFieldError('password', 'Por favor, ingrese contraseña');
                // focus password only if email is present
                if (email) { const pel = document.getElementById('password'); if (pel) pel.focus(); }
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showFieldError('email', 'Por favor, ingrese un email válido');
            const el = document.getElementById('email'); if (el) el.focus();
            return;
        }

        // Admin local shortcut
        if (email === 'admin@gmail.com' && password === '123456') {
            await Swal.fire({ title: '¡Bienvenido Administrador!', text: 'Accediendo al panel de administración...', icon: 'success', confirmButtonText: 'Continuar' });
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', 'admin@gmail.com');
            localStorage.setItem('adminName', 'Administrador');
            localStorage.setItem('loginTimestamp', Date.now().toString());
            window.location.href = 'admin.html';
            return;
        }

        // Check API availability. When reachable, require server-based login (persisted in Atlas).
        let apiAvailable = false;
        try {
            if (window.api && typeof window.api.ping === 'function') {
                apiAvailable = await window.api.ping();
            }
        } catch (err) {
            apiAvailable = false;
        }

        if (apiAvailable) {
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
                        // Try to load server-side cart into localStorage
                        try {
                            if (window.api && typeof window.api.getCart === 'function') {
                                let serverCartRes = await window.api.getCart();
                                const serverCart = Array.isArray(serverCartRes) ? serverCartRes : (serverCartRes && serverCartRes.cart) ? serverCartRes.cart : [];
                                if (Array.isArray(serverCart) && serverCart.length > 0) {
                                    // map to local shape if necessary
                                    const mapped = serverCart.map(item => ({ id: item.id || item._id || item.productId, nombre: item.nombre || item.name || '', precio: item.precio || item.price || 0, imagen: item.imagen || item.image || '', mililitros: item.mililitros || item.capacidad || 'N/A', cantidad: item.cantidad || item.quantity || item.qty || 1 }));
                                    localStorage.setItem('carrito', JSON.stringify(mapped));
                                }
                            }
                        } catch (err) {
                            console.warn('Could not load server cart:', err);
                        }
                        window.location.href = 'index.html';
                        return;
                    }
                    // If server returned a JSON error payload like { error: 'Invalid credentials' }
                    if (res && res.error) {
                        const low = String(res.error).toLowerCase();
                        if (low.includes('invalid') || low.includes('credential')) {
                            await Swal.fire({ title: 'No se pudo iniciar sesion', text: 'Contraseña incorrecta', icon: 'error', confirmButtonText: 'OK' });
                            return;
                        }
                        // Other server-provided message
                        await Swal.fire({ title: 'No se pudo iniciar sesión en el servidor', text: String(res.error), icon: 'error', confirmButtonText: 'OK' });
                        return;
                    }
                }
                // Server rejected login or returned unexpected response
                console.error('Login failed on server or unexpected response');
                await Swal.fire({ title: 'Error de autenticación', text: 'No se pudo iniciar sesión en el servidor. Por favor verifica tus credenciales o intenta más tarde.', icon: 'error', confirmButtonText: 'OK' });
                return; // Block local fallback when server is reachable
            } catch (err) {
                console.error('API login error (server reachable):', err);
                const apiMsg = extractApiError(err) || (err && err.message) || '';
                const low = String(apiMsg).toLowerCase();
                if (low.includes('invalid') || low.includes('credential') || low.includes('invalid credentials') || (err && err.status === 401)) {
                    // Show the specific Spanish message requested by the user
                    await Swal.fire({ title: 'No se pudo iniciar sesion', text: 'Contraseña incorrecta', icon: 'error', confirmButtonText: 'OK' });
                    return;
                }
                const message = apiMsg || 'Hubo un error al comunicarse con el servidor. Intenta más tarde.';
                await Swal.fire({ title: 'No se pudo iniciar sesión en el servidor', html: `<div>${escapeHtml(message)}</div>`, icon: 'error', confirmButtonText: 'OK' });
                return;
            }
        }

        // Fallback: comprobar en localStorage
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        const user = registeredUsers.find(u => u.email.toLowerCase() === email && u.password === password);
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
        return;
        } catch (err) {
            console.error('[login-api] error in submit handler:', err);
            await Swal.fire({ title: 'Error', text: 'Ocurrió un error al procesar el formulario. Revisa la consola para más detalles.', icon: 'error' });
        }
    });

    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Helper: extract error message from API errors (same helpers as in singUp.js)
function extractApiError(err) {
    if (!err) return null;
    try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) return parsed.error;
    } catch (e) {}
    return err.message || String(err);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<>"'`]/g, function (m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[m];
    });
}
// ================================
// LOGIN CON GOOGLE
// ================================
async function handleGoogleLogin(response) {
    try {
        console.log('[google-login] credential received');

        const googleToken = response.credential;

        const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: googleToken })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Google login failed');
        }

        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('token', data.jwt || '');
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userNombre', data.user.name || data.user.nombre || '');
        localStorage.setItem('userApellido', data.user.apellido || '');
        if (data.user.picture) {
            localStorage.setItem('userPhoto', data.user.picture);
        }

        await Swal.fire({
            icon: 'success',
            title: 'Bienvenido',
            text: `Hola ${data.user.name || 'usuario'}`
        });

        window.location.href = 'index.html';

    } catch (err) {
        console.error('[google-login] error:', err);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo iniciar sesión con Google'
        });
    }
}

