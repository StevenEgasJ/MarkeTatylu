/* promotions carousel and image normalization moved out of index.html
   Keeps behavior identical but places code in static/js as requested. */
(function(){
  // Simple carousel for the promo images (vegetales, carnes, limpieza)
  const images = [
    { src: './static/img/promo_vegetales.jpg', caption: 'Verduras frescas con descuento' },
    { src: './static/img/promo_carnes.jpeg', caption: 'Cortes selectos en promoción' },
    { src: './static/img/promo_limpieza.jpg', caption: 'Limpieza y hogar: ofertas especiales' }
  ];

  const imgEl = document.getElementById('promoCarouselImg');
  const captionEl = document.getElementById('promoCaption');
  const dotsEl = document.getElementById('promoDots');
  if(!imgEl || !captionEl || !dotsEl) return; // defensive - keep HTML intact

  let idx = 0, timer = null;

  function normalizeSrc(s){
    if(!s) return '';
    if(/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('/')) return s;
  // If a placeholder-style src is requested (e.g. "600x375?text=...")
  // avoid external DNS/HTTP calls and use a local SVG placeholder instead.
  if(/^\d+x\d+\?/.test(s) || s.includes('?text=')) return './static/img/placeholder.svg';
    return s;
  }

  function showSlide(i){
    idx = (i + images.length) % images.length;
    imgEl.src = normalizeSrc(images[idx].src);
    captionEl.textContent = images[idx].caption;
    Array.from(dotsEl.children).forEach((d,j)=> d.classList.toggle('active', j===idx));
  }

  function startAuto(){ if(timer) clearInterval(timer); timer = setInterval(()=> showSlide(idx+1), 3500); }

  images.forEach((_,i)=>{ const dot=document.createElement('div'); dot.className='carousel-dot'+(i===0?' active':''); dot.addEventListener('click',()=>{ showSlide(i); startAuto(); }); dotsEl.appendChild(dot); });
  showSlide(0); startAuto();

  // Fallback to a local placeholder image to avoid external network/DNS issues.
  imgEl.addEventListener('error', ()=> { imgEl.src = './static/img/placeholder.svg'; });
  const seasonImg = document.getElementById('promoSeasonImg');
  if(seasonImg){
    seasonImg.src = normalizeSrc(seasonImg.getAttribute('src')||seasonImg.src||'');
    // Try promo_navidad1.jpg as a seasonal-specific fallback if the original fails.
    // If that also fails, finally fall back to the generic placeholder.svg.
    seasonImg.addEventListener('error', function onSeasonError(){
      try {
        const retries = parseInt(seasonImg.getAttribute('data-promo-retries') || '0', 10) || 0;
        if (retries === 0) {
          // First retry: try promo_navidad1.jpg
          seasonImg.setAttribute('data-promo-retries', '1');
          // remove current handler briefly to avoid re-entrancy; handler will remain on the element
          // and will run again if the new src fails
          seasonImg.src = './static/img/promo_navidad1.jpg';
        } else {
          // Second failure: give up and use generic placeholder
          seasonImg.removeEventListener('error', onSeasonError);
          seasonImg.src = './static/img/placeholder.svg';
        }
      } catch (e) {
        // On any unexpected error, ensure we set a safe placeholder
        try { seasonImg.removeEventListener('error', onSeasonError); } catch(_){ }
        seasonImg.src = './static/img/placeholder.svg';
      }
    });
  }
})();
