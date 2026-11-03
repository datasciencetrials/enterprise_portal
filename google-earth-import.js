(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const maxFileBytes = 80 * 1024 * 1024;
  const maxFeatures = 50000;
  const ugandaBox = { west: 29.3, south: -1.6, east: 35.3, north: 4.4 };
  const loaded = new Map();
  let featureCount = 0;
  let busy = false;

  function coordinates(text, track = false) {
    return String(text || '').trim().split(/\s+/).map(part => {
      const parts = part.split(track ? /\s+/ : ',').map(Number);
      return parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
        && Math.abs(parts[0]) <= 180 && Math.abs(parts[1]) <= 90 ? parts.slice(0, 2) : null;
    }).filter(Boolean);
  }

  function kmlFeatures(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid KML XML');
    const get = (element, tag) => element.getElementsByTagNameNS('*', tag);
    const features = [];
    for (const placemark of get(doc, 'Placemark')) {
      const name = get(placemark, 'name')[0]?.textContent?.trim() || 'Unnamed feature';
      const add = geometry => features.push({ type: 'Feature', geometry, properties: { name } });
      for (const point of get(placemark, 'Point')) {
        const pair = coordinates(get(point, 'coordinates')[0]?.textContent)[0];
        if (pair) add({ type: 'Point', coordinates: pair });
      }
      for (const line of get(placemark, 'LineString')) {
        const pairs = coordinates(get(line, 'coordinates')[0]?.textContent);
        if (pairs.length > 1) add({ type: 'LineString', coordinates: pairs });
      }
      for (const polygon of get(placemark, 'Polygon')) {
        const outer = get(polygon, 'outerBoundaryIs')[0];
        const boundary = coordinates(outer && get(outer, 'coordinates')[0]?.textContent);
        if (boundary.length < 4) continue;
        const rings = [boundary];
        for (const inner of get(polygon, 'innerBoundaryIs')) {
          const ring = coordinates(get(inner, 'coordinates')[0]?.textContent);
          if (ring.length >= 4) rings.push(ring);
        }
        add({ type: 'Polygon', coordinates: rings });
      }
      for (const track of get(placemark, 'Track')) {
        const pairs = Array.from(get(track, 'coord')).map(node => {
          const parts = String(node.textContent || '').trim().split(/\s+/).map(Number);
          return parts.length >= 2 && parts.every(Number.isFinite) ? parts.slice(0, 2) : null;
        }).filter(Boolean);
        if (pairs.length > 1) add({ type: 'LineString', coordinates: pairs });
      }
    }
    return features;
  }

  async function kmzKml(file) {
    const bytes = await file.arrayBuffer();
    const view = new DataView(bytes);
    let end = -1;
    for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('Invalid KMZ ZIP directory');
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const decoder = new TextDecoder();
    let chosen = null;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid KMZ entry');
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const name = decoder.decode(new Uint8Array(bytes, offset + 46, nameLength));
      if (/\.kml$/i.test(name) && (!chosen || /(^|\/)doc\.kml$/i.test(name))) {
        chosen = { name, method: view.getUint16(offset + 10, true), compressed: view.getUint32(offset + 20, true), uncompressed: view.getUint32(offset + 24, true), localOffset: view.getUint32(offset + 42, true) };
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (!chosen) throw new Error('KMZ contains no KML map');
    if (chosen.uncompressed > maxFileBytes) throw new Error('KML inside KMZ is over 80 MB');
    const local = chosen.localOffset;
    if (local + 30 > bytes.byteLength || view.getUint32(local, true) !== 0x04034b50) throw new Error('Invalid KMZ local entry');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + chosen.compressed > bytes.byteLength) throw new Error('Truncated KMZ entry');
    const compressed = new Blob([bytes.slice(start, start + chosen.compressed)]);
    let content;
    if (chosen.method === 0) content = await compressed.arrayBuffer();
    else if (chosen.method === 8 && typeof DecompressionStream !== 'undefined') {
      content = await new Response(compressed.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    } else throw new Error('KMZ compression is not supported in this browser');
    if (content.byteLength !== chosen.uncompressed) throw new Error('KMZ size check failed');
    return decoder.decode(content);
  }

  function containsUganda(feature) {
    const walk = value => {
      if (!Array.isArray(value)) return false;
      if (typeof value[0] === 'number') return value[0] >= ugandaBox.west && value[0] <= ugandaBox.east && value[1] >= ugandaBox.south && value[1] <= ugandaBox.north;
      return value.some(walk);
    };
    return walk(feature.geometry?.coordinates);
  }

  function geoJsonFeatures(text) {
    const data = JSON.parse(text);
    const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [];
    if (!Array.isArray(features)) throw new Error('Not a GeoJSON feature collection');
    return features.filter(feature => feature?.type === 'Feature' && feature.geometry?.coordinates);
  }

  function announce(message) { $('geo-import-status').textContent = message; }
  function dispatch(detail) { window.dispatchEvent(new CustomEvent('gis-local-layer', { detail })); }

  async function importFiles(fileList) {
    if (busy) return;
    busy = true;
    const files = Array.from(fileList);
    const supported = files.filter(file => /\.(kml|kmz|geojson|json)$/i.test(file.name));
    const unsupported = files.length - supported.length;
    let added = 0;
    const skipped = [];
    for (const file of supported) {
      announce(`Reading ${file.name} (${added} added, ${skipped.length} skipped)...`);
      await new Promise(resolve => requestAnimationFrame(resolve));
      try {
        if (!window.gisLocalLayerReady) throw new Error('map is unavailable');
        if (file.size > maxFileBytes) throw new Error('file is over 80 MB');
        const path = file.webkitRelativePath || file.name;
        if (loaded.has(path)) throw new Error('already added');
        const text = /\.kmz$/i.test(file.name) ? await kmzKml(file) : await file.text();
        const features = /\.(kml|kmz)$/i.test(file.name) ? kmlFeatures(text) : geoJsonFeatures(text);
        if (!features.length) throw new Error('no supported point, line or polygon features');
        if (!features.some(containsUganda)) throw new Error('no geometry in Uganda map extent');
        if (featureCount + features.length > maxFeatures) throw new Error('session limit of 50,000 features reached');
        const id = `local-${loaded.size + 1}`;
        dispatch({ action: 'add', id, name: file.name, features });
        loaded.set(path, { id, name: file.name, count: features.length });
        featureCount += features.length;
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = true;
        checkbox.addEventListener('change', () => dispatch({ action: 'toggle', id, visible: checkbox.checked }));
        const caption = document.createElement('span');
        caption.textContent = `${file.name} (${features.length.toLocaleString()} features)`;
        label.append(checkbox, caption);
        $('geo-import-layers').append(label);
        added++;
      } catch (error) { skipped.push(`${file.name}: ${error.message}`); }
    }
    $('geo-clear').disabled = loaded.size === 0;
    const details = skipped.slice(0, 3).join('; ');
    announce(`${loaded.size} layer${loaded.size === 1 ? '' : 's'} active, ${featureCount.toLocaleString()} local features added. This selection: ${added} added, ${unsupported} unsupported file${unsupported === 1 ? '' : 's'} ignored${unsupported ? ' (shapefile components need GeoJSON conversion)' : ''}, ${skipped.length} supported file${skipped.length === 1 ? '' : 's'} skipped${details ? ': ' + details : ''}${skipped.length > 3 ? '; more files also skipped' : ''}. Files remain on your device.`);
    busy = false;
  }

  $('geo-add-files').addEventListener('click', () => $('geo-files').click());
  $('geo-add-folder').addEventListener('click', () => $('geo-folder').click());
  for (const id of ['geo-files', 'geo-folder']) $(id).addEventListener('change', event => {
    importFiles(event.target.files).catch(error => { busy = false; announce(`Import failed: ${error.message}`); });
    event.target.value = '';
  });
  $('geo-clear').addEventListener('click', () => {
    dispatch({ action: 'clear' });
    loaded.clear(); featureCount = 0;
    $('geo-import-layers').replaceChildren();
    $('geo-clear').disabled = true;
    announce('No local layers added.');
  });
})();
