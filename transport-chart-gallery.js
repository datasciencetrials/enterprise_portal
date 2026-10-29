/* Public, on-demand chart catalogue. Every chart uses the mapped subset only. */
(() => {
  'use strict';
  const gallery = document.getElementById('transport-chart-gallery');
  if (!gallery) return;
  const palette = ['#ff7a25', '#28d9bd', '#ffca48', '#bc85ff', '#ff6176', '#65a9ff', '#e6f17a', '#ff9ecd'];
  const types = ['bar', 'line', 'doughnut', 'pie', 'polarArea', 'radar', 'scatter', 'bubble'];
  const quotas = { roads: 145, bridges: 42, culverts: 35, traffic: 18, ferries: 10, aviation: 8, safety: 30, freight: 8, rail: 15 };
  const missing = value => value === null || value === undefined || String(value).trim() === '' ? 'Not supplied' : String(value).trim();
  const field = (label, key) => ({ label, get: p => missing(p[key]) });
  const band = (label, key, stops, suffix = '') => ({ label, get: p => {
    const n = Number(p[key]);
    if (p[key] === null || p[key] === undefined || p[key] === '' || !Number.isFinite(n)) return 'Not supplied';
    for (let i = 0; i < stops.length; i++) if (n < stops[i]) return `${i ? stops[i - 1] : 0} to <${stops[i]}${suffix}`;
    return `${stops[stops.length - 1]}+${suffix}`;
  } });
  const decade = (label, key) => ({ label, get: p => {
    const n = Number(p[key]);
    return Number.isInteger(n) && n >= 1900 && n <= 2100 ? `${Math.floor(n / 10) * 10}s` : 'Not supplied';
  } });
  const schemas = {
    roads: [{ label: 'Surface Type', get: p => {
      const raw = missing(p['Surface  1']).toLowerCase();
      return ['paved', 'bituminous', 'concrete'].includes(raw) ? 'Paved' : ['unpaved', 'gravel', 'earth'].includes(raw) ? 'Unpaved' : 'Not supplied';
    } }, field('Condition', 'Condition'), field('Sub-Region', 'Region'), field('Functional Class', 'Road Cla 1'),
      { label: 'Road Type', get: p => p['Road Type'] === 'DUCAR' ? 'DUCAR' : 'National Road Network' }, field('Hierarchy Tier', 'Road Hierarchy Tier'), field('Surface Material', 'Surface Material'),
      field('Pavement Class', 'Pavement Class'), field('Maintenance Area', 'Maintena 2'), field('Safety Risk Band (method unverified)', 'Road Safety Risk Band'),
      field('Intervention Priority Band (method unverified)', 'Intervention Priority Band'), band('AADT band (method unverified)', 'Aadt 2026 Live', [500, 1000, 2500, 5000, 10000], ' vehicles/day'),
      band('Mapped road-length band', 'Length Km', [1, 5, 10, 25, 50], ' km'), decade('Completion decade', 'Completion Year'), decade('Rehabilitation decade', 'Rehabilitation Year')],
    bridges: [field('Maintenance Region', 'Maintenance_Region'), field('Maintenance Station', 'Maintenance_Station'), field('Structure Type', 'Structure_Type'),
      field('River crossing', 'River_Crossing'), decade('Construction decade', 'Year_Constructed')],
    culverts: [field('Maintenance Region', 'Maintenance_Region'), field('Structure Type', 'Culvert_Structure_Type'),
      band('Span band', 'Span_Diameter_m', [1, 2, 4, 8, 16], ' m'), band('Cell count band', 'Cell_Count', [2, 3, 4, 6])],
    traffic: [field('Region', 'REGION'), field('Station group', 'STATIONS'), field('Station category', 'STATION'),
      field('Comparison status', 'compare'), field('2016 station category', 'A2016_NAME'), field('2011 station category', 'A2011_NAME')],
    ferries: [field('Category', 'Category'), field('Water body', 'Water_body'), field('Remarks', 'Remarks')],
    aviation: [field('Category', 'Category'), field('Site name', 'F9')],
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
    const specs = valid.map(dim => ({ dimension: dim, title: dim.label, subset: null }));
    const strata = valid.filter(dim => dim.groups.size <= 12);
    const buckets = strata.map(subset => {
      const views = [];
      for (const value of subset.groups.keys()) {
        if (subset.groups.get(value) < 2) continue;
        for (const dimension of valid) {
          if (dimension === subset) continue;
          views.push({ dimension, title: `${dimension.label} within ${subset.label}: ${value}`, subset: { dimension: subset, value } });
        }
      }
      return views;
    });
    const quota = quotas[mode] || 20;
    while (specs.length < quota && buckets.some(bucket => bucket.length)) {
      for (const bucket of buckets) {
        if (specs.length >= quota) break;
        if (bucket.length) specs.push(bucket.shift());
      }
    }
    return specs;
  }

  function draw(canvas, spec, items, measure, index) {
    const selected = spec.subset ? items.filter(item => spec.subset.dimension.get(item.properties || {}) === spec.subset.value) : items;
    const values = new Map();
    for (const item of selected) {
      const key = spec.dimension.get(item.properties || {});
      values.set(key, (values.get(key) || 0) + measure(item));
    }
    const labels = [...spec.dimension.groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const totals = labels.map(label => round(values.get(label) || 0));
    const requested = types[index % types.length];
    const type = labels.length > 14 && ['doughnut', 'pie', 'polarArea', 'radar'].includes(requested) ? 'bar' : requested;
    const pointType = type === 'scatter' || type === 'bubble';
    const xTicks = { color: '#b6c7d0', maxRotation: 65 };
    if (pointType) xTicks.callback = value => labels[value - 1] || '';
    const peak = Math.max(1, ...totals);
    const data = pointType ? totals.map((y, x) => type === 'bubble' ? { x: x + 1, y, r: 3 + Math.sqrt(y / peak) * 12 } : { x: x + 1, y }) : totals;
    const circular = ['doughnut', 'pie', 'polarArea'].includes(type);
    const colours = labels.map((_, i) => palette[i % palette.length]);
    const instance = new Chart(canvas, {
      type,
      data: { labels: pointType ? undefined : labels, datasets: [{ label: modeLabel(), data, backgroundColor: type === 'line' ? '#28d9bd55' : type === 'radar' ? '#bc85ff55' : colours,
        borderColor: type === 'line' ? '#28d9bd' : type === 'radar' ? '#bc85ff' : circular ? '#1b2632' : colours,
        borderWidth: type === 'bar' ? 0 : 2, pointRadius: type === 'line' ? 3 : 5, tension: .32, fill: type === 'line' || type === 'radar' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
        plugins: { legend: { display: circular, labels: { color: '#d4e2e8', font: { size: 9 } } },
          tooltip: { callbacks: { title: context => pointType ? labels[Math.round(context[0].raw.x) - 1] : context[0].label,
            label: context => `${round(pointType ? context.raw.y : context.raw)} ${modeLabel()}` } } },
        scales: type === 'radar' || type === 'polarArea' ? { r: { beginAtZero: true, grid: { color: '#ffffff25' }, angleLines: { color: '#ffffff25' }, pointLabels: { color: '#d4e2e8' }, ticks: { color: '#d4e2e8', backdropColor: 'transparent' } } }
          : circular ? {} : { x: { ticks: xTicks, grid: { color: '#ffffff12' } },
          y: { beginAtZero: true, ticks: { color: '#b6c7d0' }, grid: { color: '#ffffff19' } } } }
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
    const specs = buildSpecs(catalogueItems, mode);
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
          if (!Chart.getChart(canvas)) draw(canvas, specs[index], visibleItems, measure, index);
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
        if (!Chart.getChart(canvas)) draw(canvas, spec, visibleItems, measure, index);
        Chart.getChart(canvas)?.update('none');
        const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `uganda-${mode}-${slug}.png`; a.click();
      });
      actions.append(unit, download); header.append(label, actions); card.append(header, canvas); grid.append(card); observer.observe(card);
    });
    return specs.length;
  }
  window.TransportChartGallery = { render };
})();
