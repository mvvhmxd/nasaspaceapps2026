import { describe, expect, it } from 'vitest';
import { motionShadowSize } from '../../src/render/shadowLod.js';

const coverM = 15360; // 1.5 x the 10.24 km demo crop (scene.js shadow frustum)

describe('motion shadow size', () => {
  it('keeps a shadow texel at most half a glyph cell', () => {
    for (const cellM of [71, 35, 18, 9, 6, 3]) {
      const size = motionShadowSize({ coverM, cellM, stillSize: 4096 });
      const texelM = coverM / size;
      if (size < 4096) expect(texelM).toBeLessThanOrEqual(cellM / 2 + 1e-9);
    }
  });

  it('is small at default zoom and grows when zoomed in, within [min, still]', () => {
    expect(motionShadowSize({ coverM, cellM: 71, stillSize: 4096 })).toBe(512);
    expect(motionShadowSize({ coverM, cellM: 18, stillSize: 4096 })).toBe(2048);
    expect(motionShadowSize({ coverM, cellM: 6, stillSize: 4096 })).toBe(4096);
    expect(motionShadowSize({ coverM, cellM: 1, stillSize: 4096 })).toBe(4096);
    expect(motionShadowSize({ coverM, cellM: 1, stillSize: 2048 })).toBe(2048);
    expect(motionShadowSize({ coverM, cellM: 10000, stillSize: 4096 })).toBe(512);
  });

  it('plain shading (ASCII off) uses the off size, capped by the still size', () => {
    expect(motionShadowSize({ coverM, cellM: null, stillSize: 4096 })).toBe(2048);
    expect(motionShadowSize({ coverM, cellM: 0, stillSize: 1024 })).toBe(1024);
  });
});
