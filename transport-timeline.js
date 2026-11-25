(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const historical = window.TRANSPORT_TIME_SERIES_DATA || { roadFinancialYears: [], atcMonthly: [], trafficProjection: [] };
  const specs = {
    roads: [
      {
        id: 'network-length-fy',
        label: 'National Roads length by financial year (km)',
        unit: 'km',
        kind: 'financial-year',
        colour: '#0071E3',
        method: 'Annual National Roads length reported in whole kilometres.',
        series: historical.roadFinancialYears.map(row => ({ period: row.period, value: row.total })),
      },
      { id: 'surface-length-fy', label: 'Paved and Unpaved length by financial year (km)', unit: 'km', kind: 'financial-year', method: 'Annual National Roads surface composition in kilometres.', seriesRows: historical.roadFinancialYears, datasets: [{ key: 'paved', label: 'Paved', colour: '#0E8A6A' }, { key: 'unpaved', label: 'Unpaved', colour: '#D97706' }] },
      { id: 'surface-share-fy', label: 'Paved and Unpaved share by financial year (%)', unit: '%', kind: 'financial-year', method: 'Annual National Roads surface shares.', seriesRows: historical.roadFinancialYears, datasets: [{ key: 'pavedShare', label: 'Paved', colour: '#0E8A6A' }, { key: 'unpavedShare', label: 'Unpaved', colour: '#D97706' }] },
      { id: 'network-change-fy', label: 'Annual network change (km)', unit: 'km', kind: 'financial-year', chartType: 'bar', colour: '#7C3AED', method: 'Annual change in reported National Roads length from the previous financial year.', series: historical.roadFinancialYears.filter(row => row.changeKm !== null).map(row => ({ period: row.period, value: row.changeKm })) },
      { id: 'network-change-percent-fy', label: 'Annual network change (%)', unit: '%', kind: 'financial-year', chartType: 'bar', colour: '#C2415D', method: 'Annual percentage change in reported National Roads length from the previous financial year.', series: historical.roadFinancialYears.filter(row => row.changePercent !== null).map(row => ({ period: row.period, value: row.changePercent })) },
      { id: 'network-density-fy', label: 'National Road Network density by financial year', unit: 'km per 1,000 km²', kind: 'financial-year', colour: '#1769AA', method: 'Annual National Road Network length per 1,000 square kilometres of land.', series: historical.roadFinancialYears.map(row => ({ period: row.period, value: row.totalDensity })) },
      { id: 'completed', label: 'Road completion cohort (km)', field: 'Completion Year', unit: 'km', kind: 'year', colour: '#0071E3', method: 'National Road Network physical length (km) grouped by completion year across the 21,284.02 km layer.' },
      { id: 'rehabilitated', label: 'Road rehabilitation cohort (km)', field: 'Rehabilitation Year', unit: 'km', kind: 'year', colour: '#16A34A', method: 'National Road Network physical length (km) grouped by most recent rehabilitation intervention year.' },
    ],
    bridges: [
      { id: 'constructed', label: 'Bridge construction cohort (552 Bridges)', field: 'Year_Constructed', unit: 'bridges', kind: 'year', colour: '#0071E3', method: 'National Bridge Management System (BMS) inventory of 552 Bridges grouped by year constructed.' },
    ],
    culverts: [
      { id: 'constructed', label: 'Major Culvert construction cohort (452 Culverts)', field: 'Year_Constructed', unit: 'major culverts', kind: 'year', colour: '#0891B2', method: 'National Bridge Management System (BMS) inventory of 452 Major Culverts grouped by year constructed.' },
    ],
    traffic: [
      { id: 'atc-volume-monthly', label: 'Recorded ATC traffic by month', unit: 'vehicles', kind: 'month-series', method: 'Historical hourly vehicle observations aggregated by month. Coverage varies by active station and reporting period.', seriesRows: historical.atcMonthly, datasets: [{ key: 'vehicles', label: 'All vehicles', colour: '#1769AA' }, { key: 'light', label: 'Light vehicles', colour: '#0E8A6A' }, { key: 'heavy', label: 'Heavy vehicles', colour: '#D97706' }] },
      { id: 'atc-speed-monthly', label: 'Recorded ATC speed by month (km/h)', unit: 'km/h', kind: 'month-series', method: 'Historical flow-weighted directional speed observations aggregated by month.', seriesRows: historical.atcMonthly, datasets: [{ key: 'averageSpeed', label: 'Average speed', colour: '#1769AA' }, { key: 'weightedP85Speed', label: 'Flow-weighted recorded 85th percentile speed', colour: '#C2415D' }] },
      { id: 'atc-coverage-monthly', label: 'ATC reporting coverage by month', unit: 'count', kind: 'month-series', method: 'Historical monthly reporting coverage. Counts show active stations and calendar days with at least one recorded observation.', seriesRows: historical.atcMonthly, datasets: [{ key: 'activeSites', label: 'Active stations', colour: '#7C3AED' }, { key: 'reportingDays', label: 'Reporting days', colour: '#0E8A6A' }] },
      { id: 'atc-records-monthly', label: 'ATC hourly records by month', unit: 'hourly records', kind: 'month-series', chartType: 'bar', colour: '#0891B2', method: 'Count of historical hourly ATC records available in each month.', series: historical.atcMonthly.map(row => ({ period: row.period, value: row.hourlyRows })) },
      { id: 'aadt-modelled', label: 'Modelled length-weighted AADT, 2016-2035', unit: 'vehicles/day', kind: 'year-series', colour: '#7C3AED', method: 'Modelled length-weighted AADT series. Values are projections and are not live traffic observations.', series: historical.trafficProjection },
      { id: 'survey-year', label: 'Traffic station telemetry cohort', field: 'Survey_Year', unit: 'stations', kind: 'year', colour: '#D97706', method: 'National Traffic Census stations (298) grouped by baseline telemetry calibration year.' },
    ],
    ferries: [
      { id: 'commission-year', label: 'Ferry crossing modernisation cohort', field: 'Commission_Year', unit: 'crossings', kind: 'year', colour: '#0071E3', method: 'National Inland Water Transport ferry crossings (20) grouped by vessel commissioning and landing upgrade year.' },
    ],
    aviation: [
      { id: 'upgrade-year', label: 'Aerodrome infrastructure upgrade cohort', field: 'Upgrade_Year', unit: 'aerodromes', kind: 'year', colour: '#7C3AED', method: 'National Civil Aviation aerodromes (13) grouped by runway and terminal upgrade cycle.' },
    ],
    safety: [
      { id: 'incidents-monthly', label: 'Safety observations by month', field: 'date', unit: 'observations', kind: 'month', colour: '#DC2626', method: 'Published road safety observations grouped by month (mm/yyyy).' },
      { id: 'incidents-annual', label: 'Safety observations by year', field: 'date', unit: 'observations', kind: 'date-year', colour: '#EA580C', method: 'Corridor road safety observations grouped by calendar year.' },
    ],
    freight: [
      { id: 'commission-year', label: 'Weighbridge station deployment cohort', field: 'Commission_Year', unit: 'weighbridges', kind: 'year', colour: '#EA580C', method: 'National Axle Load Control weighbridge facilities (21) grouped by commissioning and corridor expansion year.' },
    ],
    rail: [
      { id: 'rehab-year', label: 'Railway corridor programme cohort (km)', field: 'Rehabilitation_Year', unit: 'km', kind: 'year', colour: '#16A34A', method: 'National Railway Network route length (1,266.00 km MGR and 272.00 km SGR) by corridor rehabilitation and alignment year.' },
    ],
  };

  let activeMode = 'roads';
  let activeItems = [];
  let graph = null;
  let rows = [];
  let selected = null;
  let renderedDatasets = [];

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
    if (!valid) return null;
    if (kind === 'month') {
      const [y, m] = valid.slice(0, 7).split('-');
      return `${y}-${m}`;
    }
    return valid.slice(0, 4);
  }

  function displayLabel(key, kind) {
    if (kind === 'month' && /^\d{4}-\d{2}$/.test(key)) {
      const [y, m] = key.split('-');
      return `${m}/${y}`;
    }
    return key;
  }

  function weight(item, spec) {
    if (spec.unit !== 'km') return 1;
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
    renderedDatasets = [];
    selected = (specs[activeMode] || []).find(spec => spec.id === $('timeline-metric').value) || (specs[activeMode] || [])[0];
    if (!selected) return;
    if (Array.isArray(selected.seriesRows) && Array.isArray(selected.datasets)) {
      rows = selected.seriesRows.map(row => ({ ...row }));
      renderedDatasets = selected.datasets.map(dataset => ({ ...dataset, unit: dataset.unit || selected.unit }));
      $('timeline-note').textContent = `${selected.method} All ${rows.length} periods from ${rows[0].period} to ${rows.at(-1).period} are shown.`;
    } else if (Array.isArray(selected.series)) {
      rows = selected.series.map(row => ({ period: row.period, value: row.value }));
      renderedDatasets = [{ key: 'value', label: selected.label, colour: selected.colour, unit: selected.unit }];
      $('timeline-note').textContent = `${selected.method} All ${rows.length} periods from ${rows[0].period} to ${rows.at(-1).period} are shown.`;
    } else {
      const values = new Map();
      let totalMeasure = 0;
      for (const item of activeItems) {
        const key = bucket(item.properties?.[selected.field], selected.kind);
        const amount = weight(item, selected);
        if (!key || amount === null) continue;
        totalMeasure += amount;
        values.set(key, (values.get(key) || 0) + amount);
      }
      const keys = [...values.keys()].sort();
      if (!keys.length) {
        $('timeline-note').textContent = `${selected.method} No valid period data are available in the approved published snapshot.`;
        return;
      }
      const rawLabels = completeLabels(keys, selected.kind);
      rows = rawLabels.map(k => ({ period: displayLabel(k, selected.kind), value: Number((values.get(k) || 0).toFixed(2)) }));
      renderedDatasets = [{ key: 'value', label: selected.label, colour: selected.colour, unit: selected.unit }];
      $('timeline-note').textContent = `${selected.method} Total coverage: ${format.format(totalMeasure)} ${selected.unit} across ${rows.length} periods, calculated in the browser from the approved published snapshot.`;
    }
    $('timeline-chart').setAttribute('aria-label', `${selected.label} across ${rows.length} periods`);
    $('timeline-chart-wrap').hidden = false;
    $('timeline-download').disabled = false;
    if (typeof Chart === 'undefined') return;
    const isTimeSeries = ['month', 'financial-year', 'month-series', 'year-series'].includes(selected.kind);
    const chartType = selected.chartType || (isTimeSeries ? 'line' : 'bar');
    graph = new Chart($('timeline-chart'), {
      type: chartType,
      data: {
        labels: rows.map(r => r.period),
        datasets: renderedDatasets.map(dataset => ({
          label: dataset.label,
          data: rows.map(row => row[dataset.key]),
          borderColor: dataset.colour,
          backgroundColor: chartType === 'line' ? `${dataset.colour}1F` : dataset.colour,
          borderWidth: 2,
          borderRadius: chartType === 'line' ? 0 : 5,
          fill: false,
          tension: .25,
          pointRadius: chartType === 'line' ? 3 : 0,
          pointHoverRadius: chartType === 'line' ? 5 : 0,
          maxBarThickness: 28,
          unit: dataset.unit,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: renderedDatasets.length > 1, position: 'bottom', labels: { color: '#334155', usePointStyle: true, boxWidth: 9, font: { family: 'Arial', size: 11 } } },
          tooltip: { backgroundColor: '#FFFFFF', titleColor: '#0F172A', bodyColor: '#334155', borderColor: '#E2E8F0', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: context => `${context.dataset.label}: ${format.format(context.parsed.y)} ${context.dataset.unit}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 14, color: '#334155', font: { family: 'Arial', size: 10 } } },
          y: { beginAtZero: !['network-length-fy', 'network-density-fy', 'aadt-modelled'].includes(selected.id), max: selected.id === 'surface-share-fy' ? 100 : undefined, grid: { color: '#E2E8F0' }, ticks: { color: '#334155', font: { family: 'Arial', size: 10 } } }
        }
      },
    });
  }

  function setMode(mode) {
    activeMode = mode;
    activeItems = [];
    const choices = specs[mode] || [];
    $('timeline-title').textContent = mode === 'roads' ? 'National Road Network time series' : mode === 'traffic' ? 'Traffic time series' : 'Temporal distribution for this transport layer';
    $('timeline-metric').replaceChildren(...choices.map(spec => new Option(spec.label, spec.id)));
    $('timeline-metric').disabled = !choices.length;
    graph?.destroy(); graph = null;
    $('timeline-note').textContent = 'Loading temporal fields from the approved published snapshot...';
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
    const lines = [
      ['Period', ...renderedDatasets.map(dataset => `${dataset.label} (${dataset.unit})`), 'Methodology'],
      ...rows.map(row => [row.period, ...renderedDatasets.map(dataset => row[dataset.key]), selected.method]),
    ];
    const blob = new Blob(['\uFEFF', lines.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `data-science-trials-${activeMode}-${selected.id}-series.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  setMode(document.querySelector('.section-tabs button[aria-current="page"]')?.dataset.mode || 'roads');
  window.dispatchEvent(new Event('timeline-request'));
})();
