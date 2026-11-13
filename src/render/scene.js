// Surface view (M1): lit terrain, a low Sun casting real shadows, and the lander.
// Plain shading only; the ASCII pass arrives in M3.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { buildTerrain, landerEye, blockedToward } from './terrain.js';
import { directionFromAzEl } from './sun.js';
import { createTopDownCamera, fitTopDown } from './camera.js';
import { PALETTE } from '../theme.js';

const SUN_DISTANCE = 60000; // m; far enough that the light covers the whole crop

export function createSurfaceScene(canvas, site, { onFps } = {}) {
  const hm = site.heightmap;
  const extentM = (hm.size - 1) * hm.spacingM;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PALETTE.navy);

  const scene = new THREE.Scene();

  // Faint fill so shadowed ground is dark navy, not pure black (earthshine-ish).
  scene.add(new THREE.HemisphereLight(0x3a4a7a, PALETTE.navy, 0.35));

  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
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
  scene.add(lander);

  const camera = createTopDownCamera(extentM * 0.95, 1);
  const controls = new MapControls(camera, canvas);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 12;

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
    fitTopDown(camera, w / h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let frames = 0;
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      onFps?.(Math.round((frames * 1000) / (now - last)));
      frames = 0;
      last = now;
    }
  });

  return {
    setSun,
    setLanderInShadow,
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      terrain.traverse((o) => o.geometry?.dispose());
      renderer.dispose();
    },
  };
}
