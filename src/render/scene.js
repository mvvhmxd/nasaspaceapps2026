// The game's 3D view: lit terrain, a low Sun casting real shadows, the lander,
// rover and ice prospects, drawn through the coloured ASCII renderer.
// - Map view: top-down, glyphs on a cell grid anchored to the ground, contour
//   lines, Sun / Earth pointers, the signal fence.
// - Surface view (V): a chase camera behind the rover with the Sun, Earth, stars
//   and the far horizon, drawn as halftone dots.
// Quality presets (High / Balanced / Performance / Off) come from quality.js; `G`
// toggles Off and back (W A S D drive the rover); at low fps it steps down to
// Performance at most.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { buildTerrain, landerEye, blockedToward } from './terrain.js';
import { directionFromAzEl } from './sun.js';
import { createTopDownCamera, fitTopDown, gridOffsetPx } from './camera.js';
import { createAsciiRenderer } from './ascii.js';
import { createSkyMarkers } from './markers.js';
import { QUALITY_PRESETS, DEFAULT_QUALITY, isQuality, lowerQuality } from './quality.js';
import { createFpsGovernor } from './fpsGovernor.js';
import { createTerrainMaterial } from './terrainMaterial.js';
import { siteContours } from './contours.js';
import { motionShadowSize } from './shadowLod.js';
import { createFence } from './fence.js';
import { createRefreshEstimator, createShadowStride } from './frameBudget.js';
import { PALETTE } from '../theme.js';
import { groundY, ROVER } from '../sim/rover.js';

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop
const SHARP_LAYER = 1; // objects drawn crisp on top of the ASCII terrain
const FPS_FLOOR = 30; // 2 s below this (after a grace period) steps quality down, not past Performance
// Plain shading (ASCII Off) lights every pixel; at DPR 2 that is 4x the fragments of
// DPR 1 and fell to ~39 fps. Capping its pixel ratio at 1.5 keeps it smooth and still
// sharp (lines stay ~1.25 CSS px). ASCII keeps the full ratio: its glyphs need it.
const OFF_MAX_PIXEL_RATIO = 1.5;
const SKY_DISTANCE = 150000; // m; where the Sun, Earth and stars are drawn in the surface view
const SUN_SCALE = 4; // the Sun is drawn 4x and the Earth 8x their true angular size so they read on screen
const EARTH_SCALE = 8;
const EXPOSURE = 11; // surface view: Sun-facing slopes this many times brighter than level ground reach white
const SUN_DIAMETER_DEG = 0.53;
const EARTH_DIAMETER_DEG = 1.9;
const RING_RADIUS = 6000; // m; the far-horizon silhouette sits just outside the terrain crop
const CHASE_HEIGHT_M = 140; // surface view: the camera rides above and behind the rover,
const CHASE_BACK_M = 380; //   high enough to see the real crater relief of the 40 m terrain grid
const DEFAULT_PITCH = -12; // looking slightly down: rover low in the frame, horizon in the upper part
const SURFACE_CELL_CSS = 8;
const MAP_SUN_INTENSITY = 3.4;
const LAMBERT = 0.19; // roughly albedo / pi for the terrain material

/** A small procedural Earth (ocean, cloud and land blobs). Drawn by this code; no image file. */
function makeEarthTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.closePath(); g.clip();
  g.fillStyle = '#2f6fd0'; g.fillRect(0, 0, 128, 128);
  const blob = (color, n, size) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(rnd() * 128, rnd() * 128, size * (0.5 + rnd()), size * (0.3 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill(); }
  };
  blob('#3f7f52', 7, 14); blob('#8a7a50', 4, 9); blob('rgba(255,255,255,0.9)', 26, 9);
  // Night side: a soft terminator so Earth is not a flat disc (the phase is not computed).
  const shade = g.createLinearGradient(20, 100, 100, 30);
  shade.addColorStop(0, 'rgba(0,0,0,0.92)'); shade.addColorStop(0.45, 'rgba(0,0,0,0.25)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shade; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * `quality`: preset name (see quality.js). `cellCss`: optional debug override of the
 * preset's cell size (`?cell=8`). `autoOff`: false keeps the quality fixed on slow
 * machines (`?ascii=force`). `onAsciiChange({ on, reason, quality })` fires on every
 * quality change; reason is 'user' or 'auto' (low fps).
 * `onFenceChange({ state, secondsLeft })` fires when the signal fence (fence.js)
 * changes state or its countdown ticks a second; never per frame.
 * `reducedMotion`: the fence snaps back instead of gliding (setReducedMotion to update).
 */
export function createSurfaceScene(
  canvas, site,
  {
    onFps, onAsciiChange, onFenceChange, quality: startQuality = DEFAULT_QUALITY, cellCss,
    reducedMotion = false, autoOff: autoOffEnabled = true,
  } = {},
) {
  let quality = isQuality(startQuality) ? startQuality : DEFAULT_QUALITY;
  const preset = () => QUALITY_PRESETS[quality];
  const hm = site.heightmap;
  const extentM = (hm.size - 1) * hm.spacingM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2); // ASCII presets
  const ratioFor = (p) => (p.ascii ? pixelRatio : Math.min(window.devicePixelRatio, OFF_MAX_PIXEL_RATIO));
  renderer.setPixelRatio(ratioFor(preset()));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // three.js removed PCFSoftShadowMap and fell back to this anyway
  // The terrain is static, so the shadow map only changes when the Sun moves or
  // its size changes: redraw it then (see requestShadowUpdate), not every frame.
  renderer.shadowMap.autoUpdate = false;
  const requestShadowUpdate = () => { renderer.shadowMap.needsUpdate = true; };
  requestShadowUpdate();
  renderer.setClearColor(PALETTE.navy);

  const scene = new THREE.Scene();

  // Faint fill so shadowed ground is dark navy, not pure black (earthshine-ish).
  const fill = new THREE.HemisphereLight(0x4a5c96, PALETTE.navy, 0.5);
  scene.add(fill);
  // Rover floodlight (surface view only): lights the ground around the rover so shadowed terrain is readable.
  const flood = new THREE.PointLight(0xffffff, 0, 1400, 1);
  scene.add(flood);
  // Earthshine (surface view only): a faint light from Earth's real direction, so ground in the
  // Sun's shadow still shows its relief when Earth is up. It casts no shadows.
  const earthLight = new THREE.DirectionalLight(0x58c8ff, 0); // cyan-blue earthshine
  scene.add(earthLight, earthLight.target);
  let earthEl = -90;

  const sun = new THREE.DirectionalLight(0xffe2b0, MAP_SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(preset().shadowMap);
  const sc = sun.shadow.camera;
  const r = extentM * 0.75;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
  sc.near = 1000; sc.far = SUN_DISTANCE * 2;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = hm.spacingM * 1.2; // kills acne on grazing-lit ridge crests
  scene.add(sun, sun.target);

  // Contours from the real heightmap: levels every `interval` m (index line every 5th).
  const { minM, maxM, interval } = siteContours(hm); // cached: the map key reads the same
  const terrainMat = createTerrainMaterial({ minM, maxM, interval, pixelRatio: renderer.getPixelRatio() });
  const terrain = buildTerrain(hm, { material: terrainMat.material });
  scene.add(terrain);

  // Lander marker: drawn far larger than a real lander so it reads at 10 km
  // (not to scale). It neither casts nor receives shadows. It and the Sun / Earth
  // pointers keep a constant on-screen size at every zoom (see draw()).
  const eye = landerEye(hm);
  const lander = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: PALETTE.grey });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(70, 90, 80, 6), bodyMat);
  body.position.y = 40;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(150, 175, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.9 }),
  );
  ring.position.y = 5;
  const skyMarkers = createSkyMarkers();
  skyMarkers.group.position.y = 5;
  lander.add(body, ring, skyMarkers.group);
  lander.position.set(0, eye.y, 0);
  lander.traverse((o) => o.layers.set(SHARP_LAYER));
  scene.add(lander);
  // In the surface view the map marker would be a wall, so the lander is a slim beacon instead.
  const beacon = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.5, 22, 6), new THREE.MeshBasicMaterial({ color: PALETTE.grey }));
  mast.position.y = 11;
  const lampMat = new THREE.MeshBasicMaterial({ color: PALETTE.amber });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), lampMat);
  lamp.position.y = 25;
  beacon.add(mast, lamp);
  beacon.position.set(0, eye.y - 2, 0);
  beacon.traverse((o) => o.layers.set(SHARP_LAYER));
  beacon.visible = false;
  scene.add(beacon);

  // Rover and ice prospects: crisp markers, far larger than life so they read on the map.
  const roverMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const rover = new THREE.Group();
  const roverBody = new THREE.Mesh(new THREE.ConeGeometry(48, 130, 4).rotateX(-Math.PI / 2), roverMat); // nose points north
  roverBody.position.y = 30;
  rover.add(roverBody);
  const roverRing = new THREE.Mesh(
    new THREE.RingGeometry(95, 115, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber }),
  );
  roverRing.position.y = 8;
  rover.add(roverRing); // a ring so the rover is easy to find in either view
  rover.traverse((o) => o.layers.set(SHARP_LAYER));
  rover.visible = false;
  scene.add(rover);
  const prospects = new THREE.Group();
  scene.add(prospects);
  const prospectGeo = new THREE.OctahedronGeometry(60);
  const prospectRing = new THREE.RingGeometry(ROVER.targetRadiusM, ROVER.targetRadiusM + 18, 40).rotateX(-Math.PI / 2);
  const prospectMats = { open: new THREE.MeshBasicMaterial({ color: PALETTE.teal }), done: new THREE.MeshBasicMaterial({ color: '#5a6072' }) };

  // Surface view: sky bodies, stars, and a silhouette of the far horizon beyond the terrain crop.
  const sky = new THREE.Group();
  sky.visible = false;
  scene.add(sky);
  const bodySize = (deg) => 2 * SKY_DISTANCE * Math.tan((deg * Math.PI) / 360);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff3d0', fog: false }));
  sunSprite.scale.setScalar(bodySize(SUN_DIAMETER_DEG * SUN_SCALE));
  const earthTexture = makeEarthTexture();
  const earthSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: earthTexture, fog: false }));
  earthSprite.scale.setScalar(bodySize(EARTH_DIAMETER_DEG * EARTH_SCALE));
  const starPos = new Float32Array(900 * 3);
  let starSeed = 2026;
  const srnd = () => { starSeed = (starSeed * 16807) % 2147483647; return starSeed / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const u = srnd() * 2 - 1, a = srnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    starPos.set([rr * Math.cos(a) * SKY_DISTANCE * 1.5, Math.abs(u) * SKY_DISTANCE * 1.5, rr * Math.sin(a) * SKY_DISTANCE * 1.5], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false }));
  stars.layers.set(SHARP_LAYER);
  const bigGeo = new THREE.BufferGeometry();
  bigGeo.setAttribute('position', new THREE.BufferAttribute(starPos.slice(0, 70 * 3), 3));
  const bigStars = new THREE.Points(bigGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 3.2, sizeAttenuation: false }));
  bigStars.layers.set(SHARP_LAYER);
  // Ring whose top edge, seen from the lander, sits at the site's real horizon elevation in every direction.
  const ringPos = [], ringIdx = [], ringCol = [];
  for (let i = 0; i <= 360; i++) {
    const a = (i % 360) * (Math.PI / 180);
    const top = eye.y + RING_RADIUS * Math.tan((site.horizonMask[i % 360] * Math.PI) / 180);
    ringPos.push(Math.sin(a) * RING_RADIUS, top, -Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, top - 260, -Math.cos(a) * RING_RADIUS);
    ringCol.push(0.06, 0.06, 0.065, 0, 0, 0); // bright at the skyline, fading to black below it
    if (i < 360) ringIdx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPos, 3));
  ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(ringCol, 3));
  ringGeo.setIndex(ringIdx);
  const farRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  sky.add(sunSprite, earthSprite, stars, bigStars, farRing);

  const surfaceCam = new THREE.PerspectiveCamera(50, 1, 2, SKY_DISTANCE * 4);
  surfaceCam.layers.enableAll();
  let view = 'map';
  let lastView = 'map';
  let yaw = 0, pitch = DEFAULT_PITCH; // degrees: where the surface camera looks
  let roverHeading = 0;
  let roverShown = false;
  let sunEl = 1, siteDark = false, sunFarBlocked = false;
  const camBack = new THREE.Vector3();
  const roverPos = new THREE.Vector3(0, eye.y, 0);
  const earthDir = new THREE.Vector3(0, -1, 0);
  const lookDir = new THREE.Vector3();

  const camera = createTopDownCamera(extentM * 0.95, 1);
  camera.layers.enableAll();
  const controls = new MapControls(camera, canvas);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 12;

  // Signal fence: if the view centre leaves the surveyed square, warn, count down
  // 5 s, then glide back to the landing site. Never touches the sim. Map view only.
  const fence = createFence({ half: extentM / 2, reducedMotion });
  // Never fight the player: no return glide while a drag / zoom is held.
  const onControlsStart = () => fence.setHeld(true);
  const onControlsEnd = () => fence.setHeld(false);
  controls.addEventListener('start', onControlsStart);
  controls.addEventListener('end', onControlsEnd);
  let fenceShown = { state: 'inside', secondsLeft: 0 };
  function updateFence(now) {
    const t = controls.target;
    const res = view === 'map' ? fence.tick(t.x, t.z, now) : { state: 'inside', secondsLeft: 0, target: null };
    if (res.target) {
      // Move the camera and its target together: same view, new place.
      const dx = res.target.x - t.x;
      const dz = res.target.z - t.z;
      camera.position.x += dx; camera.position.z += dz;
      t.x += dx; t.z += dz;
    }
    if (res.state !== fenceShown.state || res.secondsLeft !== fenceShown.secondsLeft) {
      fenceShown = { state: res.state, secondsLeft: res.secondsLeft };
      onFenceChange?.(fenceShown);
    }
  }

  // ASCII: terrain -> small cell-aligned target -> one glyph (or dot) pass on the canvas.
  let mapCellCss = cellCss || preset().cellCss;
  const ascii = createAsciiRenderer(renderer, {
    cellCss: mapCellCss, pixelRatio, glyphs: preset().glyphs,
    contours: { minM, maxM, interval },
  });

  let lastAsciiQuality = preset().ascii ? quality : DEFAULT_QUALITY; // where `G` returns to
  const governor = createFpsGovernor({ floor: FPS_FLOOR });
  governor.reset(performance.now()); // ignore the start-up hitch

  function applyShadowMap(size) {
    if (sun.shadow.mapSize.x === size) return;
    sun.shadow.mapSize.setScalar(size);
    sun.shadow.map?.dispose(); // three.js rebuilds it at the new size next frame
    sun.shadow.map = null;
    requestShadowUpdate();
  }

  const viewCellCss = () => (view === 'surface' ? SURFACE_CELL_CSS : mapCellCss);

  function setQuality(name, reason = 'user') {
    if (!isQuality(name) || name === quality) return;
    quality = name;
    governor.reset(performance.now()); // ignore the hitch from rebuilding atlas / shadow map
    const p = preset();
    if (p.ascii) {
      lastAsciiQuality = name;
      mapCellCss = cellCss || p.cellCss;
      ascii.setCell(viewCellCss(), pixelRatio, p.glyphs);
    }
    applyShadowMap(p.shadowMap);
    const ratio = ratioFor(p);
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      terrainMat.setPixelRatio(ratio); // plain-mode line width stays in CSS px
      resize();
    }
    onAsciiChange?.({ on: p.ascii, reason, quality });
  }

  function setAscii(on, reason = 'user') {
    if (preset().ascii === on) return;
    setQuality(on ? lastAsciiQuality : 'off', reason);
  }
  function onKey(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.closest?.('input, select, textarea')) return;
    if (e.key === 'g' || e.key === 'G') setAscii(!preset().ascii); // G, not A: W A S D drive the rover
  }
  window.addEventListener('keydown', onKey);

  const sunDir = new THREE.Vector3();
  const checkDir = new THREE.Vector3();

  /**
   * Map view: fixed light. Surface view: expose like a camera, so level ground under a grazing
   * Sun is mid-grey, Sun-facing slopes are white and shadows are black. When the sim says the
   * site is in shadow, the direct light is off and a dim fill stands in for earthshine.
   * Far-terrain shadow (the sim's whole hour says terrain beyond the crop hides the Sun):
   * the crop cannot cast it, so the Sun light is switched off to match, in both views.
   */
  function applyExposure() {
    if (view !== 'surface') {
      sun.intensity = sunFarBlocked ? 0 : MAP_SUN_INTENSITY; sun.color.set(0xffe2b0);
      fill.intensity = 0.5; fill.color.set(0x4a5c96);
      flood.intensity = 0;
      earthLight.intensity = 0;
      return;
    }
    const lit = !siteDark && sunEl > 0;
    sun.color.set(0xffb648); // amber: sunlit ground
    sun.intensity = lit ? 1 / (LAMBERT * EXPOSURE * Math.sin((Math.max(sunEl, 0.4) * Math.PI) / 180)) : 0;
    fill.color.set(0x4f74ff); // blue: ground in shadow
    fill.intensity = lit ? 0.06 : 0.14;
    flood.intensity = 70;
    earthLight.intensity = earthEl > 0 ? 0.05 / (LAMBERT * Math.sin((Math.max(earthEl, 1) * Math.PI) / 180)) : 0;
  }

  function pointLight(az, el, shadow = true) {
    directionFromAzEl(az, el, sunDir);
    sunEl = el;
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.target.position.set(0, 0, 0);
    applyExposure();
    if (shadow) requestShadowUpdate();
  }

  function pointEarth(az, el) {
    directionFromAzEl(az, el, earthDir);
    earthEl = el;
    earthLight.position.copy(earthDir).multiplyScalar(SUN_DISTANCE);
    applyExposure();
  }

  /** Render check for one hour: does the terrain mesh block the Sun at (az, el)?
   * Raycast only; the light does not move. */
  function checkSun(az, el) {
    return { renderBlocked: blockedToward(terrain, eye, directionFromAzEl(az, el, checkDir)) };
  }

  // Truth flags from the sim's whole hour (setSky); smooth frames move only positions.
  let skyFlags = { sunlit: true, earthVisible: true };
  // Motion level of detail. Redrawing a 4096² shadow map every frame does not fit
  // a 60 Hz frame at DPR 2 (measured: p95 31 ms vs 17 ms without the redraws).
  // While the Sun is moving, the shadow map is sized to the glyph cell
  // (shadowLod.js: texel <= half a cell, 512² at default zoom); after
  // MOTION_LINGER_MS without movement the preset's full-size map comes back for
  // the still view. Continuous playback keeps the motion size (it changes only
  // when the zoom crosses a power of two), so nothing is reallocated per hour.
  const MOTION_LINGER_MS = 1500;
  const shadowCoverM = sc.right - sc.left;
  // Plain shading (Off) has no glyph cell to hide detail in, so while moving it
  // uses a shadow texel of at most OFF_MOTION_TEXEL_PX drawing-buffer pixels
  // (1024² at default zoom, back to the full map when zoomed in). Measured at DPR 2,
  // 16x play: p95 36 ms with a fixed 2048² vs 33 ms at 1024²; the still view always
  // returns to the full map MOTION_LINGER_MS after the Sun stops.
  const OFF_MOTION_TEXEL_PX = 4;
  function motionSize() {
    const mPerPx = (camera.top - camera.bottom) / (camera.zoom * Math.max(1, buffer.y));
    const cellPx = preset().ascii ? ascii.cellPx : 2 * OFF_MOTION_TEXEL_PX; // texel <= cell / 2
    return motionShadowSize({ coverM: shadowCoverM, cellM: cellPx * mPerPx, stillSize: stillShadowMap() });
  }
  let motionUntil = -Infinity;
  const stillShadowMap = () => preset().shadowMap;
  // Safety net on slow GPUs: redraw the shadows every `stride` smooth frames. The
  // stride follows the frame time measured against the page's normal frame interval
  // (frameBudget.js). Between redraws three.js keeps the shadow matrix of the last
  // redraw, so lighting and shadows stay consistent, just updated at 1/1, 1/2, 1/3
  // or 1/4 of the frame rate.
  const refresh = createRefreshEstimator();
  const shadowStride = createShadowStride();
  let sinceShadow = 0;
  let frameMsAvg = refresh.intervalMs; // smoothed frame time, updated by the animation loop
  /** One display frame between hourly samples (render/skyClock.skyAt): moves the
   * Sun and Earth light, the shadows and the pointer azimuths. No raycast; the
   * solid / hollow state, the lander colour and the far-terrain switch stay with the
   * sim's whole hour. Pass `{ final: true }` for the settled frame: its shadows are
   * always redrawn. */
  function setSkySmooth(sample, { final = false } = {}) {
    if (!final && view === 'map') {
      // Moving: lighter shadow map. A final (settled or snapped) frame does not
      // count as motion, so a still view keeps, or returns to, the full map.
      // (The surface view keeps the full map: its perspective shows shadow detail up close.)
      motionUntil = performance.now() + MOTION_LINGER_MS;
      applyShadowMap(motionSize());
    }
    const stride = shadowStride.update(frameMsAvg, refresh.intervalMs);
    const redraw = final || ++sinceShadow >= stride;
    if (redraw) sinceShadow = 0;
    pointLight(sample.sunAz, sample.sunEl, redraw);
    pointEarth(sample.earthAz, sample.earthEl);
    skyMarkers.set({ ...skyFlags, sunAz: sample.sunAz, earthAz: sample.earthAz });
  }

  /** Lander colour and surface exposure for one hour (the sim decides). */
  function setLanderInShadow(inShadow) {
    bodyMat.color.set(inShadow ? PALETTE.red : PALETTE.grey);
    ring.material.color.set(inShadow ? PALETTE.red : PALETTE.amber);
    lampMat.color.set(inShadow ? PALETTE.red : PALETTE.amber);
    siteDark = inShadow;
    applyExposure();
  }

  /** Sim truth for one hour: pass the sim's stateAt() result. Sets the pointer
   * flags (and positions, until easing moves them) and the far-terrain switch. */
  function setSky(state) {
    skyFlags = { sunlit: state.sunlit, earthVisible: state.earthVisible };
    skyMarkers.set(state);
    sunFarBlocked = !!state.sunBehindFarTerrain;
    applyExposure();
  }

  /** 'map' = top-down, 'surface' = standing at the rover looking at the horizon. */
  function setView(next) {
    view = next === 'surface' ? 'surface' : 'map';
    sky.visible = view === 'surface';
    lander.visible = view === 'map';
    beacon.visible = view === 'surface';
    rover.scale.setScalar(view === 'surface' ? 0.4 : 1);
    if (view === 'surface' && lastView !== 'surface') { yaw = roverHeading; pitch = DEFAULT_PITCH; } // start looking where the rover points
    if (view !== lastView) {
      motionUntil = -Infinity; // the surface view wants the full shadow map at once
      applyShadowMap(stillShadowMap());
      requestShadowUpdate();
    }
    lastView = view;
    applyExposure();
    if (preset().ascii) ascii.setCell(viewCellCss(), pixelRatio, preset().glyphs);
    controls.enabled = view === 'map';
    rover.visible = roverShown;
    ascii.setDots(view === 'surface');
  }

  function setRover(rv) {
    roverShown = !!rv;
    rover.visible = roverShown;
    if (!rv) return;
    const y = groundY(hm, rv.x, rv.z);
    rover.position.set(rv.x, y, rv.z);
    rover.rotation.y = (-rv.heading * Math.PI) / 180;
    roverMat.color.set(!rv.alive ? PALETTE.red : rv.sunlit ? '#ffffff' : '#8fa0d8');
    roverPos.set(rv.x, y, rv.z);
    roverHeading = rv.heading;
    flood.position.set(rv.x, y + 70, rv.z);
  }

  function setProspects(list, collected = []) {
    prospects.clear();
    for (const t of list) {
      const mat = collected.includes(t.id) ? prospectMats.done : prospectMats.open;
      const y = groundY(hm, t.x, t.z);
      const gem = new THREE.Mesh(prospectGeo, mat);
      gem.scale.setScalar(0.6);
      gem.position.set(t.x, y + 70, t.z);
      const ringMesh = new THREE.Mesh(prospectRing, mat);
      ringMesh.position.set(t.x, y + 6, t.z);
      prospects.add(gem, ringMesh);
    }
    prospects.traverse((o) => o.layers.set(SHARP_LAYER));
  }

  function turn(dYaw, dPitch = 0) {
    yaw = (yaw + dYaw + 360) % 360;
    pitch = Math.max(-40, Math.min(35, pitch + dPitch));
  }
  let dragging = null;
  const onDown = (e) => { if (view === 'surface') dragging = { x: e.clientX, y: e.clientY }; };
  const onMove = (e) => {
    if (!dragging) return;
    turn(-(e.clientX - dragging.x) * 0.15, (e.clientY - dragging.y) * 0.15);
    dragging = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { dragging = null; };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // Per-frame subscribers on the one animation loop (no second rAF loop).
  const frameSubs = new Set();
  /** Run `cb(now)` before every frame is drawn; returns an unsubscribe function. */
  function onFrame(cb) {
    frameSubs.add(cb);
    return () => frameSubs.delete(cb);
  }

  // Exact drawing-buffer size: three.js floors w * dpr, which differs from
  // clientWidth * dpr at fractional scales (125 %, 150 %) common on Windows laptops.
  const buffer = new THREE.Vector2();
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(buffer);
    // Aspect of the real buffer, so one metre is the same number of pixels on
    // both axes (the grid anchoring and the terrain target assume it).
    fitTopDown(camera, buffer.x / buffer.y);
    surfaceCam.aspect = buffer.x / buffer.y;
    surfaceCam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const NO_OFFSET = [0, 0];
  function draw() {
    const surface = view === 'surface';
    const cam = surface ? surfaceCam : camera;
    if (surface) {
      directionFromAzEl(yaw, 0, camBack).multiplyScalar(-CHASE_BACK_M);
      surfaceCam.position.copy(roverPos).add(camBack);
      surfaceCam.position.y += CHASE_HEIGHT_M;
      const under = groundY(hm, surfaceCam.position.x, surfaceCam.position.z);
      if (!Number.isNaN(under)) surfaceCam.position.y = Math.max(surfaceCam.position.y, under + 40);
      surfaceCam.lookAt(lookDir.copy(directionFromAzEl(yaw, pitch)).add(surfaceCam.position));
      sunSprite.position.copy(sunDir).multiplyScalar(SKY_DISTANCE).add(surfaceCam.position);
      earthSprite.position.copy(earthDir).multiplyScalar(SKY_DISTANCE).add(surfaceCam.position);
      stars.position.copy(surfaceCam.position);
      bigStars.position.copy(surfaceCam.position);
      // A prospect marker right under the camera would fill the screen: hide the ones that close.
      for (const m of prospects.children) m.visible = Math.hypot(m.position.x - surfaceCam.position.x, m.position.z - surfaceCam.position.z) > 450;
    } else {
      lander.scale.setScalar(1 / camera.zoom); // constant screen size
      for (const m of prospects.children) m.visible = true;
    }
    // Elevation in alpha for glyphs (and empty-space detection for the dots), or
    // drawn contour lines with ASCII Off.
    terrainMat.setAscii(preset().ascii);
    if (preset().ascii) {
      // Map: grid anchored to the ground. Surface: the grid stays on the screen.
      const offset = surface ? NO_OFFSET : gridOffsetPx(camera, buffer.y, ascii.cellPx);
      ascii.render(scene, cam, buffer.x, buffer.y, offset, 0); // terrain (and sky bodies) as glyphs / dots
      cam.layers.set(SHARP_LAYER); // markers and stars drawn crisp on top
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, cam);
      renderer.autoClear = true;
      cam.layers.enableAll();
    } else {
      renderer.render(scene, cam);
    }
  }

  let frames = 0;
  let last = performance.now();
  let prevFrame = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    refresh.sample(now - prevFrame);
    frameMsAvg += (Math.min(now - prevFrame, 100) - frameMsAvg) * 0.1;
    prevFrame = now;
    if (now > motionUntil) applyShadowMap(stillShadowMap()); // still again: full-size shadows (no-op when already)
    for (const cb of frameSubs) cb(now);
    controls.update();
    updateFence(now);
    draw();
    frames++;
    if (now - last >= 500) {
      const fps = Math.round((frames * 1000) / (now - last));
      onFps?.(fps);
      frames = 0;
      last = now;
      // Shed cell detail before giving up the ASCII look (spec 8.1).
      if (autoOffEnabled && preset().ascii && governor.sample(fps, now, document.hidden)) {
        setQuality(lowerQuality(quality), 'auto');
      }
    }
  });

  return {
    checkSun,
    setSkySmooth,
    setSky,
    setLanderInShadow,
    setView,
    setRover,
    setProspects,
    turn,
    onFrame,
    get yaw() { return yaw; },
    get view() { return view; },
    setAscii: (on) => setAscii(on),
    setQuality: (name) => setQuality(name),
    setReducedMotion: (on) => { fence.reducedMotion = !!on; },
    get fenceState() { return fenceShown; },
    get quality() { return quality; },
    dispose() {
      renderer.setAnimationLoop(null);
      frameSubs.clear();
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      ro.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('end', onControlsEnd);
      controls.dispose();
      ascii.dispose();
      skyMarkers.dispose();
      terrain.traverse((o) => o.geometry?.dispose());
      terrainMat.material.dispose();
      for (const o of [lander, beacon, rover, sky]) {
        o.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); });
      }
      prospectGeo.dispose();
      prospectRing.dispose();
      prospectMats.open.dispose();
      prospectMats.done.dispose();
      earthTexture.dispose();
      renderer.dispose();
    },
  };
}
