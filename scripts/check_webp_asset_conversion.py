import json
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "site" / "assets"
TARGETS = {
    "map": {"files": [ASSETS / "map" / "flatmap_votp.png"]},
    "buildings": {"directory": ASSETS / "buildings"},
    "companies": {"directory": ASSETS / "companies"},
    "laws": {"directory": ASSETS / "laws"},
    "ideologies": {"directory": ASSETS / "ideologies"},
}
PROVINCES_PNG = ASSETS / "map" / "provinces.png"
PROVINCES_WEBP = PROVINCES_PNG.with_suffix(".webp")


def target_pngs(config):
    if "files" in config:
        return config["files"]
    return sorted(config["directory"].rglob("*.png"))


def main():
    failures = []
    summary = defaultdict(lambda: {"png_files": 0, "webp_files": 0, "png_bytes": 0, "webp_bytes": 0})

    if not PROVINCES_PNG.exists():
        failures.append(f"missing required PNG: {PROVINCES_PNG.relative_to(ROOT).as_posix()}")
    if PROVINCES_WEBP.exists():
        failures.append(f"unexpected WebP: {PROVINCES_WEBP.relative_to(ROOT).as_posix()}")

    for name, config in TARGETS.items():
        for png in target_pngs(config):
            record = summary[name]
            record["png_files"] += 1
            record["png_bytes"] += png.stat().st_size
            webp = png.with_suffix(".webp")
            if not webp.exists():
                failures.append(f"missing WebP: {webp.relative_to(ROOT).as_posix()}")
                continue
            record["webp_files"] += 1
            record["webp_bytes"] += webp.stat().st_size
            with Image.open(png) as png_image, Image.open(webp) as webp_image:
                if png_image.size != webp_image.size:
                    failures.append(
                        f"dimension mismatch: {webp.relative_to(ROOT).as_posix()} "
                        f"is {webp_image.size}, expected {png_image.size}"
                    )

    output = {"webp_asset_conversion": "ok" if not failures else "failed", "directories": summary}
    print(json.dumps(output, ensure_ascii=False, indent=2))
    if failures:
        print("\n".join(f"- {failure}" for failure in failures), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
