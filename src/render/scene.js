// Surface view: lit terrain, a low Sun casting real shadows, the lander, and
// the coloured ASCII pass. Quality presets (High / Balanced / Performance / Off) come
// from quality.js; `A` toggles Off and back; at low fps it steps down to Performance at most.
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

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop
const SHARP_LAYER = 1; // objects drawn crisp on top of the ASCII terrain
const FPS_FLOOR = 30; // 2 s below this (after a grace period) steps quality down, not past Performance
// Plain shading (ASCII Off) lights every pixel; at DPR 2 that is 4x the fragments of
// DPR 1 and fell to ~39 fps. Capping its pixel ratio at 1.5 keeps it smooth and still
// sharp (lines stay ~1.25 CSS px). ASCII keeps the full ratio: its glyphs need it.
const OFF_MAX_PIXEL_RATIO = 1.5;

/**
 * `quality`: preset name (see quality.js). `cellCss`: optional debug override of the
 * preset's cell size (`?cell=8`). `onAsciiChange({ on, reason, quality })` fires
 * on every quality change; reason is 'user' or 'auto' (low fps).
 * `onFenceChange({ state, secondsLeft })` fires when the signal fence (fence.js)
 * changes state or its countdown ticks a second; never per frame.
 * `reducedMotion`: the fence snaps back instead of gliding (setReducedMotion to update).
 */
export function createSurfaceScene(
  canvas, site,
  { onFps, onAsciiChange, onFenceChange, quality: startQuality = DEFAULT_QUALITY, cellCss, reducedMotion = false } = {},
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
  scene.add(new THREE.HemisphereLight(0x4a5c96, PALETTE.navy, 0.5));

  const sun = new THREE.DirectionalLight(0xffe2b0, 3.4);
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

  const camera = createTopDownCamera(extentM * 0.95, 1);
  camera.layers.enableAll();
  const controls = new MapControls(camera, canvas);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 12;

  // Signal fence: if the view centre leaves the surveyed square, warn, count down
  // 5 s, then glide back to the landing site. Never touches the sim.
  const fence = createFence({ half: extentM / 2, reducedMotion });
  // Never fight the player: no return glide while a drag / zoom is held.
  const onControlsStart = () => fence.setHeld(true);
  const onControlsEnd = () => fence.setHeld(false);
  controls.addEventListener('start', onControlsStart);
  controls.addEventListener('end', onControlsEnd);
  let fenceShown = { state: 'inside', secondsLeft: 0 };
  function updateFence(now) {
    const t = controls.target;
    const r = fence.tick(t.x, t.z, now);
    if (r.target) {
      // Move the camera and its target together: same view, new place.
      const dx = r.target.x - t.x;
      const dz = r.target.z - t.z;
      camera.position.x += dx; camera.position.z += dz;
      t.x += dx; t.z += dz;
    }
    if (r.state !== fenceShown.state || r.secondsLeft !== fenceShown.secondsLeft) {
      fenceShown = { state: r.state, secondsLeft: r.secondsLeft };
      onFenceChange?.(fenceShown);
    }
  }

  // ASCII: terrain -> small cell-aligned target -> one glyph pass on the canvas.
  const ascii = createAsciiRenderer(renderer, {
    cellCss: cellCss || preset().cellCss, pixelRatio, glyphs: preset().glyphs,
    contours: { minM, maxM, interval },
  });

  let lastAsciiQuality = preset().ascii ? quality : DEFAULT_QUALITY; // where `A` returns to
  const governor = createFpsGovernor({ floor: FPS_FLOOR });
  governor.reset(performance.now()); // ignore the start-up hitch

  function applyShadowMap(size) {
    if (sun.shadow.mapSize.x === size) return;
    sun.shadow.mapSize.setScalar(size);
    sun.shadow.map?.dispose(); // three.js rebuilds it at the new size next frame
    sun.shadow.map = null;
    requestShadowUpdate();
  }

  function setQuality(name, reason = 'user') {
    if (!isQuality(name) || name === quality) return;
    quality = name;
    governor.reset(performance.now()); // ignore the hitch from rebuilding atlas / shadow map
    const p = preset();
    if (p.ascii) {
      lastAsciiQuality = name;
      ascii.setCell(cellCss || p.cellCss, pixelRatio, p.glyphs);
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
    if (e.key === 'a' || e.key === 'A') setAscii(!preset().ascii);
  }
  window.addEventListener('keydown', onKey);

  const sunDir = new THREE.Vector3();
  const checkDir = new THREE.Vector3();

  function pointLight(az, el, shadow = true) {
    directionFromAzEl(az, el, sunDir);
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.target.position.set(0, 0, 0);
    if (shadow) requestShadowUpdate();
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
  // stride follows the frame time measured against the display's own refresh
  // interval (frameBudget.js: 60, 50 or 144 Hz alike). Between redraws three.js
  // keeps the shadow matrix of the last redraw, so lighting and shadows stay
  // consistent, just updated at 1/1, 1/2, 1/3 or 1/4 of the frame rate.
  const refresh = createRefreshEstimator();
  const shadowStride = createShadowStride();
  let sinceShadow = 0;
  let frameMsAvg = refresh.intervalMs; // smoothed frame time, updated by the animation loop
  /** One display frame between hourly samples (render/skyClock.skyAt): moves the
   * light, the shadows and the pointer azimuths. No raycast; the solid / hollow
   * state and the lander colour stay with the sim's whole hour. Pass
   * `{ final: true }` for the settled frame: its shadows are always redrawn. */
  function setSkySmooth(sample, { final = false } = {}) {
    if (!final) {
      // Moving: lighter shadow map. A final (settled or snapped) frame does not
      // count as motion, so a still view keeps, or returns to, the full map.
      motionUntil = performance.now() + MOTION_LINGER_MS;
      applyShadowMap(motionSize());
    }
    const stride = shadowStride.update(frameMsAvg, refresh.intervalMs);
    const redraw = final || ++sinceShadow >= stride;
    if (redraw) sinceShadow = 0;
    pointLight(sample.sunAz, sample.sunEl, redraw);
    skyMarkers.set({ ...skyFlags, sunAz: sample.sunAz, earthAz: sample.earthAz });
  }

  function setLanderInShadow(inShadow) {
    bodyMat.color.set(inShadow ? PALETTE.red : PALETTE.grey);
    ring.material.color.set(inShadow ? PALETTE.red : PALETTE.amber);
  }

  /** Sun / Earth pointers for one hour. Pass the sim's stateAt() result. */
  function setSky(sky) {
    skyFlags = { sunlit: sky.sunlit, earthVisible: sky.earthVisible };
    skyMarkers.set(sky);
  }

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
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function draw() {
    lander.scale.setScalar(1 / camera.zoom); // constant screen size
    terrainMat.setAscii(preset().ascii); // elevation in alpha for glyphs, or drawn contour lines
    if (preset().ascii) {
      const offset = gridOffsetPx(camera, buffer.y, ascii.cellPx);
      ascii.render(scene, camera, buffer.x, buffer.y, offset, 0); // terrain layer as glyphs
      camera.layers.set(SHARP_LAYER); // lander drawn crisp on top
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = true;
      camera.layers.enableAll();
    } else {
      renderer.render(scene, camera);
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
      if (preset().ascii && governor.sample(fps, now, document.hidden)) {
        setQuality(lowerQuality(quality), 'auto');
      }
    }
  });

  return {
    checkSun,
    setSkySmooth,
    setLanderInShadow,
    setSky,
    onFrame,
    setAscii: (on) => setAscii(on),
    setQuality: (name) => setQuality(name),
    setReducedMotion: (on) => { fence.reducedMotion = !!on; },
    get fenceState() { return fenceShown; },
    get quality() { return quality; },
    dispose() {
      renderer.setAnimationLoop(null);
      frameSubs.clear();
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('end', onControlsEnd);
      controls.dispose();
      ascii.dispose();
      skyMarkers.dispose();
      terrain.traverse((o) => o.geometry?.dispose());
      terrainMat.material.dispose();
      renderer.dispose();
    },
  };
}
