# Surface view: implementation

**Updated:** 2026-11-13 · [Design](design.md) · [Testing](testing.md) · [Architecture](../../ARCHITECTURE.md)

## Approach
M1 (scene proof) only: lit terrain, one low Sun casting real shadows, a lander that turns red when the sim says it is in shadow, top-down camera. Plain shading; the ASCII pass and the hero camera are not built yet. The terrain mesh bakes in lunar curvature so a raycast from the lander agrees with the sim's horizon mask, and the HUD shows that agreement every hour ("render check").

## Code map
| File / module | Role in this feature |
|---|---|
| `src/render/scene.js` | `createSurfaceScene`: renderer (PCFSoft shadows), Sun light, hemisphere fill, lander marker, MapControls, fps callback; `setSun`, `setLanderInShadow` |
| `src/render/terrain.js` | chunked terrain meshes with curvature and seamless normals; `blockedToward` raycast |
| `src/render/camera.js` | top-down orthographic camera that covers the screen |
| `src/render/sun.js` | az/el to world direction |
| `src/App.jsx` | hour slider, play at 1×/4×/16×, HUD, `?h=` deep link |

## Data and config
- **Config constants:** `SUN_DISTANCE` = 60,000 m (light placement); shadow map 4096², `normalBias = spacingM × 1.2`; lander marker radii 70–175 m (not to scale, see Deviations).
- **Persistence:** none.

## Deviations from design
- Rule 1 "true vertical scale": yes, but the lander marker is drawn about 150 m wide so it reads at 10 km; it is a marker, not a model.
- Rule 2 "Earth is a small teal sprite on the sky dome": not drawn yet (top-down view cannot show the sky; it waits for the compass ring in rule 4 and the hero camera in rule 5).
- Rules 5–8 (hero camera, ASCII pass, colour states, camera transition): not built yet.

## History
- 2026-11-13: M1 scene proof implemented (plain shading, top-down only).
