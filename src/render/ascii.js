// Coloured ASCII renderer. The terrain is drawn into a small, cell-aligned
// target (one texel per glyph-cell corner, see cellGrid.js), then one full-screen
// pass turns each cell into a tinted glyph straight on the canvas, converting
// to the output colour space itself. The HUD is DOM and never goes through it.
// Dots mode (the rover's surface view): one halftone dot per cell instead of a
// glyph, for a perspective camera; the cell grid stays on the screen there.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { cellTargetLayout, cellTargetFrustum } from './cellGrid.js';
import {
  MAJOR_EVERY, MIN_MINOR_SPACING_CELLS, MIN_MAJOR_SPACING_CELLS, NUDGE_M, MAX_CANDIDATES,
  MAX_LEVELS_PER_CELL, CONTOUR_UNDER_GLYPH, MINOR_STROKE_PER_CELL, MAJOR_STROKE_PER_CELL,
} from './contours.js';
import { contourColor } from './contourStyle.js';
import { ELEVATION_ALPHA_OFFSET } from './terrainMaterial.js';

const CANDIDATES =
  " .`'^,:;\"-~_=+<>i!lI|/\\()1{}[]?rctvxzjfnuoasykehbdpqwmZXYUOLCJQ0#%&8WMB@$";
export const FONT_STACK = "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', Menlo, monospace";

/**
 * Build the glyph atlas at exactly `cellPx` device pixels per glyph: measure
 * every candidate's ink coverage, sort by density and keep `count` glyphs
 * evenly spread from blank to solid. Returns a texture strip plus the ramp.
 */
export function buildGlyphAtlas({ count = 32, cellPx = 8, font = FONT_STACK } = {}) {
  const probePx = 32; // measure at a fixed size so the ramp is stable
  const probe = document.createElement('canvas');
  probe.width = probe.height = probePx;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  const drawGlyph = (ctx, ch, x, px) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, 0, px, px);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(px * 1.0)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + px / 2, px / 2 + px * 0.05);
  };
  const measured = [...CANDIDATES].map((ch) => {
    drawGlyph(pc, ch, 0, probePx);
    const px = pc.getImageData(0, 0, probePx, probePx).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) ink += px[i];
    return { ch, cov: ink / (255 * probePx * probePx) };
  });
  measured.sort((a, b) => a.cov - b.cov);
  const maxCov = measured[measured.length - 1].cov;
  const ramp = [];
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * maxCov;
    let best = measured[0];
    for (const m of measured) if (Math.abs(m.cov - target) < Math.abs(best.cov - target)) best = m;
    ramp.push(best);
  }

  const atlas = document.createElement('canvas');
  atlas.width = cellPx * count;
  atlas.height = cellPx;
  const ac = atlas.getContext('2d');
  ramp.forEach((g, i) => drawGlyph(ac, g.ch, i * cellPx, cellPx));

  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.NoColorSpace; // coverage data, not colour
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter; // one atlas texel per screen pixel: crisp
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, ramp: ramp.map((g) => g.ch).join(''), count };
}

const glyphVertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0); // full-screen quad, no camera
  }
`;

const glyphFragment = /* glsl */ `
  uniform sampler2D tScene;   // corner-aligned terrain: rgb colour, alpha = 1 + elevation (0 = empty)
  uniform sampler2D tGlyph;
  uniform float glyphCount;
  uniform float cell;         // cell size in drawing-buffer pixels
  uniform vec2 gridOffset;    // keeps the grid on the ground while panning
  uniform float fill;
  uniform float saturation;
  uniform float gain;
  uniform float duotone;
  uniform float contrastLo;
  uniform float contrastHi;
  uniform vec3 shadowColor;
  uniform vec3 sunColor;
  uniform vec3 emptyColor;
  uniform float dots;         // 1 = halftone dots sized by brightness (surface view)
  // Contours: cellContourInk mirrors cellContours() in contours.js.
  uniform float contourOn;
  uniform float minM;
  uniform float maxM;
  uniform float interval;
  uniform float majorEvery;
  uniform float minorHalfWidth; // drawing-buffer pixels
  uniform float majorHalfWidth;
  uniform float underGlyph;
  uniform vec3 minorShadow;
  uniform vec3 majorShadow;
  uniform vec3 minorLit;
  uniform vec3 majorLit;

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  const float NUDGE = ${NUDGE_M.toFixed(4)};
  const float MIN_MINOR_SPACING = ${MIN_MINOR_SPACING_CELLS.toFixed(4)};
  const float MIN_MAJOR_SPACING = ${MIN_MAJOR_SPACING_CELLS.toFixed(4)};
  const int MAX_CANDIDATES = ${MAX_CANDIDATES};
  const int MAX_LEVELS = ${MAX_LEVELS_PER_CELL};

  float elevation(float a) {
    return minM + (a - ${ELEVATION_ALPHA_OFFSET.toFixed(1)}) * (maxM - minM);
  }

  float nudged(float e, float level) {
    return abs(e - level) < NUDGE ? level + NUDGE : e;
  }

  float segmentDistance(vec2 q, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float h = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
    return length(q - a - ab * h);
  }

  // Distance (cell units) from q to the marching-squares segments of one level.
  // c = corner elevations (bl, br, tl, tr). 1e9 when the level does not cross.
  float levelDistance(vec4 c, float level, vec2 q) {
    float bl = nudged(c.x, level);
    float br = nudged(c.y, level);
    float tl = nudged(c.z, level);
    float tr = nudged(c.w, level);
    bool uBL = bl >= level;
    bool uBR = br >= level;
    bool uTL = tl >= level;
    bool uTR = tr >= level;
    // Edge crossings, in the order bottom, right, top, left (as in levelSegments).
    bool hB = uBL != uBR;
    bool hR = uBR != uTR;
    bool hT = uTL != uTR;
    bool hL = uBL != uTL;
    vec2 pB = vec2(hB ? (level - bl) / (br - bl) : 0.0, 0.0);
    vec2 pR = vec2(1.0, hR ? (level - br) / (tr - br) : 0.0);
    vec2 pT = vec2(hT ? (level - tl) / (tr - tl) : 0.0, 1.0);
    vec2 pL = vec2(0.0, hL ? (level - bl) / (tl - bl) : 0.0);
    int count = int(hB) + int(hR) + int(hT) + int(hL);
    if (count == 2) {
      vec2 a = vec2(0.0);
      vec2 b = vec2(0.0);
      bool got = false;
      if (hB) { a = pB; got = true; }
      if (hR) { if (got) { b = pR; } else { a = pR; got = true; } }
      if (hT) { if (got) { b = pT; } else { a = pT; got = true; } }
      if (hL) { b = pL; }
      return segmentDistance(q, a, b);
    }
    if (count == 4) {
      // Saddle: the cell-centre average decides which corners are cut off.
      bool centreUp = (bl + br + tl + tr) * 0.25 >= level;
      if (uBL != centreUp) return min(segmentDistance(q, pL, pB), segmentDistance(q, pR, pT));
      return min(segmentDistance(q, pB, pR), segmentDistance(q, pT, pL));
    }
    return 1e9;
  }

  // Minor and index contour distances (cell units) for the cell at q, and how many levels drawn.
  vec3 cellContourDistances(vec4 c, vec2 q) {
    float lo = min(min(c.x, c.y), min(c.z, c.w));
    float hi = max(max(c.x, c.y), max(c.z, c.w));
    float gx = (c.w + c.y - c.z - c.x) * 0.5; // metres per cell
    float gy = (c.z + c.w - c.x - c.y) * 0.5;
    float slope = length(vec2(gx, gy));
    float minorSpacing = slope > 0.0 ? interval / slope : 1e9;
    bool minorOk = minorSpacing >= MIN_MINOR_SPACING;
    bool majorOk = minorSpacing * majorEvery >= MIN_MAJOR_SPACING;
    float first = ceil((lo + NUDGE) / interval);
    float minorD = 1e9;
    float majorD = 1e9;
    int drawn = 0;
    for (int k = 0; k < MAX_CANDIDATES; k++) {
      if (drawn >= MAX_LEVELS) break;
      float level = (first + float(k)) * interval;
      if (level >= hi + NUDGE) break;
      float m = level / (interval * majorEvery);
      bool major = abs(m - floor(m + 0.5)) < 1e-4;
      if (major ? !majorOk : !minorOk) continue;
      float d = levelDistance(c, level, q);
      if (d > 1e8) continue;
      drawn++;
      if (major) majorD = min(majorD, d); else minorD = min(minorD, d);
    }
    return vec3(minorD, majorD, float(drawn));
  }

  void main() {
    vec2 p = gl_FragCoord.xy + gridOffset;
    vec2 cellIndex = floor(p / cell);
    ivec2 t0 = ivec2(cellIndex); // texel (i, j) is the cell's bottom-left corner

    // The cell's 4 corners (shared with its neighbours); average the ones on terrain.
    vec4 ta = texelFetch(tScene, t0, 0);
    vec4 tb = texelFetch(tScene, t0 + ivec2(1, 0), 0);
    vec4 tc = texelFetch(tScene, t0 + ivec2(0, 1), 0);
    vec4 td = texelFetch(tScene, t0 + ivec2(1, 1), 0);
    vec4 hit = step(vec4(0.5), vec4(ta.a, tb.a, tc.a, td.a)); // terrain alpha >= 1, empty 0
    float hits = dot(hit, vec4(1.0));

    vec3 color = emptyColor; // beyond the terrain edge: plain navy, no glyph speckle
    if (hits > 0.5) {
      vec3 scene = (ta.rgb * hit.x + tb.rgb * hit.y + tc.rgb * hit.z + td.rgb * hit.w) / hits;

      // Linear -> perceptual, then a contrast curve so lit ground is dense and
      // shadow still shows sparse glyphs.
      float y = pow(clamp(dot(scene, LUMA), 0.0, 1.0), 1.0 / 2.2);
      float lum = smoothstep(contrastLo, contrastHi, y);

      float idx = floor(lum * (glyphCount - 1.0) + 0.5);
      vec2 local = fract(p / cell);
      if (dots > 0.5) {
        // Halftone: one round dot per cell, radius grows with brightness, keeping the scene's
        // own colour, so the ground reads as game state: amber = sunlight (charging), blue =
        // shadow (draining), white = the rover's floodlight. Coloured things (Earth) keep theirs.
        float dl = smoothstep(0.03, 0.85, y);
        float radius = 0.52 * sqrt(dl);
        float edge = 1.0 / cell;
        float dotInk = (1.0 - smoothstep(radius - edge, radius + edge, length(local - 0.5))) * step(0.02, dl);
        float maxc = max(scene.r, max(scene.g, scene.b));
        float minc = min(scene.r, min(scene.g, scene.b));
        float chroma = (maxc - minc) / max(maxc, 0.001);
        vec3 hue = scene / max(maxc, 0.001);
        hue = mix(vec3(dot(hue, LUMA)), hue, 1.0 + 0.6 * (1.0 - chroma)); // push faint tints further apart
        vec3 dotColor = clamp(hue, 0.0, 1.0) * mix(0.62, 1.0, dl);
        gl_FragColor = vec4(mix(emptyColor, dotColor, dotInk), 1.0);
        #include <colorspace_fragment>
        return;
      }
      vec2 glyphUv = vec2((idx + local.x) / glyphCount, local.y);
      float ink = texture(tGlyph, glyphUv).r;

      // Colour: boosted scene colour blended with the palette grade.
      vec3 grey = vec3(dot(scene, LUMA));
      vec3 vivid = clamp(mix(grey, scene, saturation) * gain, 0.0, 1.0);
      vec3 grade = mix(shadowColor, sunColor, lum);
      vec3 tint = mix(vivid, grade * max(lum, 0.15), duotone);
      vec3 background = mix(scene, shadowColor * 0.6, duotone * 0.5) * fill;

      // Contours: only where all four corners are terrain.
      vec3 cd = vec3(1e9, 1e9, 0.0);
      if (contourOn > 0.5 && hits > 3.5) {
        vec4 c = vec4(elevation(ta.a), elevation(tb.a), elevation(tc.a), elevation(td.a));
        cd = cellContourDistances(c, local);
      }
      color = mix(background, tint, ink * (cd.z > 0.5 ? underGlyph : 1.0));
      if (cd.z > 0.5) {
        float litMix = smoothstep(0.15, 0.45, lum);
        float minorInk = clamp(minorHalfWidth + 0.5 - cd.x * cell, 0.0, 1.0);
        float majorInk = clamp(majorHalfWidth + 0.5 - cd.y * cell, 0.0, 1.0);
        color = mix(color, mix(minorShadow, minorLit, litMix), minorInk);
        color = mix(color, mix(majorShadow, majorLit, litMix), majorInk);
      }
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Render-target precision for elevation: float32, else half float, else 8 bit
 * (contours off: 8 bits cannot place a 50 m level, see console.info). */
function pickTargetType(renderer) {
  if (renderer.extensions.has('EXT_color_buffer_float')) return THREE.FloatType;
  if (renderer.extensions.has('EXT_color_buffer_half_float')) return THREE.HalfFloatType;
  return THREE.UnsignedByteType;
}

/**
 * Create the ASCII renderer for `renderer`. Per frame call
 * `render(scene, camera, bufW, bufH, gridOffset, layer)`: it draws `layer` of the
 * scene into the corner-aligned target and the glyphs onto the canvas (clearing it).
 * `setCell(cssPx, pixelRatio, glyphs?)` changes density or ramp length (rebuilds
 * the atlas so glyphs stay crisp). `contours`: { minM, maxM, interval } or null.
 */
export function createAsciiRenderer(
  renderer, { cellCss = 8, pixelRatio = 1, glyphs = 32, contours = null } = {},
) {
  const type = pickTargetType(renderer);
  const contoursOn = Boolean(contours) && type !== THREE.UnsignedByteType;
  if (contours && !contoursOn) {
    console.info('ASCII map: this GPU cannot render to float targets, so contour lines are hidden in ASCII mode (they still show with ASCII Off).');
  }
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: target.texture },
      tGlyph: { value: null },
      glyphCount: { value: 32 },
      cell: { value: 8 },
      gridOffset: { value: new THREE.Vector2(0, 0) },
      fill: { value: 0.45 }, // scene colour showing behind the glyph
      saturation: { value: 1.4 },
      gain: { value: 1.6 }, // glyph tint brightness
      duotone: { value: 0.5 }, // 0 = scene colours only, 1 = pure navy-to-amber grade
      contrastLo: { value: 0.04 },
      contrastHi: { value: 0.8 },
      shadowColor: { value: new THREE.Color(PALETTE.navy).multiplyScalar(2.2) },
      sunColor: { value: new THREE.Color(PALETTE.amber) },
      emptyColor: { value: new THREE.Color(PALETTE.navy) },
      dots: { value: 0 },
      contourOn: { value: contoursOn ? 1 : 0 },
      minM: { value: contours?.minM ?? 0 },
      maxM: { value: Math.max(contours?.maxM ?? 1, (contours?.minM ?? 0) + 1) },
      interval: { value: contours?.interval ?? 50 },
      majorEvery: { value: MAJOR_EVERY },
      minorHalfWidth: { value: 0.5 },
      majorHalfWidth: { value: 1 },
      underGlyph: { value: CONTOUR_UNDER_GLYPH },
      minorShadow: { value: contourColor('minorShadow') },
      majorShadow: { value: contourColor('majorShadow') },
      minorLit: { value: contourColor('minorLit') },
      majorLit: { value: contourColor('majorLit') },
    },
    vertexShader: glyphVertex,
    fragmentShader: glyphFragment,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const terrainCamera = new THREE.OrthographicCamera();
  const perspectiveCamera = new THREE.PerspectiveCamera();
  const clearColor = new THREE.Color();
  const navy = new THREE.Color(PALETTE.navy);
  let atlas = null;

  const api = {
    get cellPx() {
      return material.uniforms.cell.value;
    },
    setCell(css, dpr, count = glyphs) {
      glyphs = count;
      const cellPx = Math.max(4, Math.round(css * dpr));
      atlas?.texture.dispose();
      atlas = buildGlyphAtlas({ count: glyphs, cellPx });
      material.uniforms.tGlyph.value = atlas.texture;
      material.uniforms.glyphCount.value = atlas.count;
      material.uniforms.cell.value = cellPx;
      material.uniforms.minorHalfWidth.value = Math.max(1, cellPx * MINOR_STROKE_PER_CELL) / 2;
      material.uniforms.majorHalfWidth.value = Math.max(1.6, cellPx * MAJOR_STROKE_PER_CELL) / 2;
    },
    /** Halftone dots (surface view) instead of glyphs; contours are off there. */
    setDots(on) {
      material.uniforms.dots.value = on ? 1 : 0;
      material.uniforms.contourOn.value = on ? 0 : contoursOn ? 1 : 0;
      material.uniforms.emptyColor.value.set(on ? '#060a1c' : PALETTE.navy); // deep navy behind the dots
    },
    render(scene, camera, bufW, bufH, gridOffset, layer = 0) {
      const cellPx = material.uniforms.cell.value;
      const layout = cellTargetLayout(bufW, bufH, cellPx);
      if (target.width !== layout.width || target.height !== layout.height) {
        target.setSize(layout.width, layout.height); // only on resize / cell change
      }
      let cam;
      if (camera.isPerspectiveCamera) {
        // Same corner alignment through a view offset: texel i is centred on screen
        // pixel i*cell - ox (bottom-up), i.e. the target covers [-cell/2 - ox, ...).
        const p = perspectiveCamera;
        p.fov = camera.fov; p.aspect = camera.aspect; p.near = camera.near; p.far = camera.far; p.zoom = camera.zoom;
        const x = -0.5 * cellPx - gridOffset[0];
        const yBottom = -0.5 * cellPx - gridOffset[1];
        const w = layout.width * cellPx;
        const h = layout.height * cellPx;
        p.setViewOffset(bufW, bufH, x, bufH - (yBottom + h), w, h); // offset y counts from the top
        p.position.copy(camera.position);
        p.quaternion.copy(camera.quaternion);
        cam = p;
      } else {
        const f = cellTargetFrustum(camera, bufH, cellPx, gridOffset, layout);
        terrainCamera.left = f.left;
        terrainCamera.right = f.right;
        terrainCamera.top = f.top;
        terrainCamera.bottom = f.bottom;
        terrainCamera.near = camera.near;
        terrainCamera.far = camera.far;
        terrainCamera.zoom = 1;
        terrainCamera.position.copy(camera.position);
        terrainCamera.quaternion.copy(camera.quaternion);
        terrainCamera.updateProjectionMatrix();
        cam = terrainCamera;
      }
      cam.layers.set(layer);
      cam.updateMatrixWorld();

      // Terrain into the target, cleared to transparent so empty space is known.
      renderer.getClearColor(clearColor);
      const clearAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(target);
      renderer.setClearColor(navy, 0);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clearColor, clearAlpha);

      material.uniforms.gridOffset.value.set(gridOffset[0], gridOffset[1]);
      renderer.render(quadScene, quadCamera); // glyphs onto the canvas
    },
    dispose() {
      atlas?.texture.dispose();
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
  api.setCell(cellCss, pixelRatio);
  return api;
}
