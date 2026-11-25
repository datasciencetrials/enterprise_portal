const fs = require('fs');
const vm = require('vm');

const listeners = new Map();
const elements = new Map();
const element = id => {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: '',
      textContent: '',
      hidden: true,
      disabled: false,
      attributes: {},
      addEventListener() {},
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; },
    });
  }
  return elements.get(id);
};

let chartConfig;
class ChartStub {
  constructor(_canvas, config) { chartConfig = config; }
  destroy() {}
}

const context = {
  console,
  Intl,
  Date,
  Number,
  Array,
  Map,
  Blob,
  URL,
  setTimeout,
  Option: function Option(label, value) { return { label, value }; },
  Event: function Event(type) { return { type }; },
  Chart: ChartStub,
  document: {
    getElementById: element,
    querySelector: selector => selector.includes('aria-current') ? { dataset: { mode: 'roads' } } : null,
    createElement: () => ({ click() {} }),
  },
  window: {
    addEventListener(type, handler) { listeners.set(type, handler); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  },
};

vm.runInNewContext(fs.readFileSync('transport-timeseries-data.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('transport-timeline.js', 'utf8'), context);
listeners.get('transportdataready')({ detail: { mode: 'roads', items: [] } });

if (element('timeline-metric').value !== 'network-length-fy') throw new Error('Financial-year series is not the default road timeline');
if (chartConfig?.type !== 'line') throw new Error(`Expected a line chart, found ${chartConfig?.type}`);
const expectedLabels = ['FY 2008-09','FY 2009-10','FY 2010-11','FY 2011-12','FY 2012-13','FY 2013-14','FY 2014-15','FY 2015-16','FY 2016-17','FY 2017-18','FY 2018-19','FY 2019-20','FY 2020-21','FY 2021-22','FY 2022-23','FY 2023-24','FY 2024-25','FY 2025-26','FY 2026-27'];
const expectedValues = [10053,10430,20384,21000,21000,20544,20544,20544,20544,20544,20856,21010,21020,21120,21200,21288,21291,21302,21284];
if (chartConfig.data.labels.join('|') !== expectedLabels.join('|')) throw new Error('Complete financial-year chart labels are incorrect');
if (chartConfig.data.datasets[0].data.join('|') !== expectedValues.join('|')) throw new Error('Complete financial-year chart values are incorrect');
if (!element('timeline-note').textContent.includes('All 19 periods')) throw new Error('Complete financial-year interpretation note is missing');

element('timeline-metric').value = 'surface-length-fy';
element('timeline-metric').children.find(child => child.value === 'surface-length-fy');
listeners.get('transportdataready')({ detail: { mode: 'roads', items: [] } });
if (chartConfig.data.datasets.length !== 2) throw new Error('Surface time series must show Paved and Unpaved datasets');
if (chartConfig.data.datasets[0].data.length !== 19 || chartConfig.data.datasets[1].data.length !== 19) throw new Error('Surface time series must include all 19 periods');

listeners.get('transportmodechange')({ detail: { mode: 'traffic' } });
listeners.get('transportdataready')({ detail: { mode: 'traffic', items: [] } });
if (element('timeline-title').textContent !== 'Traffic time series') throw new Error('Traffic time-series title is missing');
if (chartConfig.data.labels.length !== 8 || chartConfig.data.datasets.length !== 3) throw new Error('Recorded ATC monthly volume series is incomplete');

console.log('Financial-year timeline test passed');
