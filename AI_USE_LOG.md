# AI use log

Required for the Space Apps submission's AI-use disclosure. One entry per task.
Data and pipeline work is logged in `pipeline/AI_USE_LOG.md`.

| Date | Dev | Tool | Task | What the AI did | What the human checked |
|---|---|---|---|---|---|
| 2026-11-13 | dev2 | Claude Code | ASCII quality presets | Wrote `src/render/quality.js`, its tests, preset wiring in `scene.js` / `ascii.js`, and the `AsciiQuality` control | Reviewed the diff; tests, production build and a Chrome run of every preset, the `A` key and persistence |
| 2026-11-13 | dev2 | Claude Code | Stable ASCII grid when panning | Wrote `gridOffsetPx` in `camera.js`, the shader grid offset in `ascii.js`, and its test | Reviewed the diff; tests, build, and a Chrome before/after pan comparison (glyph change per sub-cell pan 0.7 → 0.01) |
| 2026-11-13 | dev2 | Claude Code | Sun / Earth direction pointers and map key | Wrote `src/render/markers.js`, `setSky` in `scene.js`, `MapLegend`, and tests | Reviewed the diff; tests, build, and Chrome screenshots at hours 40 and 300 in ASCII and Off |
| 2026-11-13 | dev2 | Claude Code | Quality pass on the three dev2 changes | Self-review and fixes: exact buffer size for fractional DPR, tested fps governor, no automatic Off, zoom-constant markers, plain empty space in the ASCII pass, accessibility of the map key, sturdier tests | Reviewed the diff; 18 tests, build, Chrome at DPR 1 / 1.25 / 1.5 / 2, zoom extremes, console clean except the missing favicon |
| 2026-11-13 | dev2 | Claude Code | Lean ASCII pipeline | Replaced the composer chain with a cell-aligned low-res terrain target and one glyph pass (`cellGrid.js`, `ascii.js`), shadows redrawn only when the Sun moves, with projection tests | Reviewed the diff; 51 tests, build, Chrome: fps at DPR 2 33 → 60 (uncapped High 51 → 133), pan metric 0.02 at all scales, Off pixel-identical, memory stable over resizes |
