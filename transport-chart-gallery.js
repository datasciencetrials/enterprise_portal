/* Multi-dimensional breakdown charts for the active transport layer. */
(() => {
  'use strict';
  const gallery = document.getElementById('transport-chart-gallery');
  if (!gallery) return;
  const palette = ['#0071E3', '#16A34A', '#D97706', '#EA580C', '#DC2626', '#7C3AED', '#0891B2', '#4F46E5'];
  const cleanVal = value => value === null || value === undefined || String(value).trim() === '' ? 'Standard' : String(value).trim();
  const subRegion = raw => ({ North: 'Northern', South: 'Southern', East: 'Eastern', West: 'Western', 'North East': 'North Eastern' })[raw] || raw;
  const field = (label, key) => ({ label, get: p => cleanVal(p[key]) });
  const schemas = {
    roads: [
      { label: 'Surface Type', get: p => cleanVal(p['Surface Type'] || p['Surface  1']) },
      field('Condition (MOBICAP(Road condition assesment tool) & ROMDAS(Roughness and rutting machine based testing))', 'Condition'),
      field('Maintenance Region', 'Region'),
      field('Functional Class', 'Road Cla 1'),
    ],
    bridges: [
      field('Condition Band (552 Bridges)', 'Condition_Band'),
      field('Maintenance Region', 'Maintenance_Region'),
      field('Maintenance Station', 'Maintenance_Station'),
      field('Structural Typology', 'Structure_Type'),
      field('Deck Material', 'Deck_Material'),
      field('Scour Risk Assessment', 'Scour_Risk'),
    ],
    culverts: [
      field('Condition Band (452 Major Culverts)', 'Condition_Band'),
      field('Maintenance Region', 'Maintenance_Region'),
      field('Maintenance Station', 'Maintenance_Station'),
      field('Culvert Structure Type', 'Culvert_Structure_Type'),
      field('Road Surface Type', 'Surface_Type'),
    ],
    traffic: [
      { label: 'Maintenance Region', get: p => subRegion(cleanVal(p.REGION)) },
      field('Station Classification', 'STATIONS'),
      field('Maintenance Station', 'STATION'),
      field('Monitoring Method', 'compare'),
    ],
    ferries: [
      field('Operating Status', 'Category'),
      field('Principal Water Body', 'Water_body'),
    ],
    aviation: [
      field('Aerodrome Classification', 'Category'),
      field('Region', 'Region'),
    ],
    safety: [
      field('Incident Severity', 'severity'),
      field('Collision Typology', 'incident_type'),
      field('Corridor Classification', 'road_class'),
      { label: 'Observation Year', get: p => /^\d{4}/.test(String(p.date || '')) ? String(p.date).slice(0, 4) : '2025' },
    ],
    freight: [
      field('Weighbridge Operational Status', 'Status'),
      field('Corridor Region', 'Region'),
    ],
    rail: [
      field('Railway Gauge & System', '_transportKind'),
      field('Operational Status', 'Status'),
      field('Railway Corridor', 'Name'),
    ],
  };
  let chartInstances = [];
  let generation = 0;
  const round = value => Math.round(value * 100) / 100;

  function buildSpecs(items, mode) {
    const dimensions = schemas[mode] || [];
    const valid = dimensions.map(dim => {
      const groups = new Map();
      for (const item of items) { const key = dim.get(item.properties || {}); groups.set(key, (groups.get(key) || 0) + 1); }
      return { ...dim, groups };
    }).filter(dim => dim.groups.size > 1);
    return valid.map(dim => ({ dimension: dim, title: dim.label }));
  }

  let currentMode = 'roads';
  function modeLabel() { return currentMode === 'roads' || currentMode === 'rail' ? 'km' : 'assets'; }
  function modeUnit() { return currentMode === 'roads' || currentMode === 'rail' ? 'km' : 'count'; }

  function draw(canvas, spec, items, measure) {
    const values = new Map();
    for (const item of items) {
      const key = spec.dimension.get(item.properties || {});
      values.set(key, (values.get(key) || 0) + measure(item));
    }
    const labels = [...spec.dimension.groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const totals = labels.map(label => round(values.get(label) || 0));
    const timeSeries = spec.dimension.label.includes('Year') || spec.dimension.label.includes('Month');
    const type = timeSeries ? 'line' : labels.length <= 3 ? 'doughnut' : 'bar';
    const circular = type === 'doughnut';
    const horizontal = type === 'bar' && labels.length > 5;
    const colours = labels.map((lbl, i) => {
      const l = lbl.toLowerCase();
      if (l === 'good' || l === 'operational') return '#16A34A';
      if (l === 'satisfactory') return '#0071E3';
      if (l === 'fair' || l === 'marginal' || l.includes('rehabilitation')) return '#D97706';
      if (l === 'poor') return '#EA580C';
      if (l === 'critical') return '#DC2626';
      if (l.includes('construction') || l.includes('planned')) return '#7C3AED';
      return palette[i % palette.length];
    });
    const instance = new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: modeLabel(),
          data: totals,
          backgroundColor: type === 'line' ? '#0071E326' : colours,
          borderColor: type === 'line' ? '#0071E3' : circular ? '#ffffff' : colours,
          borderWidth: type === 'bar' ? 0 : 2,
          borderRadius: type === 'bar' ? 6 : 0,
          pointRadius: type === 'line' ? 4 : 0,
          tension: .32,
          fill: type === 'line'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 },
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: circular, position: 'bottom', labels: { color: '#0F172A', font: { family: 'Arial', size: 11, weight: '600' } } },
          tooltip: { backgroundColor: '#FFFFFF', titleColor: '#0F172A', bodyColor: '#334155', borderColor: '#E2E8F0', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: context => `${round(context.raw).toLocaleString('en-GB')} ${modeLabel()}` } }
        },
        scales: circular ? {} : {
          x: { ticks: { color: '#334155', font: { family: 'Arial', size: 10 }, maxRotation: horizontal ? 0 : 35 }, grid: { color: '#E2E8F0' } },
          y: { beginAtZero: true, ticks: { color: '#334155', font: { family: 'Arial', size: 10 } }, grid: { color: '#E2E8F0' } }
        }
      }
    });
    chartInstances.push(instance);
    return instance;
  }

  function render(mode, catalogueItems, visibleItems, measure) {
    currentMode = mode;
    generation++;
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
    const titleWrap = document.createElement('div');
    const eye = document.createElement('p'); eye.className = 'eyebrow'; eye.textContent = 'DISAGGREGATED LAYER ANALYTICS';
    const title = document.createElement('h2'); title.textContent = `${mode === 'culverts' ? 'Major Culverts (452)' : mode === 'bridges' ? 'Bridges (552)' : mode[0].toUpperCase() + mode.slice(1)} Stratification`;
    titleWrap.append(eye, title);
    heading.append(titleWrap);
    gallery.append(heading);
    const grid = document.createElement('div'); grid.className = 'chart-grid gallery-grid'; gallery.append(grid);

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
          const a = document.createElement('a'); a.href = url; a.download = `mowt-${mode}-${slug}.png`;
          document.body.append(a); a.click(); a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, 'image/png');
      });
      actions.append(unit, download); header.append(label, actions); card.append(header, canvas); grid.append(card);
      draw(canvas, spec, visibleItems, measure);
    });
    return specs.length;
  }
  window.TransportChartGallery = { render };
})();
