import json
from collections import defaultdict
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "site" / "assets"
TARGETS = {
    "map": {"quality": 80, "files": [ASSETS / "map" / "flatmap_votp.png"]},
    "buildings": {"quality": 85, "directory": ASSETS / "buildings"},
    "companies": {"quality": 85, "directory": ASSETS / "companies"},
    "laws": {"quality": 85, "directory": ASSETS / "laws"},
    "ideologies": {"quality": 85, "directory": ASSETS / "ideologies"},
}


def target_pngs(config):
    if "files" in config:
        return config["files"]
    return sorted(config["directory"].rglob("*.png"))


def main():
    summary = defaultdict(lambda: {
        "source_files": 0,
        "converted": 0,
        "skipped": 0,
        "png_bytes": 0,
        "webp_bytes": 0,
        "saved_bytes": 0,
    })

    for name, config in TARGETS.items():
        record = summary[name]
        for source in target_pngs(config):
            target = source.with_suffix(".webp")
            record["source_files"] += 1
            record["png_bytes"] += source.stat().st_size
            if not target.exists() or target.stat().st_mtime_ns < source.stat().st_mtime_ns:
                with Image.open(source) as image:
                    image.save(target, "WEBP", quality=config["quality"], method=6, exact=True)
                record["converted"] += 1
            else:
                record["skipped"] += 1
            record["webp_bytes"] += target.stat().st_size
        record["saved_bytes"] = record["png_bytes"] - record["webp_bytes"]

    print(json.dumps({"webp_conversion": "ok", "directories": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
