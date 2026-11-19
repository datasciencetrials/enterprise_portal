(() => {
  'use strict';
  const nodes = {
    root: {
      title: 'Unified SQL Database (Central Enterprise Repository)',
      summary: 'Automated weekly synchronisation pipeline feeding all maps, charts, and schedules across 6 Maintenance Regions and 23 Maintenance Stations. Strictly view-only, projected to Vision 2040, with zero user inputs or access-level gates.',
      mode: null
    },
    roads: {
      title: '1. National Road Network (21,284.02 km)',
      summary: 'Paved: 6,406.69 km (30.10%) | Unpaved: 14,877.33 km (69.90%). Functional classes: Class A International Trunk 2,604.65 km, Class B National Trunk 2,845.27 km, Class C Primary 15,689.54 km, Class M Expressways 144.56 km.',
      mode: 'roads'
    },
    condition: {
      title: '2. Pavement Condition & Survey Instrumentation',
      summary: 'Evaluated using MOBICAP(Road condition assesment tool) and ROMDAS(Roughness and rutting machine based testing). National condition: Good 12,610.00 km (59.20%), Fair 7,844.00 km (36.82%), Poor 848.00 km (3.98%).',
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
      summary: 'Decoded MoWT Data Dictionary (FY 2026/27) schedules with separate registers for Bridges (552) and Major Culverts (452), formatted in UK dates (dd/mm/yyyy) and metric units.',
      mode: null
    },
    vision2040: {
      title: 'Vision 2040 Strategic Projections',
      summary: 'Long-term traffic growth, axle load enforcement, and climate resilience projections to 2040, refreshed automatically every week from the Unified SQL Database.',
      mode: 'traffic'
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
