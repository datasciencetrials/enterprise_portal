"""Build a deliberately allowlisted, sanitised Uganda-only Google Earth overlay set.

This is a presentation overlay, never a replacement for governed map statistics.
"""

import hashlib
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from shapely.geometry import GeometryCollection, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon, mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\OneDrive\Google Earth files")
DEST = ROOT / "geo" / "reviewed_google_earth"
NS = {"k": "http://www.opengis.net/kml/2.2"}
ALLOWLIST = [
    ("a_class_roads", "A class roads.kmz", "A-class roads, source snapshot", "roads", "Undated source snapshot"),
    ("atc_locations", "ATC LOCATIONS.kml", "ATC locations, source snapshot", "traffic", "Undated source snapshot"),
    ("bridges_2025", "Bridges2025.kmz", "Bridges, 2025 source snapshot", "bridges", "2025 source label, not an annual inventory"),
    ("major_culverts_2025", "Major_Culverts2025.kmz", "Major Culverts, 2025 source snapshot", "culverts", "2025 source label, not an annual inventory"),
]


def coordinates(text):
    result = []
    for token in (text or "").split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon, lat = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        if -180 <= lon <= 180 and -90 <= lat <= 90:
            result.append((lon, lat))
    return result


def geometry(element):
    tag = element.tag.rsplit("}", 1)[-1]
    if tag == "Point":
        points = coordinates(element.findtext("k:coordinates", default="", namespaces=NS))
        return Point(points[0]) if points else None
    if tag == "LineString":
        points = coordinates(element.findtext("k:coordinates", default="", namespaces=NS))
        return LineString(points) if len(points) >= 2 else None
    if tag == "Polygon":
        outer = element.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS)
        points = coordinates(outer.text if outer is not None else "")
        if len(points) < 4:
            return None
        holes = []
        for inner in element.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS):
            ring = coordinates(inner.text)
            if len(ring) >= 4:
                holes.append(ring)
        polygon = Polygon(points, holes)
        return polygon if polygon.is_valid else polygon.buffer(0)
    if tag == "MultiGeometry":
        parts = [geometry(child) for child in element]
        parts = [part for part in parts if part is not None and not part.is_empty]
        return GeometryCollection(parts) if parts else None
    return None


def members(geom):
    if isinstance(geom, (Point, LineString, Polygon)):
        yield geom
    elif isinstance(geom, (GeometryCollection, MultiPoint, MultiLineString, MultiPolygon)):
        for part in geom.geoms:
            yield from members(part)


def kml_bytes(path):
    if path.suffix.lower() == ".kml":
        return path.read_bytes()
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".kml")]
        if len(names) != 1:
            raise ValueError(f"Expected one KML document in {path.name}, found {len(names)}")
        return archive.read(names[0])


def main():
    district_file = ROOT / "geo" / "districts.geojson"
    district_data = json.loads(district_file.read_text(encoding="utf-8"))
    uganda = unary_union([shape(item["geometry"]) for item in district_data["features"] if item.get("geometry")]).buffer(0.025)
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {"purpose": "Reviewed, sanitised source overlays. Not governed national counts or annual inventories.", "crs": "EPSG:4326", "ugandaBoundary": "135 mapped district geometries buffered by 0.025 degrees for source alignment", "layers": []}
    for stem, filename, label, category, temporal in ALLOWLIST:
        path = SOURCE / filename
        raw = path.read_bytes()
        root = ET.fromstring(kml_bytes(path))
        features = []
        rejected = 0
        for placemark in root.findall(".//k:Placemark", NS):
            name = (placemark.findtext("k:name", default="", namespaces=NS) or "").strip()[:120]
            for child in placemark:
                geom = geometry(child)
                if geom is None:
                    continue
                for part in members(geom):
                    if not part.intersects(uganda):
                        rejected += 1
                        continue
                    clipped = part.intersection(uganda)
                    for item in members(clipped):
                        if item.is_empty:
                            continue
                        features.append({"type": "Feature", "geometry": mapping(item), "properties": {"name": name or label, "source_snapshot": temporal}})
        if not features:
            raise ValueError(f"No Uganda geometry remained for {filename}")
        output = DEST / f"{stem}.geojson"
        output.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest["layers"].append({"id": stem, "file": f"geo/reviewed_google_earth/{stem}.geojson", "name": label, "category": category, "source": filename, "sourceSha256": hashlib.sha256(raw).hexdigest(), "featureCount": len(features), "rejectedOutsideUganda": rejected, "temporalStatus": temporal, "review": "Allowlisted source; WGS84 geometry clipped to mapped Uganda districts; non-name source attributes removed; independent of governed totals."})
        print(f"{filename}: {len(features)} published geometries, {rejected} rejected outside Uganda")
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
