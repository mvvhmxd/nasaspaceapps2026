// PROTOTYPE - NOT FOR PRODUCTION
// Reference values the VALIDATION screen checks the game against (see assets/provenance.yaml).
// The game computes its own side of each comparison live, at load, from assets/data/lola-site.js.
window.VALIDATION = {
  // Published sunlight at south-pole sites, 2 m above ground, % of time over ~20 years (20 m LOLA DEM):
  // Glaser et al., "Illumination conditions at the lunar poles: Implications for future exploration", NASA NTRS 20170007365.
  sites_source: 'Gläser et al. 2017 · NASA NTRS 20170007365 · 20 m LOLA, ~20 years, 2 m above ground',
  sites: [
    { name: 'CONNECTING RIDGE C1', lat: -89.4398, lon: 222.83, ill: 88.0, vis: 92.1 },
    { name: 'CONNECTING RIDGE C2', lat: -89.3130, lon: 245.98, ill: 78.1, vis: 82.0 },
    { name: 'SHACKLETON RIM S0', lat: -89.6866, lon: 197.19, ill: 85.5, vis: 89.4 },
    { name: 'SHACKLETON RIM S1', lat: -89.7815, lon: 204.70, ill: 82.1, vis: 89.8 },
  ],
  // JPL Horizons topocentric observer queries (CENTER coord@301, GEODETIC 245.699 E, -89.5891, 0 km;
  // QUANTITIES 4, APPARENT AIRLESS), at the game's sky reference point. Fetched once, at development time.
  horizons_source: 'JPL Horizons API · topocentric at 89.589°S 245.699°E · airless (no refraction)',
  horizons: [
    { utc: '2027-04-04T12:00Z', sunAz: 319.47, sunEl: -0.967, earthAz: 109.60, earthEl: 2.4915 },
    { utc: '2027-07-26T12:00Z', sunAz: 19.46, sunEl: 0.1477, earthAz: 106.85, earthEl: 6.3353 },
    { utc: '2027-07-28T00:00Z', sunAz: 1.12, sunEl: 0.2117, earthAz: 107.06, earthEl: 6.3631 },
    { utc: '2027-10-17T00:00Z', sunAz: 92.42, sunEl: 1.4904, earthAz: 109.64, earthEl: 6.1666 },
    { utc: '2027-10-17T12:00Z', sunAz: 86.34, sunEl: 1.5346, earthAz: 109.71, earthEl: 6.0879 },
    { utc: '2027-10-19T00:00Z', sunAz: 68.11, sunEl: 1.6618, earthAz: 110.20, earthEl: 5.3166 },
    { utc: '2027-10-21T00:00Z', sunAz: 43.78, sunEl: 1.8029, earthAz: 111.32, earthEl: 3.1560 },
    { utc: '2027-10-23T00:00Z', sunAz: 19.42, sunEl: 1.8922, earthAz: 112.84, earthEl: 0.1231 },
  ],
  // Shackleton's floor is permanently shadowed: Zuber et al. 2012, Nature 486, 378-381 (LOLA); Glaser et al. 2017.
  method: [
    'SUNLIGHT: for each site the game traces the horizon in 720 directions out to 140 km over the LOLA heights, with the curve of the Moon.',
    'Every hour of 2027 the Sun from the baked JPL Horizons table is checked against that horizon, 2 m above ground like the published maps.',
    'EXPECTED GAPS: published values average about 20 years on 20 m terrain; the game uses one year (2027) on 80 m and 500 m grids.',
    'AS PLAYED: the game blends the heights halfway toward a 0.5 km smoothed copy so the rover can drive (and says so). Both are shown.',
    'SKY: the game turns Horizons sub-solar and sub-Earth points into azimuth and elevation at the map centre; section 2 checks this',
    'against Horizons asked directly for the view from that point. No air on the Moon, so no refraction on either side.',
    'NOT MODELLED: the rover, power, radio and score are a game model. Horizons tables were fetched while building the game and are baked in.',
    'NOT CHECKED HERE: slopes. Each mission debrief re-checks your site and the planner pick on the raw data. All numbers are recomputed live.',
  ],
  psr: { name: 'SHACKLETON FLOOR', lat: -89.67, lon: 129.78, source: 'Zuber et al. 2012, Nature 486 · Gläser et al. 2017' },
};
