"""Map all 452 Major Culverts using recorded, quality-labelled positions.

Usage: python scripts/build-reviewed-culvert-layer.py CURRENT_GEOJSON CORRECTED_GEOJSON

Existing road-verified geometry is retained. Missing points come from the
corrected 2026 coordinate register. Review statuses remain explicit.
"""

import json
import math
import sys
from collections import Counter
from pathlib import Path


STATUS_LABELS = {
    'Confirmed': 'Source-confirmed recorded point',
    'Corrected': 'Source-corrected recorded point',
    'Confirmed (different road link)': 'Recorded point, road link differs',
    'Corrected (different road link)': 'Corrected recorded point, road link differs',
    'On a national road, link differs (check)': 'Recorded point, road link needs review',
    'Near link (check)': 'Recorded point near link, needs review',
    'Kept (road link not in network layer)': 'Recorded point, assigned link not mapped',
    'Placed by chainage (approximate)': 'Approximate point placed by chainage',
    'Unresolved (field check needed)': 'Provisional recorded point, field check needed',
}


def road_number(value):
    return str(value or '').split('_Link')[0]


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    current_path, corrected_path = map(Path, sys.argv[1:])
    current = json.loads(current_path.read_text(encoding='utf-8'))
    corrected = json.loads(corrected_path.read_text(encoding='utf-8'))
    public = current['features']
    source = corrected['features']
    if len(public) != 452 or len(source) != 452:
        raise ValueError('Both Major Culvert populations must contain exactly 452 records')
    by_number = {item['properties']['Structure No']: item for item in source}
    public_numbers = [item['properties']['Culvert_Number'] for item in public]
    if len(by_number) != 452 or len(set(public_numbers)) != 452 or set(by_number) != set(public_numbers):
        raise ValueError('Major Culvert identifiers are not a unique, complete match')

    counts = Counter()
    originally_mapped = sum(bool(item.get('geometry')) for item in public)
    for feature in public:
        fields = feature['properties']
        reference = by_number[fields['Culvert_Number']]
        detail = reference['properties']
        point = reference.get('geometry')
        if point is None or point.get('type') != 'Point' or len(point.get('coordinates', [])) != 2:
            raise ValueError(f"Missing recorded point for {fields['Culvert_Number']}")
        longitude, latitude = point['coordinates']
        if not (math.isfinite(longitude) and math.isfinite(latitude) and 28 <= longitude <= 36 and -2 <= latitude <= 5):
            raise ValueError(f"Invalid Uganda coordinate for {fields['Culvert_Number']}")
        if abs(longitude - detail['Longitude']) > 0.000001 or abs(latitude - detail['Latitude']) > 0.000001:
            raise ValueError(f"Coordinate fields differ from geometry for {fields['Culvert_Number']}")
        status = detail['Coordinate Status']
        if status not in STATUS_LABELS:
            raise ValueError(f"Unknown coordinate status for {fields['Culvert_Number']}: {status}")

        if not feature.get('geometry'):
            previous_road = road_number(fields['Link_Number'])
            feature['geometry'] = point
            fields['Position_Status'] = STATUS_LABELS[status]
            fields['Link_Number'] = detail['Assigned Link ID'] or detail['Road No'] or fields['Link_Number']
            if previous_road != detail['Road No']:
                fields['Culvert_Structure_Type'] = None
                fields['Span_Diameter_m'] = None
                fields['Cell_Count'] = None
                fields['Position_Status'] += '; road identity needs review'
                counts['road identity revised'] += 1
            counts['newly mapped'] += 1
            counts[status] += 1
        else:
            counts['previously mapped'] += 1

        if fields['Position_Status'] in ('Confirmed recorded point, road link checked', 'Corrected recorded point, road link checked'):
            fields['Position_Status'] = STATUS_LABELS[status]

        if detail['District at Point'] == 'Not recorded' and fields['Position_Status'] != 'Verified on mapped road link':
            fields['Position_Status'] = 'Recorded point near border, boundary check needed'
            counts['boundary review'] += 1

        final_longitude, final_latitude = feature['geometry']['coordinates']
        fields['Longitude'] = round(final_longitude, 6)
        fields['Latitude'] = round(final_latitude, 6)

    if counts['newly mapped'] != 452 - originally_mapped or counts['previously mapped'] != originally_mapped:
        raise ValueError(f'Unexpected map coverage: {dict(counts)}')
    if any(not item.get('geometry') for item in public):
        raise ValueError('Not all 452 Major Culverts have mapped geometry')
    current_path.write_text(json.dumps(current, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(dict(counts), sort_keys=True))


if __name__ == '__main__':
    main()
