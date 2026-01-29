import axios from 'axios';


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
  // No usar withCredentials ya que usamos JWT tokens en headers, no cookies
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      localStorage.removeItem('userLoggedIn');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== AUTH API ====================
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  logout: () => api.post('/api/auth/logout'),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/api/auth/reset-password', { token, password })
};

// ==================== PRODUCTS API ====================
export const productsAPI = {
  getAll: (params) => api.get('/api/products', { params }),
  getById: (id) => api.get(`/api/products/${id}`),
  getByCategory: (category) => api.get(`/api/products/category/${category}`),
  search: (query) => api.get('/api/products/search', { params: { q: query } }),
  create: (productData) => api.post('/api/products', productData),
  update: (id, productData) => api.put(`/api/products/${id}`, productData),
  delete: (id) => api.delete(`/api/products/${id}`),
  updateStock: (id, stock) => api.patch(`/api/products/${id}/stock`, { stock })
};

// ==================== CART API ====================
export const cartAPI = {
  get: () => api.get('/api/cart'),
  // POST /api/cart - adds item (backend expects {productId, cantidad})
  add: (productId, quantity) => api.post('/api/cart', { productId, cantidad: quantity }),
  // For update, we sync by re-posting entire cart or use same add endpoint
  update: (productId, quantity) => api.post('/api/cart', { productId, cantidad: quantity }),
  remove: (productId) => api.delete(`/api/cart/${productId}`),
  // Note: clear requires userId in path - we'll handle this in CartContext
  clear: (userId) => api.delete(`/api/cart/clear/${userId}`),
  applyCoupon: (code) => api.post('/api/cart/coupon', { code }),
  // Calculate totals using backend endpoint
  calculate: (items) => api.post('/api/cart/calculate', { items })
};

// ==================== ORDERS API ====================
export const ordersAPI = {
  create: (orderData) => api.post('/api/orders', orderData),
  getAll: () => api.get('/api/orders'),
  getById: (id) => api.get(`/api/orders/${id}`),
  getUserOrders: () => api.get('/api/orders/user'),
  updateStatus: (id, status) => api.patch(`/api/orders/${id}/status`, { status }),
  cancel: (id) => api.patch(`/api/orders/${id}/cancel`),
  getInvoice: (id) => api.get(`/api/orders/${id}/invoice`, { responseType: 'blob' })
};

// ==================== CHECKOUT API ====================
export const checkoutAPI = {
  process: (checkoutData) => api.post('/api/checkout', checkoutData),
  validateCoupon: (code) => api.post('/api/checkout/validate-coupon', { code }),
  calculateShipping: (address) => api.post('/api/checkout/shipping', { address })
};

// ==================== USERS API (Admin) ====================
export const usersAPI = {
  getAll: () => api.get('/api/users'),
  getById: (id) => api.get(`/api/users/${id}`),
  create: (userData) => api.post('/api/users', userData),
  update: (id, userData) => api.put(`/api/users/${id}`, userData),
  delete: (id) => api.delete(`/api/users/${id}`),
  toggleStatus: (id) => api.patch(`/api/users/${id}/toggle-status`)
};

// ==================== CATEGORIES API ====================
export const categoriesAPI = {
  getAll: () => api.get('/api/categories'),
  create: (categoryData) => api.post('/api/categories', categoryData),
  update: (id, categoryData) => api.put(`/api/categories/${id}`, categoryData),
  delete: (id) => api.delete(`/api/categories/${id}`)
};

// ==================== REVIEWS API ====================
export const reviewsAPI = {
  getByProduct: (productId) => api.get(`/api/reviews/product/${productId}`),
  create: (reviewData) => api.post('/api/reviews', reviewData),
  update: (id, reviewData) => api.put(`/api/reviews/${id}`, reviewData),
  delete: (id) => api.delete(`/api/reviews/${id}`),
  getAll: () => api.get('/api/reviews')
};

// ==================== REPORTS API (Admin) ====================
export const reportsAPI = {
  getSales: (params) => api.get('/api/reports/sales', { params }),
  getInventory: () => api.get('/api/reports/inventory'),
  getTopProducts: (params) => api.get('/api/reports/top-products', { params }),
  getCustomers: () => api.get('/api/reports/customers'),
  exportSales: (params) => api.get('/api/reports/export/sales', { params, responseType: 'blob' })
};

// ==================== SUPPLIERS API (Admin) ====================
export const suppliersAPI = {
  getAll: () => api.get('/api/suppliers'),
  getById: (id) => api.get(`/api/suppliers/${id}`),
  create: (supplierData) => api.post('/api/suppliers', supplierData),
  update: (id, supplierData) => api.put(`/api/suppliers/${id}`, supplierData),
  delete: (id) => api.delete(`/api/suppliers/${id}`)
};

// ==================== LOYALTY API ====================
export const loyaltyAPI = {
  getPoints: () => api.get('/api/loyalty/points'),
  getHistory: () => api.get('/api/loyalty/history'),
  redeem: (points) => api.post('/api/loyalty/redeem', { points }),
  getTiers: () => api.get('/api/loyalty/tiers')
};

// ==================== PUBLIC API ====================
export const publicAPI = {
  
  getPromotions: () => api.get('/products', { params: { limit: 6 } }), 
  getCategories: () => api.get('/api/categories'),
  getFeaturedProducts: () => api.get('/products', { params: { limit: 8 } }),
  sendContactForm: (data) => api.post('/api/auth/contact', data)
};
