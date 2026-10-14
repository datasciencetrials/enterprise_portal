// Real data loaders. Every function fetches the SAME live data files this
// platform already serves — no fabricated numbers are introduced here.
// Paths are relative (no leading slash) so they resolve correctly under
// whatever subpath the site is deployed at.

const DataStore = (() => {
  const cache = {};
  async function getJSON(path){
    if(cache[path]) return cache[path];
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error('Failed to load '+path+': '+res.status);
    const json = await res.json();
    cache[path] = json;
    return json;
  }

  async function network(){ return getJSON('network.geojson'); }
  async function bridgesGeo(){ return getJSON('geo/bridges.geojson'); }
  async function culvertsGeo(){ return getJSON('geo/major_culverts.geojson'); }
  async function ducarRoads(){ return getJSON('geo/ducar_all_roads_2025.geojson'); }
  async function ducarConditionSummary(){ return getJSON('geo/ducar_district_condition_summary.geojson'); }
  async function maintRegions(){ return getJSON('geo/maintenance_regions.geojson'); }
  async function msSummary(){ return getJSON('maintenance_strategy_summary.json'); }
  async function msDetail(){ return getJSON('maintenance_strategy_detail.json'); }
  async function ibpProjects(){ return getJSON('geo/ibp_road_projects_by_year.json'); }
  async function protectedAreas(){ return getJSON('geo/protected_areas.geojson'); }
  async function forestReserves(){ return getJSON('geo/forest_reserves.geojson'); }
  async function wetlands(){ return getJSON('geo/wetlands.geojson'); }
  async function gazettedAreas(){ return getJSON('geo/gazetted_areas.geojson'); }
  async function weighbridges(){ return getJSON('geo/weighbridges.geojson'); }
  async function trafficStations(){ return getJSON('geo/traffic_count_stations.geojson'); }
  async function oprcContracts(){ return getJSON('geo/oprc_contracts.geojson'); }
  async function ndpivProjects(){ return getJSON('geo/ndpiv_investment_projects.geojson'); }
  async function towns(){ return getJSON('geo/towns.geojson'); }
  async function districts(){ return getJSON('geo/districts.geojson'); }
  async function airports(){ return getJSON('geo/airports.geojson'); }
  async function ferryCrossings(){ return getJSON('geo/ferry_crossings.geojson'); }
  async function kampalaIncidents(){ return getJSON('geo/kampala_traffic_incidents.geojson'); }
  async function fieldVerification(){ return getJSON('geo/field_verification.geojson'); }
  async function roadDensity(){ return getJSON('road_density_by_subregion.json'); }
  async function trafficComposition(){ return getJSON('traffic_composition_2025.json'); }
  async function weighbridgeDistrictCoverage(){ return getJSON('weighbridge_district_coverage.json'); }

  const REGIONS = ['Central','Eastern','North Eastern','Northern','Southern','Western'];
  const CLASS_LABELS = {A:'Class A — International Trunk', B:'Class B — National Trunk', C:'Class C — Primary / District', M:'Expressway (Class M)'};

  // ---- canonical network stats, computed live from network.geojson (single source of truth) ----
  let _netStatsCache = null;
  async function networkStats(){
    if(_netStatsCache) return _netStatsCache;
    const d = await network();
    const feats = d.features;
    let totalKm=0, pavedKm=0, unpavedKm=0;
    const byRegion = {}, byClass = {}, byCondition = {}, bySurface = {};
    REGIONS.forEach(r=> byRegion[r] = {paved:0, unpaved:0, total:0, links:0});
    feats.forEach(f=>{
      const p = f.properties;
      const km = p['Length Km'] || 0;
      totalKm += km;
      const isPaved = p['Pavement Class']==='Paved';
      if(isPaved) pavedKm += km; else unpavedKm += km;
      const rg = p['Region'];
      if(byRegion[rg]){ byRegion[rg].total += km; byRegion[rg].links++; if(isPaved) byRegion[rg].paved+=km; else byRegion[rg].unpaved+=km; }
      const cls = p['Road Cla 1'];
      byClass[cls] = (byClass[cls]||0) + km;
      const cond = p['Condition']||'Not assessed';
      byCondition[cond] = (byCondition[cond]||0) + 1;
      const surf = p['Surface Material']||p['Pavement Class'];
      bySurface[surf] = (bySurface[surf]||0) + km;
    });
    _netStatsCache = {
      totalKm, pavedKm, unpavedKm, linkCount: feats.length,
      byRegion, byClass, byCondition, bySurface,
      source: 'Computed live from the platform’s GIS road-network inventory (network.geojson, ' + feats.length + ' links).'
    };
    return _netStatsCache;
  }

  // link_id -> link_name lookup (decode raw codes to real road names)
  let _linkNameMap = null;
  async function linkNameMap(){
    if(_linkNameMap) return _linkNameMap;
    const detail = await msDetail();
    const map = {};
    (detail.road_links||[]).forEach(r=>{ if(r.link_id) map[r.link_id] = r.link_name || r.road_no || r.link_id; });
    _linkNameMap = map;
    return map;
  }
  function decodeLinkId(id, map){ return (map && map[id]) ? map[id] : id; }

  return {
    getJSON, network, bridgesGeo, culvertsGeo, ducarRoads, ducarConditionSummary, maintRegions,
    msSummary, msDetail, ibpProjects, protectedAreas, forestReserves, wetlands, gazettedAreas,
    weighbridges, trafficStations, oprcContracts, ndpivProjects, towns, districts, airports,
    ferryCrossings, kampalaIncidents, fieldVerification, roadDensity, trafficComposition, weighbridgeDistrictCoverage, networkStats, linkNameMap, decodeLinkId,
    REGIONS, CLASS_LABELS
  };
})();
