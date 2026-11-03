(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 1 });
  const specs = {
    roads: [
      { id: 'completed', label: 'Road completion year', field: 'Completion Year', unit: 'mapped km', kind: 'year', colour: '#e76f3c', method: 'Mapped road kilometres grouped by recorded completion year. This is a cohort distribution, not the total road network in each year.' },
      { id: 'rehabilitated', label: 'Road rehabilitation year', field: 'Rehabilitation Year', unit: 'mapped km', kind: 'year', colour: '#15859b', method: 'Mapped road kilometres grouped by recorded rehabilitation year. Repeated works and undated links are not inferred.' },
    ],
    bridges: [
      { id: 'constructed', label: 'Bridge construction year', field: 'Year_Constructed', unit: 'bridges', kind: 'year', colour: '#6185dd', method: 'Bridges grouped by recorded construction year. This is a construction cohort, not an annual bridge inventory or deterioration trend.' },
    ],
    safety: [
      { id: 'incidents-monthly', label: 'Incidents by month', field: 'date', unit: 'incidents', kind: 'month', colour: '#e85e67', method: 'Mapped Kampala incidents grouped by recorded event month. Months with no records are shown as zero; this is not a national incident trend.' },
      { id: 'incidents-annual', label: 'Incidents by year', field: 'date', unit: 'incidents', kind: 'date-year', colour: '#e85e67', method: 'Mapped Kampala incidents grouped by recorded event year. This is not a national incident trend.' },
    ],
  };
  const unavailable = {
    culverts: 'The mapped Major Culvert layer has no recorded date or financial-year field. An annual condition trend cannot be inferred from one snapshot.',
    traffic: 'The mapped traffic-station locations have no observation date or financial-year field. Station counts are not traffic-volume time series; use the separate Traffic site for dated observations.',
    ferries: 'The mapped ferry-crossing layer has no dated observations. A time series cannot be constructed from its current categories.',
    aviation: 'The mapped aviation layer has no dated observations. A time series cannot be constructed from this snapshot.',
    freight: 'The mapped weighbridge layer has no dated observations. Planned and operational sites cannot be treated as annual counts.',
    rail: 'The mapped rail alignments have no dated observations. An alignment is not evidence of annual operational mileage.',
  };
  let activeMode = 'roads';
  let activeItems = [];
  let graph = null;
  let rows = [];
  let selected = null;
  let coverage = { dated: 0, undated: 0 };

  function year(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1900 && number <= 2100 ? number : null;
  }

  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }

  function bucket(value, kind) {
    if (kind === 'year') return year(value)?.toString() || null;
    const valid = date(value);
    return valid ? valid.slice(0, kind === 'month' ? 7 : 4) : null;
  }

  function weight(item, spec) {
    if (spec.unit !== 'mapped km') return 1;
    const raw = item.properties?.['Length Km'];
    const number = Number(raw);
    return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(number) && number >= 0 ? number : null;
  }

  function completeLabels(keys, kind) {
    const first = keys[0], last = keys[keys.length - 1];
    if (kind !== 'month') return Array.from({ length: Number(last) - Number(first) + 1 }, (_, index) => String(Number(first) + index));
    const [startYear, startMonth] = first.split('-').map(Number);
    const [endYear, endMonth] = last.split('-').map(Number);
    const months = (endYear - startYear) * 12 + endMonth - startMonth + 1;
    return Array.from({ length: months }, (_, index) => {
      const current = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
      return `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
    });
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${(/^[=+@\-\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  }

  function render() {
    graph?.destroy(); graph = null;
    rows = [];
    selected = (specs[activeMode] || []).find(spec => spec.id === $('timeline-metric').value);
    $('timeline-chart-wrap').hidden = true;
    $('timeline-download').disabled = true;
    if (!selected) {
      $('timeline-note').textContent = unavailable[activeMode] || 'No dated source field is available for this tab.';
      return;
    }
    const values = new Map();
    let dated = 0, undated = 0, unmeasured = 0, datedMeasure = 0, missingMeasure = 0;
    for (const item of activeItems) {
      const key = bucket(item.properties?.[selected.field], selected.kind);
      const amount = weight(item, selected);
      if (!key) { undated++; if (amount !== null) missingMeasure += amount; continue; }
      if (amount === null) { unmeasured++; continue; }
      dated++; datedMeasure += amount;
      values.set(key, (values.get(key) || 0) + amount);
    }
    const keys = [...values.keys()].sort();
    if (!keys.length) {
      $('timeline-note').textContent = `${selected.label}: no valid dated and measured records in this mapped population of ${activeItems.length.toLocaleString()}.`;
      return;
    }
    const labels = completeLabels(keys, selected.kind);
    rows = labels.map(label => ({ period: label, value: values.get(label) || 0 }));
    coverage = { dated, undated };
    const timeField = selected.kind === 'year' ? 'source year' : 'date';
    $('timeline-note').textContent = `${selected.method} Coverage: ${dated.toLocaleString()} of ${activeItems.length.toLocaleString()} mapped records have a valid ${timeField} and ${selected.unit === 'mapped km' ? 'length' : 'count'}; ${undated.toLocaleString()} lack a valid ${timeField}${unmeasured ? ` and ${unmeasured.toLocaleString()} lack a usable length` : ''}. ${selected.unit === 'mapped km' ? `${format.format(datedMeasure)} km dated, ${format.format(missingMeasure)} km undated. ` : ''}Source fields are observed, not modelled.`;
    $('timeline-chart').setAttribute('aria-label', `${selected.label}, ${rows.length} periods, ${dated} dated records, ${undated} without valid dates`);
    $('timeline-chart-wrap').hidden = false;
    $('timeline-download').disabled = false;
    if (typeof Chart === 'undefined') return;
    graph = new Chart($('timeline-chart'), {
      type: selected.kind === 'month' ? 'line' : 'bar',
      data: { labels, datasets: [{ label: selected.label, data: rows.map(row => row.value), borderColor: selected.colour, backgroundColor: selected.kind === 'month' ? `${selected.colour}33` : selected.colour, borderWidth: 2, fill: selected.kind === 'month', tension: .15, pointRadius: selected.kind === 'month' ? 2 : 0, maxBarThickness: 26 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${format.format(context.parsed.y)} ${selected.unit}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12, color: '#385b66' } }, y: { beginAtZero: true, grid: { color: '#d9e9ed' }, ticks: { color: '#385b66' } } } },
    });
  }

  function setMode(mode) {
    activeMode = mode;
    activeItems = [];
    const choices = specs[mode] || [];
    $('timeline-metric').replaceChildren(...choices.map(spec => new Option(spec.label, spec.id)));
    $('timeline-metric').disabled = !choices.length;
    graph?.destroy(); graph = null;
    $('timeline-chart-wrap').hidden = true;
    $('timeline-download').disabled = true;
    $('timeline-note').textContent = choices.length ? 'Loading dated source fields...' : unavailable[mode] || 'No dated source field is available for this tab.';
  }

  window.addEventListener('transportmodechange', event => setMode(event.detail?.mode || 'roads'));
  window.addEventListener('transportdataready', event => {
    if (event.detail?.mode !== activeMode || !Array.isArray(event.detail.items)) return;
    activeItems = event.detail.items;
    render();
  });
  $('timeline-metric').addEventListener('change', render);
  $('timeline-download').addEventListener('click', () => {
    if (!selected || !rows.length) return;
    const lines = [['Period', selected.unit, 'Source measure', 'Source population', 'Dated and measured records', 'Undated records', 'Method'], ...rows.map(row => [row.period, row.value, selected.label, activeItems.length, coverage.dated, coverage.undated, selected.method])];
    const blob = new Blob(['\uFEFF', lines.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `uganda-${activeMode}-${selected.id}-source-series.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  setMode(document.querySelector('.section-tabs button[aria-current="page"]')?.dataset.mode || 'roads');
  window.dispatchEvent(new Event('timeline-request'));
})();
