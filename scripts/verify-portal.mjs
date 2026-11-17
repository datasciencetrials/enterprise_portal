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

const pages = ['index.html', 'gis-studio.html', 'data-explorer.html'];
for (const page of pages) {
  const html = source(page);
  check(html.includes('apple-system.css?v=20261117-gis-light-v53'), `${page} must load the current light theme`);
  check(!html.includes('`n</head>'), `${page} contains a malformed head token`);
  check(!/LIVE ANALYSIS/i.test(html), `${page} must not describe static mapped data as live`);
  check(!/[\u2013\u2014]/.test(html), `${page} contains a visible en dash or em dash`);
  check(!/NDP IV|UNRA/i.test(html), `${page} contains prohibited visible wording`);
}

const index = source('index.html');
const studio = source('gis-studio.js');
const explorer = source('data-explorer.js');
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
check(studio.includes("governance_department === 'DDUCAR'"), 'map DUCAR filter is missing');
check(explorer.includes("governance_department === 'DDUCAR'"), 'table DUCAR filter is missing');

for (const token of ['.transport-photos', 'footer {', 'background: #ffffff !important', 'font-family: Arial']) {
  check(theme.includes(token), `apple-system.css is missing light-theme safeguard ${token}`);
}

for (const file of ['vendor/leaflet.min.js', 'vendor/chart.umd.min.js', 'geo/bridges.geojson', 'geo/major_culverts.geojson', 'geo/traffic_count_stations.geojson']) {
  try { source(file); } catch { fail(`${file} is missing from the deployed tree`); }
}

const bridges = JSON.parse(source('geo/bridges.geojson')).features;
const culverts = JSON.parse(source('geo/major_culverts.geojson')).features;
check(bridges.length === 552, `bridge register must retain 552 records, found ${bridges.length}`);
check(culverts.length === 452, `major culvert register must retain 452 records, found ${culverts.length}`);

const b005 = bridges.find(feature => feature.properties?.Bridge_Number === 'B005');
const b548 = bridges.find(feature => feature.properties?.Bridge_Number === 'B548');
check(b005?.properties?.Bridge_Name?.toUpperCase().includes('RWIZI'), 'B005 must remain Rwizi Bridge');
check(b005?.properties?.Link_Number === 'A002_Link08', 'B005 must remain on A002 Link 08');
check(!b548?.properties?.Bridge_Name?.toUpperCase().includes('RWIZI'), 'B548 must not be labelled Rwizi Bridge');
check(b548?.geometry === null, 'B548 must not publish the accidentally reassigned Rwizi location');
check(/require correction/i.test(b548?.properties?.Position_Status || ''), 'B548 must carry a visible correction status');

if (!process.exitCode) console.log('Portal verification passed: theme, controls, runtime filters and governed structure counts.');
