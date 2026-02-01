// Small API client used by the frontend to talk to the backend API
(function(window){
  // Determine API base:
  // - If a global override `window.__API_BASE__` is set, use it.
  // - If page was opened via file://, assume a local dev server at http://localhost:4000
  // - Otherwise use a same-origin relative path '/api'.
  const DEFAULT_DEV_SERVER = 'http://localhost:4000';
  const apiBaseRoot = (window.__API_BASE__ && window.__API_BASE__.trim())
    ? window.__API_BASE__.replace(/\/$/, '')
    : (location.protocol === 'file:' ? DEFAULT_DEV_SERVER : '');
  const API_PREFIX = apiBaseRoot ? (apiBaseRoot + '/api') : '/api';

  function getToken(){
    // Prefer sessionStorage (volatile/session-scoped) over localStorage (persistent)
    // This is especially important for admin tokens which should not persist across sessions
    try {
      return sessionStorage.getItem('token') || localStorage.getItem('token');
    } catch (e) {
      return localStorage.getItem('token');
    }
  }

  async function apiFetch(path, options = {}){
    const headers = options.headers ? { ...options.headers } : {};
    // If there is a body and it's not FormData, ensure Content-Type is set and
    // stringify plain objects before sending. This prevents missing req.body on server.
    if (options.body !== undefined && !(options.body instanceof FormData)) {
      if (typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
      }
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Instrumentation: measure request duration
    const reqKey = `${path}@${Date.now()}`;
    try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestStart) window.rail.metrics.markRequestStart(reqKey); } catch(e){}

    // Make initial request
    let res;
    try {
      res = await fetch(API_PREFIX + path, { ...options, headers });
    } catch (networkErr) {
      try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestEnd) window.rail.metrics.markRequestEnd(reqKey, { error: networkErr.message }); } catch(e){}
      throw networkErr;
    }

    // If the server rejects due to invalid token, clear saved token and retry once without Authorization
    if (!res.ok && res.status === 401 && token) {
      try {
        console.warn('apiFetch: 401 received with token present — clearing stored token and retrying without auth');
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        try { window.dispatchEvent(new Event('auth:token-cleared')); } catch(e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      const headersNoAuth = { ...headers };
      delete headersNoAuth['Authorization'];
      // retry request without Authorization header
      const retry = await fetch(API_PREFIX + path, { ...options, headers: headersNoAuth });
      if (retry.ok) {
        try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestEnd) window.rail.metrics.markRequestEnd(reqKey, { status: retry.status }); } catch(e){}
        const ct = retry.headers.get('content-type') || '';
        return ct.includes('application/json') ? retry.json() : retry.text();
      }
      // swap res to retry so below code throws appropriate error
      res = retry;
    }

    try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestEnd) window.rail.metrics.markRequestEnd(reqKey, { status: res.status }); } catch(e){}

    if (!res.ok) {
      const text = await res.text().catch(()=>null);
      const err = new Error(text || res.statusText || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  window.api = {
    getProducts: () => apiFetch('/products'),
  getCategories: () => apiFetch('/categories'),
    getProduct: (id) => apiFetch(`/products/${id}`),
    createProduct: (payload) => apiFetch('/products', { method: 'POST', body: payload }),
    updateProduct: (id, payload) => apiFetch(`/products/${id}`, { method: 'PUT', body: payload }),
    deleteProduct: (id) => apiFetch(`/products/${id}`, { method: 'DELETE' }),

    // Orders
    getOrders: () => apiFetch('/orders'),
    getOrder: (id) => apiFetch(`/orders/${id}`),
    updateOrder: (id, payload) => apiFetch(`/orders/${id}`, { method: 'PUT', body: payload }),
    deleteOrder: (id) => apiFetch(`/orders/${id}`, { method: 'DELETE' }),

  // Users & Auth
  getUsers: () => apiFetch('/users'),
  getUser: (id) => apiFetch(`/users/${id}`),
  createUser: (payload) => apiFetch('/auth/register', { method: 'POST', body: payload }),
  updateUser: (id, payload) => apiFetch(`/users/${id}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),

  register: (payload) => apiFetch('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getCart: () => apiFetch('/cart', { method: 'GET' }),
    updateCart: (cart) => apiFetch('/cart', { method: 'POST', body: JSON.stringify({ cart }) }),
    checkout: (payload) => apiFetch('/checkout', { method: 'POST', body: JSON.stringify(payload) }),

    // Ping the API health endpoint to check server availability
    ping: async () => {
      try {
        const res = await fetch(API_PREFIX + '/health', { method: 'GET' });
        return res.ok;
      } catch (err) {
        return false;
      }
    },

    // Ping specific backends: business and crud (proxied paths)
    pingBusiness: async () => {
      try {
        const res = await fetch(API_PREFIX + '/health/business', { method: 'GET' });
        return res.ok;
      } catch (err) {
        return false;
      }
    },

    pingCrud: async () => {
      try {
        const res = await fetch(API_PREFIX + '/health/crud', { method: 'GET' });
        return res.ok;
      } catch (err) {
        return false;
      }
    }
  };
})(window);
