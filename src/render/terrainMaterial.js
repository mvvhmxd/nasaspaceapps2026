// Terrain material: three.js standard lighting and shadows, plus elevation for
// contour lines (aElev = raw DEM height from terrain.js).
// - ASCII mode (uAscii = 1): the terrain is rendered into the glyph pass's target
//   and alpha carries ELEVATION_ALPHA_OFFSET + normalised elevation (1..2; 0 =
//   empty), at float precision, so the glyph pass can trace contours per cell.
// - Plain mode (uAscii = 0): thin anti-aliased contour lines are drawn in colour,
//   about 1.25 CSS px wide, index contours bolder, same palette as the glyphs.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { MAJOR_EVERY } from './contours.js';
import { contourColor } from './contourStyle.js';

/** Terrain alpha = this + normalised elevation; the target is cleared to alpha 0. */
export const ELEVATION_ALPHA_OFFSET = 1;
/** Plain-mode line width in CSS px (index contours are 1.8x). */
const LINE_WIDTH_CSS = 1.25;

const VERTEX_ANCHOR = '#include <begin_vertex>';
const FRAGMENT_ANCHOR = '#include <opaque_fragment>';

export function createTerrainMaterial({ minM, maxM, interval, pixelRatio = 1 }) {
  const uniforms = {
    uAscii: { value: 1 },
    uMinM: { value: minM },
    uMaxM: { value: Math.max(maxM, minM + 1) },
    uInterval: { value: interval },
    uMajorEvery: { value: MAJOR_EVERY },
    uLineHalfPx: { value: (LINE_WIDTH_CSS / 2) * pixelRatio },
    uMinorShadow: { value: contourColor('minorShadow') },
    uMajorShadow: { value: contourColor('majorShadow') },
    uMinorLit: { value: contourColor('minorLit') },
    uMajorLit: { value: contourColor('majorLit') },
  };
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.grey, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    if (!shader.vertexShader.includes(VERTEX_ANCHOR) || !shader.fragmentShader.includes(FRAGMENT_ANCHOR)) {
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
uniform vec3 uMinorShadow;
uniform vec3 uMajorShadow;
uniform vec3 uMinorLit;
uniform vec3 uMajorLit;
void main() {`,
      )
      .replace(
        FRAGMENT_ANCHOR,
        `${FRAGMENT_ANCHOR}
  if (uAscii > 0.5) {
    // Opaque material, so no blending: alpha reaches the target as written.
    gl_FragColor.a = ${ELEVATION_ALPHA_OFFSET.toFixed(1)} + clamp((vElev - uMinM) / (uMaxM - uMinM), 0.0, 1.0);
  } else {
    // Metres of height per pixel along the steepest screen direction.
    float mpp = max(length(vec2(dFdx(vElev), dFdy(vElev))), 1e-4);
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
    // Shadow vs sunlight from the shaded colour: restrained grey in shadow, brighter
    // regolith grey for index lines in sunlight (teal is reserved for Earth / comms).
    float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float litMix = smoothstep(0.03, 0.2, lum);
    vec3 lineColor = mix(mix(uMinorShadow, uMinorLit, litMix), mix(uMajorShadow, uMajorLit, litMix), isMajor);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, lineColor, line);
  }`,
      );
  };
  material.customProgramCacheKey = () => 'terrain-contours-v2';
  return {
    material,
    setAscii(on) { uniforms.uAscii.value = on ? 1 : 0; },
    /** Keep plain-mode lines LINE_WIDTH_CSS wide when the renderer's pixel ratio changes. */
    setPixelRatio(ratio) { uniforms.uLineHalfPx.value = (LINE_WIDTH_CSS / 2) * ratio; },
  };
}
