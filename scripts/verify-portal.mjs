import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const fail = message => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const check = (condition, message) => {
  if (!condition) fail(message);
};

const source = path => {
  if (existsSync(path)) return readFileSync(path, 'utf8');
  return execFileSync('git', ['show', `HEAD:${path}`], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
};

for (const page of ['index.html', 'data-explorer.html']) {
  const html = source(page);
  check(html.includes('apple-system.css?'), `${page} must load the light theme`);
  check(!/[\u2013\u2014]/.test(html), `${page} contains a visible en dash or em dash`);
  check(!/Unified SQL|Weekly Sync|Vision 2040|Supabase|Ministry|\bMoWT\b|\bUNRA\b|\bDNR\b|\bDNE\b/i.test(html), `${page} contains an unsupported database, projection, or institutional identity claim`);
  check(/Data Science Trials/i.test(html), `${page} must identify the personal learning site`);
  check(/private governed source/i.test(html), `${page} must describe the private governed source boundary`);
  check(/Database and schema access are not available to the browser/i.test(html), `${page} must state that browser schema access is blocked`);
}

const redirect = source('gis-studio.html');
check(/noindex/i.test(redirect) && /\.\/#explore/.test(redirect), 'legacy GIS workspace must redirect to the consolidated portal');

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
check(!tracked.some(path => /(^|\/)supabase-migration(?:\/|$)/i.test(path)), 'obsolete Supabase migration material must not be published');
check(!tracked.some(path => /\.(?:db|sqlite|sqlite3|sql)$/i.test(path)), 'database or SQL files must not be published');
for (const path of tracked.filter(path => /\.(?:html|js|json|css|md|py)$/i.test(path) && path !== 'scripts/verify-portal.mjs' && !path.startsWith('vendor/') && !path.startsWith('assets/'))) {
  const content = source(path);
  check(!/G:\\|unified_mowt_transport_db|supabase|Unified SQL|Vision 2040/i.test(content), `${path} exposes a private database reference or unsupported projection claim`);
  check(!/connected database currently has no governed public tables/i.test(content), `${path} contains superseded public-database wording`);
}

const index = source('index.html');
const studio = source('gis-studio.js');
const explorer = source('data-explorer.js');
const timeline = source('transport-timeline.js');
const theme = source('apple-system.css');

for (const token of ['data-mode="roads"', 'data-workspace-tab="catalogue"', 'data-workspace-tab="contents"', 'data-workspace-tab="details"', 'data-workspace-tab="basemaps"', 'data-map-tool="distance"', 'data-map-tool="area"']) {
  check(index.includes(token), `index.html is missing control ${token}`);
}

for (const token of ["querySelectorAll('.section-tabs button[data-mode]')", "querySelectorAll('[data-workspace-tab]')", "querySelectorAll('[data-map-tool]')", "querySelectorAll('[data-basemap]')"]) {
  check(studio.includes(token), `gis-studio.js is missing handler ${token}`);
}

check(!studio.includes('properties?.('), 'gis-studio.js contains the broken optional-call filter');
check(!explorer.includes('properties?.('), 'data-explorer.js contains the broken optional-call filter');
check(!studio.includes('visible.length)} of ${format.format(features.length'), 'road summary must report kilometres, not record counts');
check(studio.includes("const linkId = raw => typeof raw === 'string' && raw.includes('_') ? raw : 'Link ID not verified'"), 'map Link ID formatter is missing');
check(explorer.includes("if (linkIdKeys.has(key)) return value.includes('_') ? value : 'Link ID not verified'"), 'table Link ID formatter is missing');
check(index.includes('FY 2025-26</dt><dd>21,302 km'), 'FY 2025-26 National Roads length is missing');
check(index.includes('FY 2026-27</dt><dd>21,284 km'), 'FY 2026-27 National Roads length is missing');
check(!index.includes('17.98 km below'), 'financial-year observations must not be described as a baseline shortfall');
check(timeline.includes("id: 'network-length-fy'"), 'road financial-year time series is missing');
check(timeline.includes("{ period: 'FY 2025-26', value: 21302 }") && timeline.includes("{ period: 'FY 2026-27', value: 21284 }"), 'road financial-year values are incorrect');

for (const token of ['.transport-photos', 'footer {', 'background: #ffffff !important', 'font-family: Arial']) {
  check(theme.includes(token), `apple-system.css is missing light-theme safeguard ${token}`);
}

for (const file of ['vendor/leaflet.min.js', 'vendor/chart.umd.min.js', 'geo/bridges.geojson', 'geo/major_culverts.geojson', 'geo/traffic_count_stations.geojson']) {
  try { source(file); } catch { fail(`${file} is missing from the deployed tree`); }
}

const bridges = JSON.parse(source('geo/bridges.geojson')).features;
const culverts = JSON.parse(source('geo/major_culverts.geojson')).features;
const roads = JSON.parse(source('network.geojson')).features;
check(bridges.length === 552, `bridge register must retain 552 records, found ${bridges.length}`);
check(culverts.length === 452, `major culvert register must retain 452 records, found ${culverts.length}`);
const mappedRoadKm = roads.reduce((sum, feature) => sum + (Number(feature.properties?.['Length Km']) || 0), 0);
check(mappedRoadKm.toFixed(2) === '21284.02', `mapped road layer must total 21,284.02 km, found ${mappedRoadKm.toFixed(2)}`);

const b005 = bridges.find(feature => feature.properties?.Bridge_Number === 'B005');
const b548 = bridges.find(feature => feature.properties?.Bridge_Number === 'B548');
check(b005?.properties?.Bridge_Name?.toUpperCase().includes('RWIZI'), 'B005 must remain Rwizi Bridge');
check(b005?.properties?.Link_Number === 'A002_Link08', 'B005 must remain on A002 Link 08');
check(b548?.properties?.Bridge_Name === 'Rwizi Bridge 2', 'B548 must remain Rwizi Bridge 2');
check(b548?.properties?.Link_Number === 'A002_Link08', 'B548 must remain on A002 Link 08');
check(b548?.geometry?.type === 'Point', 'B548 must retain its approved mapped point');

if (!process.exitCode) console.log('Portal verification passed: light theme, private data boundary, controls, Link IDs and governed identities.');
