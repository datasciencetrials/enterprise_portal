(() => {
  'use strict';

  const roadFinancialYears = [
    { period: 'FY 2008-09', total: 10053, paved: 2916, unpaved: 7137, pavedShare: 29.01, unpavedShare: 70.99, changeKm: null, changePercent: null, totalDensity: 49.18 },
    { period: 'FY 2009-10', total: 10430, paved: 3119, unpaved: 7311, pavedShare: 29.90, unpavedShare: 70.10, changeKm: 377, changePercent: 3.75, totalDensity: 51.03 },
    { period: 'FY 2010-11', total: 20384, paved: 3264, unpaved: 17120, pavedShare: 16.01, unpavedShare: 83.99, changeKm: 9954, changePercent: 95.44, totalDensity: 99.73 },
    { period: 'FY 2011-12', total: 21000, paved: 3317, unpaved: 17683, pavedShare: 15.80, unpavedShare: 84.20, changeKm: 616, changePercent: 3.02, totalDensity: 102.74 },
    { period: 'FY 2012-13', total: 21000, paved: 3490, unpaved: 17510, pavedShare: 16.62, unpavedShare: 83.38, changeKm: 0, changePercent: 0, totalDensity: 102.74 },
    { period: 'FY 2013-14', total: 20544, paved: 3795, unpaved: 16749, pavedShare: 18.47, unpavedShare: 81.53, changeKm: -456, changePercent: -2.17, totalDensity: 100.51 },
    { period: 'FY 2014-15', total: 20544, paved: 3919, unpaved: 16625, pavedShare: 19.08, unpavedShare: 80.92, changeKm: 0, changePercent: 0, totalDensity: 100.51 },
    { period: 'FY 2015-16', total: 20544, paved: 4157, unpaved: 16387, pavedShare: 20.23, unpavedShare: 79.77, changeKm: 0, changePercent: 0, totalDensity: 100.51 },
    { period: 'FY 2016-17', total: 20544, paved: 4257, unpaved: 16287, pavedShare: 20.72, unpavedShare: 79.28, changeKm: 0, changePercent: 0, totalDensity: 100.51 },
    { period: 'FY 2017-18', total: 20544, paved: 4636, unpaved: 15908, pavedShare: 22.57, unpavedShare: 77.43, changeKm: 0, changePercent: 0, totalDensity: 100.51 },
    { period: 'FY 2018-19', total: 20856, paved: 5015, unpaved: 15841, pavedShare: 24.05, unpavedShare: 75.95, changeKm: 312, changePercent: 1.52, totalDensity: 102.04 },
    { period: 'FY 2019-20', total: 21010, paved: 5398, unpaved: 15612, pavedShare: 25.69, unpavedShare: 74.31, changeKm: 154, changePercent: 0.74, totalDensity: 102.79 },
    { period: 'FY 2020-21', total: 21020, paved: 5528, unpaved: 15492, pavedShare: 26.30, unpavedShare: 73.70, changeKm: 10, changePercent: 0.05, totalDensity: 102.84 },
    { period: 'FY 2021-22', total: 21120, paved: 5745, unpaved: 15375, pavedShare: 27.20, unpavedShare: 72.80, changeKm: 100, changePercent: 0.48, totalDensity: 103.33 },
    { period: 'FY 2022-23', total: 21200, paved: 6056, unpaved: 15144, pavedShare: 28.57, unpavedShare: 71.43, changeKm: 80, changePercent: 0.38, totalDensity: 103.72 },
    { period: 'FY 2023-24', total: 21288, paved: 6306, unpaved: 14982, pavedShare: 29.62, unpavedShare: 70.38, changeKm: 88, changePercent: 0.42, totalDensity: 104.15 },
    { period: 'FY 2024-25', total: 21291, paved: 6312, unpaved: 14979, pavedShare: 29.65, unpavedShare: 70.35, changeKm: 3, changePercent: 0.01, totalDensity: 104.16 },
    { period: 'FY 2025-26', total: 21302, paved: 6405.05, unpaved: 14896.76, pavedShare: 30.07, unpavedShare: 69.93, changeKm: 10.82, changePercent: 0.05, totalDensity: 104.22 },
    { period: 'FY 2026-27', total: 21284, paved: 6406.69, unpaved: 14877.33, pavedShare: 30.10, unpavedShare: 69.90, changeKm: -17.80, changePercent: -0.08, totalDensity: 104.13 },
  ];

  const atcMonthly = [
    { period: '07/2025', vehicles: 299317, light: 264956, heavy: 34361, averageSpeed: 50.97, weightedP85Speed: 66.39, activeSites: 1, reportingDays: 19, hourlyRows: 449 },
    { period: '08/2025', vehicles: 1180253, light: 978079, heavy: 202174, averageSpeed: 49.07, weightedP85Speed: 63.20, activeSites: 5, reportingDays: 31, hourlyRows: 1873 },
    { period: '09/2025', vehicles: 2307334, light: 1869288, heavy: 438046, averageSpeed: 47.28, weightedP85Speed: 60.47, activeSites: 6, reportingDays: 30, hourlyRows: 3846 },
    { period: '10/2025', vehicles: 2157254, light: 1769540, heavy: 387714, averageSpeed: 46.50, weightedP85Speed: 59.63, activeSites: 8, reportingDays: 31, hourlyRows: 4913 },
    { period: '11/2025', vehicles: 2426158, light: 2038727, heavy: 387431, averageSpeed: 49.22, weightedP85Speed: 63.22, activeSites: 10, reportingDays: 30, hourlyRows: 5931 },
    { period: '12/2025', vehicles: 4348009, light: 3728957, heavy: 619052, averageSpeed: 50.43, weightedP85Speed: 64.63, activeSites: 10, reportingDays: 31, hourlyRows: 7440 },
    { period: '01/2026', vehicles: 4101914, light: 3516086, heavy: 585828, averageSpeed: 50.61, weightedP85Speed: 64.71, activeSites: 10, reportingDays: 31, hourlyRows: 7440 },
    { period: '02/2026', vehicles: 3212566, light: 2728268, heavy: 484298, averageSpeed: 50.09, weightedP85Speed: 64.23, activeSites: 10, reportingDays: 27, hourlyRows: 5645 },
  ];

  const trafficProjection = [
    { period: '2016', value: 1826.45 }, { period: '2017', value: 1896.37 },
    { period: '2018', value: 1969.08 }, { period: '2019', value: 2044.83 },
    { period: '2020', value: 2123.61 }, { period: '2021', value: 2595.11 },
    { period: '2022', value: 2278.86 }, { period: '2023', value: 2259.11 },
    { period: '2024', value: 2765.51 }, { period: '2025', value: 2568.47 },
    { period: '2026', value: 2668.68 }, { period: '2027', value: 2773.00 },
    { period: '2028', value: 2881.62 }, { period: '2029', value: 2994.77 },
    { period: '2030', value: 3112.57 }, { period: '2031', value: 3235.26 },
    { period: '2032', value: 3363.09 }, { period: '2033', value: 3496.15 },
    { period: '2034', value: 3634.80 }, { period: '2035', value: 3779.24 },
  ];

  window.TRANSPORT_TIME_SERIES_DATA = Object.freeze({ roadFinancialYears, atcMonthly, trafficProjection });
})();
