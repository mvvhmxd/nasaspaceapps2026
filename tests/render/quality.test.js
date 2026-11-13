import { describe, expect, it } from 'vitest';
import {
  QUALITY_ORDER, QUALITY_PRESETS, DEFAULT_QUALITY,
  initialQuality, lowerQuality, saveQuality, isQuality,
} from '../../src/render/quality.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

describe('ASCII quality presets', () => {
  it('has High, Balanced, Performance and Off, with cells per the spec', () => {
    expect(QUALITY_ORDER).toEqual(['high', 'balanced', 'performance', 'off']);
    expect(QUALITY_PRESETS.high.cellCss).toBe(8);
    expect(QUALITY_PRESETS.balanced.cellCss).toBe(10);
    expect(QUALITY_PRESETS.performance.cellCss).toBe(12);
    expect(QUALITY_PRESETS.off.ascii).toBe(false);
    expect(DEFAULT_QUALITY).toBe('balanced');
    for (const q of QUALITY_ORDER) {
      const p = QUALITY_PRESETS[q];
      expect(p.glyphs).toBeGreaterThanOrEqual(24);
      expect(p.glyphs).toBeLessThanOrEqual(32);
    }
  });

  it('steps down one preset at a time and stops at Off', () => {
    expect(lowerQuality('high')).toBe('balanced');
    expect(lowerQuality('balanced')).toBe('performance');
    expect(lowerQuality('performance')).toBe('off');
    expect(lowerQuality('off')).toBe('off');
  });

  it('picks the start quality: ?ascii=0, then ?quality, then saved, then default', () => {
    const s = memoryStorage();
    expect(initialQuality('', s)).toBe('balanced');
    saveQuality('high', s);
    expect(initialQuality('', s)).toBe('high');
    expect(initialQuality('?quality=performance', s)).toBe('performance');
    expect(initialQuality('?quality=bogus', s)).toBe('high');
    expect(initialQuality('?ascii=0&quality=high', s)).toBe('off');
  });

  it('ignores bad names and blocked storage', () => {
    const s = memoryStorage();
    saveQuality('ultra', s);
    expect(initialQuality('', s)).toBe('balanced');
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(() => saveQuality('high', blocked)).not.toThrow();
    expect(initialQuality('', blocked)).toBe('balanced');
    expect(initialQuality('', undefined)).toBe('balanced');
    expect(isQuality('toString')).toBe(false);
  });
});
