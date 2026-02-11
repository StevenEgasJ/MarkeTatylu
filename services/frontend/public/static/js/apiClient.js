// Small API client used by the frontend to talk to the backend API
(function(window){
  // Determine API base:
  // - If a global override `window.__API_BASE__` is set, use it.
  // - If page was opened via file://, assume a local dev server at http://localhost:4000
  // - Otherwise use a same-origin relative path '/api'.
  const DEFAULT_DEV_SERVER = 'http://localhost:4000';
  const host = (location && location.hostname) ? location.hostname : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const rawOverride = (window.__API_BASE__ && window.__API_BASE__.trim())
    ? window.__API_BASE__.replace(/\/$/, '')
    : '';
  // Avoid using a remote override when running locally to prevent CORS failures.
  // Allow local overrides (localhost/127.0.0.1) for dev flexibility.
  const overrideAllowed = !isLocalHost || /localhost|127\.0\.0\.1/.test(rawOverride);
  const apiBaseRoot = (rawOverride && overrideAllowed)
    ? rawOverride
    : (location.protocol === 'file:' ? DEFAULT_DEV_SERVER : '');
  const API_PREFIX = apiBaseRoot ? (apiBaseRoot + '/api') : '/api';

  function getToken(){
    // Prefer sessionStorage (volatile/session-scoped) over localStorage (persistent)
    // This is especially important for admin tokens which should not persist across sessions
    try {
      const sessionToken = sessionStorage.getItem('token');
      if (sessionToken) {
        console.log('apiFetch: Token found in sessionStorage');
        return sessionToken;
      }
      const localToken = localStorage.getItem('token');
      if (localToken) {
        console.log('apiFetch: Token found in localStorage');
        return localToken;
      }
      console.log('apiFetch: No token found anywhere');
      return null;
    } catch (e) {
      console.error('apiFetch: Error accessing sessionStorage:', e);
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
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (options && options.requireAuth) {
      // Request explicitly requires auth, warn so developers know why it will fail
      console.warn('apiFetch: No token found in sessionStorage or localStorage (request requires authentication)');
    } else {
      // For anonymous/public requests, avoid noisy warnings
      if (console.debug) console.debug('apiFetch: anonymous request (no token)');
    }

    // Instrumentation: measure request duration
    const reqKey = `${path}@${Date.now()}`;
    try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestStart) window.rail.metrics.markRequestStart(reqKey); } catch(e){}

    // Make initial request with retry logic for transient network errors
    let res;
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      try {
        res = await fetch(API_PREFIX + path, { ...options, headers });
        break; // success or non-network HTTP response
      } catch (networkErr) {
        attempt++;
        try { if (window.rail && window.rail.metrics && window.rail.metrics.markRequestEnd) window.rail.metrics.markRequestEnd(reqKey, { error: networkErr.message }); } catch(e){}
        if (attempt >= maxAttempts) throw networkErr;
        // backoff before retry
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }

    // Handle 401 with token: clear token and retry once without Authorization
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

    // If response is 304 Not Modified for GETs, try to return cached data when available
    if (res.status === 304 && (!options.method || options.method.toUpperCase() === 'GET')) {
      try {
        const cacheMap = {
          '/products': 'productos',
          '/categories': 'categorias',
          '/orders': 'pedidos'
        };
        const cacheKey = cacheMap[path];
        if (cacheKey) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        }
      } catch (e) {
        // ignore cache parse errors
      }
      // As a fallback return empty array for GETs
      return [];
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

  // Helper function to create fetch options that bypass Cloudflare challenges
  function getFetchOptionsWithHeaders() {
    return {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    };
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
        const options = getFetchOptionsWithHeaders();
        const res = await fetch(API_PREFIX + '/health/business', options);
        
        if (!res.ok) {
          window.__businessUp = false;
          return false;
        }
        
        try {
          const data = await res.json();
          const isUp = data && data.status === 'ok' && data.service === 'backend-business';
          window.__businessUp = isUp;
          return isUp;
        } catch (parseErr) {
          window.__businessUp = false;
          return false;
        }
      } catch (err) {
        window.__businessUp = false;
        return false;
      }
    },

    pingCrud: async () => {
      try {
        // Retry logic: try up to 3 times with 1 second delay
        let retries = 3;
        const options = getFetchOptionsWithHeaders();
        
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(API_PREFIX + '/health/crud', options);
            
            // Check HTTP status is OK
            if (!res.ok) {
              // If not the last retry, wait 1 second before retrying
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              continue;
            }
            
            // Validate response is JSON with status: ok
            try {
              const data = await res.json();
              if (data && data.status === 'ok' && data.service === 'backend-crud') {
                window.__crudUp = true;
                return true;
              }
            } catch (parseErr) {
              // Response is not valid JSON, might be Cloudflare challenge
            }
          } catch (err) {
            // Network error, continue retrying
          }
          
          // If not the last retry, wait 1 second before retrying
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // All retries failed
        window.__crudUp = false;
        return false;
      } catch (err) {
        window.__crudUp = false;
        return false;
      }
    }
  };
})(window);
