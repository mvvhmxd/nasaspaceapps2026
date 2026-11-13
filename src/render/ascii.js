// Coloured ASCII pass: a full-screen ShaderPass that turns the rendered scene
// into a grid of tinted glyphs. Runs in linear space between RenderPass and
// OutputPass. The HUD is DOM and never goes through it.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PALETTE } from '../theme.js';

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

const AsciiShader = {
  uniforms: {
    tDiffuse: { value: null },
    tGlyph: { value: null },
    glyphCount: { value: 32 },
    resolution: { value: new THREE.Vector2(1, 1) }, // drawing-buffer pixels
    cell: { value: 8 }, // cell size in drawing-buffer pixels
    fill: { value: 0.45 }, // scene colour showing behind the glyph
    saturation: { value: 1.4 },
    gain: { value: 1.6 }, // glyph tint brightness
    duotone: { value: 0.5 }, // 0 = scene colours only, 1 = pure navy-to-amber grade
    contrastLo: { value: 0.04 },
    contrastHi: { value: 0.8 },
    shadowColor: { value: new THREE.Color(PALETTE.navy).multiplyScalar(2.2) },
    sunColor: { value: new THREE.Color(PALETTE.amber) },
    emptyColor: { value: new THREE.Color(PALETTE.navy) }, // drawn where there is no terrain
    dots: { value: 0 }, // 1 = halftone dots sized by brightness (surface view) instead of glyphs
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tGlyph;
    uniform float glyphCount;
    uniform vec2 resolution;
    uniform float cell;
    uniform float fill;
    uniform float saturation;
    uniform float gain;
    uniform float duotone;
    uniform float contrastLo;
    uniform float contrastHi;
    uniform vec3 shadowColor;
    uniform vec3 sunColor;
    uniform vec3 emptyColor;
    uniform float dots;
    varying vec2 vUv;

    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec2 cellIndex = floor(gl_FragCoord.xy / cell);
      vec2 cellUv = (cellIndex + 0.5) * cell / resolution;
      vec4 texel = texture(tDiffuse, cellUv);
      if (texel.a < 0.5) { // beyond the edge of the terrain: no glyphs
        gl_FragColor = vec4(emptyColor, 1.0);
        return;
      }
      vec3 scene = texel.rgb;

      // Linear -> perceptual, then a contrast curve so lit ground is dense and
      // shadow still shows sparse glyphs.
      float y = pow(clamp(dot(scene, LUMA), 0.0, 1.0), 1.0 / 2.2);
      float lum = smoothstep(contrastLo, contrastHi, y);

      float idx = floor(lum * (glyphCount - 1.0) + 0.5);
      vec2 local = fract(gl_FragCoord.xy / cell);
      vec2 glyphUv = vec2((idx + local.x) / glyphCount, local.y);
      float ink = texture(tGlyph, glyphUv).r;

      if (dots > 0.5) {
        // Halftone: one round dot per cell, radius grows with brightness, keeps the scene's own colour.
        // Dots sized by brightness. Each dot takes the colour of the light that reaches it, so the
        // ground reads as game state: amber = sunlight (charging), blue = shadow (draining),
        // white = the rover's floodlight. Coloured things (Earth) keep their own colour.
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
        return;
      }

      // Colour: boosted scene colour blended with the palette grade.
      vec3 grey = vec3(dot(scene, LUMA));
      vec3 vivid = clamp(mix(grey, scene, saturation) * gain, 0.0, 1.0);
      vec3 grade = mix(shadowColor, sunColor, lum);
      vec3 tint = mix(vivid, grade * max(lum, 0.15), duotone);

      vec3 background = mix(scene, shadowColor * 0.6, duotone * 0.5) * fill;
      gl_FragColor = vec4(mix(background, tint, ink), 1.0);
    }
  `,
};

/**
 * Create the pass. Call `setSize(widthPx, heightPx)` with drawing-buffer pixels
 * whenever the renderer resizes, and `setCell(cssPx, pixelRatio, glyphs?)` to change
 * density or ramp length (rebuilds the atlas so glyphs stay crisp).
 */
export function createAsciiPass({ cellCss = 8, pixelRatio = 1, glyphs = 32 } = {}) {
  const pass = new ShaderPass(AsciiShader);
  let atlas = null;
  const api = {
    pass,
    ramp: '',
    setSize(w, h) {
      pass.uniforms.resolution.value.set(w, h);
    },
    setDots(on) {
      pass.uniforms.dots.value = on ? 1 : 0;
      pass.uniforms.emptyColor.value.set(on ? '#060a1c' : PALETTE.navy); // deep navy behind the dots
    },
    setCell(css, dpr, count = glyphs) {
      glyphs = count;
      const cellPx = Math.max(4, Math.round(css * dpr));
      atlas?.texture.dispose();
      atlas = buildGlyphAtlas({ count: glyphs, cellPx });
      pass.uniforms.tGlyph.value = atlas.texture;
      pass.uniforms.glyphCount.value = atlas.count;
      pass.uniforms.cell.value = cellPx;
      api.ramp = atlas.ramp;
    },
    dispose() {
      atlas?.texture.dispose();
      pass.dispose?.();
    },
  };
  api.setCell(cellCss, pixelRatio);
  return api;
}
