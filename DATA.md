# fonts.json — schema

This is the file you edit to add or change fonts on the site. `build.py`
reads it, validates it, and generates everything else — you should never
need to edit `fonts.generated.json`, `index.html`'s front matter, or the
per-font `.zip` files by hand; `build.py` writes all of them.

`fonts.json` is a single JSON array at the repo root. Each item is one
**font family** (e.g. "Alkufi"), which can have multiple **typefaces**
(weights/styles, e.g. Regular / Bold / Light).

## Adding a font

1. Put the font files under `fonts/<font-id>/` (e.g. `fonts/alkufi/alkufi-bold.ttf`).
   `.ttf` and `.otf` work as-is. `.woff2` is the smallest and loads
   fastest for visitors, so prefer it if you have it — but it's not
   required.
2. Add an entry to `fonts.json` (see field list below).
3. Run `python build.py` locally to check it validates, or just open a
   pull request — the GitHub Actions workflow runs it for you and will
   fail the check if something's wrong (missing file, broken JSON, etc).

## Font fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | **yes** | string | Display name, Arabic. |
| `creator` | **yes** | string | Designer or foundry name. |
| `typefaces` | **yes** | array | At least one. See below. |
| `id` | no | string | URL/folder-safe slug. Auto-derived from `name_en` or `name` if omitted. Set it explicitly if the auto-generated one would look wrong. |
| `name_en` | no | string | Latin name. Used as a fallback for `id` generation. Falls back to `name` if omitted. |
| `creator_url` | no | string | Link to the designer/foundry's site. |
| `license` | no | string | e.g. `"SIL Open Font License 1.1"`. Shown to visitors — **set this if you know it.** |
| `license_url` | no | string | Link to the full license text. |
| `category` | no | string | e.g. `Kufi`, `Naskh`, `Diwani`, `Ruq'ah`, `Modern`. Shown as a small tag next to the font name. |
| `year` | no | number | Release year, if known. |

## Typeface fields (inside `typefaces[]`)

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | **yes** | string | e.g. `"عريض"`. Shown in the download list. |
| `file` | **yes** | string | Path **relative to `fonts/`**, e.g. `alkufi/alkufi-bold.ttf`. Must exist — `build.py` fails the build otherwise. |
| `name_en` | no | string | e.g. `"Bold"`. |
| `weight` | no | number | CSS font-weight, 100–900. Defaults to `400`. Get this right if you can — it's what makes `@font-face` correct. |
| `style` | no | string | `normal` or `italic`. Defaults to `normal`. |

## Example

```json
[
  {
    "id": "alkufi",
    "name": "الكوفي",
    "name_en": "Alkufi",
    "creator": "Asdf Studio",
    "license": "SIL Open Font License 1.1",
    "license_url": "https://scripts.sil.org/OFL",
    "category": "Kufi",
    "year": 2021,
    "typefaces": [
      { "name": "عادي", "name_en": "Regular", "file": "alkufi/alkufi-regular.ttf", "weight": 400 },
      { "name": "عريض", "name_en": "Bold",    "file": "alkufi/alkufi-bold.ttf",    "weight": 700 },
      { "name": "خفيف", "name_en": "Light",   "file": "alkufi/alkufi-light.ttf",   "weight": 300 }
    ]
  }
]
```

## What `build.py` generates from this

- **`fonts.generated.json`** — what the site's JavaScript actually fetches.
  Same data, plus a `format` field per typeface (guessed from the file
  extension) and a `zip` field pointing at the generated bundle.
- **`fonts/<id>/<id>-all.zip`** — every typeface of that font zipped
  together, for the "Download all" button.
- **`index.html`** front matter — just points Jekyll at the `gallery`
  layout; the actual content is rendered client-side.

## Formats

Recognized extensions: `.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`. Anything
else is still included (the build won't break) but a warning is printed,
since the browser may not know how to load it.

> **Known limitation / TODO:** `build.py` does not currently convert
> fonts to `.woff2` automatically — it uses whatever format you give it.
> Auto-generating `.woff2` from `.ttf`/`.otf` during the build (so every
> font gets the smallest format for free) is a planned improvement.
