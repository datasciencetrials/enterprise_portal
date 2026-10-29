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
  let paused = prefersReducedMotion.matches;
  let timer;
  let touchStart = null;
  if (paused) {
    pauseButton.textContent = 'Play';
    pauseButton.setAttribute('aria-label', 'Resume automatic rotation');
    pauseButton.setAttribute('aria-pressed', 'true');
  }

  const stop = () => { window.clearInterval(timer); timer = undefined; };
  const start = () => {
    stop();
    if (!paused && !document.hidden && slides.length > 1) {
      timer = window.setInterval(() => show(active + 1, false), 6000);
    }
  };
  const show = (index, announce = true) => {
    active = (index + slides.length) % slides.length;
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
    else if (arrow?.dataset.photoAction === 'previous') show(active - 1);
    else if (arrow?.dataset.photoAction === 'next') show(active + 1);
  });
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(active + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  carousel.addEventListener('touchstart', event => { touchStart = event.changedTouches[0]?.screenX ?? null; }, {passive:true});
  carousel.addEventListener('touchend', event => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].screenX - touchStart;
    touchStart = null;
    if (Math.abs(delta) > 45) show(active + (delta < 0 ? 1 : -1));
  }, {passive:true});
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
      start();
    })
    .catch(() => start());
  start();
})();
