const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('gis-studio.js', 'utf8');
const start = source.indexOf('  async function loadMode(key) {');
const end = source.indexOf('  function pointPopup(', start);
assert.ok(start >= 0 && end > start, 'mode loader is available');

const featureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [32, 1] }, properties: { Bridge_Name: 'Test' } }],
};

function loader(fetch) {
  const modeCache = new Map();
  const status = { textContent: '' };
  const context = {
    modeCache,
    transportModes: { bridges: { title: 'Bridges', files: ['bridges.geojson'] } },
    activeMode: 'bridges',
    $: () => status,
    fetch,
    AbortController,
    window: { setTimeout, clearTimeout },
  };
  return { loadMode: vm.runInNewContext(`${source.slice(start, end)}\nloadMode`, context), modeCache, status };
}

const aborted = () => Object.assign(new Error('timed out'), { name: 'AbortError' });

(async () => {
  let calls = 0;
  const transient = loader(async () => {
    calls++;
    if (calls === 1) throw aborted();
    return { ok: true, json: async () => featureCollection };
  });
  const loaded = await transient.loadMode('bridges');
  assert.equal(calls, 2, 'a transient timeout is retried once');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].properties._transportKind, 'Bridges');
  assert.equal(transient.status.textContent, 'Retrying bridges');

  calls = 0;
  const missing = loader(async () => { calls++; return { ok: false, status: 404 }; });
  await assert.rejects(missing.loadMode('bridges'), /returned 404/);
  assert.equal(calls, 1, 'a missing file is not retried');
  assert.equal(missing.modeCache.size, 0, 'failed loads can be retried by the user');

  calls = 0;
  const unavailable = loader(async () => { calls++; throw aborted(); });
  await assert.rejects(unavailable.loadMode('bridges'), /timed out/);
  assert.equal(calls, 2, 'retries are bounded');
  assert.equal(unavailable.modeCache.size, 0);
  console.log('Mode load retry tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
