/**
 * Product Manager - Gestión de productos
 */

class ProductManager {
    constructor() {
        this.products = [];
        this.loadProductsSync(); // Cargar inmediatamente desde localStorage de forma síncrona
        this.loadProducts(); // Luego intentar actualizar desde servidor de forma asíncrona
    }

    // Cargar productos de forma síncrona desde localStorage (para inicialización inmediata)
    loadProductsSync() {
        try {
            const stored = localStorage.getItem('productos');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.products = parsed.map(p => {
                    const stockValue = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
                    const precioValue = p.precio !== undefined && p.precio !== null ? Number(p.precio) : 0;
                    // Normalizar id: preferir `id`, sino usar `_id` (MongoDB)
                    const idValue = (p.id !== undefined && p.id !== null) ? String(p.id) : (p._id ? String(p._id) : undefined);
                    return {
                        ...p,
                        id: idValue,
                        stock: stockValue,
                        precio: precioValue
                    };
                });
                console.log(`⚡ ${this.products.length} productos cargados de forma síncrona desde localStorage`);
            }
        } catch (error) {
            console.error('❌ Error en loadProductsSync:', error);
        }
    }

    // Cargar productos desde el servidor o localStorage
    async loadProducts() {
        try {
            // MODIFICACIÓN: Solo intentar fetch si NO estamos en file://
            const isFileProtocol = window.location.protocol === 'file:';
            
            if (!isFileProtocol && typeof window.api !== 'undefined' && window.api.getProducts) {
                console.log('📡 Cargando productos desde el servidor...');
                const serverProducts = await window.api.getProducts();
                if (serverProducts && serverProducts.length > 0) {
                    console.log(`✅ ${serverProducts.length} productos cargados desde el servidor`);
                    this.products = serverProducts.map(p => {
                        const stockValue = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
                        const precioValue = p.precio !== undefined && p.precio !== null ? Number(p.precio) : 0;
                        // Normalizar id: preferir `id`, si no existe usar `_id` (respuesta de MongoDB)
                        const idValue = (p.id !== undefined && p.id !== null) ? String(p.id) : (p._id ? String(p._id) : undefined);
                        return {
                            ...p,
                            id: idValue,
                            stock: stockValue,
                            precio: precioValue
                        };
                    });
                    // Actualizar localStorage con los datos del servidor
                    localStorage.setItem('productos', JSON.stringify(this.products));
                    return this.products;
                }
            } else if (isFileProtocol) {
                console.log('ℹ️ Modo offline (file://), cargando desde localStorage');
            }
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar productos desde el servidor:', error);
        }

        // Fallback a localStorage
        try {
            const stored = localStorage.getItem('productos');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.products = parsed.map(p => {
                    const stockValue = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
                    const precioValue = p.precio !== undefined && p.precio !== null ? Number(p.precio) : 0;
                    return {
                        ...p,
                        stock: stockValue,
                        precio: precioValue
                    };
                });
                console.log(`📦 ${this.products.length} productos cargados desde localStorage`);
                // Log de algunos productos para debug
                if (this.products.length > 0) {
                    console.log('📋 Primeros 3 productos con stock:', 
                        this.products.slice(0, 3).map(p => ({
                            id: p.id,
                            nombre: p.nombre,
                            stock: p.stock,
                            stockType: typeof p.stock
                        }))
                    );
                }
            } else {
                console.warn('⚠️ No hay productos en localStorage');
                this.products = [];
            }
        } catch (error) {
            console.error('❌ Error cargando productos desde localStorage:', error);
            this.products = [];
        }

        return this.products;
    }

    // Obtener todos los productos (alias para compatibilidad)
    getAllProducts() {
        return this.getProducts();
    }

    // Obtener todos los productos con stock actualizado
    getProducts() {
        // Asegurarse de que el stock es numérico
        return this.products.map(product => ({
            ...product,
            stock: Number(product.stock) || 0,
            precio: Number(product.precio) || 0
        }));
    }

    // Obtener producto por ID
    getProductById(id) {
        const product = this.products.find(p => String(p.id) === String(id));
        if (product) {
            const stockValue = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 0;
            const precioValue = product.precio !== undefined && product.precio !== null ? Number(product.precio) : 0;
            
            console.log(`🔍 getProductById(${id}): stock raw = ${product.stock}, converted = ${stockValue}`);
            
            return {
                ...product,
                stock: stockValue,
                precio: precioValue
            };
        }
        return null;
    }

    // Actualizar stock de un producto
    async updateStock(productId, newStock) {
        try {
            console.log(`🔄 Actualizando stock del producto ${productId} a ${newStock}`);
            
            // Actualizar en memoria
            const index = this.products.findIndex(p => String(p.id) === String(productId));
            if (index !== -1) {
                this.products[index].stock = Number(newStock);
                
                // Guardar en localStorage
                localStorage.setItem('productos', JSON.stringify(this.products));
                
                // Intentar actualizar en el servidor
                if (typeof window.api !== 'undefined' && window.api.updateProduct) {
                    try {
                        await window.api.updateProduct(productId, { stock: Number(newStock) });
                        console.log('✅ Stock actualizado en el servidor');
                    } catch (error) {
                        console.warn('⚠️ No se pudo actualizar en el servidor:', error);
                    }
                }
                
                // Disparar evento de actualización
                window.dispatchEvent(new CustomEvent('stockUpdated', { 
                    detail: { productId, newStock } 
                }));
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error actualizando stock:', error);
            return false;
        }
    }

    // Reducir stock después de una compra
    async reduceStock(cartItems) {
        try {
            console.log('📉 Reduciendo stock de productos comprados...');
            
            for (const item of cartItems) {
                const product = this.getProductById(item.id);
                if (product) {
                    const newStock = Math.max(0, Number(product.stock) - Number(item.cantidad));
                    await this.updateStock(item.id, newStock);
                    console.log(`✅ Stock reducido: ${product.nombre} - Stock anterior: ${product.stock}, Vendido: ${item.cantidad}, Nuevo stock: ${newStock}`);
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error reduciendo stock:', error);
            return false;
        }
    }

    // Sincronizar con datos del admin
    async syncWithAdminProducts() {
        try {
            console.log('🔄 Sincronizando productos con admin...');
            
            // Recargar productos desde el servidor
            await this.loadProducts();
            
            // Disparar evento de actualización
            window.dispatchEvent(new Event('productsUpdated'));
            
            console.log('✅ Productos sincronizados correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error sincronizando productos:', error);
            return false;
        }
    }

    // Verificar stock disponible para un producto
    checkStockAvailability(productId, requestedQuantity) {
        console.log(`🔍 checkStockAvailability called with ID: ${productId}, Requested: ${requestedQuantity}`);
        console.log(`📦 Total products in memory: ${this.products.length}`);
        
        const product = this.getProductById(productId);
        
        if (!product) {
            console.warn(`❌ Producto no encontrado con ID: ${productId}`);
            console.log('📋 IDs disponibles:', this.products.map(p => p.id));
            return { available: false, reason: 'Producto no encontrado' };
        }

        const currentStock = Number(product.stock) || 0;
        const requested = Number(requestedQuantity) || 0;

        console.log(`✅ Producto encontrado: ${product.nombre}`);
        console.log(`📦 Stock actual: ${currentStock}, Solicitado: ${requested}`);

        if (currentStock === 0) {
            console.warn(`❌ Producto agotado: ${product.nombre}`);
            return { available: false, reason: 'Producto agotado', currentStock: 0 };
        }

        if (requested > currentStock) {
            console.warn(`❌ Stock insuficiente para ${product.nombre}: tiene ${currentStock}, solicita ${requested}`);
            return { 
                available: false, 
                reason: `Stock insuficiente. Solo hay ${currentStock} unidades disponibles`,
                currentStock: currentStock 
            };
        }

        console.log(`✅ Stock disponible para ${product.nombre}`);
        return { available: true, currentStock: currentStock };
    }
}

// Exportar instancia global
window.productManager = new ProductManager();

// Clase para manejo de cámara y archivos
class MediaHandler {
    constructor() {
        this.stream = null;
    }

    // Capturar foto con cámara
    async capturePhoto() {
        try {
            // Solicitar permisos de cámara
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment' // Cámara trasera preferida
                } 
            });

            // Crear modal para mostrar la cámara
            const cameraModal = this.createCameraModal();
            document.body.appendChild(cameraModal);

            const video = cameraModal.querySelector('#cameraVideo');
            const canvas = cameraModal.querySelector('#cameraCanvas');
            const captureBtn = cameraModal.querySelector('#captureBtn');
            const retakeBtn = cameraModal.querySelector('#retakeBtn');
            const confirmBtn = cameraModal.querySelector('#confirmBtn');
            const cancelBtn = cameraModal.querySelector('#cancelBtn');

            video.srcObject = this.stream;

            return new Promise((resolve, reject) => {
                let capturedImage = null;

                captureBtn.addEventListener('click', () => {
                    const context = canvas.getContext('2d');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0);
                    
                    capturedImage = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // Mostrar la imagen capturada
                    video.style.display = 'none';
                    canvas.style.display = 'block';
                    captureBtn.style.display = 'none';
                    retakeBtn.style.display = 'inline-block';
                    confirmBtn.style.display = 'inline-block';
                });

                retakeBtn.addEventListener('click', () => {
                    video.style.display = 'block';
                    canvas.style.display = 'none';
                    captureBtn.style.display = 'inline-block';
                    retakeBtn.style.display = 'none';
                    confirmBtn.style.display = 'none';
                    capturedImage = null;
                });

                confirmBtn.addEventListener('click', () => {
                    this.stopCamera();
                    document.body.removeChild(cameraModal);
                    resolve(capturedImage);
                });

                cancelBtn.addEventListener('click', () => {
                    this.stopCamera();
                    document.body.removeChild(cameraModal);
                    reject(new Error('Captura cancelada'));
                });
            });

        } catch (error) {
            console.error('Error accessing camera:', error);
            Swal.fire({
                title: 'Error de cámara',
                text: 'No se pudo acceder a la cámara. Por favor, permite el acceso o usa la opción de archivo.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            throw error;
        }
    }

    // Crear modal para la cámara
    createCameraModal() {
        const modal = document.createElement('div');
        modal.className = 'camera-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="camera-container" style="text-align: center;">
                <video id="cameraVideo" autoplay style="max-width: 80vw; max-height: 60vh; border-radius: 10px;"></video>
                <canvas id="cameraCanvas" style="max-width: 80vw; max-height: 60vh; border-radius: 10px; display: none;"></canvas>
                <div class="camera-controls" style="margin-top: 20px;">
                    <button id="captureBtn" class="btn btn-success me-2">
                        <i class="fa-solid fa-camera"></i> Capturar
                    </button>
                    <button id="retakeBtn" class="btn btn-warning me-2" style="display: none;">
                        <i class="fa-solid fa-redo"></i> Repetir
                    </button>
                    <button id="confirmBtn" class="btn btn-primary me-2" style="display: none;">
                        <i class="fa-solid fa-check"></i> Confirmar
                    </button>
                    <button id="cancelBtn" class="btn btn-secondary">
                        <i class="fa-solid fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        `;

        return modal;
    }

    // Parar cámara
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // Seleccionar archivo
    async selectFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = () => reject(new Error('Error al leer el archivo'));
                    reader.readAsDataURL(file);
                } else {
                    reject(new Error('No se seleccionó archivo'));
                }
            };

            input.click();
        });
    }

    // Redimensionar imagen
    resizeImage(dataUrl, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calcular nuevas dimensiones manteniendo proporción
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Dibujar y redimensionar
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };

            img.src = dataUrl;
        });
    }
}

// Inicializar gestores (instanciación deferida a main.js to ensure window.api is available)
let productManager;
const mediaHandler = new MediaHandler();
