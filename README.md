# Arabic Fonts
A minimalist, static gallery of free Arabic fonts.

## How it works
1. **You edit [`fonts.json`](./fonts.json)** — the list of fonts and
   their typeface files. See [`DATA.md`](./DATA.md) for the schema.
2. **`build.py` runs before Jekyll** and:
   - validates `fonts.json` (fails loudly if a file is missing or the
     JSON is malformed),
   - writes `fonts.generated.json`, which the page fetches at runtime,
   - zips each font's typefaces into `fonts/<id>/<id>-all.zip` for the
     "download all" button,
   - writes `index.html`'s Jekyll front matter.
3. **Jekyll** renders `index.html` through `_layouts/gallery.html` and
   copies `assets/` and `fonts/` through as static files.
4. **GitHub Actions** (`.github/workflows/deploy.yml`) runs steps 2–3 on
   every push to `main` and deploys the result to GitHub Pages.

## Local development
```bash
pip install -r requirements.txt   # none currently — build.py uses only the stdlib
bundle install
python build.py && bundle exec jekyll serve
```

## Adding a font
See [`DATA.md`](./DATA.md) — short version: drop the font files in
`fonts/<font-id>/`, add an entry to `fonts.json`, open a pull request.
The Actions workflow validates it for you.

## License
Site code is under the [LICENSE](./LICENSE) in this repo. **Fonts
themselves keep their own individual licenses** — check the `license`
field for each font in `fonts.json` (or the in-page info) before using a
font commercially. This repo redistributing a font does not change its
original license.