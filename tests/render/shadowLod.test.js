import { describe, expect, it } from 'vitest';
import { motionShadowSize } from '../../src/render/shadowLod.js';

const coverM = 15360; // 1.5 x the 10.24 km demo crop (scene.js shadow frustum)

describe('motion shadow size', () => {
  it('keeps a shadow texel at most half a glyph cell, unless capped by the still size', () => {
    for (const cellM of [71, 35, 18, 9, 6, 3]) {
      const size = motionShadowSize({ coverM, cellM, stillSize: 4096 });
      const texelM = coverM / size;
      const capped = size === 4096 && coverM / 4096 > cellM / 2;
      expect(capped || texelM <= cellM / 2 + 1e-9).toBe(true);
      // and it is the smallest power of two that does it: half the size would be too coarse
      if (size > 512 && !capped) expect(coverM / (size / 2)).toBeGreaterThan(cellM / 2);
    }
    // the cap is real: 3 m cells want 8192, the preset allows 4096
    expect(motionShadowSize({ coverM, cellM: 3, stillSize: 4096 })).toBe(4096);
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
