/* Direct, data-backed chart views of the mapped subset. */
(() => {
  'use strict';
  const gallery = document.getElementById('transport-chart-gallery');
  if (!gallery) return;
  const palette = ['#ff7a25', '#28d9bd', '#ffca48', '#bc85ff', '#ff6176', '#65a9ff', '#e6f17a', '#ff9ecd'];
  const missing = value => value === null || value === undefined || String(value).trim() === '' ? 'Not supplied' : String(value).trim();
  const field = (label, key) => ({ label, get: p => missing(p[key]) });
  const schemas = {
    roads: [{ label: 'Surface Type', get: p => {
      const raw = missing(p['Surface  1']).toLowerCase();
      return ['paved', 'bituminous', 'concrete'].includes(raw) ? 'Paved' : ['unpaved', 'gravel', 'earth'].includes(raw) ? 'Unpaved' : 'Not supplied';
    } }, field('Condition', 'Condition'), field('Sub-Region', 'Region'), field('Functional Class', 'Road Cla 1'),
      { label: 'Road Type', get: p => p['Road Type'] === 'DUCAR' ? 'DUCAR' : 'National Road Network' }],
    bridges: [field('Maintenance Region', 'Maintenance_Region'), field('Maintenance Station', 'Maintenance_Station'), field('Structure Type', 'Structure_Type'),
      field('River crossing', 'River_Crossing')],
    culverts: [field('Maintenance Region', 'Maintenance_Region'), field('Structure Type', 'Culvert_Structure_Type')],
    traffic: [field('Region', 'REGION'), field('Station group', 'STATIONS'), field('Station category', 'STATION'),
      field('Comparison status', 'compare')],
    ferries: [field('Category', 'Category'), field('Water body', 'Water_body')],
    aviation: [field('Category', 'Category')],
    safety: [field('Severity', 'severity'), field('Incident type', 'incident_type'), field('Road class', 'road_class'),
      { label: 'Year', get: p => /^\d{4}/.test(String(p.date || '')) ? String(p.date).slice(0, 4) : 'Not supplied' },
      { label: 'Month', get: p => /^\d{4}-\d{2}/.test(String(p.date || '')) ? String(p.date).slice(0, 7) : 'Not supplied' }],
    freight: [field('Facility status', 'Status')],
    rail: [field('Rail type', '_transportKind'), field('Alignment status', 'Status')],
  };
  let chartInstances = [];
  let observer;
  let generation = 0;
  const round = value => Math.round(value * 10) / 10;

  function buildSpecs(items, mode) {
    const dimensions = schemas[mode] || [];
    const valid = dimensions.map(dim => {
      const groups = new Map();
      for (const item of items) { const key = dim.get(item.properties || {}); groups.set(key, (groups.get(key) || 0) + 1); }
      return { ...dim, groups };
    }).filter(dim => dim.groups.size > 1);
    return valid.map(dim => ({ dimension: dim, title: dim.label }));
  }

  function draw(canvas, spec, items, measure) {
    const selected = items;
    const values = new Map();
    for (const item of selected) {
      const key = spec.dimension.get(item.properties || {});
      values.set(key, (values.get(key) || 0) + measure(item));
    }
    const labels = [...spec.dimension.groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const totals = labels.map(label => round(values.get(label) || 0));
    const timeSeries = spec.dimension.label === 'Year' || spec.dimension.label === 'Month';
    const type = timeSeries ? 'line' : labels.length <= 3 ? 'doughnut' : 'bar';
    const circular = type === 'doughnut';
    const horizontal = type === 'bar' && labels.length > 6;
    const colours = labels.map((_, i) => palette[i % palette.length]);
    const instance = new Chart(canvas, {
      type,
      data: { labels, datasets: [{ label: modeLabel(), data: totals, backgroundColor: type === 'line' ? '#28d9bd33' : colours,
        borderColor: type === 'line' ? '#099b8b' : circular ? '#ffffff' : colours,
        borderWidth: type === 'bar' ? 0 : 2, borderRadius: type === 'bar' ? 6 : 0, pointRadius: type === 'line' ? 4 : 0, tension: .32, fill: type === 'line' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { legend: { display: circular, position: 'bottom', labels: { color: '#28414d', font: { size: 10 } } },
          tooltip: { callbacks: { label: context => `${round(context.raw)} ${modeLabel()}` } } },
        scales: circular ? {} : { x: { ticks: { color: '#48606d', maxRotation: horizontal ? 0 : 45 }, grid: { color: '#dae7ed' } },
          y: { beginAtZero: true, ticks: { color: '#48606d' }, grid: { color: '#dae7ed' } } } }
    });
    chartInstances.push(instance);
    return instance;
  }

  let currentMode = 'roads';
  function modeLabel() { return currentMode === 'roads' || currentMode === 'rail' ? 'km' : 'mapped features'; }
  function modeUnit() { return currentMode === 'roads' || currentMode === 'rail' ? 'km' : 'count'; }
  function render(mode, catalogueItems, visibleItems, measure) {
    currentMode = mode;
    generation++;
    observer?.disconnect();
    for (const instance of chartInstances) instance.destroy();
    chartInstances = [];
    if (mode === 'roads') {
      gallery.replaceChildren();
      gallery.hidden = true;
      return 0;
    }
    const specs = buildSpecs(catalogueItems, mode);
    if (!specs.length) {
      gallery.replaceChildren();
      gallery.hidden = true;
      return 0;
    }
    gallery.replaceChildren();
    gallery.hidden = false;
    const heading = document.createElement('div'); heading.className = 'analysis-title';
    const title = document.createElement('h2'); title.textContent = `${mode === 'roads' ? 'Roads' : mode[0].toUpperCase() + mode.slice(1)} by category`;
    heading.append(title); gallery.append(heading);
    const grid = document.createElement('div'); grid.className = 'chart-grid gallery-grid'; gallery.append(grid);
    const version = generation;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (version !== generation) continue;
        const index = Number(entry.target.dataset.index);
        const canvas = entry.target.querySelector('canvas');
        if (entry.isIntersecting) {
          if (!Chart.getChart(canvas)) draw(canvas, specs[index], visibleItems, measure);
        } else {
          const instance = Chart.getChart(canvas);
          if (instance) { instance.destroy(); chartInstances = chartInstances.filter(chart => chart !== instance); }
        }
      }
    }, { rootMargin: '400px' });
    specs.forEach((spec, index) => {
      const card = document.createElement('article'); card.className = 'chart-card gallery-card'; card.dataset.index = String(index);
      const header = document.createElement('div'); header.className = 'chart-header';
      const label = document.createElement('h3'); label.textContent = spec.title;
      const actions = document.createElement('div'); actions.className = 'gallery-card-actions';
      const unit = document.createElement('span'); unit.className = 'chart-unit'; unit.textContent = modeUnit();
      const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${spec.title}, ${modeLabel()}`);
      const download = document.createElement('button'); download.type = 'button'; download.className = 'chart-download'; download.textContent = '↓';
      download.setAttribute('aria-label', `Download ${spec.title} chart as PNG`);
      download.title = 'Download PNG';
      download.addEventListener('click', () => {
        if (!Chart.getChart(canvas)) draw(canvas, spec, visibleItems, measure);
        Chart.getChart(canvas)?.update('none');
        const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `uganda-${mode}-${slug}.png`;
          document.body.append(a); a.click(); a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, 'image/png');
      });
      actions.append(unit, download); header.append(label, actions); card.append(header, canvas); grid.append(card); observer.observe(card);
    });
    return specs.length;
  }
  window.TransportChartGallery = { render };
})();
