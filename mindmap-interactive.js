(() => {
  'use strict';
  const nodes = {
    root: {
      title: 'Published Mapped Exports',
      summary: 'Approved published snapshots feed the browser map, charts and schedules. A controlled weekly check compares them with the Unified SQL Database. Database and schema access are not available to the browser.',
      mode: null
    },
    roads: {
      title: '1. Mapped National Roads (21,284.02 km)',
      summary: 'Paved: 6,406.69 km (30.10%) | Unpaved: 14,877.33 km (69.90%). National Roads length is 21,302 km for FY 2025-26 and 21,284 km for FY 2026-27; the current mapped layer totals 21,284.02 km.',
      mode: 'roads'
    },
    condition: {
      title: '2. Pavement Condition & Survey Instrumentation',
      summary: 'Published mapped condition fields associated with MOBICAP(Road condition assesment tool) and ROMDAS(Roughness and rutting machine based testing): Good 12,608.66 km, Fair 7,824.14 km and Poor 851.22 km.',
      mode: 'roads'
    },
    structures: {
      title: '3. National Bridges (552) & Major Culverts (452)',
      summary: 'Bridges (552): 247 Good, 71 Satisfactory, 162 Marginal, 52 Poor, 13 Critical, 7 Under Construction (including B162 Atari Bridge). Major Culverts (452): 403 Good, 39 Satisfactory, 4 Marginal, 1 Poor, 4 Critical, 1 Under Construction.',
      mode: 'bridges'
    },
    multimodal: {
      title: '4. Multi-Modal Transport Infrastructure',
      summary: 'Rail: 1,266.00 km Meter-Gauge (269.00 km Operational, 997.00 km Rehabilitation) and 272.00 km Standard-Gauge alignment. Plus 298 Traffic Count Stations, 20 Ferry Crossings, 13 Aviation Aerodromes, and 21 Weighbridges.',
      mode: 'rail'
    },
    cartography: {
      title: 'Imagery Hybrid GIS Cartography',
      summary: 'Esri World Imagery + Hybrid Labels (World_Boundaries_and_Places) in WGS 84 decimal degrees (EPSG:4326). Paved roads render solid at full width; unpaved roads render in matching class colour at 0.58x width with dotted styling.',
      mode: 'roads'
    },
    analytics: {
      title: 'Interactive Analytics & Temporal Cohorts',
      summary: 'Multi-tier charts disaggregated by Surface Type, Functional Class, Maintenance Region, and Financial Year with downloadable PNG charts and CSV schedules.',
      mode: null
    },
    registers: {
      title: 'National Asset Register Schedules',
      summary: 'Separate mapped registers for Bridges (552) and Major Culverts (452), with decoded labels, explicit data-quality states and metric units.',
      mode: null
    },
    gaps: {
      title: 'Coverage and Data Gaps',
      summary: 'National Roads length is reported as a financial-year time series: 21,302 km for FY 2025-26 and 21,284 km for FY 2026-27. Live database tables, current traffic, speed, current operations and automated refresh are not verified.',
      mode: null
    }
  };

  function init() {
    const svg = document.querySelector('#platform-mindmap .mindmap-svg');
    const detail = document.getElementById('mindmap-detail');
    if (!svg || !detail) return;
    const titleEl = detail.querySelector('h3');
    const descEl = detail.querySelector('p');
    const actionBtn = detail.querySelector('[data-mindmap-action]');
    const allGroups = [...svg.querySelectorAll('g[data-node]')];

    function select(key) {
      const info = nodes[key] || nodes.root;
      allGroups.forEach(g => {
        const match = g.dataset.node === key;
        g.classList.toggle('is-selected', match);
        g.style.opacity = !key || match ? '1' : '0.68';
      });
      if (titleEl) titleEl.textContent = info.title;
      if (descEl) descEl.textContent = info.summary;
      if (actionBtn) {
        const modeBtn = info.mode ? document.querySelector(`.section-tabs button[data-mode="${info.mode}"]`) : null;
        actionBtn.hidden = !modeBtn;
        actionBtn.dataset.targetMode = info.mode || '';
      }
    }

    allGroups.forEach(g => {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.addEventListener('click', () => select(g.dataset.node));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(g.dataset.node);
        }
      });
    });

    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        const mode = actionBtn.dataset.targetMode;
        const btn = mode && document.querySelector(`.section-tabs button[data-mode="${mode}"]`);
        if (btn) {
          btn.click();
          document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    select('root');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
