"""Build public, geometry-only road overlays from a local WGS 84 shapefile.

Run with: py scripts/build_allroads_overlay.py PATH_TO_ALLROADS_SHP
The source path and attribute table are never written to the outputs.
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter
from pathlib import Path

import shapefile
from PIL import Image, ImageDraw


def mercator_y(latitude: float) -> float:
    radians = math.radians(max(-85.0, min(85.0, latitude)))
    return math.log(math.tan(math.pi / 4 + radians / 2))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Provide the local all-roads .shp path")
    source = Path(sys.argv[1]).resolve(strict=True)
    if source.suffix.lower() != ".shp":
        raise SystemExit("The source must be a shapefile")
    projection = source.with_suffix(".prj").read_text(encoding="utf-8")
    if "WGS_1984" not in projection or "Degree" not in projection:
        raise SystemExit("Expected geographic WGS 84 coordinates")

    reader = shapefile.Reader(str(source))
    west, south, east, north = reader.bbox
    if not (28 < west < east < 36 and -2 < south < north < 5):
        raise SystemExit("The geometry bounds are outside the expected Uganda extent")

    output = Path(__file__).resolve().parents[1] / "geo"
    versions = {
        "overview": {"size": (1800, 1900), "widths": {"community": 1, "ducar": 1, "national": 2, "paved": 2}},
        "detail": {"size": (7200, 7600), "widths": {"community": 1, "ducar": 2, "national": 3, "paved": 3}},
    }
    palette = [0, 0, 0] * 256
    for index, rgb in enumerate([(0, 0, 0), (226, 220, 202), (216, 186, 123), (238, 136, 78), (17, 17, 17)]):
        palette[index * 3:index * 3 + 3] = list(rgb)
    images = {}
    drawers = {}
    for key, version in versions.items():
        image = Image.new("P", version["size"], 0)
        image.putpalette(palette)
        images[key] = image
        drawers[key] = ImageDraw.Draw(image)

    top = mercator_y(north)
    bottom = mercator_y(south)
    counts = Counter()

    for pass_number in (0, 1):
        for feature in reader.iterShapeRecords():
            row = feature.record.as_dict()
            paved = row.get("PAVED_CLS") == "Paved"
            if paved != bool(pass_number):
                continue
            if paved:
                style, colour = "paved", 4
            elif row.get("FUNC_CLASS") == "Community Access Road":
                style, colour = "community", 1
            elif row.get("GOV_DEPT") == "DDUCAR MoWT":
                style, colour = "ducar", 2
            else:
                style, colour = "national", 3
            counts[style] += 1
            points = feature.shape.points
            part_starts = list(feature.shape.parts) + [len(points)]
            for start, end in zip(part_starts, part_starts[1:]):
                if end - start < 2:
                    continue
                section = points[start:end]
                for key, version in versions.items():
                    width, height = version["size"]
                    projected = [
                        (round((longitude - west) / (east - west) * (width - 1)),
                         round((top - mercator_y(latitude)) / (top - bottom) * (height - 1)))
                        for longitude, latitude in section
                    ]
                    drawers[key].line(projected, fill=colour, width=version["widths"][style], joint="curve")
        print(f"Completed drawing pass {pass_number + 1}", flush=True)

    for key, image in images.items():
        target = output / f"allroads-{key}.png"
        image.save(target, format="PNG", optimize=True, transparency=0)
        print(f"{target.name}: {target.stat().st_size:,} bytes", flush=True)
    manifest = {
        "bounds": [[south, west], [north, east]],
        "geometry_count": len(reader),
        "style_counts": dict(counts),
        "crs": "EPSG:4326",
        "coverage_note": "Mapped geometry does not reconcile to the governed national road-length total.",
        "images": {key: f"geo/allroads-{key}.png" for key in versions},
    }
    (output / "allroads-display.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(manifest), flush=True)


if __name__ == "__main__":
    main()
