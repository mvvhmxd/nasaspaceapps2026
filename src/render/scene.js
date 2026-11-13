// Surface view: lit terrain, a low Sun casting real shadows, the lander, and
// the coloured ASCII pass (toggle with `A`; falls back to plain shading below 30 fps).
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTerrain, landerEye, blockedToward } from './terrain.js';
import { directionFromAzEl } from './sun.js';
import { createTopDownCamera, fitTopDown } from './camera.js';
import { createAsciiPass } from './ascii.js';
import { PALETTE } from '../theme.js';
import { groundY, ROVER } from '../sim/rover.js';

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop
const SHARP_LAYER = 1; // objects drawn crisp on top of the ASCII terrain
const FPS_FLOOR = 30; // three readings below this switch the ASCII pass off
const SKY_DISTANCE = 150000; // m; where the Sun, Earth and stars are drawn in the surface view
const SUN_SCALE = 4; // the Sun is drawn 4x and the Earth 8x their true angular size so they read on screen
const EARTH_SCALE = 8;
const EXPOSURE = 11; // surface view: Sun-facing slopes this many times brighter than level ground reach white
const SUN_DIAMETER_DEG = 0.53;
const EARTH_DIAMETER_DEG = 1.9;
const RING_RADIUS = 6000; // m; the far-horizon silhouette sits just outside the terrain crop
const CHASE_HEIGHT_M = 220; // surface view: the camera rides above and behind the rover,
const CHASE_BACK_M = 600; //   high enough to see the real crater relief of the 40 m terrain grid
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

export function createSurfaceScene(canvas, site, { onFps, onAsciiChange, cellCss = 10, autoOff: autoOffEnabled = true } = {}) {
  const hm = site.heightmap;
  const extentM = (hm.size - 1) * hm.spacingM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PALETTE.navy, 0); // alpha 0 marks "no terrain" for the ASCII pass; the canvas itself is opaque

  const scene = new THREE.Scene();

  // Faint fill so shadowed ground is dark navy, not pure black (earthshine-ish).
  const fill = new THREE.HemisphereLight(0x4a5c96, PALETTE.navy, 0.5);
  scene.add(fill);

  const sun = new THREE.DirectionalLight(0xffe2b0, MAP_SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
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
  // (not to scale). It neither casts nor receives shadows.
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
  lander.add(body, ring);
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
  rover.traverse((o) => o.layers.set(SHARP_LAYER));
  rover.visible = false;
  scene.add(rover);
  const prospects = new THREE.Group();
  scene.add(prospects);
  const prospectGeo = new THREE.OctahedronGeometry(60);
  const prospectRing = new THREE.RingGeometry(ROVER.targetRadiusM, ROVER.targetRadiusM + 18, 40).rotateX(-Math.PI / 2);

  // Surface view: sky bodies, stars, and a silhouette of the far horizon beyond the terrain crop.
  const sky = new THREE.Group();
  sky.visible = false;
  scene.add(sky);
  const bodySize = (deg) => 2 * SKY_DISTANCE * Math.tan((deg * Math.PI) / 360);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff3d0', fog: false }));
  sunSprite.scale.setScalar(bodySize(SUN_DIAMETER_DEG * SUN_SCALE));
  const earthSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEarthTexture(), fog: false }));
  earthSprite.scale.setScalar(bodySize(EARTH_DIAMETER_DEG * EARTH_SCALE));
  const starPos = new Float32Array(900 * 3);
  let starSeed = 2026;
  const srnd = () => { starSeed = (starSeed * 16807) % 2147483647; return starSeed / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const u = srnd() * 2 - 1, a = srnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    starPos.set([r * Math.cos(a) * SKY_DISTANCE * 1.5, Math.abs(u) * SKY_DISTANCE * 1.5, r * Math.sin(a) * SKY_DISTANCE * 1.5], i * 3);
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
    ringPos.push(Math.sin(a) * RING_RADIUS, top, -Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, top - 900, -Math.cos(a) * RING_RADIUS);
    ringCol.push(0.1, 0.1, 0.105, 0, 0, 0); // bright at the skyline, fading to black below it
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
  let mapCellCss = cellCss;
  let yaw = 0, pitch = -7; // degrees: where the surface camera looks
  let sunEl = 1, siteDark = false;
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

  // ASCII chain: scene -> glyph pass -> output (tone mapping + sRGB once).
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const ascii = createAsciiPass({ cellCss, pixelRatio });
  composer.addPass(ascii.pass);
  composer.addPass(new OutputPass());

  let asciiOn = true;
  let autoOff = false;
  let lowFpsStreak = 0;
  function setAscii(on, reason = 'user') {
    if (asciiOn === on) return;
    asciiOn = on;
    autoOff = !on && reason === 'auto';
    onAsciiChange?.({ on, reason, ramp: ascii.ramp });
  }
  function onKey(e) {
    if (e.key === 'g' || e.key === 'G') setAscii(!asciiOn);
  }
  window.addEventListener('keydown', onKey);

  const sunDir = new THREE.Vector3();

  /** Point the Sun for one hour; returns whether the terrain blocks it (render check). */
  function setSun(az, el) {
    directionFromAzEl(az, el, sunDir);
    sunEl = el;
    applyExposure();
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.target.position.set(0, 0, 0);
    return { renderBlocked: blockedToward(terrain, eye, sunDir) };
  }

  /**
   * Map view: fixed light. Surface view: expose like a camera, so level ground under a grazing
   * Sun is mid-grey, Sun-facing slopes are white and shadows are black. When the sim says the
   * site is in shadow, the direct light is off and a dim fill stands in for earthshine.
   */
  function applyExposure() {
    if (view !== 'surface') {
      sun.intensity = MAP_SUN_INTENSITY; sun.color.set(0xffe2b0);
      fill.intensity = 0.5; fill.color.set(0x4a5c96);
      return;
    }
    const lit = !siteDark && sunEl > 0;
    sun.color.set(0xffffff);
    sun.intensity = lit ? 1 / (LAMBERT * EXPOSURE * Math.sin((Math.max(sunEl, 0.4) * Math.PI) / 180)) : 0;
    fill.color.set(0xffffff);
    fill.intensity = lit ? 0.03 : 0.5;
  }

  function setEarth(az, el) {
    directionFromAzEl(az, el, earthDir);
  }

  /** 'map' = top-down, 'surface' = standing at the rover looking at the horizon. */
  function setView(next) {
    view = next === 'surface' ? 'surface' : 'map';
    sky.visible = view === 'surface';
    lander.visible = view === 'map';
    beacon.visible = view === 'surface';
    rover.scale.setScalar(view === 'surface' ? 0.22 : 1);
    applyExposure();
    ascii.setCell(view === 'surface' ? SURFACE_CELL_CSS : mapCellCss, pixelRatio);
    controls.enabled = view === 'map';
    rover.visible = roverShown;
    ascii.setDots(view === 'surface');
    renderPass.camera = view === 'surface' ? surfaceCam : camera;
  }

  let roverShown = false;
  function setRover(r) {
    roverShown = !!r;
    rover.visible = roverShown;
    if (!r) return;
    const y = groundY(hm, r.x, r.z);
    rover.position.set(r.x, y, r.z);
    rover.rotation.y = (-r.heading * Math.PI) / 180;
    roverMat.color.set(!r.alive ? PALETTE.red : r.sunlit ? '#ffffff' : '#8fa0d8');
    roverPos.set(r.x, y, r.z);
  }

  function setProspects(list, collected = []) {
    prospects.clear();
    for (const t of list) {
      const done = collected.includes(t.id);
      const mat = new THREE.MeshBasicMaterial({ color: done ? '#5a6072' : PALETTE.teal });
      const y = groundY(hm, t.x, t.z);
      const gem = new THREE.Mesh(prospectGeo, mat);
      gem.position.set(t.x, y + 90, t.z);
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

  function setLanderInShadow(inShadow) {
    bodyMat.color.set(inShadow ? PALETTE.red : PALETTE.grey);
    ring.material.color.set(inShadow ? PALETTE.red : PALETTE.amber);
    lampMat.color.set(inShadow ? PALETTE.red : PALETTE.amber);
    siteDark = inShadow;
    applyExposure();
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    ascii.setSize(w * pixelRatio, h * pixelRatio);
    fitTopDown(camera, w / h);
    surfaceCam.aspect = w / h;
    surfaceCam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function draw() {
    const cam = view === 'surface' ? surfaceCam : camera;
    if (view === 'surface') {
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
    }
    if (asciiOn) {
      cam.layers.set(0); // terrain (and the sky bodies) through the glyph or dot pass
      composer.render();
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
      if (asciiOn && !document.hidden) {
        lowFpsStreak = fps < FPS_FLOOR ? lowFpsStreak + 1 : 0;
        if (autoOffEnabled && lowFpsStreak >= 3) setAscii(false, 'auto');
      }
    }
  });

  return {
    setSun,
    setEarth,
    setView,
    setRover,
    setProspects,
    turn,
    get yaw() { return yaw; },
    get view() { return view; },
    setLanderInShadow,
    setAscii: (on) => setAscii(on),
    setCell: (css) => { mapCellCss = css; if (view === 'map') ascii.setCell(css, pixelRatio); },
    get asciiOn() { return asciiOn; },
    get autoOff() { return autoOff; },
    ramp: ascii.ramp,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      ro.disconnect();
      controls.dispose();
      ascii.dispose();
      composer.dispose?.();
      terrain.traverse((o) => o.geometry?.dispose());
      renderer.dispose();
    },
  };
}
