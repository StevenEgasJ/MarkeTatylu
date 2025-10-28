// Sistema de gestión de productos con localStorage
class ProductManager {
    constructor() {
        this.products = this.loadProducts();
        this.initializeDefaultProducts();

        // If API is available, try to load products from server and overwrite local list
        try {
            if (window.api && typeof window.api.getProducts === 'function') {
                this.fetchProductsFromApi();
            }
        } catch (err) {
            console.warn('API products fetch skipped:', err);
        }
    }

    // Cargar productos desde localStorage
    loadProducts() {
        const products = localStorage.getItem('productos');
        return products ? JSON.parse(products) : [];
    }

    // Intentar obtener productos desde la API del servidor (Atlas)
    async fetchProductsFromApi() {
        try {
            const serverProducts = await window.api.getProducts();
            if (Array.isArray(serverProducts) && serverProducts.length > 0) {
                // Map server products to local shape
                this.products = serverProducts.map(p => ({
                    id: p._id || p.id,
                    nombre: p.nombre || p.name || p.title || 'Producto',
                    precio: p.precio || p.price || 0,
                    capacidad: p.capacidad || p.descripcion?.substring(0,50) || p.descripcion || 'N/A',
                    imagen: p.imagen || p.image || './static/img/producto.png',
                    descripcion: p.descripcion || p.description || p.nombre || '',
                    categoria: p.categoria || p.category || 'electrodomesticos',
                    stock: p.stock || 0,
                    fechaCreacion: p.fechaCreacion || p.createdAt || new Date().toISOString(),
                    fechaModificacion: p.fechaModificacion || p.updatedAt || new Date().toISOString(),
                    isAdminProduct: true
                }));

                this.saveProducts();
                console.log('✅ Productos cargados desde API:', this.products.length);
            }
        } catch (err) {
            console.warn('No se pudo cargar productos desde API:', err.message || err);
        }
    }

    // Guardar productos en localStorage
    saveProducts() {
        localStorage.setItem('productos', JSON.stringify(this.products));
    }

    // Inicializar productos - crear productos por defecto si no existen
    initializeDefaultProducts() {
        const existingProducts = localStorage.getItem('productos');
        
        if (!existingProducts || JSON.parse(existingProducts).length === 0) {
            // Crear productos por defecto
            const defaultProducts = [
                {
                    id: 1,
                    nombre: "Refrigeradora Samsung RF28T5001SR",
                    precio: 1299.99,
                    categoria: "refrigeracion",
                    stock: 15,
                    imagen: "./static/img/refrigeradora.png",
                    descripcion: "Refrigeradora de 28 pies cúbicos con tecnología Twin Cooling Plus",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 2,
                    nombre: "Microondas LG MS2596OB",
                    precio: 189.99,
                    categoria: "cocina",
                    stock: 25,
                    imagen: "./static/img/microondas.png",
                    descripcion: "Microondas de 25 litros con grill y función auto-cook",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 3,
                    nombre: "Licuadora Oster BLSTPB-WBL",
                    precio: 89.99,
                    categoria: "pequenos",
                    stock: 30,
                    imagen: "./static/img/licuadora.png",
                    descripcion: "Licuadora de 6 velocidades con jarra de vidrio",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 4,
                    nombre: "Cafetera Hamilton Beach 49980A",
                    precio: 79.99,
                    categoria: "pequenos",
                    stock: 20,
                    imagen: "./static/img/cafetera.png",
                    descripcion: "Cafetera programable de 12 tazas con jarra térmica",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 5,
                    nombre: "Hervidor Eléctrico Cuisinart CPK-17",
                    precio: 99.99,
                    categoria: "pequenos",
                    stock: 18,
                    imagen: "./static/img/hervidor.png",
                    descripcion: "Hervidor eléctrico de acero inoxidable con control de temperatura",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 6,
                    nombre: "Plancha de Vapor Black+Decker IR03V",
                    precio: 45.99,
                    categoria: "pequenos",
                    stock: 22,
                    imagen: "./static/img/plancha.png",
                    descripcion: "Plancha de vapor con suela antiadherente y tanque de agua de 200ml",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 7,
                    nombre: "Tostadora Cuisinart CPT-180",
                    precio: 69.99,
                    categoria: "pequenos",
                    stock: 16,
                    imagen: "./static/img/tostadora.png",
                    descripcion: "Tostadora de 4 rebanadas con 7 niveles de tostado",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 8,
                    nombre: "Ventilador de Torre Dyson AM07",
                    precio: 399.99,
                    categoria: "climatizacion",
                    stock: 8,
                    imagen: "./static/img/ventilador.png",
                    descripcion: "Ventilador de torre sin aspas con amplificador de aire Dyson",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 9,
                    nombre: "Freidora de Aire Ninja AF101",
                    precio: 129.99,
                    categoria: "cocina",
                    stock: 12,
                    imagen: "./static/img/freidora.png",
                    descripcion: "Freidora de aire de 4 cuartos con tecnología de circulación rápida",
                    fechaCreacion: new Date().toISOString()
                },
                {
                    id: 10,
                    nombre: "Extractor de Jugos Breville BJE200XL",
                    precio: 199.99,
                    categoria: "pequenos",
                    stock: 10,
                    imagen: "./static/img/extractor.png",
                    descripcion: "Extractor de jugos centrífugo con motor de 700W",
                    fechaCreacion: new Date().toISOString()
                }
            ];
            
            localStorage.setItem('productos', JSON.stringify(defaultProducts));
            console.log('✅ Productos por defecto creados automáticamente:', defaultProducts.length);
        }
        
        // Sincronizar con productos del admin
        this.syncWithAdminProducts();
    }

    // Sincronizar con productos del admin
    syncWithAdminProducts() {
        const adminProducts = localStorage.getItem('productos');
        if (adminProducts) {
            try {
                const adminProdArray = JSON.parse(adminProducts);
                // Convertir formato de admin a formato de productManager
                const convertedProducts = adminProdArray.map(adminProd => {
                    // Buscar si ya existe este producto para preservar su stock actual
                    const existingProduct = this.products.find(p => p.id.toString() === adminProd.id.toString());
                    
                    return {
                        id: adminProd.id,  // Usar el ID original del admin
                        nombre: adminProd.nombre,
                        precio: adminProd.precio,
                        capacidad: adminProd.descripcion ? adminProd.descripcion.substring(0, 50) + '...' : 'N/A',
                        imagen: adminProd.imagen || './static/img/producto.png',
                        descripcion: adminProd.descripcion || adminProd.nombre,
                        categoria: adminProd.categoria || 'electrodomesticos',
                        stock: adminProd.stock || (existingProduct ? existingProduct.stock : 10), // Usar stock del admin o preservar existente
                        fechaCreacion: adminProd.fechaCreacion || new Date().toISOString(),
                        fechaModificacion: adminProd.fechaModificacion || existingProduct?.fechaModificacion,
                        isAdminProduct: true
                    };
                });

                // Reemplazar todos los productos con los del admin
                this.products = convertedProducts;
                this.saveProducts();
                
                console.log('✅ Productos sincronizados con admin:', convertedProducts.length);
            } catch (error) {
                console.error('Error sincronizando productos admin:', error);
            }
        }
    }

    // Obtener todos los productos
    getAllProducts() {
        this.syncWithAdminProducts();
        return this.products;
    }

    // Obtener producto por ID
    getProductById(id) {
        // Convertir ambos a string para comparación consistente
        return this.products.find(product => product.id.toString() === id.toString());
    }

    // Crear nuevo producto
    async createProduct(productData) {
        const newProduct = {
            id: 'prod' + Date.now(),
            ...productData,
            fechaCreacion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString()
        };
        
        this.products.push(newProduct);
        this.saveProducts();
        
        // Notificación
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('El Valle', {
                body: `Producto "${newProduct.nombre}" creado exitosamente`,
                icon: './static/img/logo.png'
            });
        }
        
        return newProduct;
    }

    // Actualizar producto
    async updateProduct(id, productData) {
        const index = this.products.findIndex(product => product.id.toString() === id.toString());
        if (index !== -1) {
            this.products[index] = {
                ...this.products[index],
                ...productData,
                fechaModificacion: new Date().toISOString()
            };
            this.saveProducts();
            
            // Notificación
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('El Valle', {
                    body: `Producto "${this.products[index].nombre}" actualizado`,
                    icon: './static/img/logo.png'
                });
            }
            
            return this.products[index];
        }
        return null;
    }

    // Eliminar producto
    async deleteProduct(id) {
        const index = this.products.findIndex(product => product.id.toString() === id.toString());
        if (index !== -1) {
            const deletedProduct = this.products[index];
            this.products.splice(index, 1);
            this.saveProducts();
            
            // Notificación
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('El Valle', {
                    body: `Producto "${deletedProduct.nombre}" eliminado`,
                    icon: './static/img/logo.png'
                });
            }
            
            return deletedProduct;
        }
        return null;
    }

    // Buscar productos
    searchProducts(query) {
        const searchTerm = query.toLowerCase();
        return this.products.filter(product => 
            product.nombre.toLowerCase().includes(searchTerm) ||
            product.descripcion.toLowerCase().includes(searchTerm) ||
            product.categoria.toLowerCase().includes(searchTerm)
        );
    }

    // Filtrar productos por categoría
    getProductsByCategory(category) {
        return this.products.filter(product => product.categoria === category);
    }

    // Actualizar stock
    updateStock(id, newStock) {
        const product = this.getProductById(id);
        if (product) {
            product.stock = newStock;
            product.fechaModificacion = new Date().toISOString();
            this.saveProducts();
            return product;
        }
        return null;
   }

    // Verificar stock disponible de un producto
    checkStock(productId, requestedQuantity = 1) {
        const product = this.getProductById(productId);
        if (!product) {
            return { available: false, message: 'Producto no encontrado' };
        }
        
        const currentStock = product.stock || 0;
        if (currentStock <= 0) {
            return { available: false, message: 'Producto sin stock' };
        }
        
        if (currentStock < requestedQuantity) {
            return { 
                available: false, 
                message: `Solo quedan ${currentStock} unidades disponibles` 
            };
        }
        
        return { available: true, stock: currentStock };
    }

    // Obtener productos con stock bajo (5 o menos)
    getLowStockProducts() {
        return this.products.filter(product => (product.stock || 0) <= 5);
    }

    // Reducir stock de un producto
    reduceStock(id, quantity) {
        const product = this.getProductById(id);
        if (product) {
            const newStock = Math.max(0, product.stock - quantity);
            product.stock = newStock;
            product.fechaModificacion = new Date().toISOString();
            
            // Actualizar también en los productos del admin
            this.updateAdminProductStock(id, quantity);
            
            this.saveProducts();
            return { 
                success: true, 
                newStock: newStock,
                message: `Stock actualizado: ${newStock} unidades disponibles`
            };
        }
        return { 
            success: false, 
            message: 'Producto no encontrado' 
        };
    }

    // Actualizar stock en productos del admin
    updateAdminProductStock(productId, quantity) {
        try {
            const adminProducts = JSON.parse(localStorage.getItem('productos') || '[]');
            const productIndex = adminProducts.findIndex(p => p.id.toString() === productId.toString());
            
            if (productIndex !== -1) {
                const currentStock = adminProducts[productIndex].stock || 0;
                const newStock = Math.max(0, currentStock - quantity);
                adminProducts[productIndex].stock = newStock;
                adminProducts[productIndex].fechaModificacion = new Date().toISOString();
                
                localStorage.setItem('productos', JSON.stringify(adminProducts));
                console.log(`📦 Admin stock actualizado desde productManager para producto ${productId}: ${newStock} unidades`);
                
                return { success: true, newStock: newStock };
            }
        } catch (error) {
            console.error('❌ Error actualizando stock del admin desde productManager:', error);
        }
        return { success: false };
    }
}

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

// Inicializar gestores
const productManager = new ProductManager();
const mediaHandler = new MediaHandler();
