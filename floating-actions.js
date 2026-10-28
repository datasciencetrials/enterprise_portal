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
    const related = document.getElementById('mode-table-link');
    window.location.href = related && !document.getElementById('mode-detail')?.hidden ? related.href : './data-explorer.html?dataset=roads';
  });
})();
