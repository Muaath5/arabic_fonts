# fonts.json — schema

This is the file you edit to add or change fonts on the site. `fonts.json`
itself ships as a static file — `assets/js/app.js` fetches and parses it
directly in the browser at runtime. `build.py` only **validates** it
(fails the build if something's wrong) and generates the per-font `.zip`
bundles; it does not produce a separate data file, and you should never
edit `index.html`'s front matter by hand either — `build.py` writes it.

`fonts.json` is a single JSON array at the repo root. Each item is one
**font family** (e.g. "ثمانية"), which can have multiple **typefaces**
(weights/styles, e.g. عادي / عريض).

## Adding a font

1. Put the font files under `fonts/<font-id>/` (e.g. `fonts/thmanyah/thmanyah-bold.ttf`).
   `.ttf` and `.otf` work as-is. `.woff2` is smaller and loads faster, so
   prefer it if you have it — but it's not required.
2. Add an entry to `fonts.json` (see field list below).
3. Run `python build.py` locally to check it validates, or just open a
   pull request — the GitHub Actions workflow runs it for you and will
   fail the check if something's wrong (missing file, broken JSON, etc).

## Font fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | **yes** | string | Display name, Arabic. |
| `typefaces` | **yes** | array | At least one. See below. |
| `creator` | no | string | Designer, foundry, or organization name. Omit if unknown — it just won't show on the card. |
| `id` | no | string | URL/folder-safe slug. Auto-derived from `name_en` or `name` if omitted. Set it explicitly if the auto-generated one would look wrong. |
| `name_en` | no | string | Latin name. Used as a fallback for `id` generation. |
| `creator_url` | no | string | Link to the designer/foundry's site. |
| `license` | no | string | Shown to visitors — **set this if you know it**, especially for fonts with usage restrictions. |
| `license_url` | no | string | Link to the full license text. |
| `category` | no | string | Arabic label, e.g. `كوفي`, `نسخ`, `ديواني`, `تراثي`, `عصري`, `زخرفي`. Shown as a small tag next to the font name — keep it Arabic, it's user-visible. |
| `year` | no | number | Release year, if known. |

## Typeface fields (inside `typefaces[]`)

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | **yes** | string | e.g. `"عريض"`. Shown in the download list — Arabic, user-visible. |
| `file` | **yes** | string | Path **relative to `fonts/`**, e.g. `thmanyah/thmanyah-bold.ttf`. Must exist — `build.py` fails the build otherwise. |
| `weight` | no | number | CSS font-weight, 100–900. Defaults to `400`. Get this right if you can — it's what makes `@font-face` correct. |
| `style` | no | string | `normal` or `italic`. Defaults to `normal`. |

## Example

```json
[
  {
    "id": "thmanyah",
    "name": "ثمانية",
    "name_en": "Thmanyah",
    "creator": "ثمانية",
    "creator_url": "https://font.thmanyah.com/",
    "license": "مجاني للاستخدام الشخصي والتجاري",
    "category": "عصري",
    "year": 2026,
    "typefaces": [
      { "name": "عادي", "file": "thmanyah/thmanyah-regular.ttf", "weight": 400 },
      { "name": "عريض", "file": "thmanyah/thmanyah-bold.ttf", "weight": 700 }
    ]
  }
]
```

## What happens at build vs. at runtime

- **`build.py`** (runs once, in CI, before Jekyll): validates every
  entry — fails loudly on a missing file, duplicate id, or broken JSON —
  and writes `fonts/<id>/<id>-all.zip` for the "download all" button.
  It also writes `index.html`'s front matter (`layout: gallery`,
  `permalink: /` — nothing else; page content is not generated here).
- **`assets/js/app.js`** (runs in the visitor's browser, every page
  load): fetches `fonts.json` directly, derives the same `id`/format/zip
  path logic that `build.py` validates against, injects `@font-face`
  rules, and renders the specimen list.

Because both sides derive `id` and `format` the same way (slug fallback,
extension → format map), keep them in sync if you ever change that logic
in one place.

## Formats

Recognized extensions: `.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`. Anything
else is still included (the build won't break) but a warning is printed,
since the browser may not know how to load it.

> **Known limitation / TODO:** neither `build.py` nor `app.js` converts
> fonts to `.woff2` automatically — whatever format you provide is what
> ships. Auto-generating `.woff2` from `.ttf`/`.otf` during the build is
> a planned improvement.

## Site title, description, and domain

These are **not** set in `fonts.json` — they live in `_config.yml` at
the repo root (`title`, `description`, `url`). Change them there and the
page `<title>`, meta description, Open Graph tags, Twitter card tags,
and JSON-LD all update automatically. See `_config.yml`'s comments for
details, including what to do if you deploy to a different domain or as
a GitHub Pages project page instead of a custom domain.
