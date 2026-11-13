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

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop
const SHARP_LAYER = 1; // objects drawn crisp on top of the ASCII terrain
const FPS_FLOOR = 30; // three readings below this switch the ASCII pass off

export function createSurfaceScene(canvas, site, { onFps, onAsciiChange, cellCss = 10 } = {}) {
  const hm = site.heightmap;
  const extentM = (hm.size - 1) * hm.spacingM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PALETTE.navy);

  const scene = new THREE.Scene();

  // Faint fill so shadowed ground is dark navy, not pure black (earthshine-ish).
  scene.add(new THREE.HemisphereLight(0x4a5c96, PALETTE.navy, 0.5));

  const sun = new THREE.DirectionalLight(0xffe2b0, 3.4);
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

  const camera = createTopDownCamera(extentM * 0.95, 1);
  camera.layers.enableAll();
  const controls = new MapControls(camera, canvas);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 12;

  // ASCII chain: scene -> glyph pass -> output (tone mapping + sRGB once).
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
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
    if (e.key === 'a' || e.key === 'A') setAscii(!asciiOn);
  }
  window.addEventListener('keydown', onKey);

  const sunDir = new THREE.Vector3();

  /** Point the Sun for one hour; returns whether the terrain blocks it (render check). */
  function setSun(az, el) {
    directionFromAzEl(az, el, sunDir);
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.target.position.set(0, 0, 0);
    return { renderBlocked: blockedToward(terrain, eye, sunDir) };
  }

  function setLanderInShadow(inShadow) {
    bodyMat.color.set(inShadow ? PALETTE.red : PALETTE.grey);
    ring.material.color.set(inShadow ? PALETTE.red : PALETTE.amber);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    ascii.setSize(w * pixelRatio, h * pixelRatio);
    fitTopDown(camera, w / h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function draw() {
    if (asciiOn) {
      camera.layers.set(0); // terrain only through the glyph pass
      composer.render();
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
      if (asciiOn && !document.hidden) {
        lowFpsStreak = fps < FPS_FLOOR ? lowFpsStreak + 1 : 0;
        if (lowFpsStreak >= 3) setAscii(false, 'auto');
      }
    }
  });

  return {
    setSun,
    setLanderInShadow,
    setAscii: (on) => setAscii(on),
    setCell: (css) => ascii.setCell(css, pixelRatio),
    get asciiOn() { return asciiOn; },
    get autoOff() { return autoOff; },
    ramp: ascii.ramp,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      controls.dispose();
      ascii.dispose();
      composer.dispose?.();
      terrain.traverse((o) => o.geometry?.dispose());
      renderer.dispose();
    },
  };
}
