(function(){
  'use strict';

  var SUMMARY_URL = '/enterprise_portal/maintenance_strategy_summary.json';
  var DETAIL_URL = '/enterprise_portal/maintenance_strategy_detail.json';
  var summary = null, detail = null, panelBuilt = false, activeTab = null;
  var searchQuery = { bridges: '', culverts: '', network: '' };

  var TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'condition', label: 'Network Condition' },
    { key: 'plan', label: '5-Year Investment Plan' },
    { key: 'bridges', label: 'Bridges' },
    { key: 'culverts', label: 'Major Culverts' },
    { key: 'assets', label: 'Asset Values' },
  ];

  function esc(s){
    var d = document.createElement('div');
    d.textContent = (s === null || s === undefined) ? '' : String(s);
    return d.innerHTML;
  }
  function n(v, d){
    if (v === null || v === undefined || v === '') return 'Not available';
    if (typeof v !== 'number') return esc(v);
    return v.toLocaleString('en-US', {maximumFractionDigits: d===undefined?1:d});
  }
  function km(v){ return n(v,1) + (v===null||v===undefined?'':' km'); }
  function bn(v){ return v===null||v===undefined?'Not available':'UShs ' + n(v,1) + ' bn'; }

  var REGION_COLORS = {'Central':'#00f3ff','Eastern':'#ff00ea','Northern':'#00ff66','Western':'#fffb00','Southern':'#9d00ff','North Eastern':'#ff6a00'};

  function renderOverview(){
    var k = summary.kpi_summary, reg = summary.network_regional_breakdown, cls = summary.network_by_class;
    var regionRows = Object.keys(reg).map(function(r){
      var v = reg[r];
      return '<tr><td class="ms-name">' + esc(r) + '</td><td class="ms-num">' + km(v.paved_km) + '</td>' +
        '<td class="ms-num">' + km(v.unpaved_km) + '</td><td class="ms-num">' + km(v.total_km) + '</td></tr>';
    }).join('');
    var classRows = cls.map(function(c){
      return '<tr><td class="ms-name">Class ' + esc(c.road_class) + '</td><td>' + esc(c.description) + '</td>' +
        '<td class="ms-num">' + km(c.bituminous_km) + '</td><td class="ms-num">' + km(c.unsealed_km) + '</td>' +
        '<td class="ms-num">' + km(c.total_km) + '</td><td class="ms-num">' + n((c.pct_total_network||0)*100,1) + '%</td></tr>';
    }).join('');
    return (
      '<div class="ms-kpis">' +
        '<div class="glass-card kpi-card ms-kpi" style="border-left-color:#00f3ff"><div class="ms-kpi-label">Total Network</div><div class="ms-kpi-value">' + km(k.total_network_km) + '</div></div>' +
        '<div class="glass-card kpi-card ms-kpi" style="border-left-color:#00ff66"><div class="ms-kpi-label">Paved / Unpaved</div><div class="ms-kpi-value ms-kpi-small">' + km(k.paved_km) + ' / ' + km(k.unpaved_km) + '</div></div>' +
        '<div class="glass-card kpi-card ms-kpi" style="border-left-color:#ff00ea"><div class="ms-kpi-label">Bridges / Major Culverts</div><div class="ms-kpi-value ms-kpi-small">' + n(k.total_bridges,0) + ' / ' + n(k.total_major_culverts,0) + '</div></div>' +
        '<div class="glass-card kpi-card ms-kpi" style="border-left-color:#fffb00"><div class="ms-kpi-label">Total Road Asset Value</div><div class="ms-kpi-value ms-kpi-small">USD ' + n(k.total_asset_value_mn_usd,0) + ' mn</div></div>' +
      '</div>' +
      '<h3 class="ms-section-title">Network by Maintenance Region <span class="ms-count">(all 6 regions, paved/unpaved split)</span></h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Region</th><th>Paved</th><th>Unpaved</th><th>Total</th></tr></thead><tbody>' + regionRows + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Network by Functional Class</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Class</th><th>Description</th><th>Bituminous</th><th>Unsealed</th><th>Total</th><th>% of Network</th></tr></thead><tbody>' + classRows + '</tbody></table></div>' +
      '<div class="ms-footnote">Source: MoWT maintenance strategy planning workbooks (2026 cycle), asset values (corrected/recalculated), FY2025/26 network snapshot. Structure counts and asset values are always reported separately for bridges and major culverts.</div>'
    );
  }

  function renderCondition(){
    var vci = summary.vci_condition_distribution;
    var total = Object.keys(vci).reduce(function(s,k2){return s+vci[k2];},0);
    var order = ['Very Good','Good','Fair','Poor','Very Poor','Committed Project','Not assessed'];
    var keys = order.filter(function(k2){return vci[k2]!==undefined;}).concat(Object.keys(vci).filter(function(k2){return order.indexOf(k2)===-1;}));
    var rows = keys.map(function(k2){
      var v = vci[k2];
      var pct = total ? (v/total*100) : 0;
      return '<tr><td class="ms-name">' + esc(k2) + '</td><td class="ms-num">' + v + '</td>' +
        '<td><div class="ms-bar-track"><div class="ms-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + vciColor(k2) + '"></div></div></td>' +
        '<td class="ms-num">' + pct.toFixed(1) + '%</td></tr>';
    }).join('');
    return (
      '<h3 class="ms-section-title">Pavement Condition Index (VCI) Distribution <span class="ms-count">(' + total + ' assessed links)</span></h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>VCI Rating</th><th>Links</th><th>Share</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="ms-footnote">VCI (Visual Condition Index) rating derived from the national road network condition survey, all 6 maintenance regions.</div>'
    );
  }

  function vciColor(r){
    var m = {'Very Good':'#00ff66','Good':'#00f3ff','Fair':'#fffb00','Poor':'#ff6a00','Very Poor':'#ff0044','Committed Project':'#9d00ff','Not assessed':'#6b7688'};
    return m[r] || '#00f3ff';
  }

  function renderPlan(){
    var annual = summary.investment_plan_annual, mix = summary.intervention_mix_summary, rates = summary.intervention_rate_benchmarks;
    var annualRows = annual.map(function(r){
      return '<tr><td class="ms-name">' + esc(r.financial_year) + '</td><td class="ms-num">' + n(r.links_count,0) + '</td>' +
        '<td class="ms-num">' + bn(r.programme_cost_bn_ushs) + '</td><td class="ms-num">' + bn(r.asset_value_at_risk_bn_ushs) + '</td>' +
        '<td class="ms-num">' + bn(r.funding_gap_vs_baseline_bn_ushs) + '</td></tr>';
    }).join('');
    var mixRows = mix.map(function(r){
      return '<tr><td class="ms-name">' + esc(r.intervention) + '</td><td class="ms-num">' + n(r.links_count,0) + '</td>' +
        '<td class="ms-num">' + km(r.length_km) + '</td><td class="ms-num">' + bn(r.cost_bn_ushs) + '</td></tr>';
    }).join('');
    var rateRows = rates.map(function(r){
      return '<tr><td>' + esc(r.surface_type) + '</td><td>' + esc(r.intervention) + '</td>' +
        '<td class="ms-num">' + n(r.recommended_rate_bn_ushs_per_km,3) + ' bn/km</td>' +
        '<td>' + esc(r.accuracy_band) + '</td></tr>';
    }).join('');
    return (
      '<h3 class="ms-section-title">5-Year Investment Plan Summary <span class="ms-count">(FY26/27 &ndash; FY30/31, paved network)</span></h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Financial Year</th><th>Links</th><th>Programme Cost</th><th>Asset Value at Risk</th><th>Funding Gap vs Baseline</th></tr></thead><tbody>' + annualRows + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Intervention Mix (5-Year Total)</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Intervention</th><th>Links</th><th>Length</th><th>Cost</th></tr></thead><tbody>' + mixRows + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Recommended Unit Intervention Rates</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Surface</th><th>Intervention</th><th>Rate</th><th>Confidence</th></tr></thead><tbody>' + rateRows + '</tbody></table></div>' +
      '<div class="ms-footnote">Programme costs and funding gap figures in UShs billions. Rate confidence bands reflect direct-vs-assumption basis in the source workbook.</div>'
    );
  }

  function renderAssets(){
    var trend = summary.asset_value_trend, struct = summary.structures_summary, reg = summary.structures_regional_split;
    var paved = trend.filter(function(r){return r.surface_type==='Paved';});
    var unpaved = trend.filter(function(r){return r.surface_type==='Unpaved';});
    function trendRows(rows){
      return rows.map(function(r){
        return '<tr><td>' + esc(r.financial_year) + '</td><td class="ms-num">' + km(r.length_km) + '</td>' +
          '<td class="ms-num">USD ' + n(r.asset_value_mn_usd,1) + ' mn</td></tr>';
      }).join('');
    }
    var structRows = struct.map(function(r){
      return '<tr><td class="ms-name">' + esc(r.structure_type) + '</td><td class="ms-num">' + n(r.count,0) + '</td>' +
        '<td class="ms-num">USD ' + n(r.asset_value_mn_usd,0) + ' mn</td>' +
        '<td class="ms-num">' + n(r.paved_count,0) + '</td><td class="ms-num">' + n(r.unpaved_count,0) + '</td></tr>';
    }).join('');
    var regRows = reg.map(function(r){
      return '<tr><td class="ms-name">' + esc(r.maintenance_region) + '</td><td class="ms-num">' + n(r.bridges_count,0) + '</td>' +
        '<td class="ms-num">' + n(r.major_culverts_count,0) + '</td><td class="ms-num">' + n(r.total_structures,0) + '</td></tr>';
    }).join('');
    return (
      '<h3 class="ms-section-title">Road Asset Value Trend &mdash; Paved</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Financial Year</th><th>Length</th><th>Asset Value</th></tr></thead><tbody>' + trendRows(paved) + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Road Asset Value Trend &mdash; Unpaved</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Financial Year</th><th>Length</th><th>Asset Value</th></tr></thead><tbody>' + trendRows(unpaved) + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Structures &mdash; Bridges &amp; Major Culverts <span class="ms-count">(always reported separately)</span></h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Structure</th><th>Count</th><th>Asset Value</th><th>On Paved</th><th>On Unpaved</th></tr></thead><tbody>' + structRows + '</tbody></table></div>' +
      '<h3 class="ms-section-title">Structures by Maintenance Region</h3>' +
      '<div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>Region</th><th>Bridges</th><th>Major Culverts</th><th>Total</th></tr></thead><tbody>' + regRows + '</tbody></table></div>'
    );
  }

  function structTable(rows, cols, emptyMsg){
    if (!rows.length) return '<div class="ms-empty">' + esc(emptyMsg) + '</div>';
    var head = '<tr>' + cols.map(function(c){return '<th>'+esc(c.label)+'</th>';}).join('') + '</tr>';
    var body = rows.map(function(r){
      return '<tr>' + cols.map(function(c){
        var v = r[c.key];
        var cls = c.name ? ' class="ms-name"' : (c.num ? ' class="ms-num"' : '');
        return '<td' + cls + '>' + esc(c.fmt ? c.fmt(v) : (v===null||v===undefined?'Not recorded':v)) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="ms-table-wrap"><table class="ms-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function condDist(dist){
    var order = ['Good','Satisfactory','Marginal','Poor','Critical','Not recorded'];
    var keys = order.filter(function(k2){return dist[k2]!==undefined;});
    var total = Object.keys(dist).reduce(function(s,k2){return s+dist[k2];},0);
    return '<div class="ms-kpis ms-kpis-cond">' + keys.map(function(k2){
      var pct = total ? (dist[k2]/total*100) : 0;
      return '<div class="glass-card kpi-card ms-kpi" style="border-left-color:' + condColor(k2) + '"><div class="ms-kpi-label">' + esc(k2) + '</div><div class="ms-kpi-value">' + dist[k2] + '<span class="ms-kpi-pct"> (' + pct.toFixed(0) + '%)</span></div></div>';
    }).join('') + '</div>';
  }
  function condColor(c){
    var m = {'Good':'#00ff66','Satisfactory':'#00f3ff','Marginal':'#fffb00','Poor':'#ff6a00','Critical':'#ff0044','Not recorded':'#6b7688'};
    return m[c] || '#00f3ff';
  }

  function renderBridges(){
    var dist = summary.bridge_condition_distribution;
    var html = '<h3 class="ms-section-title">Bridge Condition Distribution <span class="ms-count">(' + summary.counts.bridges + ' bridges)</span></h3>' + condDist(dist);
    html += '<div class="ms-search-row"><input type="text" id="ms-search-bridges" class="ms-search" placeholder="Filter by bridge name, road link, or condition…" /></div>';
    html += '<div id="ms-bridges-table"><div class="ms-loading">Loading bridge register…</div></div>';
    return html;
  }
  function renderCulverts(){
    var dist = summary.culvert_condition_distribution;
    var html = '<h3 class="ms-section-title">Major Culvert Condition Distribution <span class="ms-count">(' + summary.counts.major_culverts + ' culverts &mdash; reported separately from bridges)</span></h3>' + condDist(dist);
    html += '<div class="ms-search-row"><input type="text" id="ms-search-culverts" class="ms-search" placeholder="Filter by river, road, or condition…" /></div>';
    html += '<div id="ms-culverts-table"><div class="ms-loading">Loading culvert register…</div></div>';
    return html;
  }

  function filterRows(rows, q, fields){
    if (!q) return rows;
    return rows.filter(function(r){
      return fields.some(function(f){ return (r[f]!==null && r[f]!==undefined) && String(r[f]).toLowerCase().indexOf(q) !== -1; });
    });
  }

  function ensureDetail(cb){
    if (detail) { cb(); return; }
    fetch(DETAIL_URL).then(function(r){ return r.json(); }).then(function(d){ detail = d; cb(); })
      .catch(function(err){ console.error('Maintenance Strategy: failed to load detail data', err); });
  }

  function fillBridgesTable(){
    var rows = filterRows(detail.bridges, searchQuery.bridges, ['bridge_name','link_id','condition','type_crossing']);
    var html = structTable(rows, [
      {key:'bridge_name', label:'Bridge Name', name:true},
      {key:'link_id', label:'Road Link'},
      {key:'condition', label:'Condition'},
      {key:'coordinate_e', label:'Longitude', num:true, fmt:function(v){return v===null?'Not available':v.toFixed(4);}},
      {key:'coordinate_s', label:'Latitude', num:true, fmt:function(v){return v===null?'Not available':v.toFixed(4);}},
    ], 'No matching bridges.');
    document.getElementById('ms-bridges-table').innerHTML = html + '<div class="ms-footnote">Showing ' + rows.length + ' of ' + detail.bridges.length + ' bridges.</div>';
  }
  function fillCulvertsTable(){
    var rows = filterRows(detail.major_culverts, searchQuery.culverts, ['river','road_no','condition','link_id']);
    var html = structTable(rows, [
      {key:'river', label:'River', name:true},
      {key:'road_no', label:'Road'},
      {key:'link_id', label:'Section / Link'},
      {key:'condition', label:'Condition'},
    ], 'No matching major culverts.');
    document.getElementById('ms-culverts-table').innerHTML = html + '<div class="ms-footnote">Showing ' + rows.length + ' of ' + detail.major_culverts.length + ' major culverts.</div>';
  }

  function afterRenderTab(){
    if (activeTab === 'bridges'){
      ensureDetail(function(){
        fillBridgesTable();
        var el = document.getElementById('ms-search-bridges');
        if (el) el.addEventListener('input', function(e){ searchQuery.bridges = e.target.value.trim().toLowerCase(); fillBridgesTable(); });
      });
    } else if (activeTab === 'culverts'){
      ensureDetail(function(){
        fillCulvertsTable();
        var el = document.getElementById('ms-search-culverts');
        if (el) el.addEventListener('input', function(e){ searchQuery.culverts = e.target.value.trim().toLowerCase(); fillCulvertsTable(); });
      });
    }
  }

  function renderTabContent(tab){
    switch(tab){
      case 'overview': return renderOverview();
      case 'condition': return renderCondition();
      case 'plan': return renderPlan();
      case 'bridges': return renderBridges();
      case 'culverts': return renderCulverts();
      case 'assets': return renderAssets();
      default: return '';
    }
  }

  function renderTabButtons(){
    return TABS.map(function(t){
      var cls = 'ms-tab-btn' + (t.key === activeTab ? ' ms-tab-btn-active' : '');
      return '<button class="' + cls + '" data-tab="' + t.key + '">' + esc(t.label) + '</button>';
    }).join('');
  }

  function refreshTabButtons(){
    var row = document.getElementById('ms-tab-buttons');
    if (row) row.innerHTML = renderTabButtons();
    bindTabButtons();
  }
  function refreshTabBody(){
    var body = document.getElementById('ms-tab-body');
    if (body) body.innerHTML = renderTabContent(activeTab);
    afterRenderTab();
  }
  function bindTabButtons(){
    var row = document.getElementById('ms-tab-buttons');
    if (!row) return;
    Array.from(row.querySelectorAll('.ms-tab-btn')).forEach(function(btn){
      btn.addEventListener('click', function(){
        activeTab = btn.getAttribute('data-tab');
        refreshTabButtons();
        refreshTabBody();
      });
    });
  }

  function renderPanel(){
    activeTab = 'overview';
    var root = document.getElementById('ms-projects-root');
    root.innerHTML =
      '<div class="ms-overlay" id="ms-overlay">' +
        '<div class="ms-panel">' +
          '<div class="ms-header">' +
            '<div>' +
              '<h2>National Road Maintenance Strategy</h2>' +
              '<div class="ms-subtitle">' + esc(summary.meta.note) + '</div>' +
            '</div>' +
            '<button class="ms-close" id="ms-close" aria-label="Close">&#10005;</button>' +
          '</div>' +
          '<div class="ms-tab-row" id="ms-tab-buttons">' + renderTabButtons() + '</div>' +
          '<div class="ms-scroll"><div id="ms-tab-body">' + renderTabContent(activeTab) + '</div></div>' +
        '</div>' +
      '</div>';
    document.getElementById('ms-close').addEventListener('click', closePanel);
    document.getElementById('ms-overlay').addEventListener('click', function(e){
      if (e.target.id === 'ms-overlay') closePanel();
    });
    bindTabButtons();
    afterRenderTab();
    panelBuilt = true;
  }

  function openPanel(){
    if (!document.getElementById('ms-projects-root')){
      var div = document.createElement('div');
      div.id = 'ms-projects-root';
      document.body.appendChild(div);
    }
    if (summary){
      if (!panelBuilt) renderPanel();
      document.getElementById('ms-overlay').classList.add('ms-open');
      document.body.style.overflow = 'hidden';
      return;
    }
    fetch(SUMMARY_URL).then(function(r){ return r.json(); }).then(function(data){
      summary = data;
      renderPanel();
      document.getElementById('ms-overlay').classList.add('ms-open');
      document.body.style.overflow = 'hidden';
    }).catch(function(err){
      console.error('Maintenance Strategy: failed to load summary data', err);
    });
  }

  function closePanel(){
    var ov = document.getElementById('ms-overlay');
    if (ov) ov.classList.remove('ms-open');
    document.body.style.overflow = '';
  }

  function addNavItem(){
    var nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('ms-nav-item')) return;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'ms-nav-item';
    item.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#00ff66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench">' +
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
      '<span>12. Maintenance Strategy</span>';
    item.addEventListener('click', openPanel);
    nav.appendChild(item);
  }

  function init(){ addNavItem(); }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  var mo = new MutationObserver(function(){ addNavItem(); });
  mo.observe(document.body, {childList:true, subtree:true});

  window.__maintStrategy = { open: openPanel, close: closePanel };
})();
