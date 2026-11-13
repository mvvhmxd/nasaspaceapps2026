---
name: ascii-rendering
description: Designs, prototypes, implements, profiles, and tests the required coloured 2D ASCII terrain compositor for Crater Expectations. Use whenever changing map rendering, glyphs, shader pipelines, terrain styling, or rendering performance.
---

# Coloured 2D ASCII Terrain Rendering

## Product requirement
The active game is a strictly 2D north-up top-down strategy game. Its terrain map must have a premium coloured ASCII visual identity. Do not restore the retired 3D hero camera. Do not remove ASCII as a scope-saving shortcut without explicit user approval.

## Visual contract
- Apply the ASCII treatment to the terrain / hillshade / contour / valid shadow image only.
- Keep React UI, labels, HUD, lander sprite, selected-site ring, objective markers, compass, and critical icons sharp and readable above the effect.
- Use the game's palette: navy `#0B1026`, amber `#F5A524`, teal `#3FB6A8`, terrain/text grey `#C9CED6`, and restrained critical red.
- The result should feel like premium lunar cartography rendered in coloured characters, not a generic green terminal, noisy dithering filter, or illegible text wall.

## Preferred implementation process
1. Inspect the existing renderer and any original ASCII shader / glyph atlas work. Reuse compatible work when it is correct and tested.
2. Build an isolated proof using one representative crater / ridge terrain fixture before changing the full game.
3. Render the ordinary 2D terrain image into an offscreen texture or equivalent render target.
4. Build and cache a glyph atlas from a bundled font whose exact license has been checked and recorded. Use roughly 24 to 32 useful glyphs, ordered by measured or visually validated ink coverage.
5. Use a GPU fragment / compositing pipeline where supported. Sample the source map by glyph cells, estimate luminance consistently, choose a glyph density tier, and tint with the source terrain colour / game palette.
6. Correct for glyph aspect ratio and device pixel ratio. Start near 8, 10, and 12 CSS px cells for High, Balanced, and Performance, then profile and tune.
7. Anchor the grid / sample positions consistently so panning does not cause distracting glyph shimmer. Do not introduce random per-frame dithering.
8. Draw gameplay markers and all UI after the ASCII pass.
9. Handle resize, DPR changes, WebGL context loss and restore, texture disposal, and fallback rendering.

## Performance rules
- Never do expensive per-pixel or per-character CPU loops every frame when a GPU path is available.
- Cache glyph atlas and terrain resources. Recompute shadow maps only when site / Sun sample changes.
- Profile the isolated map, then the complete screen, on the slowest actual team laptop.
- Record FPS and frame-time at each quality preset and viewport size.
- If performance is low, lower render-target scale, shadow resolution, and glyph detail before dropping ASCII. Preserve the Off fallback for accessibility and unsupported hardware.

## Scientific integrity
- The shader is presentation only. It must not decide Sun or Earth visibility, calculate shadows, or modify any simulation quantity.
- The base map shadow layer must come from the documented DEM shadow method or be visibly labelled schematic / illustrative.
- Never make invented terrain look like verified LOLA terrain.

## Required tests / acceptance
- Glyph-density order is validated and stable.
- Dark, bright, midtone, high-contrast ridge, and shadow-edge fixtures produce sensible glyph-density results.
- Fixed input and state produce deterministic screenshots.
- Camera pan / zoom causes no distracting flicker or glyph crawling.
- Crater rims, ridges, shadow boundaries, selected site, and lander remain identifiable at 1366×768.
- HUD, labels, and small iconography remain crisp and accessible.
- Quality settings and Off toggle work and preserve all gameplay interactions.
- Resize, DPR changes, context restoration, and cleanup are tested.
- Performance measurements and known limitations are recorded in `docs/BUILD_STATUS.md`.
