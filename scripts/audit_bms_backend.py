"""Read-only spatial QA of Access BMS coordinates against Uganda and road links.

Usage: py scripts/audit_bms_backend.py BACKEND_MDB BOUNDARY_SHP NETWORK_GEOJSON
"""

import json
import sys
from collections import Counter
from pathlib import Path

import pyodbc
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    database_path, boundary_path, network_path = map(Path, sys.argv[1:])
    reader = shapefile.Reader(str(boundary_path))
    boundary_crs = CRS.from_wkt(boundary_path.with_suffix('.prj').read_text())
    boundary = unary_union([transform(Transformer.from_crs(boundary_crs, 4326, always_xy=True).transform, shape(item.shape.__geo_interface__)) for item in reader.iterShapeRecords()])
    project = Transformer.from_crs(4326, 32636, always_xy=True).transform
    utm_arc = Transformer.from_crs(boundary_crs, 4326, always_xy=True).transform
    utm_wgs = Transformer.from_crs(32636, 4326, always_xy=True).transform
    roads = json.loads(network_path.read_text(encoding='utf-8'))['features']
    by_road = {}
    for feature in roads:
        p = feature.get('properties') or {}
        road_no = str(p.get('Road No 1') or '')
        if road_no and feature.get('geometry'):
            by_road.setdefault(road_no, []).append(transform(project, shape(feature['geometry'])))
    connection = pyodbc.connect('DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=' + str(database_path) + ';ReadOnly=1', timeout=10)
    cursor = connection.cursor()
    queries = [
        ('Bridges', 'SELECT BridgeNumber, CoOrdinateE, CoOrdinateS, [Link] FROM tblB_Bridge'),
        ('Major Culverts', 'SELECT CulvertNumber, CoOrdinateE, CoOrdinateS, [Link] FROM tblCul_Culvert'),
    ]
    for title, query in queries:
        rows = cursor.execute(query).fetchall()
        counts = Counter()
        examples = []
        for number, east, south, road_no in rows:
            counts['total'] += 1
            if east is None or south is None:
                counts['missing_coordinates'] += 1
                continue
            east, south = float(east), float(south)
            candidates = [('direct', (east, south)), ('swapped', (south, east))]
            if 100000 <= east <= 900000 and -200000 <= south <= 1200000:
                candidates.extend([('arc1960_utm36', utm_arc(east, south)), ('wgs84_utm36', utm_wgs(east, south))])
            valid = [(method, Point(lon, lat)) for method, (lon, lat) in candidates if 28 <= lon <= 36 and -2 <= lat <= 5]
            in_uganda = [(method, point) for method, point in valid if boundary.covers(point)]
            if not in_uganda:
                counts['no_candidate_inside_uganda'] += 1
                if len(examples) < 12: examples.append([str(number), 'outside', east, south])
                continue
            road_lines = by_road.get(str(road_no or ''), [])
            if not road_lines:
                counts['road_number_not_in_mapped_national_subset'] += 1
                if len(examples) < 12: examples.append([str(number), 'road_missing', str(road_no)])
                continue
            matches = sorted((min(transform(project, point).distance(line) for line in road_lines), method) for method, point in in_uganda)
            distance, method = matches[0]
            counts['matched_road_number'] += 1
            counts['candidate_' + method] += 1
            if distance <= 30: counts['within_30m'] += 1
            elif distance <= 100: counts['within_100m'] += 1
            elif distance <= 500: counts['within_500m'] += 1
            else:
                counts['over_500m'] += 1
                if len(examples) < 12: examples.append([str(number), 'distance_m', round(distance), str(road_no)])
        print(title, json.dumps(dict(counts), sort_keys=True))
        print('examples', json.dumps(examples))


if __name__ == '__main__':
    main()
