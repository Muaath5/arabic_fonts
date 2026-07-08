#!/usr/bin/env python3
"""
build.py — builds the static data + assets for the Arabic fonts gallery
from fonts.json, before Jekyll runs.

What it does:
  1. Reads fonts.json (source of truth, hand-edited by maintainers).
  2. Validates every entry and every referenced font file actually exists
     under fonts/.
  3. Fills in sensible defaults for optional fields (id, weight, style...).
  4. Writes fonts.generated.json — the file the front-end JavaScript
     fetches at runtime. It carries only what the page needs, with paths
     already resolved.
  5. Generates a fontname-all.zip next to each font's files, containing
     every typeface of that font, so the "Download all" button in the
     Download popup can link straight to a static file (no JS zipping,
     no server).
  6. Writes/rewrites index.html with Jekyll front matter pointing at the
     layout in _layouts/, so Jekyll only has to render the shell — all
     real content is loaded client-side from fonts.generated.json.

Run this before `jekyll build` / `jekyll serve`. The GitHub Actions
workflow in .github/workflows/ does this automatically on every push.

Usage:
    python build.py
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
OUTPUT_JSON = ROOT / "fonts.generated.json"
INDEX_HTML = ROOT / "index.html"

SITE_BASE_URL = "https://fonts.muaath.dev"  # used only for embed CSS preview/docs

# Recognized font file extensions and the CSS @font-face format() keyword
# they map to. If a file extension isn't in this dict, build.py still
# includes it (so nothing silently breaks) but flags it in the summary
# so you know it wasn't recognized.
FORMAT_MAP = {
    ".woff2": "woff2",
    ".woff": "woff",
    ".ttf": "truetype",
    ".otf": "opentype",
    ".eot": "embedded-opentype",
}

VALID_WEIGHTS = set(range(100, 1000, 100))


class BuildError(Exception):
    """Raised for problems in fonts.json that stop the build."""


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


def validate_and_normalize_font(raw: dict, index: int, seen_ids: set[str]) -> dict:
    where = f"fonts.json[{index}]"

    name = raw.get("name")
    if not name or not isinstance(name, str):
        raise BuildError(f"{where}: missing required string field 'name'")

    creator = raw.get("creator")
    if not creator or not isinstance(creator, str):
        raise BuildError(f"{where}: missing required string field 'creator'")

    typefaces_raw = raw.get("typefaces")
    if not isinstance(typefaces_raw, list) or len(typefaces_raw) == 0:
        raise BuildError(f"{where} ('{name}'): 'typefaces' must be a non-empty array")

    # id: explicit id wins, otherwise derive from name_en, otherwise from name.
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
                f"{tf_where} ('{tf_name}'): file 'fonts/{file_rel}' does not exist. "
                f"Check the path is relative to fonts/."
            )
        if file_path in seen_tf_files:
            raise BuildError(f"{tf_where}: file '{file_rel}' listed twice for the same font")
        seen_tf_files.add(file_path)

        ext = file_path.suffix.lower()
        fmt = FORMAT_MAP.get(ext)
        if fmt is None:
            print(
                f"  ! warning: {tf_where} ('{tf_name}'): unrecognized font "
                f"extension '{ext}' — included as-is, but the browser may not "
                f"know how to load it. Recognized: {', '.join(FORMAT_MAP)}",
                file=sys.stderr,
            )

        weight = tf_raw.get("weight", 400)
        if weight not in VALID_WEIGHTS:
            print(
                f"  ! warning: {tf_where} ('{tf_name}'): weight {weight!r} is not "
                f"a standard CSS weight (100-900, step 100) — using it as-is",
                file=sys.stderr,
            )

        typefaces.append(
            {
                "name": tf_name,
                "name_en": tf_raw.get("name_en") or tf_name,
                "file": file_rel,
                "format": fmt,  # None if unrecognized; front-end should skip format() then
                "weight": weight,
                "style": tf_raw.get("style", "normal"),
            }
        )

    return {
        "id": font_id,
        "name": name,
        "name_en": raw.get("name_en") or name,
        "creator": creator,
        "creator_url": raw.get("creator_url") or "",
        "license": raw.get("license") or "",
        "license_url": raw.get("license_url") or "",
        "category": raw.get("category") or "",
        "year": raw.get("year"),
        "typefaces": typefaces,
    }


def make_zip(font: dict) -> str | None:
    """Create fonts/<id>/<id>-all.zip containing every typeface file for this font.
    Returns the path relative to the repo root, or None if there was nothing to zip.
    """
    if len(font["typefaces"]) == 0:
        return None

    out_dir = FONTS_DIR / font["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_rel_path = f"{font['id']}/{font['id']}-all.zip"
    zip_path = FONTS_DIR / zip_rel_path

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for tf in font["typefaces"]:
            src = FONTS_DIR / tf["file"]
            # flatten into the zip root using the original filename
            zf.write(src, arcname=Path(tf["file"]).name)

    return zip_rel_path


def build() -> None:
    print("→ reading fonts.json")
    raw_fonts = load_fonts_json()

    print(f"→ validating {len(raw_fonts)} font entr{'y' if len(raw_fonts)==1 else 'ies'}")
    seen_ids: set[str] = set()
    fonts = [
        validate_and_normalize_font(raw, i, seen_ids) for i, raw in enumerate(raw_fonts)
    ]

    print("→ generating per-font zip bundles")
    for font in fonts:
        zip_rel = make_zip(font)
        font["zip"] = zip_rel
        if zip_rel:
            print(f"  - fonts/{zip_rel} ({len(font['typefaces'])} files)")

    print(f"→ writing {OUTPUT_JSON.name}")
    OUTPUT_JSON.write_text(
        json.dumps(fonts, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"→ writing {INDEX_HTML.name} front matter")
    write_index_html()

    print(f"\n✓ build complete — {len(fonts)} fonts, "
          f"{sum(len(f['typefaces']) for f in fonts)} typefaces total")


def write_index_html() -> None:
    """(Re)writes index.html with Jekyll front matter pointing at the gallery
    layout. Content itself is rendered client-side by assets/app.js, which
    fetches fonts.generated.json — so this file only needs the front matter
    plus a couple of Jekyll-templated meta tags."""
    front_matter = (
        "---\n"
        "layout: gallery\n"
        "title: خطوط عربية\n"
        "description: معرض خطوط عربية مجانية — عاينها، حمّلها، أو ضمّنها في موقعك\n"
        "permalink: /\n"
        "---\n"
    )
    INDEX_HTML.write_text(front_matter, encoding="utf-8")


if __name__ == "__main__":
    try:
        build()
    except BuildError as e:
        print(f"\n✗ build failed: {e}", file=sys.stderr)
        sys.exit(1)
