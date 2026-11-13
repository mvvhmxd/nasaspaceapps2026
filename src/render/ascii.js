// Coloured ASCII renderer. The terrain is drawn into a small, cell-aligned
// target (2 x 2 texels per glyph cell, see cellGrid.js), then one full-screen
// pass turns each cell into a tinted glyph straight on the canvas, converting
// to the output colour space itself. The HUD is DOM and never goes through it.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { cellTargetLayout, cellTargetFrustum, TEXELS_PER_CELL } from './cellGrid.js';

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

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

  void main() {
    vec2 p = gl_FragCoord.xy + gridOffset;
    vec2 cellIndex = floor(p / cell);
    ivec2 t0 = ivec2(cellIndex) * ${TEXELS_PER_CELL};

    // The cell's 2 x 2 texels; average only the ones that hit terrain.
    vec4 ta = texelFetch(tScene, t0, 0);
    vec4 tb = texelFetch(tScene, t0 + ivec2(1, 0), 0);
    vec4 tc = texelFetch(tScene, t0 + ivec2(0, 1), 0);
    vec4 td = texelFetch(tScene, t0 + ivec2(1, 1), 0);
    vec4 hit = step(vec4(0.5), vec4(ta.a, tb.a, tc.a, td.a));
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
      color = mix(background, tint, ink);
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
export function createAsciiRenderer(renderer, { cellCss = 8, pixelRatio = 1, glyphs = 32 } = {}) {
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
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
  api.setCell(cellCss, pixelRatio);
  return api;
}
