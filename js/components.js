// Shared UI component builders. Vanilla JS, no framework/build step.
// All functions return DOM nodes or HTML strings as noted.

const RENDERERS = {}; // populated by section scripts: RENDERERS.overview = async (container) => {...}
const NEON = ['#00e5ff','#ff00c8','#9d00ff','#00ff85','#fff500','#ff7a00','#2979ff','#ff2d78'];
const INK  = ['#0089a8','#b8008f','#6d1fd1','#00944f','#93790a','#c85400','#1a56cc','#c30057'];

function fmtNum(n, digits=0){
  if(n===null || n===undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', {maximumFractionDigits:digits, minimumFractionDigits:digits});
}
function fmtKm(n){ return n===null||n===undefined ? '—' : fmtNum(n,1) + ' km'; }
function esc(s){ return (s===null||s===undefined) ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k==='class') node.className = v;
    else if(k==='html') node.innerHTML = v;
    else if(k.startsWith('on') && typeof v==='function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if(c===null||c===undefined) return;
    node.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  });
  return node;
}

/* ---------------- searchable select (standing platform rule: every dropdown
   is a search box, not a plain native <select> — restored after the light
   rebuild reverted table filters to plain selects) ---------------- */
function searchableSelect(opts){
  // opts: {label, options:[string], onChange(value)}
  const wrap = el('div',{class:'search-select'});
  const input = document.createElement('input');
  input.className = 'search-select-input';
  input.placeholder = 'All '+opts.label;
  input.setAttribute('aria-label', opts.label+' filter');
  wrap.appendChild(input);
  const panel = el('div',{class:'search-select-panel'});
  panel.style.display = 'none';
  wrap.appendChild(panel);

  function optionsFor(q){
    const items = ['All '+opts.label, ...opts.options];
    if(!q) return items;
    const ql = q.toLowerCase();
    return items.filter(o => o.toLowerCase().includes(ql));
  }
  function openPanel(){
    const items = optionsFor(input.value);
    panel.innerHTML = '';
    if(!items.length){
      panel.appendChild(el('div',{class:'search-select-empty'}, 'No matches'));
    } else {
      items.forEach(o=>{
        const isAll = o==='All '+opts.label;
        const row = el('div',{class:'search-select-opt'}, o);
        row.addEventListener('mousedown', e=>{
          e.preventDefault();
          input.value = isAll ? '' : o;
          panel.style.display = 'none';
          opts.onChange(isAll ? 'All' : o);
        });
        panel.appendChild(row);
      });
    }
    panel.style.display = 'block';
  }
  input.addEventListener('focus', openPanel);
  input.addEventListener('input', openPanel);
  input.addEventListener('blur', ()=> setTimeout(()=>{ panel.style.display='none'; }, 150));
  input.addEventListener('keydown', e=>{ if(e.key==='Escape'){ panel.style.display='none'; input.blur(); } });
  return wrap;
}

/* ---------------- KPI tiles ---------------- */
const REDUCE_MOTION = typeof window!=='undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function kpiGrid(items){
  // items: [{label, value, unit, accent, delta}]
  const grid = el('div',{class:'kpi-grid'});
  items.forEach(it=>{
    const tile = el('div',{class:'kpi-tile', style:`--accent:${it.accent||NEON[0]}`});
    tile.appendChild(el('div',{class:'kpi-label'}, it.label));

    // Animate a count-up for plain numeric values (fmtNum output: digits, commas, optional one decimal group).
    const raw = it.value;
    const isNumeric = typeof raw==='string' && /^-?[\d,]+(\.\d+)?$/.test(raw.trim());
    const target = isNumeric ? parseFloat(raw.replace(/,/g,'')) : null;
    const decimals = isNumeric && raw.includes('.') ? raw.split('.')[1].length : 0;
    const numSpan = document.createElement('span');
    numSpan.textContent = target===null ? raw : fmtNum(0, decimals);
    const valueEl = el('div',{class:'kpi-value'}, [numSpan, it.unit?el('small',{},' '+it.unit):null]);
    tile.appendChild(valueEl);
    if(it.delta) tile.appendChild(el('div',{class:'kpi-delta', style:`color:${it.deltaColor||'var(--text-secondary)'}`}, it.delta));
    grid.appendChild(tile);

    if(target!==null && !REDUCE_MOTION){
      const dur = 700, t0 = performance.now();
      (function tick(now){
        const p = Math.min(1, (now-t0)/dur);
        const eased = 1-Math.pow(1-p,3); // easeOutCubic
        numSpan.textContent = fmtNum(target*eased, decimals);
        if(p<1) requestAnimationFrame(tick);
      })(t0);
    }
  });
  return grid;
}

/* ---------------- condition badge ---------------- */
function conditionBadge(cond){
  if(!cond) return el('span',{class:'badge badge-neutral'}, 'Not assessed');
  const c = String(cond).toLowerCase();
  let cls='badge-neutral';
  if(['good','very good','excellent'].includes(c)) cls='badge-good';
  else if(['fair','satisfactory','moderate'].includes(c)) cls='badge-fair';
  else if(['poor','marginal'].includes(c)) cls='badge-poor';
  else if(['critical','very poor'].includes(c)) cls='badge-critical';
  return el('span',{class:'badge '+cls}, cond);
}

/* ---------------- intervention-priority badge (Low/Moderate/High/Critical quartile band —
   a distinct scale from the pavement-condition badge above, never conflate the two) ---------------- */
function priorityBadge(band){
  if(!band) return el('span',{class:'badge badge-neutral'}, 'Not scored');
  const cls = { Low:'badge-good', Moderate:'badge-fair', High:'badge-poor', Critical:'badge-critical' }[band] || 'badge-neutral';
  return el('span',{class:'badge '+cls}, band);
}

/* ---------------- Data table: sortable, searchable, paginated ---------------- */
function dataTable(opts){
  // opts: {columns:[{key,label,align,fmt,sortable}], rows:[obj], pageSize, searchKeys, filters:[{label,key,options}], caption}
  const wrap = el('div',{});
  const toolbar = el('div',{class:'table-toolbar'});
  const searchBox = el('div',{class:'table-search'}, [
    el('span',{},'🔍'),
    (()=>{ const i=document.createElement('input'); i.placeholder='Search '+(opts.caption||'records')+'…'; return i; })()
  ]);
  const searchInput = searchBox.querySelector('input');
  toolbar.appendChild(searchBox);

  const filterState = {};
  (opts.filters||[]).forEach(f=>{
    filterState[f.key] = 'All';
    const combo = searchableSelect({ label: f.label, options: f.options, onChange:(val)=>{ filterState[f.key]=val; state.page=0; render(); } });
    toolbar.appendChild(combo);
  });

  const countLabel = el('span',{class:'table-count'});
  toolbar.appendChild(countLabel);
  wrap.appendChild(toolbar);

  const tableWrap = el('div',{class:'table-wrap'});
  const table = el('table',{class:'data-table'});
  const thead = el('thead');
  const trh = el('tr');
  opts.columns.forEach(col=>{
    const th = el('th',{class: col.align==='num'?'num':''}, [col.label, el('span',{class:'arrow'},'')]);
    if(col.sortable!==false) th.addEventListener('click', ()=>{
      if(state.sortKey===col.key) state.sortDir = state.sortDir==='asc'?'desc':'asc';
      else { state.sortKey = col.key; state.sortDir='asc'; }
      render();
    });
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = el('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  const pager = el('div',{class:'pager'});
  tableWrap.appendChild(pager);
  wrap.appendChild(tableWrap);

  const pageSize = opts.pageSize || 25;
  const state = { page:0, sortKey:null, sortDir:'asc' };

  function getFiltered(){
    let rows = opts.rows;
    const q = (searchInput.value||'').trim().toLowerCase();
    if(q && opts.searchKeys){
      rows = rows.filter(r => opts.searchKeys.some(k => String(r[k]??'').toLowerCase().includes(q)));
    }
    (opts.filters||[]).forEach(f=>{
      if(filterState[f.key] && filterState[f.key]!=='All'){
        rows = rows.filter(r => String(r[f.key]) === filterState[f.key]);
      }
    });
    if(state.sortKey){
      rows = rows.slice().sort((a,b)=>{
        let av=a[state.sortKey], bv=b[state.sortKey];
        if(typeof av==='string') av=av.toLowerCase();
        if(typeof bv==='string') bv=bv.toLowerCase();
        if(av===null||av===undefined) av = typeof bv==='number' ? -Infinity : '';
        if(bv===null||bv===undefined) bv = typeof av==='number' ? -Infinity : '';
        if(av<bv) return state.sortDir==='asc'?-1:1;
        if(av>bv) return state.sortDir==='asc'?1:-1;
        return 0;
      });
    }
    return rows;
  }

  function render(){
    const filtered = getFiltered();
    countLabel.textContent = fmtNum(filtered.length) + ' ' + (opts.caption||'rows');
    const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize));
    state.page = Math.min(state.page, totalPages-1);
    const start = state.page*pageSize;
    const pageRows = filtered.slice(start, start+pageSize);

    tbody.innerHTML='';
    if(pageRows.length===0){
      tbody.appendChild(el('tr',{},el('td',{colspan:opts.columns.length, style:'text-align:center;color:var(--text-tertiary);padding:26px;'},'No matching records')));
    }
    pageRows.forEach(r=>{
      const tr = el('tr');
      opts.columns.forEach(col=>{
        const raw = r[col.key];
        const content = col.render ? col.render(raw, r) : (col.fmt ? col.fmt(raw) : (raw===null||raw===undefined?'—':raw));
        const td = el('td',{class: col.align==='num'?'num':''});
        if(content instanceof Node) td.appendChild(content); else td.innerHTML = content;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // sort arrow indicators
    [...trh.children].forEach((th,i)=>{
      const arrow = th.querySelector('.arrow');
      if(!arrow) return;
      arrow.textContent = opts.columns[i].key===state.sortKey ? (state.sortDir==='asc'?'▲':'▼') : '';
    });

    pager.innerHTML='';
    pager.appendChild(el('span',{}, `Page ${state.page+1} of ${totalPages}`));
    const prev = el('button',{disabled: state.page===0 ? 'true':null}, '‹');
    prev.disabled = state.page===0;
    prev.addEventListener('click', ()=>{ state.page--; render(); });
    const next = el('button',{}, '›');
    next.disabled = state.page>=totalPages-1;
    next.addEventListener('click', ()=>{ state.page++; render(); });
    pager.appendChild(prev); pager.appendChild(next);

    if(!REDUCE_MOTION){
      tbody.classList.remove('table-body-fade');
      void tbody.offsetWidth;
      tbody.classList.add('table-body-fade');
    }
  }

  searchInput.addEventListener('input', ()=>{ state.page=0; render(); });
  render();
  return wrap;
}

/* ---------------- Chart card (Chart.js) ---------------- */
let __chartInstances = [];
function destroyAllCharts(){ __chartInstances.forEach(c=>c.destroy()); __chartInstances=[]; }

function chartCard(opts){
  // opts: {title, subtitle, type, labels, datasets, height, horizontal, stacked, indexAxis}
  const card = el('div',{class:'card chart-card'});
  card.appendChild(el('h3',{}, opts.title));
  if(opts.subtitle) card.appendChild(el('span',{class:'tiny-muted'}, opts.subtitle));
  const box = el('div',{class:'chart-box'+(opts.tall?' tall':'')});
  const canvas = document.createElement('canvas');
  box.appendChild(canvas);
  card.appendChild(box);

  requestAnimationFrame(()=>{
    const ctx = canvas.getContext('2d');
    const cfg = {
      type: opts.type||'bar',
      data: { labels: opts.labels, datasets: opts.datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        indexAxis: opts.indexAxis || 'x',
        animation: REDUCE_MOTION ? false : { duration:900, easing:'easeOutQuart' },
        transitions: { active: { animation: { duration:250 } } },
        plugins:{
          legend:{ display: !!(opts.datasets.length>1 || opts.showLegend), labels:{ color:'#565b6b', font:{size:11}, usePointStyle:true } },
          tooltip:{ backgroundColor:'#14151c', titleColor:'#fff', bodyColor:'#e5e7eb', padding:10, cornerRadius:8 }
        },
        scales: opts.type==='pie'||opts.type==='doughnut'||opts.type==='polarArea'||opts.type==='radar' ? {} : {
          x:{ stacked: !!opts.stacked, grid:{ color:'#eef0f6' }, ticks:{ color:'#8b90a0', font:{size:10} } },
          y:{ stacked: !!opts.stacked, grid:{ color:'#eef0f6' }, ticks:{ color:'#8b90a0', font:{size:10} }, beginAtZero:true }
        }
      }
    };
    const chart = new Chart(ctx, cfg);
    __chartInstances.push(chart);
  });
  return card;
}

function chartGrid(cards){
  const grid = el('div',{class:'chart-grid'});
  cards.forEach(c=>grid.appendChild(c));
  return grid;
}

/* ---------------- section scaffolding ---------------- */
function sectionBlock(titleHtml, subtitle, contentNode){
  const b = el('div',{class:'section-block'});
  const head = el('div',{class:'section-block-head'});
  head.appendChild(el('h2',{html:titleHtml}));
  if(subtitle) head.appendChild(el('span',{class:'muted'}, subtitle));
  b.appendChild(head);
  b.appendChild(contentNode);
  return b;
}

function loadingBlock(msg){
  const wrap = el('div',{class:'skeleton-wrap'});
  const kpis = el('div',{class:'skeleton-kpis'});
  for(let i=0;i<4;i++) kpis.appendChild(el('div',{class:'skeleton skeleton-kpi'}));
  wrap.appendChild(kpis);
  wrap.appendChild(el('div',{class:'skeleton skeleton-block'}));
  wrap.appendChild(el('div',{class:'skeleton-label'}, msg||'Loading real data…'));
  return wrap;
}

function pageHead(title, subtitle, badge){
  const head = el('div',{class:'content-head'});
  const left = el('div',{},[ el('h1',{},title), subtitle?el('p',{},subtitle):null ]);
  head.appendChild(left);
  if(badge) head.appendChild(el('span',{class:'pill-badge'}, badge));
  return head;
}
