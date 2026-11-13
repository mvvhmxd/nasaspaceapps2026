// Coloured ASCII renderer. The terrain is drawn into a small, cell-aligned
// target (one texel per glyph-cell corner, see cellGrid.js), then one full-screen
// pass turns each cell into a tinted glyph straight on the canvas, converting
// to the output colour space itself. The HUD is DOM and never goes through it.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { cellTargetLayout, cellTargetFrustum } from './cellGrid.js';
import {
  MAJOR_EVERY, MIN_MINOR_SPACING_CELLS, MIN_MAJOR_SPACING_CELLS, CROSSING_MARGIN_M,
} from './contours.js';

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

/**
 * Contour glyph atlas: 8 cells of `cellPx` (CONTOUR_GLYPHS order - | / \, minor
 * then major). Drawn as strokes that run edge to edge (like box-drawing
 * characters), so neighbouring cells join into continuous contour lines.
 */
export function buildLineAtlas(cellPx) {
  const c = cellPx;
  const canvas = document.createElement('canvas');
  canvas.width = c * 8;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'square';
  const widths = [Math.max(1, Math.round(c * 0.1)), Math.max(2, Math.round(c * 0.2))];
  widths.forEach((lw, major) => {
    ctx.lineWidth = lw;
    const mid = lw % 2 ? Math.floor(c / 2) + 0.5 : Math.round(c / 2); // crisp on the pixel grid
    const segs = [
      [0, mid, c, mid], // -
      [mid, 0, mid, c], // |
      [0, c, c, 0], // /  (canvas y points down)
      [0, 0, c, c], // backslash
    ];
    segs.forEach(([x0, y0, x1, y1], g) => {
      const ox = (major * 4 + g) * c;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, 0, c, c);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(ox + x0, y0);
      ctx.lineTo(ox + x1, y1);
      ctx.stroke();
      ctx.restore();
    });
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const glyphVertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0); // full-screen quad, no camera
  }
`;

const glyphFragment = /* glsl */ `
  uniform sampler2D tScene;   // cell-aligned terrain, alpha 0 = nothing drawn
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
  // Contours (see contours.js: contourGlyphForCell is the same rule in JS).
  uniform sampler2D tLine;     // 8 glyphs: - | / backslash, minor then major
  uniform float contourOn;
  uniform float minM;
  uniform float maxM;
  uniform float interval;
  uniform float majorEvery;
  uniform float underGlyph;    // density glyph strength under a contour
  uniform vec3 contourShadow;
  uniform vec3 contourLit;

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  const float TAN_22_5 = 0.41421356;

  // Terrain alpha 0.5..1 encodes elevation between minM and maxM.
  float elevation(float a) {
    return minM + (a - 0.5) * 2.0 * (maxM - minM);
  }

  // Contour glyph for a cell: -1 = none, else atlas index 0..7.
  float contourGlyph(float eTL, float eTR, float eBL, float eBR) {
    // Levels must be cleared by the margin on both sides (grazing = data noise).
    float lo = min(min(eTL, eTR), min(eBL, eBR)) + ${CROSSING_MARGIN_M.toFixed(3)};
    float hi = max(max(eTL, eTR), max(eBL, eBR)) - ${CROSSING_MARGIN_M.toFixed(3)};
    float n = floor(hi / interval) - floor(lo / interval);
    if (n < 0.5) return -1.0;
    float majorStep = interval * majorEvery;
    float nMajor = floor(hi / majorStep) - floor(lo / majorStep);
    float gx = (eTR + eBR - eTL - eBL) * 0.5;   // metres per cell
    float gy = (eTL + eTR - eBL - eBR) * 0.5;
    float ax = abs(gx);
    float ay = abs(gy);
    // Spacing between neighbouring contours in cells; too close reads as hatching.
    float slope = length(vec2(gx, gy));
    float minorSpacing = slope > 0.0 ? interval / slope : 1e9;
    bool showMajor = nMajor > 0.5 && minorSpacing * majorEvery >= ${MIN_MAJOR_SPACING_CELLS.toFixed(3)};
    bool showMinor = n - nMajor > 0.5 && minorSpacing >= ${MIN_MINOR_SPACING_CELLS.toFixed(3)};
    if (!showMajor && !showMinor) return -1.0;
    float g;
    if (ax <= ay * TAN_22_5) g = 0.0;        // -
    else if (ay <= ax * TAN_22_5) g = 1.0;   // |
    else g = gx * gy < 0.0 ? 2.0 : 3.0;      // / or backslash
    if (ax + ay < 1e-9) g = (eTL + eBR >= eTR + eBL) ? 3.0 : 2.0; // saddle
    return g + (showMajor ? 4.0 : 0.0);
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
    vec4 hit = step(vec4(0.25), vec4(ta.a, tb.a, tc.a, td.a)); // terrain alpha >= 0.5, empty 0
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
      vec2 glyphUv = vec2((idx + local.x) / glyphCount, local.y);
      float ink = texture(tGlyph, glyphUv).r;

      // Colour: boosted scene colour blended with the palette grade.
      vec3 grey = vec3(dot(scene, LUMA));
      vec3 vivid = clamp(mix(grey, scene, saturation) * gain, 0.0, 1.0);
      vec3 grade = mix(shadowColor, sunColor, lum);
      vec3 tint = mix(vivid, grade * max(lum, 0.15), duotone);

      vec3 background = mix(scene, shadowColor * 0.6, duotone * 0.5) * fill;

      // Contour lines: only where all four texels are terrain (no edge garbage).
      // Corners: ta = bottom-left, tb = bottom-right, tc = top-left, td = top-right.
      float g = -1.0;
      if (contourOn > 0.5 && hits > 3.5) {
        g = contourGlyph(elevation(tc.a), elevation(td.a), elevation(ta.a), elevation(tb.a));
      }
      if (g >= 0.0) {
        float lineInk = texture(tLine, vec2((g + local.x) / 8.0, local.y)).r;
        float major = step(3.5, g);
        // Minor contours stay quiet so the glyph texture leads; index contours stand out.
        vec3 lineColor = mix(contourShadow, contourLit, smoothstep(0.15, 0.45, lum)) * mix(0.7, 1.5, major);
        color = mix(mix(background, tint, ink * underGlyph), lineColor, lineInk);
      } else {
        color = mix(background, tint, ink);
      }
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Create the ASCII renderer for `renderer`. Per frame call
 * `render(scene, camera, bufW, bufH, gridOffset, layer)`: it draws `layer` of the
 * scene into the cell-aligned target and the glyphs onto the canvas (clearing it).
 * `setCell(cssPx, pixelRatio, glyphs?)` changes density or ramp length (rebuilds
 * the atlas so glyphs stay crisp).
 */
export function createAsciiRenderer(
  renderer, { cellCss = 8, pixelRatio = 1, glyphs = 32, contours = null } = {},
) {
  const halfFloatOk =
    renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: halfFloatOk ? THREE.HalfFloatType : THREE.UnsignedByteType, // linear colour needs > 8 bits in shadow
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
      // contours: { minM, maxM, interval } from the site heightmap, or null for none
      tLine: { value: null },
      contourOn: { value: contours ? 1 : 0 },
      minM: { value: contours?.minM ?? 0 },
      maxM: { value: Math.max(contours?.maxM ?? 1, (contours?.minM ?? 0) + 1) },
      interval: { value: contours?.interval ?? 50 },
      majorEvery: { value: MAJOR_EVERY },
      underGlyph: { value: 0.35 },
      contourShadow: { value: new THREE.Color(PALETTE.teal).lerp(new THREE.Color(PALETTE.grey), 0.4).multiplyScalar(0.35) },
      contourLit: { value: new THREE.Color(PALETTE.amber).multiplyScalar(0.55) },
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
  const clearColor = new THREE.Color();
  const navy = new THREE.Color(PALETTE.navy);
  let atlas = null;

  const api = {
    ramp: '',
    halfFloat: halfFloatOk,
    get cellPx() {
      return material.uniforms.cell.value;
    },
    get target() {
      return target;
    },
    setCell(css, dpr, count = glyphs) {
      glyphs = count;
      const cellPx = Math.max(4, Math.round(css * dpr));
      atlas?.texture.dispose();
      atlas = buildGlyphAtlas({ count: glyphs, cellPx });
      material.uniforms.tGlyph.value = atlas.texture;
      material.uniforms.tLine.value?.dispose();
      material.uniforms.tLine.value = buildLineAtlas(cellPx);
      material.uniforms.glyphCount.value = atlas.count;
      material.uniforms.cell.value = cellPx;
      api.ramp = atlas.ramp;
    },
    render(scene, camera, bufW, bufH, gridOffset, layer = 0) {
      const cellPx = material.uniforms.cell.value;
      const layout = cellTargetLayout(bufW, bufH, cellPx);
      if (target.width !== layout.width || target.height !== layout.height) {
        target.setSize(layout.width, layout.height); // only on resize / cell change
      }
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
      terrainCamera.layers.set(layer);
      terrainCamera.updateProjectionMatrix();
      terrainCamera.updateMatrixWorld();

      // Terrain into the target, cleared to transparent so empty space is known.
      renderer.getClearColor(clearColor);
      const clearAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(target);
      renderer.setClearColor(navy, 0);
      renderer.render(scene, terrainCamera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clearColor, clearAlpha);

      material.uniforms.gridOffset.value.set(gridOffset[0], gridOffset[1]);
      renderer.render(quadScene, quadCamera); // glyphs onto the canvas
    },
    dispose() {
      atlas?.texture.dispose();
      material.uniforms.tLine.value?.dispose();
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
  api.setCell(cellCss, pixelRatio);
  return api;
}
