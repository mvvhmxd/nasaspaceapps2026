// Terrain material: three.js standard lighting and shadows, plus elevation for
// contour lines (aElev = raw DEM height from terrain.js).
// - ASCII mode (uAscii = 1): the terrain is rendered into the glyph pass's
//   target, and alpha carries the normalised elevation (0.5..1; 0 = empty), so
//   the glyph pass can find where contour levels cross each cell.
// - Plain mode (uAscii = 0): thin anti-aliased contour lines are drawn in colour,
//   about 1.25 CSS px wide, index contours bolder.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { MAJOR_EVERY } from './contours.js';

const VERTEX_ANCHOR = '#include <begin_vertex>';
const FRAGMENT_ANCHOR = '#include <opaque_fragment>';

export function createTerrainMaterial({ minM, maxM, interval, pixelRatio = 1 }) {
  const uniforms = {
    uAscii: { value: 1 },
    uMinM: { value: minM },
    uMaxM: { value: Math.max(maxM, minM + 1) },
    uInterval: { value: interval },
    uMajorEvery: { value: MAJOR_EVERY },
    uLineHalfPx: { value: 0.625 * pixelRatio }, // half of ~1.25 CSS px
    // Linear colours (three converts hex through its colour management).
    uContourShadow: { value: new THREE.Color(PALETTE.teal).lerp(new THREE.Color(PALETTE.grey), 0.4).multiplyScalar(0.3) },
    uContourLit: { value: new THREE.Color(PALETTE.amber).multiplyScalar(0.42) },
  };
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.grey, roughness: 0.95, metalness: 0 });
  let injected = null;
  material.onBeforeCompile = (shader) => {
    const okV = shader.vertexShader.includes(VERTEX_ANCHOR);
    const okF = shader.fragmentShader.includes(FRAGMENT_ANCHOR);
    injected = okV && okF;
    if (!injected) {
      console.warn('terrainMaterial: shader anchors not found; contour lines are off for this three.js version');
      return;
    }
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float aElev;\nvarying float vElev;\nvoid main() {')
      .replace(VERTEX_ANCHOR, `${VERTEX_ANCHOR}\n  vElev = aElev;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying float vElev;
uniform float uAscii;
uniform float uMinM;
uniform float uMaxM;
uniform float uInterval;
uniform float uMajorEvery;
uniform float uLineHalfPx;
uniform vec3 uContourShadow;
uniform vec3 uContourLit;
void main() {`,
      )
      .replace(
        FRAGMENT_ANCHOR,
        `${FRAGMENT_ANCHOR}
  if (uAscii > 0.5) {
    // Opaque material, so no blending: alpha reaches the target as written.
    gl_FragColor.a = 0.5 + 0.5 * clamp((vElev - uMinM) / (uMaxM - uMinM), 0.0, 1.0);
  } else {
    float mpp = max(fwidth(vElev), 1e-4);            // metres of height per pixel
    float lvl = vElev / uInterval;
    float nearestLvl = floor(lvl + 0.5);
    float distPx = abs(lvl - nearestLvl) * uInterval / mpp;
    float m = mod(nearestLvl, uMajorEvery);
    float isMajor = (m < 0.5 || m > uMajorEvery - 0.5) ? 1.0 : 0.0;
    float halfPx = uLineHalfPx * mix(1.0, 1.8, isMajor);
    float line = 1.0 - smoothstep(halfPx - 0.5, halfPx + 0.5, distPx);
    // Where lines would bunch closer than ~3 px (steep walls) fade them out;
    // index contours are 5x further apart, so they stay longer.
    float spacingPx = uInterval * mix(1.0, uMajorEvery, isMajor) / mpp;
    line *= smoothstep(2.0, 4.0, spacingPx);
    float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 lineColor = mix(uContourShadow, uContourLit, smoothstep(0.03, 0.2, lum));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, lineColor, line * mix(0.8, 1.0, isMajor));
  }`,
      );
  };
  material.customProgramCacheKey = () => 'terrain-contours-v1';
  return {
    material,
    uniforms,
    /** true / false once compiled, null before. */
    get injected() { return injected; },
    setAscii(on) { uniforms.uAscii.value = on ? 1 : 0; },
  };
}
