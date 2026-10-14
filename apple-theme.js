(function(){
  'use strict';

  // ---------- 1. insight-wall status cards: swap heavy neon wash for a
  // quiet surface + a slim colored accent bar + a recolored icon ----------
  var STATUS_MAP = [
    { match:/rgba\(0,\s*243,\s*255/i,  accent:'#00f3ff' }, // info    (cyan)
    { match:/rgba\(255,\s*153,\s*0/i,  accent:'#ff9900' }, // warning (orange)
    { match:/rgba\(255,\s*51,\s*102/i, accent:'#ff3366' }, // danger  (hot pink/red)
    { match:/rgba\(0,\s*255,\s*153/i,  accent:'#00ff99' }  // success (neon green)
  ];

  function refineInsightPanels(){
    var panels = document.querySelectorAll('.glass-panel:not([data-se-apple])');
    panels.forEach(function(el){
      var style = el.getAttribute('style') || '';
      var hit = null;
      for (var i = 0; i < STATUS_MAP.length; i++){
        if (STATUS_MAP[i].match.test(style)) { hit = STATUS_MAP[i]; break; }
      }
      if (!hit) return; // not a status panel (e.g. sidebar itself also uses .glass-panel)
      el.dataset.seApple = '1';
      el.style.background = 'rgba(255,255,255,.045)';
      el.style.borderTop = '1px solid rgba(255,255,255,.08)';
      el.style.borderRight = '1px solid rgba(255,255,255,.08)';
      el.style.borderBottom = '1px solid rgba(255,255,255,.08)';
      el.style.borderLeft = '3px solid ' + hit.accent;
      var svg = el.querySelector('svg');
      if (svg) { svg.style.stroke = hit.accent; }
    });
  }

  // ---------- 2. conditional-format table cells: tone down heavy washes
  // to a subtler, consistent semantic tint ----------
  function refineTableCells(){
    var cells = document.querySelectorAll('td[style*="rgba"]:not([data-se-apple])');
    cells.forEach(function(td){
      var style = td.getAttribute('style') || '';
      var m = style.match(/background:\s*rgba\(([^)]+)\)/i);
      if (!m) return;
      var parts = m[1].split(',').map(function(s){ return parseFloat(s); });
      var r = parts[0], g = parts[1], b = parts[2];
      var accent = null;
      // classify by hue: reddish, greenish, amber, blue-ish
      if (r > 180 && g < 140 && b < 140) accent = '#ff3366';
      else if (g > 150 && r < 140) accent = '#00ff99';
      else if (r > 200 && g > 120 && g < 210 && b < 90) accent = '#ff9900';
      else if (b > 180 && r < 140) accent = '#00f3ff';
      if (!accent) return;
      td.dataset.seApple = '1';
      var hexToRgb = function(h){ var n = parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
      var rgb = hexToRgb(accent);
      td.style.background = 'rgba(' + rgb.join(',') + ',.14)';
      td.style.borderLeft = '2px solid ' + accent;
      td.style.color = '#ffffff';
    });
  }

  // ---------- 3. sidebar section grouping (visual only, no behavior change) ----------
  var GROUPS = [
    { before:'1.', label:'Overview' },
    { before:'2.', label:'Data & Maps' },
    { before:'4.', label:'Analytics & Insights' },
    { before:'7.', label:'Reference & Reports' },
    { before:'10.', label:'System' }
  ];
  function addSidebarGroups(){
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var items = Array.from(nav.querySelectorAll('.nav-item'));
    GROUPS.forEach(function(g){
      var target = items.find(function(el){
        return el.textContent.trim().indexOf(g.before) === 0;
      });
      if (!target) return;
      var prev = target.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('se-nav-group-label')) return; // already labeled
      var label = document.createElement('div');
      label.className = 'se-nav-group-label';
      label.textContent = g.label;
      label.setAttribute('data-se-apple-label','1');
      target.parentNode.insertBefore(label, target);
    });
  }

  // ---------- 4. System Architecture diagram (react-flow): retint the
  // literal neon rgb() colors the library writes as inline styles on
  // node borders/handles, edge strokes, and the minimap swatches.
  // The pulsing white glow itself is killed in CSS (see apple-theme.css). ----------
  var FLOW_COLOR_MAP = [
    { re:/rgb\(0,\s*243,\s*255\)/gi,  to:'rgb(10, 132, 255)' },  // cyan   -> systemBlue
    { re:/rgb\(0,\s*255,\s*102\)/gi,  to:'rgb(48, 209, 88)' },   // green  -> systemGreen
    { re:/rgb\(255,\s*0,\s*234\)/gi,  to:'rgb(255, 55, 95)' },   // magenta-> systemPink
    { re:/rgb\(255,\s*170,\s*0\)/gi,  to:'rgb(255, 159, 10)' },  // orange -> systemOrange
    { re:/rgb\(255,\s*251,\s*0\)/gi,  to:'rgb(255, 214, 10)' },  // yellow -> systemYellow
    { re:/rgb\(157,\s*0,\s*255\)/gi,  to:'rgb(191, 90, 242)' }   // purple -> systemPurple
  ];
  function remapFlowColors(styleStr){
    for (var i = 0; i < FLOW_COLOR_MAP.length; i++){
      styleStr = styleStr.replace(FLOW_COLOR_MAP[i].re, FLOW_COLOR_MAP[i].to);
    }
    return styleStr;
  }
  function refineFlowDiagram(){
    var els = document.querySelectorAll('.pulse-node, .react-flow__handle, .react-flow__edge-path, .react-flow__minimap rect');
    els.forEach(function(el){
      var s = el.getAttribute('style');
      if (!s) return;
      var ns = remapFlowColors(s);
      if (ns !== s) el.setAttribute('style', ns);
    });
  }

  function runPass(){
    try { refineInsightPanels(); } catch(e){}
    try { refineTableCells(); } catch(e){}
    try { addSidebarGroups(); } catch(e){}
    // refineFlowDiagram() intentionally not called (2026-09-05): diagram already emits its own native neon colors.
  }

  function init(){
    runPass();
    var mo = new MutationObserver(function(){
      clearTimeout(window.__appleThemeT);
      window.__appleThemeT = setTimeout(runPass, 120);
    });
    mo.observe(document.body, { childList:true, subtree:true });
    setInterval(runPass, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__appleTheme = runPass;
})();
