(() => {
  'use strict';
  const status = document.getElementById('reviewed-layer-status');
  const list = document.getElementById('reviewed-layer-list');
  const loaded = new Map();
  fetch('geo/reviewed_google_earth/manifest.json').then(response => {
    if (!response.ok) throw new Error(`Layer catalogue returned ${response.status}`);
    return response.json();
  }).then(manifest => {
    if (!Array.isArray(manifest.layers)) throw new Error('Invalid layer catalogue');
    for (const entry of manifest.layers) {
      const label = document.createElement('label'); label.className = 'reviewed-layer';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
      const detail = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = entry.name;
      const note = document.createElement('small'); note.textContent = `${entry.featureCount.toLocaleString()} mapped geometries. ${entry.temporalStatus}.`;
      detail.append(name, note); label.append(checkbox, detail); list.append(label);
      checkbox.addEventListener('change', async () => {
        if (!checkbox.checked) {
          window.dispatchEvent(new CustomEvent('gis-reviewed-layer', { detail: { action: 'toggle', id: entry.id, visible: false } }));
          status.textContent = `${entry.name} hidden.`;
          return;
        }
        checkbox.disabled = true;
        status.textContent = `Loading ${entry.name}...`;
        try {
          let features = loaded.get(entry.id);
          if (!features) {
            const response = await fetch(entry.file);
            if (!response.ok) throw new Error(`Layer returned ${response.status}`);
            const collection = await response.json();
            if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features) || collection.features.length !== entry.featureCount) throw new Error('Layer count does not match catalogue');
            features = collection.features; loaded.set(entry.id, features);
            window.dispatchEvent(new CustomEvent('gis-reviewed-layer', { detail: { action: 'add', id: entry.id, features } }));
          } else window.dispatchEvent(new CustomEvent('gis-reviewed-layer', { detail: { action: 'toggle', id: entry.id, visible: true } }));
          status.textContent = `${entry.name} shown as a separate source overlay.`;
        } catch (error) {
          checkbox.checked = false;
          status.textContent = `Could not load ${entry.name}: ${error.message}`;
        } finally { checkbox.disabled = false; }
      });
    }
    status.textContent = `${manifest.layers.length} reviewed Uganda source layers available. Select a layer to show it on the map.`;
  }).catch(error => { status.textContent = `Reviewed source layers unavailable: ${error.message}`; });
})();
