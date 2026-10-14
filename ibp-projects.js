(function(){
  'use strict';

  var DATA_URL = '/enterprise_portal/geo/ibp_road_projects_by_year.json';
  var cache = null;
  var panelBuilt = false;
  var activeYear = null;
  var searchQuery = '';

  function fmtBn(v){
    if (v === null || v === undefined) return 'Not available';
    return v.toLocaleString('en-US', {maximumFractionDigits: 1}) + ' bn';
  }

  function esc(s){
    var d = document.createElement('div');
    d.textContent = (s === null || s === undefined) ? '' : String(s);
    return d.innerHTML;
  }

  function buildRows(rows){
    if (!rows.length){
      return '<tr><td colspan="5" class="ibp-empty">No matching projects.</td></tr>';
    }
    return rows.map(function(p){
      var timeline = (p.start_date || '?') + ' → ' + (p.end_date || '?');
      return '<tr>' +
        '<td class="ibp-name">' + esc(p.name) + '</td>' +
        '<td>' + esc(p.agency) + '</td>' +
        '<td>' + esc(p.location) + '</td>' +
        '<td class="ibp-num">' + esc(fmtBn(p.value_bn_ushs)) + '</td>' +
        '<td>' + esc(timeline) + '</td>' +
        '</tr>';
    }).join('');
  }

  function filterRows(rows){
    if (!searchQuery) return rows;
    var q = searchQuery;
    return rows.filter(function(p){
      return (p.name + ' ' + p.agency + ' ' + p.location).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderYearButtons(data){
    return data.years.map(function(y){
      var cls = 'ibp-year-btn' + (y === activeYear ? ' ibp-year-btn-active' : '');
      return '<button class="' + cls + '" data-year="' + esc(y) + '">' + esc(y) + '</button>';
    }).join('');
  }

  function renderYearContent(data, year){
    var yearData = data.by_year[year];
    var s = data.summary_by_year[year];
    var roads = filterRows(yearData.roads);
    var bridges = filterRows(yearData.bridges);

    return (
      '<div class="ibp-kpis">' +
        '<div class="glass-card kpi-card ibp-kpi" style="border-left-color:#00f3ff"><div class="ibp-kpi-label">Road Projects</div><div class="ibp-kpi-value">' + s.road_projects + '</div></div>' +
        '<div class="glass-card kpi-card ibp-kpi" style="border-left-color:#ff00ea"><div class="ibp-kpi-label">Bridge &amp; Major Culvert Projects</div><div class="ibp-kpi-value">' + s.bridge_major_culvert_projects + '</div></div>' +
        '<div class="glass-card kpi-card ibp-kpi" style="border-left-color:#00ff66"><div class="ibp-kpi-label">Combined Value (' + esc(year) + ')</div><div class="ibp-kpi-value">UShs ' + fmtBn(s.combined_value_bn_ushs) + '</div></div>' +
        '<div class="glass-card kpi-card ibp-kpi" style="border-left-color:#fffb00"><div class="ibp-kpi-label">UNRA / MoWT Projects</div><div class="ibp-kpi-value ibp-kpi-small">' + s.unra_projects + ' / ' + s.mowt_projects + '</div></div>' +
      '</div>' +

      '<h3 class="ibp-section-title">Road Projects <span class="ibp-count">(' + roads.length + ')</span></h3>' +
      '<div class="ibp-table-wrap">' +
        '<table class="ibp-table"><thead><tr>' +
          '<th>Project</th><th>Implementing Agency</th><th>Location</th><th>Total Value (UShs)</th><th>Timeline</th>' +
        '</tr></thead><tbody>' + buildRows(roads) + '</tbody></table>' +
      '</div>' +

      '<h3 class="ibp-section-title">Bridge &amp; Major Culvert Projects <span class="ibp-count">(' + bridges.length + ')</span></h3>' +
      '<div class="ibp-table-wrap">' +
        '<table class="ibp-table"><thead><tr>' +
          '<th>Project</th><th>Implementing Agency</th><th>Location</th><th>Total Value (UShs)</th><th>Timeline</th>' +
        '</tr></thead><tbody>' + buildRows(bridges) + '</tbody></table>' +
      '</div>'
    );
  }

  function refreshYearContent(data){
    var body = document.getElementById('ibp-year-body');
    if (body) body.innerHTML = renderYearContent(data, activeYear);
  }

  function refreshYearButtons(data){
    var row = document.getElementById('ibp-year-buttons');
    if (row) row.innerHTML = renderYearButtons(data);
    bindYearButtons(data);
  }

  function bindYearButtons(data){
    var row = document.getElementById('ibp-year-buttons');
    if (!row) return;
    Array.from(row.querySelectorAll('.ibp-year-btn')).forEach(function(btn){
      btn.addEventListener('click', function(){
        activeYear = btn.getAttribute('data-year');
        refreshYearButtons(data);
        refreshYearContent(data);
      });
    });
  }

  function renderPanel(data){
    activeYear = data.years[data.years.length - 1]; // default to most recent PIP year
    var root = document.getElementById('ibp-projects-root');
    root.innerHTML =
      '<div class="ibp-overlay" id="ibp-overlay">' +
        '<div class="ibp-panel">' +
          '<div class="ibp-header">' +
            '<div>' +
              '<h2>IBP Uganda — National Road &amp; Bridge Investment Projects</h2>' +
              '<div class="ibp-subtitle">Ministry of Finance, Planning and Economic Development — Integrated Bank of Projects (IBP), Public Investment Plan documents by fiscal year</div>' +
            '</div>' +
            '<button class="ibp-close" id="ibp-close" aria-label="Close">✕</button>' +
          '</div>' +

          '<div class="ibp-year-row" id="ibp-year-buttons">' + renderYearButtons(data) + '</div>' +

          '<div class="ibp-search-row">' +
            '<input type="text" id="ibp-search" class="ibp-search" placeholder="Filter by project, agency, or location…" />' +
          '</div>' +

          '<div class="ibp-scroll">' +
            '<div id="ibp-year-body">' + renderYearContent(data, activeYear) + '</div>' +
            '<div class="ibp-footnote">Figures are total lifecycle project values as published in the selected fiscal year’s Public Investment Plan, not annual budget allocations. The same project can appear across multiple fiscal years with updated figures as it progresses.</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('ibp-close').addEventListener('click', closePanel);
    document.getElementById('ibp-overlay').addEventListener('click', function(e){
      if (e.target.id === 'ibp-overlay') closePanel();
    });
    document.getElementById('ibp-search').addEventListener('input', function(e){
      searchQuery = e.target.value.trim().toLowerCase();
      refreshYearContent(data);
    });
    bindYearButtons(data);

    panelBuilt = true;
  }

  function openPanel(){
    if (!document.getElementById('ibp-projects-root')){
      var div = document.createElement('div');
      div.id = 'ibp-projects-root';
      document.body.appendChild(div);
    }
    if (cache){
      if (!panelBuilt) renderPanel(cache);
      document.getElementById('ibp-overlay').classList.add('ibp-open');
      document.body.style.overflow = 'hidden';
      return;
    }
    fetch(DATA_URL).then(function(r){ return r.json(); }).then(function(data){
      cache = data;
      renderPanel(data);
      document.getElementById('ibp-overlay').classList.add('ibp-open');
      document.body.style.overflow = 'hidden';
    }).catch(function(err){
      console.error('IBP projects: failed to load data', err);
    });
  }

  function closePanel(){
    var ov = document.getElementById('ibp-overlay');
    if (ov) ov.classList.remove('ibp-open');
    document.body.style.overflow = '';
  }

  function addNavItem(){
    var nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('ibp-nav-item')) return;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'ibp-nav-item';
    item.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#9d00ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark">' +
      '<line x1="3" x2="21" y1="22" y2="22"></line><line x1="6" x2="6" y1="18" y2="11"></line>' +
      '<line x1="10" x2="10" y1="18" y2="11"></line><line x1="14" x2="14" y1="18" y2="11"></line>' +
      '<line x1="18" x2="18" y1="18" y2="11"></line><polygon points="12 2 20 7 4 7"></polygon></svg>' +
      '<span>11. IBP Investment Projects</span>';
    item.addEventListener('click', openPanel);
    nav.appendChild(item);
  }

  function init(){
    addNavItem();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  var mo = new MutationObserver(function(){ addNavItem(); });
  mo.observe(document.body, {childList:true, subtree:true});

  window.__ibpProjects = { open: openPanel, close: closePanel };
})();
