# Surface view: testing

**Updated:** 2026-11-13 · [Design](design.md) · [Implementation](implementation.md)

Run: `npm test` (Vitest, Node, no WebGL). Browser checks: `npm run dev`, open `http://localhost:5173/?h=<hour>`.

## Criteria
- [x] Azimuth 0 points north (−z), 90 points east (+x), elevation 90 points up *(tests/visibility.test.js › conventions)*
- [x] The stored horizon mask in demo.json matches `computeMask` on the decoded heightmap within 0.002° *(tests/visibility.test.js › demo site)*
- [x] The render raycast agrees with the sim mask on sunlit vs shadow for ≥ 95% of hours; disagreements only within 0.25° of the ridge line *(tests/visibility.test.js › demo site: 99.79% of 1440 h, 3 disagreements within 0.003°)*
- [x] Lander is grey with long shadows at a sunlit hour, red at a shadowed hour, and the HUD "render check" says agrees *(browser check 2026-11-13: headless Chrome 1440×900, `?h=200` sunlit and `?h=50` shadow)*
- [x] Terrain covers the whole canvas at 16:10 with north up *(browser check 2026-11-13, same screenshots)*
- [ ] 60 fps on a team laptop *(not proven: headless Chrome uses a software renderer; read the HUD fps counter in a real browser)*
- [ ] Hero camera, ASCII pass, Earth sprite, camera transition *(not built yet)*
