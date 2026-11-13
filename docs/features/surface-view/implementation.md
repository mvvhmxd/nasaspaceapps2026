# Surface view: implementation

**Updated:** 2026-11-13 · [Design](design.md) · [Testing](testing.md) · [Architecture](../../ARCHITECTURE.md)

## Approach
M1 (scene proof) plus M1b (ASCII look): lit terrain, one low Sun casting real shadows, a lander that turns red when the sim says it is in shadow, top-down camera, and a coloured ASCII post-pass. The terrain mesh bakes in lunar curvature so a raycast from the lander agrees with the sim's horizon mask, and the HUD shows that agreement every hour ("render check").

The ASCII pass is a `ShaderPass` between `RenderPass` and `OutputPass` (linear space; sRGB once at the end). Each screen cell samples the scene at its centre, maps perceptual luminance through a contrast curve to one of 32 glyphs, and tints it with the scene colour blended with a navy-to-amber grade. The glyph atlas is built at the exact device cell size with nearest sampling so characters stay crisp, and the ramp is chosen by measured ink coverage, so it is monotonic in any monospace font. The lander lives on render layer 1 and is drawn sharp over the glyph image. The hero camera is not built yet.

## Code map
| File / module | Role in this feature |
|---|---|
| `src/render/scene.js` | `createSurfaceScene`: renderer (PCFSoft shadows), Sun light, hemisphere fill, lander marker on the sharp layer, MapControls, composer chain, `A` toggle, low-fps fallback, fps callback; `setSun`, `setLanderInShadow`, `setAscii`, `setCell` |
| `src/render/ascii.js` | `buildGlyphAtlas` (measured ramp, canvas texture) and `createAsciiPass` (shader, uniforms, resize) |
| `src/render/terrain.js` | chunked terrain meshes with curvature and seamless normals; `blockedToward` raycast |
| `src/render/camera.js` | top-down orthographic camera that covers the screen |
| `src/render/sun.js` | az/el to world direction |
| `src/App.jsx` | hour slider, play at 1×/4×/16×, HUD, `?h=` deep link |

## Data and config
- **Config constants:** `SUN_DISTANCE` = 60,000 m (light placement); shadow map 4096², `normalBias = spacingM × 1.2`; lander marker radii 70–175 m (not to scale, see Deviations); `SHARP_LAYER` = 1; `FPS_FLOOR` = 30 (three readings below it switch the pass off).
- **ASCII uniforms** (`ascii.js`): `cell` = 10 CSS px × pixel ratio (design.md "ASCII cell size"), 32 glyphs, `fill` 0.45, `saturation` 1.4, `gain` 1.6, `duotone` 0.5, contrast curve 0.04–0.8, grade colours from `PALETTE.navy` (×2.2) and `PALETTE.amber`.
- **URL flags:** `?site=<id>` (default `connecting-ridge`), `?h=<hour>`, `?cell=<px>`, `?ascii=0`.
- **Far terrain:** when `stateAt` says terrain beyond the crop hides the Sun (`sunBehindFarTerrain`), `setSun` switches the Sun light off and the HUD says "IN SHADOW (far terrain)"; the render check compares against the crop's own horizon (`nearMask`).
- **Persistence:** none.

## Deviations from design
- Rule 1 "true vertical scale": yes, but the lander marker is drawn about 150 m wide so it reads at 10 km; it is a marker, not a model.
- Rule 2 "Earth is a small teal sprite on the sky dome": not drawn yet (top-down view cannot show the sky; it waits for the compass ring in rule 4 and the hero camera in rule 5).
- Rule 6 ramp: 32 measured glyphs instead of the 10-glyph `' .:-=+*#%@'` ramp, for more detail (design.md updated).
- Rules 4 (compass ring), 5 (hero camera) and 8 (camera transition): not built yet.

## History
- 2026-11-13: M1 scene proof implemented (plain shading, top-down only).
- 2026-11-13: M1b ASCII pass implemented (`ascii.js`), lander on a sharp layer, `A` toggle and low-fps fallback.
- 2026-11-13: real site (Connecting Ridge) is the default; far-terrain shadow handling; the sim samples the mesh's own triangles and checks every mesh-edge crossing, so the render check is exact.
