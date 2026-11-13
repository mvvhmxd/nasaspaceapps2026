# Crater Expectations: Asset and Data Sources

This is a curated starting list, not blanket permission to download everything. Claude must inspect each selected item, keep the included license file, record the exact file name and source URL, and add the item to the in-game credits where required.

## 1. Recommended visual assets

### Primary UI pack
- **Kenney: UI Pack Sci-Fi**: https://kenney.nl/assets/ui-pack-sci-fi
- License listed on the asset page: CC0.
- Use selectively for panels, buttons, frames, and interface details. Re-colour to the game's navy / amber / teal palette. Do not make the entire UI look like a generic shooter HUD.
- OpenGameArt mirror page and license listing: https://opengameart.org/content/ui-pack-sci-fi

### Space sprites and supporting details
- **Kenney: Space Shooter Redux**: https://lpc.opengameart.org/content/space-shooter-redux
- The page lists CC0 and includes 295+ sprites, backgrounds, a sprite sheet, vector files, fonts, and a few sound effects.
- Use only relevant items such as small spacecraft details, stars, or effects. Do not turn this mission strategy game into a space shooter.

### Top-down prop references
- **Kenney: Top-down Tanks**: https://kenney.nl/assets/top-down-tanks
- License listed: CC0.
- Not lunar assets. Use only as a sprite-format / readability reference or adapt generic marker techniques. Do not place terrestrial trees, roads, tanks, or grass in the lunar environment.

### Terrain visuals
- Prefer generating the actual topographic map from the team's LOLA-derived DEM and the game's own rendering code.
- Do not use a random Moon image or stock crater background as a substitute for the scientific map.
- If a visual placeholder is needed, create procedural craters and contours but label the site illustrative.

## 2. Audio and music

### UI sound effects
- **Kenney: Interface Sounds**: https://kenney.nl/assets/interface-sounds
- 100 interface sounds; asset page lists CC0.
- Suitable for clicks, confirms, toggles, and short UI cues.

### Sci-fi system effects
- **Kenney: Sci-fi Sounds**: https://kenney.nl/assets/sci-fi-sounds
- 70 files; asset page lists CC0.
- Suitable for system boot, low-energy warning, comms, subtle mechanical cues. Use sparingly.

### Short musical cues
- **Kenney: Music Jingles**: https://kenney.nl/assets/music-jingles
- 85 short jingles; asset page lists CC0.
- Useful for mission start, success, failure, and menu transitions. Not a substitute for a continuous ambient soundtrack.

### Ambient music option
- **Our Expanse by Bobjt**: https://opengameart.org/content/our-expanse
- The page lists CC0 and provides OGG / MP3 variants.
- Candidate for a calm space theme. Listen to the whole track and test the loop / fade in game before choosing it.

### Alternative ambient option requiring attribution
- **Space Ambient by Osmic**: https://opengameart.org/content/space-ambient
- The page lists CC-BY 3.0. Attribution is required. Include the creator, track name, source URL, and license in the credits file.

### Additional optional library
- **Pixabay music and sound effects**: https://pixabay.com/music/ and https://pixabay.com/sound-effects/
- Pixabay's content license summary allows free use and adaptation subject to its prohibited-use conditions. Check the exact asset page, contributor, and current license before using each download. Do not redistribute an audio file as a standalone asset.

## 3. ASCII glyph atlas and typography

The coloured ASCII terrain treatment is mandatory. Prefer generating the glyph atlas inside the project from a bundled, license-checked monospaced font instead of downloading an opaque pre-rendered ASCII texture.

Candidate font source to evaluate:
- **IBM Plex Mono**: https://fonts.google.com/specimen/IBM+Plex+Mono
- Verify and retain the exact Open Font License file / license statement from the downloaded package before bundling it.

Requirements:
- Use the font only to generate the cached glyph atlas. Do not render HUD paragraphs through the atlas.
- Record the exact font version, creator, source URL, license, included license file, and any modifications.
- Measure or visually validate each glyph's ink coverage; do not assume alphabetical / ASCII code order is density order.
- If no font license can be verified, use a suitable system monospace fallback during development and do not ship an unverified font file.

## 4. Icons and fonts

- **Lucide icons**: https://lucide.dev/ and https://lucide.dev/license
- License: ISC for Lucide artwork, with some Feather-derived icons under MIT terms. Keep the license notice in the project.
- Prefer a consistent icon set over emoji for critical game states.
- Fonts: use a bundled open font such as Space Grotesk or IBM Plex Sans only after checking and retaining the font's actual license file. Source pages: https://fonts.google.com/specimen/Space+Grotesk and https://fonts.google.com/specimen/IBM+Plex+Sans
- Do not pull fonts from random ZIP collections or use a font whose license is unclear.

## 5. NASA / lunar data sources

### NASA Moon Trek
- https://trek.nasa.gov/moon/
- Use for lunar surface exploration, South Pole map context, topography products, and resource discovery. Record the exact product and export metadata used, not just the tool's home page.

### LROC QuickMap
- https://quickmap.lroc.asu.edu/
- Use to inspect LRO imagery and terrain context. Trace every DEM / mosaic product to its actual underlying source and metadata.

### JPL Horizons
- https://ssd.jpl.nasa.gov/horizons/
- API documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- User manual: https://ssd.jpl.nasa.gov/horizons/manual.html
- Use a correctly defined lunar surface observer / site and explicit target, time span, time step, coordinate frame, and requested quantities. Save query parameters or batch input with the dataset.

### NASA Lunar Reconnaissance Orbiter / LOLA
- NASA PDS Geosciences Node: https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- NASA Moon Trek can help locate products. The team must record the actual LOLA product identifier, resolution, projection, datum, and file metadata.

## 6. Asset licensing workflow

For every selected file, record:

| Field | Required value |
|---|---|
| Asset ID | Stable internal ID |
| File path | Exact path inside `public/assets/` |
| Creator | Original creator / studio |
| Source URL | Direct asset page, not only a search page |
| License | Exact license and version |
| Attribution | Exact credit text, or `Not required` if verified |
| Modifications | Cropped, recoloured, edited, converted, looped, etc. |
| Date checked | Date team verified the page and license |

Keep the original license text / license file beside the asset where possible. Do not trust a third-party mirror if the original page is available. If the license is unclear, do not use the asset.

## 7. Initial credits template

Create `public/assets/credits/ASSET_CREDITS.md` and fill it with the exact assets used. Do not credit every asset link in this document if the game does not actually include it.

```text
Crater Expectations asset credits

[Asset name]
Creator: [creator]
Source: [direct URL]
License: [license]
Changes: [none / description]

[Repeat for every included asset]

NASA / science data
[Exact LOLA product identifier and source]
[Exact JPL Horizons query / source]
[Other datasets actually used]

Libraries
[Actual library list and license links]
```
