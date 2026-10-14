// App shell: sidebar nav, routing, section mounting.
const NAV = [
  { group:'Overview', items:[
    { id:'overview', label:'Overview', icon:'◆' },
  ]},
  { group:'Network', items:[
    { id:'map', label:'National GIS Map', icon:'⬡' },
    { id:'network', label:'Network Explorer', icon:'≣' },
    { id:'ducar', label:'DUCAR Network', icon:'▤' },
  ]},
  { group:'Asset Management', items:[
    { id:'maintenance', label:'Maintenance & Condition', icon:'✓' },
    { id:'structures', label:'Bridges & Culverts', icon:'▣' },
    { id:'investment', label:'Investment Plan', icon:'↗' },
  ]},
  { group:'Context', items:[
    { id:'socioeconomic', label:'Socio-Economic & Climate', icon:'✦' },
    { id:'standards', label:'Standards & Data Model', icon:'▦' },
  ]},
  { group:'Insights', items:[
    { id:'analytics', label:'Analytics & Insights', icon:'▲' },
    { id:'reports', label:'Executive Reports', icon:'▥' },
  ]},
  { group:'Explore', items:[
    { id:'universe', label:'Network Universe', icon:'🌌' },
  ]},
  { group:'Links', items:[
    { id:'links', label:'Live Links', icon:'🔗' },
  ]},
];

function buildSidebar(activeId, onNavigate){
  const sidebar = el('div',{class:'sidebar'});
  sidebar.appendChild(el('div',{class:'brand'},[
    el('div',{class:'brand-badge'},'UG'),
    el('div',{},[ el('div',{class:'brand-text'},'GIS Enterprise'), el('div',{class:'brand-sub'},'Roads & Bridges · MoWT') ])
  ]));
  const nav = el('div',{class:'nav'});
  NAV.forEach(group=>{
    nav.appendChild(el('div',{class:'nav-group-label'}, group.group));
    group.items.forEach(item=>{
      const node = el('div',{class:'nav-item'+(item.id===activeId?' active':'')},[
        el('span',{class:'ic'}, item.icon), item.label
      ]);
      node.addEventListener('click', ()=> onNavigate(item.id));
      nav.appendChild(node);
    });
  });
  sidebar.appendChild(nav);
  return sidebar;
}

function buildTopbar(){
  const bar = el('div',{class:'topbar'});
  bar.appendChild(el('div',{class:'search-box'},[ el('span',{},'🔍'), (()=>{const i=document.createElement('input'); i.placeholder='Search routes, bridges, districts…'; return i;})() ]));
  bar.appendChild(el('div',{class:'topbar-spacer'}));
  bar.appendChild(el('button',{class:'icon-btn', title:'Export view'},'⇩'));
  bar.appendChild(el('button',{class:'icon-btn', title:'Settings'},'⚙'));
  return bar;
}

async function mount(id){
  destroyAllCharts();
  const container = document.getElementById('content');
  container.innerHTML = '';
  container.classList.remove('fade-in'); void container.offsetWidth; container.classList.add('fade-in');
  container.appendChild(loadingBlock());
  const renderer = RENDERERS[id];
  if(!renderer){ container.innerHTML = '<div class="loading-row">Section not found.</div>'; return; }
  try{
    await renderer(container);
  }catch(err){
    console.error(err);
    container.innerHTML = '';
    container.appendChild(el('div',{class:'callout warn'}, 'This section could not load its live data ('+esc(err.message)+'). Try refreshing — the underlying data files are fetched directly from this site.'));
  }
}

function navigate(id){
  history.replaceState(null,'','#'+id);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const idx = NAV.flatMap(g=>g.items).findIndex(i=>i.id===id);
  const flatEls = document.querySelectorAll('.nav-item');
  if(flatEls[idx]) flatEls[idx].classList.add('active');
  mount(id);
}

function initApp(){
  const root = document.getElementById('app');
  const startId = (location.hash||'#overview').slice(1);
  const sidebar = buildSidebar(startId, navigate);
  root.appendChild(sidebar);
  const mainCol = el('div',{class:'main-col'});
  mainCol.appendChild(buildTopbar());
  mainCol.appendChild(el('div',{class:'content', id:'content'}));
  root.appendChild(mainCol);
  mount(startId);
}

document.addEventListener('DOMContentLoaded', initApp);
