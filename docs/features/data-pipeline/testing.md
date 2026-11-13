# Data pipeline: testing

**Updated:** 2026-11-13 · [Design](design.md) · [Implementation](implementation.md)

Run: `npm test` (checks the generated site files), and the pipeline itself prints a summary on every run.

## Criteria
- [x] The 240 m polar DEM and the 5 m site DEM agree where they overlap *(one-off check 2026-11-13: 4,000 random points, 4.7 m RMS, 0.6 m median offset; recorded in implementation.md, not an automated test)*
- [x] The site file is marked real and names LOLA and Horizons *(tests/visibility.test.js › Connecting Ridge › is marked as real data)*
- [x] The stored horizon is never below the crop's own horizon, and equals it where the crop sets it *(tests/visibility.test.js › Connecting Ridge › pipeline horizon: 0.000° worst; 303 of 360 azimuths set inside the crop)*
- [x] The render raycast agrees with the crop's horizon for ≥ 95% of hours, misses within 0.01° *(tests/visibility.test.js › Connecting Ridge › render raycast: 99.93% of 1440 h, 1 tie on the ridge line)*
- [x] The lander shows red at an hour where Horizons puts the Sun behind a ridge *(browser check 2026-11-13: `?h=59`, Sun el −0.08°, ridge 0.23°, lander red, render check agrees)*
- [x] A far-terrain shadow switches the Sun light off and is labelled *(browser check 2026-11-13: `?h=1021`, "IN SHADOW (far terrain)")*
- [ ] Illumination matches the published PGDA illumination maps for the site *(not done)*
