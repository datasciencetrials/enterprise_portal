(() => {
  const carousel = document.querySelector('.transport-photos');
  if (!carousel) return;
  const track = carousel.querySelector('.transport-photos-track');
  const dotContainer = carousel.querySelector('.transport-photo-dots');
  let slides = [...carousel.querySelectorAll('.transport-photo')];
  let dots = [...carousel.querySelectorAll('[data-photo-index]')];
  const status = carousel.querySelector('#transport-photo-status');
  const pauseButton = carousel.querySelector('[data-photo-action="pause"]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let mode = new URLSearchParams(window.location.search).get('mode') || 'all';
  let visibleIndices = [];
  let paused = prefersReducedMotion.matches;
  let timer;
  let touchStart = null;
  if (paused) {
    pauseButton.textContent = 'Play';
    pauseButton.setAttribute('aria-label', 'Resume automatic rotation');
    pauseButton.setAttribute('aria-pressed', 'true');
  }

  const stop = () => { window.clearInterval(timer); timer = undefined; };
  const categoriesFor = {
    roads: ['ROAD NETWORK', 'EXPRESSWAYS', 'URBAN ROADS'],
    bridges: ['BRIDGES'],
    culverts: ['ROAD NETWORK'],
    traffic: ['EXPRESSWAYS', 'URBAN ROADS'],
    ferries: ['FERRIES'],
  };
  const setMode = nextMode => {
    mode = nextMode;
    const categories = categoriesFor[mode];
    visibleIndices = slides.map((slide, index) => ({
      index,
      category: slide.querySelector('figcaption span')?.textContent?.trim(),
    })).filter(item => !categories || categories.includes(item.category)).map(item => item.index);
    if (!visibleIndices.length) visibleIndices = slides.map((_, index) => index);
    slides.forEach((slide, index) => { slide.hidden = !visibleIndices.includes(index); });
    dots.forEach((dot, index) => { dot.hidden = !visibleIndices.includes(index); });
    show(visibleIndices.includes(active) ? active : visibleIndices[0], false);
  };
  const step = (delta, announce = true) => {
    const place = visibleIndices.indexOf(active);
    show(visibleIndices[(place + delta + visibleIndices.length) % visibleIndices.length], announce);
  };
  const start = () => {
    stop();
    if (!paused && !document.hidden && visibleIndices.length > 1) {
      timer = window.setInterval(() => step(1, false), 6000);
    }
  };
  const show = (index, announce = true) => {
    active = visibleIndices.includes(index) ? index : visibleIndices[0];
    slides.forEach((slide, i) => {
      const current = i === active;
      slide.classList.toggle('is-active', current);
      slide.setAttribute('aria-hidden', String(!current));
    });
    dots.forEach((dot, i) => {
      const current = i === active;
      dot.classList.toggle('is-active', current);
      if (current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (announce) status.textContent = `Now showing ${slides[active].querySelector('strong').textContent}`;
    start();
  };
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume automatic rotation' : 'Pause automatic rotation');
    pauseButton.setAttribute('aria-pressed', String(paused));
    start();
  });
  carousel.addEventListener('click', event => {
    const dot = event.target.closest('[data-photo-index]');
    const arrow = event.target.closest('[data-photo-action]');
    if (dot) show(Number(dot.dataset.photoIndex));
    else if (arrow?.dataset.photoAction === 'previous') step(-1);
    else if (arrow?.dataset.photoAction === 'next') step(1);
  });
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  carousel.addEventListener('touchstart', event => { touchStart = event.changedTouches[0]?.screenX ?? null; }, {passive:true});
  carousel.addEventListener('touchend', event => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].screenX - touchStart;
    touchStart = null;
    if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
  }, {passive:true});
  window.addEventListener('transportmodechange', event => setMode(event.detail.mode));
  document.addEventListener('visibilitychange', start);
  prefersReducedMotion.addEventListener('change', event => {
    paused = event.matches;
    pauseButton.textContent = paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume automatic rotation' : 'Pause automatic rotation');
    pauseButton.setAttribute('aria-pressed', String(paused));
    start();
  });
  fetch('media/transport-gallery.json')
    .then(response => { if (!response.ok) throw new Error('Gallery unavailable'); return response.json(); })
    .then(photos => {
      photos.forEach(photo => {
        const figure = document.createElement('figure');
        figure.className = 'transport-photo';
        figure.setAttribute('aria-hidden', 'true');
        const img = document.createElement('img');
        img.src = `media/${photo.file}`;
        img.alt = photo.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        figure.append(img);
        const caption = document.createElement('figcaption');
        const category = document.createElement('span');
        category.textContent = photo.category;
        const title = document.createElement('strong');
        title.textContent = photo.title;
        caption.append(category, title);
        figure.append(caption);
        track.append(figure);
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.dataset.photoIndex = String(slides.length);
        dot.setAttribute('aria-label', `Show ${photo.title}`);
        dotContainer.append(dot);
        slides.push(figure);
        dots.push(dot);
      });
      setMode(mode);
    })
    .catch(() => start());
  setMode(mode);
})();
