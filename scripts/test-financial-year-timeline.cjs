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

vm.runInNewContext(fs.readFileSync('transport-timeline.js', 'utf8'), context);
listeners.get('transportdataready')({ detail: { mode: 'roads', items: [] } });

if (element('timeline-metric').value !== 'network-length-fy') throw new Error('Financial-year series is not the default road timeline');
if (chartConfig?.type !== 'line') throw new Error(`Expected a line chart, found ${chartConfig?.type}`);
if (chartConfig.data.labels.join('|') !== 'FY 2025-26|FY 2026-27') throw new Error('Financial-year chart labels are incorrect');
if (chartConfig.data.datasets[0].data.join('|') !== '21302|21284') throw new Error('Financial-year chart values are incorrect');
if (!element('timeline-note').textContent.includes('not a baseline shortfall')) throw new Error('Financial-year interpretation note is missing');

console.log('Financial-year timeline test passed');
