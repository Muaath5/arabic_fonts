#!/usr/bin/env python3
"""
build.py — validates fonts.json and generates per-font zip bundles,
before Jekyll runs.

fonts.json itself ships as a static file; assets/js/app.js fetches and
parses it directly in the browser. This script's job is:
  1. Validate every entry and fail the build (exit 1) if something is
     wrong, so a broken fonts.json never gets deployed silently.
  2. Generate fonts/<id>/<id>-all.zip for each font, since zipping
     client-side isn't practical.

Run before `jekyll build` / `jekyll serve`. The GitHub Actions workflow
does this automatically on every push.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FONTS_JSON = ROOT / "fonts.json"
FONTS_DIR = ROOT / "fonts"
INDEX_HTML = ROOT / "index.html"

FORMAT_MAP = {
    ".woff2": "woff2",
    ".woff": "woff",
    ".ttf": "truetype",
    ".otf": "opentype",
    ".eot": "embedded-opentype",
}

VALID_WEIGHTS = set(range(100, 1000, 100))


class BuildError(Exception):
    pass


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def load_fonts_json() -> list[dict]:
    if not FONTS_JSON.exists():
        raise BuildError(f"fonts.json not found at {FONTS_JSON}")
    try:
        data = json.loads(FONTS_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BuildError(f"fonts.json is not valid JSON: {e}") from e
    if not isinstance(data, list):
        raise BuildError("fonts.json must be a top-level JSON array of fonts")
    return data


def validate_font(raw: dict, index: int, seen_ids: set[str]) -> dict:
    where = f"fonts.json[{index}]"

    name = raw.get("name")
    if not name or not isinstance(name, str):
        raise BuildError(f"{where}: missing required string field 'name'")

    creator = raw.get("creator") or ""

    typefaces_raw = raw.get("typefaces")
    if not isinstance(typefaces_raw, list) or len(typefaces_raw) == 0:
        raise BuildError(f"{where} ('{name}'): 'typefaces' must be a non-empty array")

    font_id = raw.get("id") or slugify(raw.get("name_en") or name)
    if not font_id:
        raise BuildError(f"{where} ('{name}'): could not derive an id — set 'id' explicitly")
    if font_id in seen_ids:
        raise BuildError(f"{where}: duplicate font id '{font_id}'")
    seen_ids.add(font_id)

    typefaces = []
    seen_tf_files = set()
    for j, tf_raw in enumerate(typefaces_raw):
        tf_where = f"{where}.typefaces[{j}]"

        tf_name = tf_raw.get("name")
        if not tf_name or not isinstance(tf_name, str):
            raise BuildError(f"{tf_where}: missing required string field 'name'")

        file_rel = tf_raw.get("file")
        if not file_rel or not isinstance(file_rel, str):
            raise BuildError(f"{tf_where} ('{tf_name}'): missing required string field 'file'")

        file_path = FONTS_DIR / file_rel
        if not file_path.exists():
            raise BuildError(
                f"{tf_where} ('{tf_name}'): file 'fonts/{file_rel}' does not exist"
            )
        if file_path in seen_tf_files:
            raise BuildError(f"{tf_where}: file '{file_rel}' listed twice for the same font")
        seen_tf_files.add(file_path)

        ext = file_path.suffix.lower()
        if ext not in FORMAT_MAP:
            print(
                f"  ! warning: {tf_where} ('{tf_name}'): unrecognized extension "
                f"'{ext}' — recognized: {', '.join(FORMAT_MAP)}",
                file=sys.stderr,
            )

        weight = tf_raw.get("weight", 400)
        if weight not in VALID_WEIGHTS:
            print(
                f"  ! warning: {tf_where} ('{tf_name}'): weight {weight!r} is not "
                f"a standard CSS weight (100-900, step 100)",
                file=sys.stderr,
            )

        typefaces.append({"name": tf_name, "file": file_rel})

    return {"id": font_id, "name": name, "creator": creator, "typefaces": typefaces}


def make_zip(font: dict) -> None:
    out_dir = FONTS_DIR / font["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{font['id']}-all.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for tf in font["typefaces"]:
            src = FONTS_DIR / tf["file"]
            zf.write(src, arcname=Path(tf["file"]).name)


def write_index_html() -> None:
    INDEX_HTML.write_text(
        "---\nlayout: gallery\npermalink: /\n---\n", encoding="utf-8"
    )


def build() -> None:
    print("→ reading fonts.json")
    raw_fonts = load_fonts_json()

    print(f"→ validating {len(raw_fonts)} font entr{'y' if len(raw_fonts) == 1 else 'ies'}")
    seen_ids: set[str] = set()
    fonts = [validate_font(raw, i, seen_ids) for i, raw in enumerate(raw_fonts)]

    print("→ generating per-font zip bundles")
    for font in fonts:
        make_zip(font)
        print(f"  - fonts/{font['id']}/{font['id']}-all.zip ({len(font['typefaces'])} files)")

    print("→ writing index.html front matter")
    write_index_html()

    print(f"\n✓ build complete — {len(fonts)} fonts, "
          f"{sum(len(f['typefaces']) for f in fonts)} typefaces total")


if __name__ == "__main__":
    try:
        build()
    except BuildError as e:
        print(f"\n✗ build failed: {e}", file=sys.stderr)
        sys.exit(1)
