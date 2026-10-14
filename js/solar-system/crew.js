// Crew rosters per subsystem planet. Roles only — no real staff names, matching the platform's
// standing confidentiality rule. Status labels are presentational flavor (which planet is being
// viewed), not a claim about real personnel activity.

const Crew = (() => {
  const ROLES_BY_PLANET = {
    pms:    ['Pavement Engineer', 'Defect Survey Technician', 'Reseal & Overlay Lead'],
    tis:    ['Traffic Engineer', 'Axle Load Analyst', 'Congestion Modeler'],
    bms:    ['Bridge Engineer', 'Structural Inspector', 'Culvert Assessment Lead'],
    socio:  ['Economist', 'NDP IV Liaison', 'Corridor Access Analyst'],
    budget: ['Asset Valuation Analyst', 'LCCA Modeler', 'Budget Planning Officer'],
    lidar:  ['GIS Analyst', 'Remote Sensing Specialist', 'Point Cloud Technician'],
    piarc:  ['Standards Officer', 'Benchmarking Analyst', 'International Liaison'],
    pims:   ['Projects Officer', 'Procurement Analyst', 'Contractor Performance Lead'],
  };
  const STATUSES = ['On site', 'Surveying', 'Reporting', 'Reviewing data'];

  function rosterFor(planetId){
    const roles = ROLES_BY_PLANET[planetId] || [];
    return roles.map((role, i) => ({
      role,
      status: STATUSES[(i + planetId.length) % STATUSES.length],
    }));
  }

  return { ROLES_BY_PLANET, rosterFor };
})();
