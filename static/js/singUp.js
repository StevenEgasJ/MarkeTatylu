// Variables globales para manejar la foto del usuario
let userPhoto = null;
let stream = null;

// Esperar a que el DOM esté cargado
document.addEventListener("DOMContentLoaded", function() {
    // Verificar si ya está logueado
    if (localStorage.getItem('userLoggedIn') === 'true') {
        window.location.href = "index.html";
        return;
    }

    // Esperar un poco más para asegurar que todos los scripts estén cargados
    setTimeout(() => {
        // Inicializar elementos de cámara para registro
        initCameraElementsForRegister();
    }, 200);

    const registerForm = document.getElementById('signUpForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async(e) => {
            e.preventDefault();

            const userData = {
                nombre: document.getElementById('nombre').value.trim(),
                apellido: document.getElementById('apellido').value.trim(),
                email: document.getElementById('email').value.trim().toLowerCase(),
                password: document.getElementById('password').value,
                cedula: document.getElementById('cedula').value.trim(),
                telefono: document.getElementById('telefono') ? document.getElementById('telefono').value.trim() : '',
                fechaRegistro: new Date().toISOString(),
                id: Date.now().toString(), // ID único basado en timestamp
                photo: userPhoto // Incluir foto del usuario
            };

            // Validación básica
            if (!userData.nombre || !userData.apellido || !userData.email || !userData.password || !userData.cedula) {
                Swal.fire({
                    title: 'Campos requeridos',
                    text: 'Por favor completa todos los campos obligatorios',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
                return;
            }

            // Validaciones específicas usando la función mejorada
            const validationResult = validateUserDataEnhanced(userData);
            if (!validationResult.isValid) {
                Swal.fire({
                    title: 'Datos incompletos o inválidos',
                    html: `<ul class="text-start">${validationResult.errors.map(error => `<li>${error}</li>`).join('')}</ul>`,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
                return;
            }

            // Verificar si el email ya está registrado
            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
            const existingUser = registeredUsers.find(user => user.email === userData.email);
            
            if (existingUser) {
                Swal.fire({
                    title: 'Email ya registrado',
                    text: 'Este email ya está registrado. Por favor usa otro email o inicia sesión.',
                    icon: 'error',
                    showCancelButton: true,
                    confirmButtonText: 'Iniciar sesión',
                    cancelButtonText: 'Intentar otro email'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = "login.html";
                    }
                });
                return;
            }

            // Verificar si la cédula ya está registrada
            const existingCedula = registeredUsers.find(user => user.cedula === userData.cedula);
            if (existingCedula) {
                Swal.fire({
                    title: 'Cédula ya registrada',
                    text: 'Esta cédula ya está asociada a otra cuenta.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
                return;
            }

            // Registrar nuevo usuario en localStorage
            registeredUsers.push(userData);
            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

            // Mostrar mensaje de registro exitoso
            await Swal.fire({
                title: '¡Registro exitoso!',
                text: `Bienvenido ${userData.nombre} ${userData.apellido}. Tu cuenta ha sido creada exitosamente.`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Ir al Login',
                cancelButtonText: 'Iniciar Sesión Directamente'
            });

            // Mostrar notificación del navegador
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('El Valle', {
                    body: `Cuenta creada exitosamente para ${userData.nombre}`,
                    icon: './static/img/logo.png'
                });
            }

            // Redirigir al login
            window.location.href = "login.html";
        });
    }

    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// === VALIDACIONES EN TIEMPO REAL ===

// Agregar validaciones en tiempo real cuando se carga el DOM
document.addEventListener("DOMContentLoaded", function() {
    // Validación para cédula (solo números, máximo 10)
    const cedulaInput = document.getElementById('cedula');
    if (cedulaInput) {
        cedulaInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').substring(0, 10);
            validateCedulaField(this);
        });
        
        cedulaInput.addEventListener('blur', function() {
            validateCedulaField(this);
        });
    }
    
    // Validación para teléfono (solo números, máximo 10)
    const telefonoInput = document.getElementById('telefono');
    if (telefonoInput) {
        telefonoInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').substring(0, 10);
            validateTelefonoField(this);
        });
        
        telefonoInput.addEventListener('blur', function() {
            validateTelefonoField(this);
        });
    }
    
    // Validación para email
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            validateEmailField(this);
        });
    }
    
    // Validación para nombre y apellido (solo letras)
    const nombreInput = document.getElementById('nombre');
    const apellidoInput = document.getElementById('apellido');
    
    if (nombreInput) {
        nombreInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        });
    }
    
    if (apellidoInput) {
        apellidoInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        });
    }
});

// Función para validar los datos del usuario
function validateUserData(userData) {
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        return { isValid: false, message: 'Por favor ingresa un email válido' };
    }

    // Validar longitud de contraseña
    if (userData.password.length < 6) {
        return { isValid: false, message: 'La contraseña debe tener al menos 6 caracteres' };
    }

    // Validar formato de cédula ecuatoriana (10 dígitos)
    const cedulaRegex = /^\d{10}$/;
    if (!cedulaRegex.test(userData.cedula)) {
        return { isValid: false, message: 'La cédula debe tener exactamente 10 dígitos' };
    }

    // Validar nombres (solo letras y espacios)
    const nameRegex = /^[a-zA-ZáéíóúñÑ\s]+$/;
    if (!nameRegex.test(userData.nombre)) {
        return { isValid: false, message: 'El nombre solo puede contener letras' };
    }

    if (!nameRegex.test(userData.apellido)) {
        return { isValid: false, message: 'El apellido solo puede contener letras' };
    }

    // Validar teléfono si se proporciona
    if (userData.telefono && userData.telefono.length > 0) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(userData.telefono)) {
            return { isValid: false, message: 'El teléfono debe tener 10 dígitos' };
        }
    }

    return { isValid: true, message: 'Válido' };
}

// === FUNCIONES DE VALIDACIÓN INDIVIDUALES ===

// Validar campo de cédula
function validateCedulaField(input) {
    const cedula = input.value.trim();
    const messageElement = getOrCreateErrorMessage(input, 'cedula-error');
    
    if (cedula.length === 0) {
        showFieldError(input, messageElement, 'La cédula es obligatoria');
        return false;
    } else if (cedula.length < 10) {
        showFieldError(input, messageElement, 'La cédula debe tener exactamente 10 dígitos');
        return false;
    } else if (!/^\d{10}$/.test(cedula)) {
        showFieldError(input, messageElement, 'La cédula solo debe contener números');
        return false;
    } else {
        hideFieldError(input, messageElement);
        return true;
    }
}

// Validar campo de teléfono
function validateTelefonoField(input) {
    const telefono = input.value.trim();
    const messageElement = getOrCreateErrorMessage(input, 'telefono-error');
    
    if (telefono.length === 0) {
        showFieldError(input, messageElement, 'El teléfono es obligatorio');
        return false;
    } else if (telefono.length < 10) {
        showFieldError(input, messageElement, 'El teléfono debe tener exactamente 10 dígitos');
        return false;
    } else if (!/^\d{10}$/.test(telefono)) {
        showFieldError(input, messageElement, 'El teléfono solo debe contener números');
        return false;
    } else {
        hideFieldError(input, messageElement);
        return true;
    }
}

// Validar campo de email
function validateEmailField(input) {
    const email = input.value.trim();
    const messageElement = getOrCreateErrorMessage(input, 'email-error');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email.length === 0) {
        showFieldError(input, messageElement, 'El email es obligatorio');
        return false;
    } else if (!emailRegex.test(email)) {
        showFieldError(input, messageElement, 'Ingrese un email válido');
        return false;
    } else {
        hideFieldError(input, messageElement);
        return true;
    }
}

// === FUNCIONES AUXILIARES PARA MANEJO DE ERRORES ===

// Obtener o crear elemento de mensaje de error
function getOrCreateErrorMessage(input, errorId) {
    let messageElement = document.getElementById(errorId);
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = errorId;
        messageElement.className = 'invalid-feedback d-block';
        messageElement.style.fontSize = '0.875rem';
        input.parentNode.appendChild(messageElement);
    }
    return messageElement;
}

// Mostrar error en campo
function showFieldError(input, messageElement, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    messageElement.textContent = message;
    messageElement.style.display = 'block';
}

// Ocultar error en campo
function hideFieldError(input, messageElement) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    messageElement.style.display = 'none';
}

// === VALIDACIÓN MEJORADA DE DATOS DE USUARIO ===

// Función mejorada para validar todos los datos del usuario
function validateUserDataEnhanced(userData) {
    const errors = [];
    
    // Validar nombre
    if (!userData.nombre || userData.nombre.length < 2) {
        errors.push('El nombre debe tener al menos 2 caracteres');
    }
    
    // Validar apellido
    if (!userData.apellido || userData.apellido.length < 2) {
        errors.push('El apellido debe tener al menos 2 caracteres');
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email || !emailRegex.test(userData.email)) {
        errors.push('Ingrese un email válido');
    }
    
    // Validar cédula
    if (!userData.cedula || !/^\d{10}$/.test(userData.cedula)) {
        errors.push('La cédula debe tener exactamente 10 dígitos');
    }
    
    // Validar teléfono
    if (!userData.telefono || !/^\d{10}$/.test(userData.telefono)) {
        errors.push('El teléfono debe tener exactamente 10 dígitos');
    }
    
    // Validar contraseña
    if (!userData.password || userData.password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Funciones para manejar la cámara y foto de usuario en el registro
function initCameraElementsForRegister() {
    console.log('Initializing camera elements for register...');
    
    // Crear elementos de UI para la foto en el registro
    const photoSection = document.createElement('div');
    photoSection.className = 'mb-3 text-center';
    photoSection.innerHTML = `
        <label class="form-label fw-semibold">
            <i class="fa-solid fa-camera me-1"></i>Foto de perfil (opcional)
        </label>
        <div class="photo-container mb-3">
            <!-- Vista previa de la foto seleccionada -->
            <div id="userPhotoPreviewReg" class="user-photo-preview mx-auto mb-2" style="display: none;">
                <img id="previewImgReg" src="" alt="Foto de usuario" class="rounded-circle" style="width: 120px; height: 120px; object-fit: cover; border: 3px solid #28a745;">
            </div>
            
            <!-- Cámara en vivo -->
            <div id="cameraContainerReg" class="camera-container mx-auto mb-3" style="display: none;">
                <div class="row justify-content-center align-items-start">
                    <div class="col-md-6 text-center">
                        <h6 class="text-muted mb-2">Vista de la cámara</h6>
                        <video id="cameraVideoReg" width="300" height="225" autoplay style="border-radius: 10px; border: 2px solid #007bff;"></video>
                        <canvas id="photoCanvasReg" width="300" height="225" style="border-radius: 10px; display: none;"></canvas>
                    </div>
                    <div class="col-md-6 text-center" id="capturedPhotoPreview" style="display: none;">
                        <h6 class="text-muted mb-2">Foto capturada</h6>
                        <div class="captured-photo-container" style="display: inline-block; position: relative;">
                            <canvas id="previewCanvasReg" width="300" height="225" style="border-radius: 10px; border: 2px solid #28a745;"></canvas>
                            <div class="mt-2">
                                <small class="text-success"><i class="fa-solid fa-check-circle me-1"></i>¡Foto lista!</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="cameraErrorReg" class="alert alert-danger mt-2" style="display: none;"></div>
            </div>
            
            <!-- Botones de acción -->
            <div class="btn-group w-100 mb-2" role="group">
                <button type="button" class="btn btn-outline-primary" id="takePhotoBtnReg">
                    <i class="fa-solid fa-camera me-1"></i>Tomar Foto
                </button>
                <button type="button" class="btn btn-outline-secondary" id="selectPhotoBtnReg">
                    <i class="fa-solid fa-upload me-1"></i>Seleccionar Foto
                </button>
            </div>
            
            <!-- Botones de control de cámara (ocultos inicialmente) -->
            <div id="cameraControlsReg" class="camera-controls" style="display: none;">
                <div class="btn-group w-100" role="group">
                    <button type="button" class="btn btn-success" id="capturePhotoBtnReg">
                        <i class="fa-solid fa-camera-retro me-1"></i>Capturar
                    </button>
                    <button type="button" class="btn btn-primary" id="usePhotoBtnReg" style="display: none;">
                        <i class="fa-solid fa-check me-1"></i>Usar Foto
                    </button>
                    <button type="button" class="btn btn-outline-danger" id="cancelCameraBtnReg">
                        <i class="fa-solid fa-times me-1"></i>Cancelar
                    </button>
                </div>
            </div>
        </div>
        
        <input type="file" id="photoFileInputReg" accept="image/*" style="display: none;">
    `;
    
    // Insertar después del campo de teléfono
    const telefonoDiv = document.getElementById('telefono').closest('.mb-3');
    if (telefonoDiv) {
        console.log('Telefono div found, inserting photo section...');
        telefonoDiv.insertAdjacentElement('afterend', photoSection);
        
        // Configurar event listeners después de un breve delay para asegurar que Bootstrap esté listo
        setTimeout(() => {
            console.log('Setting up event listeners after delay...');
            setupPhotoEventListenersReg();
        }, 100);
    } else {
        console.error('Telefono div not found');
        // Fallback: insertar después del campo de contraseña
        const passwordDiv = document.getElementById('password').closest('.mb-3');
        if (passwordDiv) {
            console.log('Password div found as fallback, inserting photo section...');
            passwordDiv.insertAdjacentElement('afterend', photoSection);
            
            setTimeout(() => {
                console.log('Setting up event listeners after delay (fallback)...');
                setupPhotoEventListenersReg();
            }, 100);
        } else {
            console.error('Password div not found either');
        }
    }
}

function setupPhotoEventListenersReg() {
    console.log('Setting up photo event listeners...');
    
    // Botón para tomar foto - inicia cámara directamente
    const takePhotoBtn = document.getElementById('takePhotoBtnReg');
    if (takePhotoBtn) {
        console.log('Take photo button found');
        takePhotoBtn.addEventListener('click', () => {
            console.log('Iniciando cámara directamente...');
            startCameraDirectlyReg();
        });
    } else {
        console.error('Take photo button not found');
    }

    // Botón para seleccionar foto
    const selectPhotoBtn = document.getElementById('selectPhotoBtnReg');
    if (selectPhotoBtn) {
        console.log('Select photo button found');
        selectPhotoBtn.addEventListener('click', () => {
            console.log('Select photo button clicked');
            const fileInput = document.getElementById('photoFileInputReg');
            if (fileInput) {
                fileInput.click();
            }
        });
    } else {
        console.error('Select photo button not found');
    }

    // Input de archivo
    const fileInput = document.getElementById('photoFileInputReg');
    if (fileInput) {
        console.log('File input found');
        fileInput.addEventListener('change', handleFileSelectReg);
    }

    // Botón capturar foto
    const capturePhotoBtn = document.getElementById('capturePhotoBtnReg');
    if (capturePhotoBtn) {
        console.log('Capture photo button found');
        capturePhotoBtn.addEventListener('click', capturePhotoDirectlyReg);
    }

    // Botón usar foto
    const usePhotoBtn = document.getElementById('usePhotoBtnReg');
    if (usePhotoBtn) {
        console.log('Use photo button found');
        usePhotoBtn.addEventListener('click', usePhotoDirectlyReg);
    }

    // Botón cancelar cámara
    const cancelCameraBtn = document.getElementById('cancelCameraBtnReg');
    if (cancelCameraBtn) {
        console.log('Cancel camera button found');
        cancelCameraBtn.addEventListener('click', stopCameraDirectlyReg);
    }
    
    console.log('Event listeners setup complete');
}

// Nuevas funciones para cámara directa (sin modal)
async function startCameraDirectlyReg() {
    try {
        console.log('Iniciando cámara directamente...');
        const video = document.getElementById('cameraVideoReg');
        const errorDiv = document.getElementById('cameraErrorReg');
        const cameraContainer = document.getElementById('cameraContainerReg');
        const cameraControls = document.getElementById('cameraControlsReg');
        const userPhotoPreview = document.getElementById('userPhotoPreviewReg');
        const capturedPhotoPreview = document.getElementById('capturedPhotoPreview');
        
        // Ocultar vista previa si existe
        if (userPhotoPreview) {
            userPhotoPreview.style.display = 'none';
        }
        
        // Ocultar vista previa capturada anterior
        if (capturedPhotoPreview) {
            capturedPhotoPreview.style.display = 'none';
        }
        
        // Mostrar contenedor de cámara
        cameraContainer.style.display = 'block';
        errorDiv.style.display = 'none';
        
        // Solicitar acceso a la cámara
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false 
        });
        
        video.srcObject = stream;
        video.style.display = 'block';
        
        // Mostrar controles de cámara
        cameraControls.style.display = 'block';
        
        console.log('Cámara iniciada exitosamente');
        
        // Mostrar mensaje de ayuda
        Swal.fire({
            title: 'Cámara lista',
            text: 'Posiciónate bien y presiona "Capturar" cuando estés listo.',
            icon: 'info',
            timer: 3000,
            toast: true,
            position: 'top-end',
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        const errorDiv = document.getElementById('cameraErrorReg');
        let errorMessage = 'No se pudo acceder a la cámara.';
        
        switch(error.name) {
            case 'NotAllowedError':
                errorMessage = 'Acceso a la cámara denegado. Por favor, permite el acceso e intenta de nuevo.';
                break;
            case 'NotFoundError':
                errorMessage = 'No se encontró una cámara en tu dispositivo.';
                break;
            case 'NotReadableError':
                errorMessage = 'La cámara está siendo usada por otra aplicación.';
                break;
            default:
                errorMessage = 'Error al acceder a la cámara. Intenta seleccionar una foto desde tu dispositivo.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
        
        // Mostrar alerta
        Swal.fire({
            title: 'Error de cámara',
            text: errorMessage,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

function capturePhotoDirectlyReg() {
    console.log('Capturando foto...');
    const video = document.getElementById('cameraVideoReg');
    const canvas = document.getElementById('photoCanvasReg');
    const previewCanvas = document.getElementById('previewCanvasReg');
    const capturedPhotoPreview = document.getElementById('capturedPhotoPreview');
    const ctx = canvas.getContext('2d');
    const previewCtx = previewCanvas.getContext('2d');
    const captureBtn = document.getElementById('capturePhotoBtnReg');
    const useBtn = document.getElementById('usePhotoBtnReg');
    
    // Dibujar el frame actual del video en ambos canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    previewCtx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
    
    // Mostrar la vista previa capturada a la derecha
    capturedPhotoPreview.style.display = 'block';
    
    // Ocultar video y mostrar canvas principal (aunque esté oculto)
    video.style.display = 'none';
    canvas.style.display = 'none'; // Mantener oculto, usamos el preview
    
    // Cambiar botones
    captureBtn.style.display = 'none';
    useBtn.style.display = 'inline-block';
    
    console.log('Foto capturada, mostrando vista previa a la derecha');
}

function usePhotoDirectlyReg() {
    console.log('Usando foto capturada...');
    const canvas = document.getElementById('photoCanvasReg');
    userPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    // Mostrar vista previa de la foto seleccionada
    showPhotoPreviewReg(userPhoto);
    
    // Ocultar cámara y controles
    stopCameraDirectlyReg();
    
    console.log('Foto guardada exitosamente');
    
    // Mostrar confirmación
    Swal.fire({
        title: '¡Foto guardada!',
        text: 'Tu foto de perfil ha sido guardada exitosamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
}

function stopCameraDirectlyReg() {
    console.log('Deteniendo cámara...');
    
    // Detener stream de cámara
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Ocultar elementos de cámara
    const cameraContainer = document.getElementById('cameraContainerReg');
    const cameraControls = document.getElementById('cameraControlsReg');
    const video = document.getElementById('cameraVideoReg');
    const canvas = document.getElementById('photoCanvasReg');
    const capturedPhotoPreview = document.getElementById('capturedPhotoPreview');
    const captureBtn = document.getElementById('capturePhotoBtnReg');
    const useBtn = document.getElementById('usePhotoBtnReg');
    
    cameraContainer.style.display = 'none';
    cameraControls.style.display = 'none';
    video.style.display = 'none';
    canvas.style.display = 'none';
    capturedPhotoPreview.style.display = 'none';
    
    // Resetear botones
    captureBtn.style.display = 'inline-block';
    useBtn.style.display = 'none';
    
    console.log('Cámara detenida');
}

// Funciones originales del modal (mantenidas para compatibilidad pero no usadas)
function handleFileSelectReg(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            userPhoto = e.target.result;
            showPhotoPreviewReg(userPhoto);
            
            // Mostrar confirmación
            Swal.fire({
                title: '¡Foto cargada!',
                text: 'Tu foto de perfil ha sido cargada exitosamente.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        };
        reader.readAsDataURL(file);
    }
}

function showPhotoPreviewReg(photoData) {
    const preview = document.getElementById('userPhotoPreviewReg');
    const img = document.getElementById('previewImgReg');
    
    img.src = photoData;
    preview.style.display = 'block';
    
    // Ocultar cámara si está visible
    const cameraContainer = document.getElementById('cameraContainerReg');
    if (cameraContainer) {
        cameraContainer.style.display = 'none';
    }
}

// Funciones del modal original (obsoletas pero mantenidas para evitar errores)
async function startCameraReg() {
    // Función obsoleta - ahora se usa startCameraDirectlyReg()
    console.log('Función obsoleta startCameraReg llamada');
}

function capturePhotoReg() {
    // Función obsoleta - ahora se usa capturePhotoDirectlyReg()
    console.log('Función obsoleta capturePhotoReg llamada');
}

function usePhotoReg() {
    // Función obsoleta - ahora se usa usePhotoDirectlyReg()
    console.log('Función obsoleta usePhotoReg llamada');
}

function stopCameraReg() {
    // Función obsoleta - ahora se usa stopCameraDirectlyReg()
    console.log('Función obsoleta stopCameraReg llamada');
}