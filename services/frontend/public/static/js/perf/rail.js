// RAIL utilities: Response, Animation, Idle, Load helpers
(function(){
  const rail = {};

  // Run a function during browser idle time if available, fallback to setTimeout
  rail.runDuringIdle = function(fn, options={timeout:200}){
    return new Promise((resolve)=>{
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(async (deadline)=>{ try { const r = await fn(); resolve(r); } catch(e){ resolve(); } }, options);
      } else {
        // give the browser a tick to finish layout/paint
        setTimeout(async ()=>{ try { const r = await fn(); resolve(r); } catch(e){ resolve(); } }, 50);
      }
    });
  };

  // Schedule work on next animation frame
  rail.runNextFrame = function(fn){
    requestAnimationFrame(() => { try { fn(); } catch(e){ console.warn('runNextFrame error', e); } });
  };

  // Batch render items into a container using idle callbacks to keep UI responsive
  // createFn(item) should return a DOM node
  rail.batchRender = function(items, createFn, container, batchSize=8){
    if (!items || items.length === 0) return Promise.resolve();
    let i = 0;
    function renderChunk(deadline){
      const end = Math.min(i + batchSize, items.length);
      for (; i < end; i++){
        try { container.appendChild(createFn(items[i])); } catch(e){ console.warn('batchRender append failed', e); }
      }
      if (i < items.length) {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(renderChunk, {timeout:200});
        else setTimeout(renderChunk, 40);
      } else {
        // finished, trigger lazy loading of images in the container
        rail.lazyLoadImages(container);
      }
    }
    // Start with one synchronous chunk to show content quickly
    renderChunk();
    return Promise.resolve();
  };

  // Lazy-load images using IntersectionObserver, fallback to swapping data-src on load
  rail.lazyLoadImages = function(root){
    try {
      const rootEl = root && root.querySelector ? root : document;
      const images = Array.from(rootEl.querySelectorAll('img.lazy[data-src]'));
      if (images.length === 0) return;

      if ('IntersectionObserver' in window){
        const io = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting){
              const img = entry.target;
              img.src = img.getAttribute('data-src');
              img.removeAttribute('data-src');
              img.classList.remove('lazy');
              obs.unobserve(img);
            }
          });
        }, {rootMargin: '200px'});

        images.forEach(img => io.observe(img));
      } else {
        // Fallback: load all images after short delay
        setTimeout(()=>{
          images.forEach(img=>{ img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); img.classList.remove('lazy'); });
        }, 200);
      }
    } catch(e) { console.warn('lazyLoadImages failed', e); }
  };

  // Helper to fetch during idle with timeout/cancel safety
  rail.idleFetch = function(url, opts){
    return rail.runDuringIdle(() => fetch(url, opts).then(r=>r.json()).catch(e=>{ throw e; }));
  };

  // Simple in-memory metrics for RAIL: requests and button timings
  rail.metrics = (function(){
    const state = { requests: [], buttons: {}, marks: {} };

    function markRequestStart(key){ state.marks[key] = performance.now(); }
    function markRequestEnd(key, meta){
      try {
        const start = state.marks[key];
        const end = performance.now();
        const dur = start ? (end - start) : null;
        const rec = { key, meta: meta || {}, start, end, dur };
        state.requests.push(rec);
        delete state.marks[key];
        return rec;
      } catch(e){ console.warn('rail.metrics requestEnd error', e); return null; }
    }

    function markButtonAdded(id){ state.buttons[id] = state.buttons[id] || {}; state.buttons[id].added = performance.now(); }
    function markButtonInteractive(id){ state.buttons[id] = state.buttons[id] || {}; state.buttons[id].interactive = performance.now(); }
    function markButtonClickStart(id){ state.buttons[id] = state.buttons[id] || {}; state.buttons[id].clickStart = performance.now(); }
    function markButtonClickEnd(id){
      state.buttons[id] = state.buttons[id] || {};
      state.buttons[id].clickEnd = performance.now();
      const b = state.buttons[id];
      b.clickDuration = (b.clickEnd - (b.clickStart || b.added || b.interactive || b.clickEnd));
      // Auto-report small event for quick feedback
      rail.metrics.report({ type: 'button', id, value: b.clickDuration });
    }

    function report(extra){
      try {
        const summary = {
          timestamp: new Date().toISOString(),
          requests: state.requests.slice(-20),
          buttons: state.buttons,
          extra: extra || null
        };
        
        // Calculate total time and categorize requests
        let totalTime = 0;
        const categorized = {
          api: [],
          popup: [],
          other: []
        };
        
        state.requests.forEach(r => {
          if (r.dur) totalTime += r.dur;
          
          const info = {
            name: r.key || 'unknown',
            duration_ms: r.dur ? Math.round(r.dur) : 0,
            start: r.start ? Math.round(r.start) : 0,
            end: r.end ? Math.round(r.end) : 0
          };
          
          if (r.key && r.key.startsWith('popup:')) {
            info.type = 'Popup/Modal';
            info.name = r.key.replace('popup:', '');
            categorized.popup.push(info);
          } else if (r.key && (r.key.startsWith('api:') || r.key.includes('fetch'))) {
            info.type = 'API Request';
            categorized.api.push(info);
          } else {
            info.type = 'Other';
            categorized.other.push(info);
          }
        });
        
        // Enhanced console output
        console.group('📊 RAIL METRICS REPORT');
        console.log(`⏱️ Total Time: ${Math.round(totalTime)}ms`);
        console.log(`📅 Timestamp: ${summary.timestamp}`);
        
        if (categorized.popup.length > 0) {
          console.group('🎯 Popups/Modals (' + categorized.popup.length + ')');
          categorized.popup.forEach(p => {
            console.log(`  ├─ ${p.name}: ${p.duration_ms}ms`);
          });
          const popupTotal = categorized.popup.reduce((sum, p) => sum + p.duration_ms, 0);
          console.log(`  └─ Total popup time: ${popupTotal}ms`);
          console.groupEnd();
        }
        
        if (categorized.api.length > 0) {
          console.group('🌐 API Requests (' + categorized.api.length + ')');
          categorized.api.forEach(a => {
            console.log(`  ├─ ${a.name}: ${a.duration_ms}ms`);
          });
          const apiTotal = categorized.api.reduce((sum, a) => sum + a.duration_ms, 0);
          console.log(`  └─ Total API time: ${apiTotal}ms`);
          console.groupEnd();
        }
        
        if (categorized.other.length > 0) {
          console.group('📦 Other Operations (' + categorized.other.length + ')');
          categorized.other.forEach(o => {
            console.log(`  ├─ ${o.name}: ${o.duration_ms}ms`);
          });
          console.groupEnd();
        }
        
        const buttonCount = Object.keys(state.buttons).length;
        if (buttonCount > 0) {
          console.group('🔘 Button Interactions (' + buttonCount + ')');
          Object.entries(state.buttons).forEach(([id, data]) => {
            const clickDur = data.clickDuration || 0;
            console.log(`  ├─ ${id}: ${Math.round(clickDur)}ms`);
          });
          console.groupEnd();
        }
        
        console.groupEnd();
        
        // Add summary statistics
        summary.statistics = {
          total_time_ms: Math.round(totalTime),
          popup_count: categorized.popup.length,
          api_count: categorized.api.length,
          button_count: buttonCount,
          categorized: categorized
        };
        
        // Structured log so external agents (Railway, APM, etc.) can parse it
        console.log('RAIL_METRICS_SUMMARY', summary);
        // Dispatch event for any listener (tests, UI, or monitoring script)
        try { window.dispatchEvent(new CustomEvent('rail:metrics', { detail: summary })); } catch(e){}

        // Non-blocking: send to server endpoint /metrics/rail (best-effort)
        try {
          const payload = summary;
          const body = JSON.stringify(payload);
          // Prefer sendBeacon for reliability during unload
          if (navigator && typeof navigator.sendBeacon === 'function') {
            try { navigator.sendBeacon('/metrics/rail', new Blob([body], { type: 'application/json' })); } catch(e){ /* ignore */ }
          } else {
            // Send during idle so it doesn't impact performance
            try { rail.runDuringIdle(() => fetch('/metrics/rail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(r=>r.ok).catch(()=>{}), { timeout: 2000 }); } catch(e){}
          }
        } catch(e){ /* ignore posting errors */ }

        return summary;
      } catch(e){ console.warn('rail.metrics.report failed', e); }
    }

    return { markRequestStart, markRequestEnd, markButtonAdded, markButtonInteractive, markButtonClickStart, markButtonClickEnd, report };
  })();

  window.rail = rail;
})();
