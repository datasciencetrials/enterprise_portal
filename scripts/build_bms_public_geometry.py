"""Build a public BMS structure layer with only spatially verified map points.

Usage: py scripts/build_bms_public_geometry.py BACKEND_MDB BOUNDARY_SHP NETWORK_GEOJSON OUTPUT_DIR
The output retains every register entry. Unresolved positions have null geometry
and remain in the table, never plotted at guessed coordinates. Coordinates are
aligned to the named road only when the backend position is within 100 metres.
Only explicitly whitelisted public fields are exported.
"""

import json
import sys
from collections import Counter
from pathlib import Path

import pyodbc
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import Point, mapping, shape
from shapely.ops import nearest_points, transform, unary_union


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    database_path, boundary_path, network_path, output = map(Path, sys.argv[1:])
    output.mkdir(parents=True, exist_ok=True)
    reader = shapefile.Reader(str(boundary_path))
    boundary_crs = CRS.from_wkt(boundary_path.with_suffix('.prj').read_text())
    to_wgs = Transformer.from_crs(boundary_crs, 4326, always_xy=True).transform
    to_m = Transformer.from_crs(4326, 32636, always_xy=True).transform
    from_m = Transformer.from_crs(32636, 4326, always_xy=True).transform
    arc_utm_to_wgs = Transformer.from_crs(boundary_crs, 4326, always_xy=True).transform
    wgs_utm_to_wgs = Transformer.from_crs(32636, 4326, always_xy=True).transform
    boundary = unary_union([transform(to_wgs, shape(item.shape.__geo_interface__)) for item in reader.iterShapeRecords()])
    network = json.loads(network_path.read_text(encoding='utf-8'))['features']
    roads = {}
    for feature in network:
        properties = feature.get('properties') or {}
        road_no = str(properties.get('Road No 1') or '')
        link_id = str(properties.get('Link Id 1') or '')
        if road_no and link_id and feature.get('geometry'):
            roads.setdefault(road_no, []).append((link_id, transform(to_m, shape(feature['geometry'])), properties))
    connection = pyodbc.connect('DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=' + str(database_path) + ';ReadOnly=1', timeout=10)
    cursor = connection.cursor()
    bridge_types = {str(code): description for code, description in cursor.execute('SELECT Code, Description FROM tblAC_TBridge')}
    culvert_types = {str(code): description for code, description in cursor.execute('SELECT Code, Description FROM tblACCul_TCulvert')}
    alternate_bridge_coordinates = {str(number): (east, south) for number, east, south in cursor.execute(
        'SELECT [BRIDGE NO], [LATITUDE], [LONGITUDE] FROM Bridges')}

    def place(east, south, road_reference):
        if east is None or south is None:
            return None, None, None
        east, south = float(east), float(south)
        candidate_coords = [('direct', (east, south)), ('swapped', (south, east))]
        if 100000 <= east <= 900000 and -200000 <= south <= 1200000:
            candidate_coords.extend([('arc1960_utm36', arc_utm_to_wgs(east, south)), ('wgs84_utm36', wgs_utm_to_wgs(east, south))])
        road_ref = str(road_reference or '')
        root = road_ref.split('_Link')[0]
        candidates = roads.get(root, [])
        if '_Link' in road_ref:
            exact = [entry for entry in candidates if entry[0] == road_ref]
            if exact:
                candidates = exact
        matches = []
        for method, (longitude, latitude) in candidate_coords:
            if not (28 <= longitude <= 36 and -2 <= latitude <= 5):
                continue
            point = Point(longitude, latitude)
            if not boundary.covers(point):
                continue
            point_m = transform(to_m, point)
            for link_id, line_m, attributes in candidates:
                distance = point_m.distance(line_m)
                if distance <= 100:
                    snapped = transform(from_m, nearest_points(point_m, line_m)[1])
                    if boundary.covers(snapped):
                        matches.append((distance, method, snapped, link_id, attributes))
        if not matches:
            return None, None, None
        distance, method, point, link_id, attributes = min(matches, key=lambda match: match[0])
        return point, link_id, attributes

    def clean(value):
        return str(value).strip() if value is not None and str(value).strip() else None

    result = {}
    counts = Counter()
    bridge_query = ('SELECT BridgeNumber, BridgeName, CoOrdinateE, CoOrdinateS, [Link], River, '
                    'TypeBridge, CompletionYear, Maint_Auth FROM tblB_Bridge')
    bridges = []
    for number, name, east, south, road, river, type_code, year, authority in cursor.execute(bridge_query):
        point, link_id, attributes = place(east, south, road)
        if point is None and str(number) in alternate_bridge_coordinates:
            alternate_east, alternate_south = alternate_bridge_coordinates[str(number)]
            point, link_id, attributes = place(alternate_east, alternate_south, road)
        counts['bridge_total'] += 1
        counts['bridge_mapped' if point else 'bridge_unresolved'] += 1
        properties = {
            'Bridge_Number': clean(number), 'Bridge_Name': clean(name), 'Link_Number': link_id or clean(road),
            'River_Crossing': clean(river), 'Maintenance_Station': clean(authority),
            'Maintenance_Region': clean(attributes.get('Region')) if attributes else None,
            'Structure_Type': bridge_types.get(str(type_code)),
            'Year_Constructed': int(year) if year is not None and 1800 <= int(year) <= 2100 else None,
            'Position_Status': 'Verified on mapped road link' if point else 'Position requires verification',
        }
        bridges.append({'type': 'Feature', 'geometry': mapping(point) if point else None, 'properties': properties})
    result['bridges.geojson'] = bridges

    culvert_query = ('SELECT CulvertNumber, CoOrdinateE, CoOrdinateS, [Link], SectionOrLinkNo, '
                     'TypeCulvert, SpanOrDiameter, NoOfPipesOrCells FROM tblCul_Culvert')
    culverts = []
    for number, east, south, road, section, type_code, span, cells in cursor.execute(culvert_query):
        point, link_id, attributes = place(east, south, section or road)
        if point is None and section and road and str(section) != str(road):
            point, link_id, attributes = place(east, south, road)
        counts['culvert_total'] += 1
        counts['culvert_mapped' if point else 'culvert_unresolved'] += 1
        span_m = float(span) if span is not None and 0 < float(span) <= 100 else None
        properties = {
            'Culvert_Number': clean(number), 'Link_Number': link_id or clean(section) or clean(road),
            'Maintenance_Region': clean(attributes.get('Region')) if attributes else None,
            'Culvert_Structure_Type': culvert_types.get(str(type_code)),
            'Span_Diameter_m': round(span_m, 2) if span_m is not None else None,
            'Cell_Count': int(cells) if cells is not None and 0 < int(cells) <= 100 else None,
            'Position_Status': 'Verified on mapped road link' if point else 'Position requires verification',
        }
        culverts.append({'type': 'Feature', 'geometry': mapping(point) if point else None, 'properties': properties})
    result['major_culverts.geojson'] = culverts

    for filename, features in result.items():
        ids = [feature['properties'].get('Bridge_Number') or feature['properties'].get('Culvert_Number') for feature in features]
        if len(ids) != len(set(ids)):
            raise RuntimeError(f'Duplicate structure identifiers in {filename}')
        target = output / filename
        target.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(dict(counts), sort_keys=True))


if __name__ == '__main__':
    main()
