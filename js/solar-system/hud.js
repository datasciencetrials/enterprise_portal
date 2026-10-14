// On-screen overlay for the 3D Network Universe: clickable planet tabs (mirrors clicking a planet
// in the scene), a live metrics panel per subsystem, the crew roster, and the VCI condition-band
// reference table. Built with the platform's existing el()/fmtNum()/esc() helpers (js/components.js).

const SolarHUD = (() => {
  const VCI_BANDS = [
    { range: '85% – 100%', label: 'Good / Very Good', action: 'Routine Maintenance & Crack Sealing', color: 'var(--status-good)' },
    { range: '70% – 84%',  label: 'Fair / Warning',     action: 'Fog Spray & Patching',                color: 'var(--status-fair)' },
    { range: '50% – 69%',  label: 'Poor / Moderate Distress', action: 'Double Surface Dressing / Reseal', color: 'var(--neon-orange)' },
    { range: '30% – 49%',  label: 'Very Poor / Severe Distress', action: 'Structural Asphalt Overlay (50mm)', color: 'var(--status-poor)' },
    { range: '0% – 29%',   label: 'Critical / Failed',  action: 'Full Depth Reconstruction',          color: 'var(--status-critical)' },
  ];

  function vciLegend(){
    const wrap = el('div', { class: 'card card-pad' });
    wrap.appendChild(el('h3', {}, 'Visual Condition Index (VCI) — DNR-MOWT Visual Inspection Manual 2012'));
    const table = el('table', { class: 'data-table', style: 'margin-top:10px;' });
    const thead = el('thead', {}, el('tr', {}, [
      el('th', {}, 'VCI Band'), el('th', {}, 'Condition'), el('th', {}, 'Standard Intervention'),
    ]));
    const tbody = el('tbody', {}, VCI_BANDS.map(b => el('tr', {}, [
      el('td', {}, el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${b.color};margin-right:8px;` }), ),
      el('td', {}, [document.createTextNode(b.range + ' — '), document.createTextNode(b.label)]),
      el('td', {}, b.action),
    ])));
    table.appendChild(thead); table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function build(container, planetsConfig, onSelect){
    const root = el('div', { class: 'universe-hud' });

    const tabs = el('div', { class: 'universe-tabs' });
    const tabEls = {};
    planetsConfig.forEach(p => {
      const tab = el('button', {
        class: 'universe-tab',
        style: `--tab-color:#${p.color.toString(16).padStart(6, '0')}`,
        onclick: () => onSelect(p.id),
      }, [el('span', { class: 'universe-tab-dot' }), p.name]);
      tabEls[p.id] = tab;
      tabs.appendChild(tab);
    });
    root.appendChild(tabs);

    const metricsPanel = el('div', { class: 'card card-pad universe-metrics' }, 'Select a planet — in the scene or above — for its live subsystem metrics.');
    root.appendChild(metricsPanel);

    const rosterPanel = el('div', { class: 'card card-pad universe-roster' });
    root.appendChild(rosterPanel);

    root.appendChild(vciLegend());

    container.appendChild(root);

    return {
      setActive(id){
        Object.entries(tabEls).forEach(([pid, node]) => node.classList.toggle('active', pid === id));
      },
      setMetrics(node){
        metricsPanel.innerHTML = '';
        metricsPanel.appendChild(node);
      },
      setRoster(planet, roster){
        rosterPanel.innerHTML = '';
        rosterPanel.appendChild(el('h3', {}, planet.full + ' crew'));
        const list = el('div', { class: 'universe-roster-list' });
        roster.forEach(member => {
          list.appendChild(el('div', { class: 'universe-roster-row' }, [
            el('span', {}, member.role),
            el('span', { class: 'muted' }, member.status),
          ]));
        });
        rosterPanel.appendChild(list);
      },
    };
  }

  return { build, VCI_BANDS };
})();
