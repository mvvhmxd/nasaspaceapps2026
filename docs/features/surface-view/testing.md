# Surface view: testing

**Updated:** 2026-11-13 · [Design](design.md) · [Implementation](implementation.md)

Run: `npm test` (Vitest, Node, no WebGL). Browser checks: `npm run dev`, open `http://localhost:5173/?h=<hour>`.

## Criteria
- [x] Azimuth 0 points north (−z), 90 points east (+x), elevation 90 points up *(tests/visibility.test.js › conventions)*
- [x] The stored horizon mask in demo.json matches `computeMask` on the decoded heightmap within 0.002° *(tests/visibility.test.js › demo site)*
- [x] The render raycast agrees with the sim mask on sunlit vs shadow for ≥ 95% of hours; disagreements only within 0.01° of the ridge line *(tests/visibility.test.js › demo site: 100% of 1440 h; Connecting Ridge: 99.93%, 1 tie on the ridge line)*
- [x] Lander is grey with long shadows at a sunlit hour, red at a shadowed hour, and the HUD "render check" says agrees *(browser check 2026-11-13: headless Chrome 1440×900, demo `?site=demo&h=200` / `h=50`; Connecting Ridge `?h=2` sunlit, `?h=59` ridge shadow, `?h=1021` far-terrain shadow)*
- [x] Terrain covers the whole canvas at 16:10 with north up *(browser check 2026-11-13, same screenshots)*
- [x] ASCII pass: lit slopes show dense amber glyphs, shadow stays navy with sparse glyphs, the lander is drawn sharp, and the render check still agrees *(browser check 2026-11-13: headless Chrome 1440×900, `?h=200` and `?h=50` at cell 8 and 12; no shader errors in the console)*
- [x] 60 fps on a team laptop with the ASCII pass on *(browser check 2026-11-13: HUD counter read 144 fps on the demo site at `?h=200` with ASCII on, 1280×600 window, on the lead's laptop; still to be read on the slowest team laptop)*
- [ ] `A` toggles the pass and three sub-30 fps readings switch it off with the HUD note *(not proven: needs a real browser session)*
- [ ] Hero camera, compass ring, Earth sprite, camera transition *(not built yet)*
