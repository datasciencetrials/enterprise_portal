"""Read-only bridge and major-culvert QA against a boundary and linked roads.

Usage: py scripts/audit_structure_positions.py BOUNDARY_SHP NETWORK_GEOJSON BRIDGES_GEOJSON CULVERTS_GEOJSON
No coordinates are moved by this audit. Distances are in approximate UTM 36N metres.
"""

import json
import sys
from collections import Counter
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    boundary_path, network_path, bridge_path, culvert_path = map(Path, sys.argv[1:])
    boundary_reader = shapefile.Reader(str(boundary_path))
    boundary_crs = CRS.from_wkt(boundary_path.with_suffix('.prj').read_text())
    to_wgs = Transformer.from_crs(boundary_crs, CRS.from_epsg(4326), always_xy=True).transform
    boundary = unary_union([transform(to_wgs, shape(item.shape.__geo_interface__)) for item in boundary_reader.iterShapeRecords()])
    to_metres = Transformer.from_crs(4326, 32636, always_xy=True).transform
    boundary_m = transform(to_metres, boundary)
    roads = json.loads(network_path.read_text(encoding='utf-8'))['features']
    links = {}
    for feature in roads:
        link = str(feature.get('properties', {}).get('Link Id 1') or '')
        if link and feature.get('geometry'):
            links.setdefault(link, []).append(transform(to_metres, shape(feature['geometry'])))
    print('boundary_features', len(boundary_reader), 'mapped_link_ids', len(links))
    for kind, path in [('Bridges', bridge_path), ('Major Culverts', culvert_path)]:
        features = json.loads(path.read_text(encoding='utf-8'))['features']
        summary = Counter()
        outliers = []
        for feature in features:
            properties = feature.get('properties') or {}
            number = properties.get('Bridge_Number') or properties.get('Culvert_Number')
            link_id = str(properties.get('Link_Number') or '')
            summary['total'] += 1
            if not feature.get('geometry'):
                summary['unresolved_without_map_point'] += 1
                continue
            point = shape(feature['geometry'])
            geographic = -180 <= point.x <= 180 and -90 <= point.y <= 90
            point_m = transform(to_metres, point) if geographic else None
            in_country = geographic and boundary.covers(point)
            roads_for_link = links.get(link_id, [])
            distance = min((point_m.distance(road) for road in roads_for_link), default=None) if point_m else None
            summary['mapped'] += 1
            if not geographic:
                summary['invalid_geographic_coordinates'] += 1
            summary['outside_border' if not in_country else 'inside_border'] += 1
            summary['unmatched_link' if not roads_for_link else 'matched_link'] += 1
            if distance is not None:
                if distance <= 1:
                    summary['within_1m'] += 1
                summary['within_100m' if distance <= 100 else 'over_100m'] += 1
                if distance > 1000:
                    summary['over_1km'] += 1
            if not in_country or distance is None or distance > 1000:
                outliers.append({'id': number, 'link': link_id, 'inside_uganda': in_country,
                                 'border_distance_m': round(point_m.distance(boundary_m)) if geographic and not in_country else None,
                                 'linked_road_distance_m': round(distance) if distance is not None else None})
        print(kind, json.dumps(dict(summary), sort_keys=True))
        print('outliers', json.dumps(outliers[:40], separators=(',', ':')))


if __name__ == '__main__':
    main()
