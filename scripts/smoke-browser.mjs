import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8767/';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'gis-smoke-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, base], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let nextId = 1;
const pending = new Map();
const exceptions = [];
const downloads = [];
try {
  let port;
  for (let i = 0; i < 60; i++) {
    const marker = join(profile, 'DevToolsActivePort');
    if (existsSync(marker)) { port = readFileSync(marker, 'utf8').split('\n')[0].trim(); break; }
    await delay(100);
  }
  if (!port) throw new Error('Chrome DevTools did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === 'page');
  if (!target) throw new Error('No browser page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.method === 'Page.downloadWillBegin') downloads.push(message.params.suggestedFilename);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: profile });
  await delay(2500);
  const desktop = await evaluate(`({roadCount:document.getElementById('map-status')?.textContent,expanded:document.getElementById('allroads-coverage')?.textContent,overlayLoaded:[...document.querySelectorAll('.leaflet-image-layer')].some(x=>x.complete&&x.naturalWidth>0),downloadLabel:document.querySelector('[data-action="download"]')?.textContent.trim(),tabs:[...document.querySelectorAll('.section-tabs button')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth})`);
  if (desktop.roadCount !== 'Road network on map' || desktop.tabs.length !== 9 || !desktop.tabs.includes('Rail') || !desktop.tabs.includes('Water') || desktop.tabs.includes('Explore')) throw new Error(`Road coverage or tab mismatch: ${JSON.stringify(desktop)}`);
  if (!desktop.overlayLoaded || !desktop.expanded.includes('Expanded National and DUCAR geometry shown') || desktop.downloadLabel !== 'Download') throw new Error(`Expanded map or download control mismatch: ${JSON.stringify(desktop)}`);
  if (desktop.overflow) throw new Error('Desktop horizontal overflow');
  const modes = ['roads','bridges','traffic','ferries','aviation','safety','freight','rail','water'];
  const results = {};
  for (const mode of modes) {
    await evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
    await delay(mode === 'roads' ? 400 : 900);
    const result = await evaluate(`({status:document.getElementById('map-status').textContent,title:document.getElementById('mode-title').textContent,link:document.getElementById('mode-table-link').href})`);
    if (/unavailable|loading/i.test(result.status)) throw new Error(`${mode}: ${JSON.stringify(result)}`);
    results[mode] = result.status;
  }
  await evaluate(`document.querySelector('[data-action="download"]').click()`);
  await delay(600);
  if (!downloads.includes('uganda-water-map.csv')) throw new Error(`Map CSV download not observed: ${JSON.stringify(downloads)}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(300);
  const mobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tabCount:[...document.querySelectorAll('.section-tabs button')].filter(x=>getComputedStyle(x).display!=='none').length,homeVisible:getComputedStyle(document.querySelector('.section-tabs a')).display!=='none'})`);
  if (mobile.scrollWidth > mobile.width || mobile.tabCount !== 9 || !mobile.homeVisible) throw new Error(`Mobile layout: ${JSON.stringify(mobile)}`);
  await send('Page.enable');
  await send('Page.navigate', { url: new URL('data-explorer.html?dataset=bridges', base).href });
  await delay(1500);
  const table = await evaluate(`({total:document.getElementById('total')?.textContent,range:document.getElementById('row-range')?.textContent,schema:document.getElementById('schema-sql')?.textContent.includes('not a deployed SQL table')})`);
  if (table.total !== '423' || !table.range.includes('423') || !table.schema) throw new Error(`Table mismatch: ${JSON.stringify(table)}`);
  await send('Page.navigate', { url: new URL('data-explorer.html?dataset=roads', base).href });
  await delay(1800);
  await evaluate(`(document.getElementById('category').value='Not supplied',document.getElementById('category').dispatchEvent(new Event('change')))`);
  const roadTable = await evaluate(`({total:document.getElementById('total')?.textContent,matching:document.getElementById('matching')?.textContent,context:document.getElementById('context')?.textContent,hasDucar:document.getElementById('table-body')?.textContent.includes('DUCAR')})`);
  if (roadTable.total !== '5,274' || roadTable.matching !== '4,259' || !roadTable.hasDucar || !roadTable.context.includes('DUCAR')) throw new Error(`Road table mismatch: ${JSON.stringify(roadTable)}`);
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join('; ')}`);
  console.log(JSON.stringify({ desktop, modes: results, download: downloads, mobile, bridgeTable: table, roadTable, browserExceptions: exceptions.length }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
