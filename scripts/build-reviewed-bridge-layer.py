"""Map all 552 bridge records using recorded, quality-labelled positions.

Usage: python scripts/build-reviewed-bridge-layer.py CURRENT_GEOJSON CORRECTED_GEOJSON

Existing road-verified geometry is retained. Missing points come from the
corrected 2026 coordinate register. Review and approximate statuses remain
explicit, and revised identities do not inherit old BMS condition attributes.
"""

import json
import math
import sys
from collections import Counter
from pathlib import Path


STATUS_LABELS = {
    'Confirmed': 'Confirmed recorded point, road link checked',
    'Corrected': 'Corrected recorded point, road link checked',
    'Confirmed (different road link)': 'Recorded point, road link differs',
    'Corrected (different road link)': 'Corrected recorded point, road link differs',
    'On a national road, link differs (check)': 'Recorded point, road link needs review',
    'Near link (check)': 'Recorded point near link, needs review',
    'Kept (road link not in network layer)': 'Recorded point, assigned link not mapped',
    'Placed by chainage (approximate)': 'Approximate point placed by chainage',
    'Unresolved (field check needed)': 'Provisional recorded point, field check needed',
}


def normalise(value):
    return ''.join(char for char in str(value or '').lower() if char.isalnum())


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    current_path, corrected_path = map(Path, sys.argv[1:])
    current = json.loads(current_path.read_text(encoding='utf-8'))
    corrected = json.loads(corrected_path.read_text(encoding='utf-8'))
    public = current['features']
    source = corrected['features']
    if len(public) != 552 or len(source) != 552:
        raise ValueError('Both bridge populations must contain exactly 552 records')
    by_number = {item['properties']['Structure No']: item for item in source}
    public_numbers = [item['properties']['Bridge_Number'] for item in public]
    if len(by_number) != 552 or len(set(public_numbers)) != 552 or set(by_number) != set(public_numbers):
        raise ValueError('Bridge identifiers are not a unique, complete match')

    counts = Counter()
    originally_mapped = sum(bool(item.get('geometry')) for item in public)
    for feature in public:
        old = feature['properties']
        reference = by_number[old['Bridge_Number']]
        detail = reference['properties']
        point = reference.get('geometry')
        if point is None or point.get('type') != 'Point' or len(point.get('coordinates', [])) != 2:
            raise ValueError(f"Missing recorded point for {old['Bridge_Number']}")
        longitude, latitude = point['coordinates']
        if not (math.isfinite(longitude) and math.isfinite(latitude) and 28 <= longitude <= 36 and -2 <= latitude <= 5):
            raise ValueError(f"Invalid Uganda coordinate for {old['Bridge_Number']}")
        if abs(longitude - detail['Longitude']) > 0.000001 or abs(latitude - detail['Latitude']) > 0.000001:
            raise ValueError(f"Coordinate fields differ from geometry for {old['Bridge_Number']}")
        status = detail['Coordinate Status']
        if status not in STATUS_LABELS:
            raise ValueError(f"Unknown coordinate status for {old['Bridge_Number']}: {status}")

        if not feature.get('geometry'):
            feature['geometry'] = point
            old['Position_Status'] = STATUS_LABELS[status]
            old['Link_Number'] = detail['Assigned Link ID'] or detail['Road No'] or old['Link_Number']
            if normalise(old['Bridge_Name']) != normalise(detail['Name']):
                old['Bridge_Name'] = detail['Name']
                old['River_Crossing'] = detail['River'] or None
                old['Structure_Type'] = None
                old['Year_Constructed'] = None
                counts['identity revised'] += 1
            counts['newly mapped'] += 1
            counts[status] += 1
        else:
            counts['previously mapped'] += 1

        if detail['District at Point'] == 'Not recorded' and old['Position_Status'] != 'Verified on mapped road link':
            old['Position_Status'] = 'Recorded point near border, boundary check needed'
            counts['boundary review'] += 1

        final_longitude, final_latitude = feature['geometry']['coordinates']
        old['Longitude'] = round(final_longitude, 6)
        old['Latitude'] = round(final_latitude, 6)

    if counts['newly mapped'] != 552 - originally_mapped or counts['previously mapped'] != originally_mapped:
        raise ValueError(f'Unexpected map coverage: {dict(counts)}')
    if any(not item.get('geometry') for item in public):
        raise ValueError('Not all 552 bridges have mapped geometry')
    current_path.write_text(json.dumps(current, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(dict(counts), sort_keys=True))


if __name__ == '__main__':
    main()
