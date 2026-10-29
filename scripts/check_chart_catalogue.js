/* Validate chart definitions against the published GeoJSON without rendering. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'transport-chart-gallery.js'), 'utf8').replace('window.TransportChartGallery = { render };', 'window.TransportChartGallery = { render, buildSpecs };');
const context = { document: { getElementById: () => ({}) }, window: {}, console };
vm.runInNewContext(source, context);
const { buildSpecs } = context.window.TransportChartGallery;
const files = {
  roads: ['network.geojson'], bridges: ['geo/bridges.geojson'], culverts: ['geo/major_culverts.geojson'],
  traffic: ['geo/traffic_count_stations.geojson'], ferries: ['geo/ferry_crossings.geojson'], aviation: ['geo/airports.geojson'],
  safety: ['geo/kampala_traffic_incidents.geojson'], freight: ['geo/weighbridges.geojson'], rail: ['geo/mgr.geojson', 'geo/sgr_alignment.geojson'],
};
let total = 0;
for (const [mode, paths] of Object.entries(files)) {
  const items = paths.flatMap(file => {
    const target = path.join(root, file);
    const alternate = process.argv[2] && file.startsWith('geo/') ? path.join(process.argv[2], file) : target;
    const data = JSON.parse(fs.readFileSync(fs.existsSync(target) ? target : alternate, 'utf8'));
    return data.features.filter(feature => feature.geometry).map(feature => mode === 'rail' ? {
      ...feature, properties: { ...feature.properties, _transportKind: file.includes('sgr') ? 'SGR alignment' : 'MGR mapped segments' }
    } : feature);
  });
  const specs = buildSpecs(items, mode);
  const titles = new Set(specs.map(spec => spec.title));
  if (titles.size !== specs.length) throw new Error(`${mode} has repeated chart definitions`);
  const count = specs.length;
  total += count;
  console.log(`${mode}: ${count} charts from ${items.length} mapped features`);
}
console.log(`TOTAL: ${total}`);
if (total < 200) process.exitCode = 1;
