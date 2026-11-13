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
import { PALETTE } from '../theme.js';

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop
const SHARP_LAYER = 1; // objects drawn crisp on top of the ASCII terrain
const FPS_FLOOR = 30; // 2 s below this (after a grace period) steps quality down, not past Performance

/**
 * `quality`: preset name (see quality.js). `cellCss`: optional debug override of the
 * preset's cell size (`?cell=8`). `onAsciiChange({ on, reason, quality, ramp })` fires
 * on every quality change; reason is 'user' or 'auto' (low fps).
 */
export function createSurfaceScene(
  canvas, site, { onFps, onAsciiChange, quality: startQuality = DEFAULT_QUALITY, cellCss } = {},
) {
  let quality = isQuality(startQuality) ? startQuality : DEFAULT_QUALITY;
  const preset = () => QUALITY_PRESETS[quality];
  const hm = site.heightmap;
  const extentM = (hm.size - 1) * hm.spacingM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
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

  const terrain = buildTerrain(hm, {
    material: new THREE.MeshStandardMaterial({ color: PALETTE.grey, roughness: 0.95, metalness: 0 }),
  });
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

  // ASCII: terrain -> small cell-aligned target -> one glyph pass on the canvas.
  const ascii = createAsciiRenderer(renderer, {
    cellCss: cellCss || preset().cellCss, pixelRatio, glyphs: preset().glyphs,
  });

  let lastAsciiQuality = preset().ascii ? quality : DEFAULT_QUALITY; // where `A` returns to
  let lastReason = 'user';
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
    lastReason = reason;
    governor.reset(performance.now()); // ignore the hitch from rebuilding atlas / shadow map
    const p = preset();
    if (p.ascii) {
      lastAsciiQuality = name;
      ascii.setCell(cellCss || p.cellCss, pixelRatio, p.glyphs);
    }
    applyShadowMap(p.shadowMap);
    onAsciiChange?.({ on: p.ascii, reason, quality, ramp: ascii.ramp });
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

  /** Point the Sun for one hour; returns whether the terrain blocks it (render check). */
  function setSun(az, el) {
    directionFromAzEl(az, el, sunDir);
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.target.position.set(0, 0, 0);
    requestShadowUpdate();
    return { renderBlocked: blockedToward(terrain, eye, sunDir) };
  }

  function setLanderInShadow(inShadow) {
    bodyMat.color.set(inShadow ? PALETTE.red : PALETTE.grey);
    ring.material.color.set(inShadow ? PALETTE.red : PALETTE.amber);
  }

  /** Sun / Earth pointers for one hour. Pass the sim's stateAt() result. */
  function setSky(sky) {
    skyMarkers.set(sky);
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
  renderer.setAnimationLoop(() => {
    controls.update();
    draw();
    frames++;
    const now = performance.now();
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
    setSun,
    setLanderInShadow,
    setSky,
    setAscii: (on) => setAscii(on),
    setQuality: (name) => setQuality(name),
    get quality() { return quality; },
    get asciiOn() { return preset().ascii; },
    get autoOff() { return quality === 'off' && lastReason === 'auto'; },
    get ramp() { return ascii.ramp; },
    /** three.js render stats (draw calls, live textures / geometries) for profiling. */
    get renderInfo() { return renderer.info; },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      controls.dispose();
      ascii.dispose();
      skyMarkers.dispose();
      terrain.traverse((o) => o.geometry?.dispose());
      renderer.dispose();
    },
  };
}
