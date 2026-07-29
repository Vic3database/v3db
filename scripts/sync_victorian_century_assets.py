#!/usr/bin/env python3
"""Sync Victorian Century display assets required by the standalone database.

The script deliberately selects only assets that are both referenced by the
Victorian Century dataset and missing from the original-site asset set.  It
keeps page display assets in PNG plus WebP, while prestige-good icons remain
PNG-only, matching the established site asset policy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MOD = Path(r"D:\SteamLibrary\steamapps\workshop\content\529340\3219394272")
DEFAULT_DATABASE = ROOT / "database" / "victorian_century"
DEFAULT_ORIGINAL_ASSETS = ROOT / "site" / "assets"
DEFAULT_TARGET_ASSETS = ROOT / "Victorian Century Database" / "assets"
MANIFEST_NAME = "victorian-century-assets.json"

PRESTIGE_OVERRIDES = {
    "prestige_good_brunn_type_engines": "brunn_type_engine_prestige.png",
    "prestige_good_havana_sugar": "generic_sugar_prestige.png",
    "prestige_good_kikkoman_soy_sauce": "kikkoman_soy_sauce.png",
}

WEBP_KINDS = {"company", "law", "ideology"}


@dataclass(frozen=True)
class Asset:
    kind: str
    key: str
    source: Path
    source_path: str
    destination: Path

    @property
    def uses_webp(self) -> bool:
        return self.kind in WEBP_KINDS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mod-path", type=Path, default=DEFAULT_MOD)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--original-assets", type=Path, default=DEFAULT_ORIGINAL_ASSETS)
    parser.add_argument("--target-assets", type=Path, default=DEFAULT_TARGET_ASSETS)
    parser.add_argument("--check", action="store_true", help="Validate existing standalone assets without writing files.")
    parser.add_argument("--dry-run", action="store_true", help="Print the computed asset set without writing files.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def read_records(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig") as handle:
        content = json.load(handle)
    if not isinstance(content, list):
        raise ValueError(f"Expected a JSON array: {path}")
    return content


def icon_filename(icon: object) -> str:
    name = Path(str(icon or "")).name
    if name.lower().endswith(".dds"):
        return f"{name[:-4]}.png"
    return name


def prestige_filename(key: str) -> str:
    return PRESTIGE_OVERRIDES.get(key, f"{key.removeprefix('prestige_good_')}_prestige.png")


def parse_prestige_sources(mod_path: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for source_file in sorted((mod_path / "common" / "prestige_goods").rglob("*.txt")):
        current_key = ""
        for line in source_file.read_text(encoding="utf-8-sig").splitlines():
            stripped = line.strip()
            if stripped.startswith("prestige_good_") and "=" in stripped and "{" in stripped:
                current_key = stripped.split("=", 1)[0].strip()
                continue
            if current_key and stripped.startswith("texture") and "=" in stripped:
                value = stripped.split("=", 1)[1].strip().strip('"')
                result[current_key] = mod_path / Path(value.replace("/", "\\"))
    return result


def source_icon(mod_path: Path, icon: object, key: str) -> Path:
    relative = Path(str(icon or "").replace("/", "\\"))
    source = mod_path / relative
    if source.is_file():
        return source
    raise FileNotFoundError(f"{key} references a missing VC image: {relative.as_posix()}")


def add_icon_assets(
    records: Iterable[dict],
    *,
    kind: str,
    mod_path: Path,
    original_assets: Path,
    target_assets: Path,
) -> list[Asset]:
    assets: list[Asset] = []
    seen: set[str] = set()
    destination_dir = {"company": "companies", "law": "laws", "ideology": "ideologies"}[kind]
    for record in records:
        key = str(record.get("key") or "")
        icon = record.get("icon")
        filename = icon_filename(icon)
        if not key or not filename or filename in seen:
            continue
        if (original_assets / destination_dir / filename).is_file():
            continue
        seen.add(filename)
        source = source_icon(mod_path, icon, key)
        assets.append(
            Asset(
                kind=kind,
                key=key,
                source=source,
                source_path=source.relative_to(mod_path).as_posix(),
                destination=target_assets / destination_dir / filename,
            )
        )
    return assets


def collect_assets(args: argparse.Namespace) -> list[Asset]:
    mod_path = args.mod_path.resolve()
    database = args.database.resolve()
    original_assets = args.original_assets.resolve()
    target_assets = args.target_assets.resolve()
    if not mod_path.is_dir():
        raise FileNotFoundError(f"VC workshop directory does not exist: {mod_path}")

    companies = read_records(database / "companies.json")
    laws = read_records(database / "laws.json")
    ideologies = read_records(database / "ideologies.json")
    assets = [
        *add_icon_assets(companies, kind="company", mod_path=mod_path, original_assets=original_assets, target_assets=target_assets),
        *add_icon_assets(laws, kind="law", mod_path=mod_path, original_assets=original_assets, target_assets=target_assets),
        *add_icon_assets(ideologies, kind="ideology", mod_path=mod_path, original_assets=original_assets, target_assets=target_assets),
    ]

    prestige_sources = parse_prestige_sources(mod_path)
    prestige_keys = sorted(
        {
            str(item.get("key"))
            for company in companies
            for item in company.get("possible_prestige_goods", [])
            if item.get("key")
        }
    )
    for key in prestige_keys:
        source = prestige_sources.get(key)
        filename = prestige_filename(key)
        if source is None or (original_assets / "prestige-goods" / filename).is_file():
            continue
        if not source.is_file():
            raise FileNotFoundError(f"{key} references a missing VC prestige-good image: {source}")
        assets.append(
            Asset(
                kind="prestige_good",
                key=key,
                source=source,
                source_path=source.relative_to(mod_path).as_posix(),
                destination=target_assets / "prestige-goods" / filename,
            )
        )
    return sorted(assets, key=lambda item: (item.kind, item.destination.name.casefold()))


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def images_match(source: Path, target: Path) -> bool:
    if not target.is_file():
        return False
    with Image.open(source) as source_image, Image.open(target) as target_image:
        return source_image.convert("RGBA").tobytes() == target_image.convert("RGBA").tobytes()


def write_png(asset: Asset) -> bool:
    asset.destination.parent.mkdir(parents=True, exist_ok=True)
    if images_match(asset.source, asset.destination):
        return False
    if asset.source.suffix.lower() == ".png":
        shutil.copy2(asset.source, asset.destination)
        return True
    with Image.open(asset.source) as image:
        image.convert("RGBA").save(asset.destination, "PNG")
    return True


def write_webp(png: Path, force: bool = False) -> Path:
    webp = png.with_suffix(".webp")
    if not force and webp.is_file() and webp.stat().st_mtime_ns >= png.stat().st_mtime_ns:
        return webp
    with Image.open(png) as image:
        image.save(webp, "WEBP", quality=85, method=6, exact=True)
    return webp


def manifest_entries(assets: Iterable[Asset], target_assets: Path) -> list[dict]:
    return [
        {
            "kind": asset.kind,
            "key": asset.key,
            "source": asset.source_path,
            "path": asset.destination.relative_to(target_assets).as_posix(),
            "webp": asset.uses_webp,
        }
        for asset in assets
    ]


def write_manifest(assets: list[Asset], target_assets: Path) -> Path:
    manifest = target_assets / MANIFEST_NAME
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = {"version": 1, "assets": manifest_entries(assets, target_assets)}
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def check_assets(assets: list[Asset], target_assets: Path) -> tuple[list[str], dict[str, int]]:
    failures: list[str] = []
    counts: dict[str, int] = {"company": 0, "law": 0, "ideology": 0, "prestige_good": 0, "webp": 0}
    for asset in assets:
        counts[asset.kind] += 1
        if not asset.destination.is_file():
            failures.append(f"missing PNG: {asset.destination.relative_to(ROOT).as_posix()}")
            continue
        if image_size(asset.source) != image_size(asset.destination):
            failures.append(f"PNG dimension mismatch: {asset.destination.relative_to(ROOT).as_posix()}")
        elif not images_match(asset.source, asset.destination):
            failures.append(f"PNG content mismatch: {asset.destination.relative_to(ROOT).as_posix()}")
        webp = asset.destination.with_suffix(".webp")
        if asset.uses_webp:
            counts["webp"] += 1
            if not webp.is_file():
                failures.append(f"missing WebP: {webp.relative_to(ROOT).as_posix()}")
            elif image_size(asset.destination) != image_size(webp):
                failures.append(f"WebP dimension mismatch: {webp.relative_to(ROOT).as_posix()}")
        elif webp.exists():
            failures.append(f"unexpected WebP for prestige good: {webp.relative_to(ROOT).as_posix()}")

    manifest = target_assets / MANIFEST_NAME
    expected_manifest = {"version": 1, "assets": manifest_entries(assets, target_assets)}
    if not manifest.is_file():
        failures.append(f"missing manifest: {manifest.relative_to(ROOT).as_posix()}")
    else:
        try:
            actual_manifest = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            failures.append(f"invalid manifest: {manifest.relative_to(ROOT).as_posix()}: {error.msg}")
        else:
            if actual_manifest != expected_manifest:
                failures.append(f"outdated manifest: {manifest.relative_to(ROOT).as_posix()}")
    return failures, counts


def output(payload: dict, as_json: bool) -> None:
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    for key, value in payload.items():
        if key == "assets":
            for asset in value:
                print(f"{asset['kind']}: {asset['key']} -> {asset['path']}")
        else:
            print(f"{key}: {value}")


def main() -> int:
    args = parse_args()
    try:
        assets = collect_assets(args)
        target_assets = args.target_assets.resolve()
        if args.dry_run:
            output({"status": "dry_run", "assets": manifest_entries(assets, target_assets)}, args.json)
            return 0
        if args.check:
            failures, counts = check_assets(assets, target_assets)
            output(
                {
                    "status": "ok" if not failures else "failed",
                    "counts": counts,
                    "failures": failures,
                },
                args.json,
            )
            return 1 if failures else 0
        for asset in assets:
            png_changed = write_png(asset)
            if asset.uses_webp:
                write_webp(asset.destination, force=png_changed)
        manifest = write_manifest(assets, target_assets)
        failures, counts = check_assets(assets, target_assets)
        output(
            {
                "status": "ok" if not failures else "failed",
                "counts": counts,
                "manifest": manifest.relative_to(ROOT).as_posix(),
                "failures": failures,
            },
            args.json,
        )
        return 1 if failures else 0
    except (FileNotFoundError, ValueError, OSError) as error:
        output({"status": "error", "error": str(error)}, args.json)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
