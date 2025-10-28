// Small API client used by the frontend to talk to the backend API
(function(window){
  const API_PREFIX = '/api';

  function getToken(){
    return localStorage.getItem('token');
  }

  async function apiFetch(path, options = {}){
    const headers = options.headers || {};
    // do not set JSON header for FormData
    if (!options.body || (typeof options.body === 'object' && !(options.body instanceof FormData))) {
      headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(API_PREFIX + path, { ...options, headers });
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
    getProduct: (id) => apiFetch(`/products/${id}`),
    register: (payload) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    getCart: () => apiFetch('/cart', { method: 'GET' }),
    updateCart: (cart) => apiFetch('/cart', { method: 'POST', body: JSON.stringify({ cart }) }),
    checkout: (payload) => apiFetch('/checkout', { method: 'POST', body: JSON.stringify(payload) })
  };
})(window);
