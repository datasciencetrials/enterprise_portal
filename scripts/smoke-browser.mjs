import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  await delay(base.startsWith('https:') ? 10000 : 2500);
  const desktop = await evaluate(`({roadCount:document.getElementById('map-status')?.textContent,expanded:document.getElementById('allroads-coverage')?.textContent,overlayLoaded:[...document.querySelectorAll('.leaflet-image-layer')].some(x=>x.complete&&x.naturalWidth>0),downloadLabel:document.querySelector('[data-action="download"]')?.textContent.trim(),tabs:[...document.querySelectorAll('.section-tabs button')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth,motion:getComputedStyle(document.querySelector('.intro h1 em')).animationName,progress:document.documentElement.style.getPropertyValue('--scroll-progress'),legend:document.querySelector('.legend-card')?.innerText,cardBackground:getComputedStyle(document.querySelector('.control-card')).backgroundColor,cardBlur:getComputedStyle(document.querySelector('.control-card')).backdropFilter,aspect:document.getElementById('gis-map').dataset.aspect})`);
  if (desktop.roadCount !== 'Road network on map' || desktop.tabs.join('|') !== 'Roads|Bridges|Major Culverts|Traffic|Ferries|Aviation|Safety|Freight|Rail') throw new Error(`Road coverage or tab order mismatch: ${JSON.stringify(desktop)}`);
  if (!desktop.overlayLoaded || desktop.expanded !== undefined || desktop.downloadLabel !== 'Download') throw new Error(`Expanded map or download control mismatch: ${JSON.stringify(desktop)}`);
  if (desktop.overflow) throw new Error('Desktop horizontal overflow');
  if (desktop.motion !== 'headline-glint' || !desktop.progress) throw new Error(`Motion system unavailable: ${JSON.stringify(desktop)}`);
  if (desktop.aspect !== 'landscape') throw new Error(`Desktop map aspect mismatch: ${JSON.stringify(desktop)}`);
  if (!desktop.legend.includes('National paved roads') || !desktop.legend.includes('DUCAR paved roads') || !desktop.cardBackground.includes('0.86') || desktop.cardBlur === 'none') throw new Error(`Road hierarchy or card transparency mismatch: ${JSON.stringify(desktop)}`);
  const roadMetric = await evaluate(`({value:document.getElementById('metric-value')?.textContent,label:document.getElementById('metric-label')?.textContent,coverageChart:!!document.getElementById('coverage-view')})`);
  if (!roadMetric.label.includes('(km)') || !Number.isFinite(Number(roadMetric.value.replaceAll(',', ''))) || roadMetric.coverageChart) throw new Error(`Road metric or chart mismatch: ${JSON.stringify(roadMetric)}`);
  const chartTypes = await evaluate(`['surface-chart','condition-chart','region-chart','class-chart','traffic-chart','safety-chart','priority-chart'].map(id=>Chart.getChart(document.getElementById(id))?.config.type)`);
  if (chartTypes.join('|') !== 'doughnut|polarArea|bar|bar|line|pie|radar') throw new Error(`Road chart variety mismatch: ${JSON.stringify(chartTypes)}`);
  const roadChartUnits = await evaluate(`({labels:[...document.querySelectorAll('#road-analysis .chart-header span')].map(x=>x.textContent),conditionKm:Chart.getChart(document.getElementById('condition-chart')).data.datasets[0].data.reduce((a,b)=>a+b,0),roadKm:Number(document.getElementById('metric-value').textContent.replaceAll(',',''))})`);
  if (roadChartUnits.labels.length !== 7 || roadChartUnits.labels.some(label => !label.includes('km')) || Math.abs(roadChartUnits.conditionKm - roadChartUnits.roadKm) > .11) throw new Error(`Road chart units mismatch: ${JSON.stringify(roadChartUnits)}`);
  const overlayManifest = await evaluate(`fetch('geo/allroads-display.json').then(response=>response.json()).then(data=>data.style_counts)`);
  if (overlayManifest.paved_national !== 3470 || overlayManifest.paved_ducar !== 7520) throw new Error(`Paved geometry split mismatch: ${JSON.stringify(overlayManifest)}`);
  if (process.env.GIS_CHART_SCREENSHOT) {
    await evaluate(`document.getElementById('road-analysis').scrollIntoView({behavior:'instant'})`);
    await delay(1200);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(process.env.GIS_CHART_SCREENSHOT, Buffer.from(shot.data, 'base64'));
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const reducedAnimation = await evaluate(`getComputedStyle(document.querySelector('.intro h1 em')).animationDuration`);
  if (parseFloat(reducedAnimation) > .001) throw new Error(`Reduced motion not respected: ${reducedAnimation}`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await evaluate(`document.getElementById('gis-map').scrollIntoView({behavior:'instant'})`);
  await delay(150);
  const zoomBefore = await evaluate(`Number(document.getElementById('gis-map').dataset.zoom)`);
  const wheelPoint = await evaluate(`(()=>{const rect=document.getElementById('gis-map').getBoundingClientRect();return {x:Math.round(rect.left+rect.width*.6),y:Math.round(Math.min(innerHeight-30,rect.top+90))}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: -600, pointerType: 'mouse' });
  await delay(650);
  const zoomAfter = await evaluate(`Number(document.getElementById('gis-map').dataset.zoom)`);
  if (!(zoomAfter > zoomBefore)) throw new Error(`Mouse-wheel map zoom failed: ${zoomBefore} to ${zoomAfter}`);
  const modes = ['roads','bridges','traffic','ferries','aviation','safety','freight','rail','culverts'];
  const results = {};
  for (const mode of modes) {
    await evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
    await delay(base.startsWith('https:') ? 3000 : mode === 'roads' ? 400 : 900);
    const result = await evaluate(`({status:document.getElementById('map-status').textContent,title:document.getElementById('mode-title').textContent,link:document.getElementById('mode-table-link').href,metric:document.getElementById('metric-value').textContent,label:document.getElementById('metric-label').textContent})`);
    if (/unavailable|loading/i.test(result.status)) throw new Error(`${mode}: ${JSON.stringify(result)}`);
    if (mode === 'rail' ? !result.label.includes('(km)') || !(Number(result.metric.replaceAll(',', '')) > 0) : mode !== 'roads' && (result.label.includes('(km)') || !Number.isInteger(Number(result.metric.replaceAll(',', ''))))) throw new Error(`${mode} metric mismatch: ${JSON.stringify(result)}`);
    if (mode === 'bridges' && (result.metric !== '423' || !result.link.includes('dataset=bridges'))) throw new Error(`Bridge view mismatch: ${JSON.stringify(result)}`);
    if (mode === 'culverts' && (result.metric !== '396' || !result.link.includes('dataset=culverts'))) throw new Error(`Major Culvert view mismatch: ${JSON.stringify(result)}`);
    results[mode] = `${result.status}: ${result.metric} ${result.label}`;
  }
  await evaluate(`document.querySelector('[data-action="download"]').click()`);
  await delay(600);
  if (!downloads.includes('uganda-culverts-map.csv')) throw new Error(`Map CSV download not observed: ${JSON.stringify(downloads)}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(300);
  const mobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tabCount:[...document.querySelectorAll('.section-tabs button')].filter(x=>getComputedStyle(x).display!=='none').length,homeVisible:getComputedStyle(document.querySelector('.section-tabs a')).display!=='none',aspect:document.getElementById('gis-map').dataset.aspect})`);
  if (mobile.scrollWidth > mobile.width || mobile.tabCount !== 9 || !mobile.homeVisible || mobile.aspect !== 'portrait') throw new Error(`Mobile layout: ${JSON.stringify(mobile)}`);
  await send('Page.enable');
  await send('Page.navigate', { url: new URL('data-explorer.html?dataset=bridges', base).href });
  await delay(base.startsWith('https:') ? 5000 : 1500);
  const table = await evaluate(`({total:document.getElementById('total')?.textContent,range:document.getElementById('row-range')?.textContent,schema:document.getElementById('schema-sql')?.textContent.includes('not a deployed SQL table')})`);
  if (table.total !== '423' || !table.range.includes('423') || !table.schema) throw new Error(`Table mismatch: ${JSON.stringify(table)}`);
  await send('Page.navigate', { url: new URL('data-explorer.html?dataset=roads', base).href });
  await delay(base.startsWith('https:') ? 5000 : 1800);
  const allRoadRows = await evaluate(`({count:document.querySelectorAll('#table-body tr').length,hasPagination:!!document.querySelector('.pagination')})`);
  if (allRoadRows.count !== 5274 || allRoadRows.hasPagination) throw new Error(`Full road table mismatch: ${JSON.stringify(allRoadRows)}`);
  await evaluate(`(document.getElementById('category').value='Not supplied',document.getElementById('category').dispatchEvent(new Event('change')))`);
  const roadTable = await evaluate(`({total:document.getElementById('total')?.textContent,matching:document.getElementById('matching')?.textContent,context:document.getElementById('context')?.textContent,hasDucar:document.getElementById('table-body')?.textContent.includes('DUCAR'),renderedRows:document.querySelectorAll('#table-body tr').length,hasPagination:!!document.querySelector('.pagination'),scrollable:document.querySelector('.table-scroll').scrollHeight>document.querySelector('.table-scroll').clientHeight})`);
  if (roadTable.total !== '5,274' || roadTable.matching !== '4,259' || !roadTable.hasDucar || !roadTable.context.includes('DUCAR') || roadTable.renderedRows !== 4259 || roadTable.hasPagination || !roadTable.scrollable) throw new Error(`Road table mismatch: ${JSON.stringify(roadTable)}`);
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join('; ')}`);
  console.log(JSON.stringify({ desktop, modes: results, download: downloads, mobile, bridgeTable: table, roadTable, browserExceptions: exceptions.length }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
