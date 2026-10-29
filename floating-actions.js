(() => {
  'use strict';
  const goHome = () => { window.location.href = './'; };
  document.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back(); else goHome();
  });
  document.querySelector('[data-action="top"]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.querySelector('[data-action="download"]')?.addEventListener('click', () => {
    const tableDownload = document.getElementById('download');
    if (tableDownload) { tableDownload.click(); return; }
    if (document.getElementById('gis-map')) {
      let menu = document.getElementById('map-download-menu');
      if (!menu) {
        menu = document.createElement('div'); menu.id = 'map-download-menu'; menu.className = 'map-download-menu';
        menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Download options');
        for (const [format, label] of [['csv', 'Table CSV'], ['geojson', 'Map GeoJSON'], ['json', 'Table JSON'], ['print', 'Print or save PDF']]) {
          const option = document.createElement('button'); option.type = 'button'; option.textContent = label;
          option.addEventListener('click', () => { menu.hidden = true; if (format === 'print') window.print(); else window.dispatchEvent(new CustomEvent('download-mapped-data', { detail: { format } })); });
          menu.append(option);
        }
        document.querySelector('.floating-actions').append(menu);
      }
      menu.hidden = !menu.hidden;
      if (!menu.hidden) menu.querySelector('button')?.focus();
      return;
    }
    window.location.href = './data-explorer.html';
  });
})();
