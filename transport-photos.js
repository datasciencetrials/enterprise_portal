(() => {
  const carousel = document.querySelector('.transport-photos');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.transport-photo')];
  const dots = [...carousel.querySelectorAll('[data-photo-index]')];
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
    if (!paused && !document.hidden && !carousel.matches(':hover') && !carousel.contains(document.activeElement)) {
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
    if (announce) status.textContent = `Photograph ${active + 1} of ${slides.length}: ${slides[active].querySelector('strong').textContent}`;
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
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  carousel.addEventListener('focusin', stop);
  carousel.addEventListener('focusout', () => window.setTimeout(start, 0));
  document.addEventListener('visibilitychange', start);
  prefersReducedMotion.addEventListener('change', event => {
    paused = event.matches;
    pauseButton.textContent = paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume automatic rotation' : 'Pause automatic rotation');
    pauseButton.setAttribute('aria-pressed', String(paused));
    start();
  });
  start();
})();
