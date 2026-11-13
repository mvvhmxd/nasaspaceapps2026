import { describe, expect, it } from 'vitest';
import {
  contourInterval, contourGlyphForCell, levelsCrossed, elevationRange, CONTOUR_GLYPHS, BACKSLASH,
} from '../../src/render/contours.js';

// A plane e = a*x + b*y + c sampled at a cell's 4 corners (x right, y up, in cells):
// a and b are metres per cell.
const plane = (a, b, c) => ({
  tl: a * -0.5 + b * 0.5 + c, tr: a * 0.5 + b * 0.5 + c,
  bl: a * -0.5 + b * -0.5 + c, br: a * 0.5 + b * -0.5 + c,
});

describe('contour interval', () => {
  it('picks 50 m for the demo site relief (1119-1932 m)', () => {
    expect(contourInterval(1119, 1932)).toBe(50);
    expect(813 / 50).toBeGreaterThanOrEqual(12);
  });
  it('scales with relief', () => {
    expect(contourInterval(0, 100)).toBe(10);
    expect(contourInterval(0, 4000)).toBe(250);
    expect(contourInterval(-2000, 8000)).toBe(500);
    expect(contourInterval(5, 5)).toBe(10);
    expect(contourInterval(0, 1e6)).toBe(1000);
  });
  it('counts levels in (lo, hi]', () => {
    expect(levelsCrossed(1149, 1151, 50)).toBe(1);
    expect(levelsCrossed(1150, 1151, 50)).toBe(0); // lo on a level is not a crossing
    expect(levelsCrossed(1149, 1150, 50)).toBe(1);
    expect(levelsCrossed(1101, 1249, 50)).toBe(2); // 1150, 1200
    expect(levelsCrossed(1101, 1251, 50)).toBe(3); // 1150, 1200, 1250
  });
  it('finds the elevation range', () => {
    expect(elevationRange(new Float32Array([3, -2, 7, 1]))).toEqual({ minM: -2, maxM: 7 });
  });
});

describe('contour glyph per cell', () => {
  it('flat or no crossing: none', () => {
    expect(contourGlyphForCell(plane(0, 0, 1175), 50)).toBeNull();
    expect(contourGlyphForCell(plane(10, 0, 1175), 50)).toBeNull(); // 1170..1180, no level
  });
  it('height rising to the north: east-west line "-"', () => {
    expect(contourGlyphForCell(plane(0, 10, 1200), 50)).toEqual({ glyph: '-', major: false });
  });
  it('height rising to the east: north-south line "|"', () => {
    expect(contourGlyphForCell(plane(10, 0, 1200), 50)).toEqual({ glyph: '|', major: false });
  });
  it('rising to the north-west: line runs up-right "/"', () => {
    // e = -x + y: level lines y = x + c, slope +1 on a y-up screen
    expect(contourGlyphForCell(plane(-10, 10, 1200), 50).glyph).toBe('/');
    expect(contourGlyphForCell(plane(10, -10, 1200), 50).glyph).toBe('/');
  });
  it('rising to the north-east: line runs down-right (backslash)', () => {
    expect(contourGlyphForCell(plane(10, 10, 1200), 50).glyph).toBe(BACKSLASH);
    expect(contourGlyphForCell(plane(-10, -10, 1200), 50).glyph).toBe(BACKSLASH);
  });
  it('index contours every 5th level are major', () => {
    expect(contourGlyphForCell(plane(0, 10, 1250), 50)).toEqual({ glyph: '-', major: true });
    expect(contourGlyphForCell(plane(0, 10, 1200), 50).major).toBe(false);
  });
  it('ignores levels the terrain only grazes (< 1 m either side)', () => {
    // corners 1199.5 .. 1200.5 straddle 1200 by 0.5 m: below precision, no line
    expect(contourGlyphForCell(plane(0, 1, 1200), 50)).toBeNull();
    // 1198.5 .. 1201.5: clears 1200 by 1.5 m both sides, drawn
    expect(contourGlyphForCell(plane(0, 3, 1200), 50)).toEqual({ glyph: '-', major: false });
    // 1199.5 .. 1210.5: only 0.5 m below the level, not drawn
    expect(contourGlyphForCell(plane(0, 11, 1205), 50)).toBeNull();
  });
  it('saddle is deterministic', () => {
    const hiTlBr = { tl: 1210, tr: 1190, bl: 1190, br: 1210 };
    const hiTrBl = { tl: 1190, tr: 1210, bl: 1210, br: 1190 };
    expect(contourGlyphForCell(hiTlBr, 50)).toEqual({ glyph: BACKSLASH, major: false });
    expect(contourGlyphForCell(hiTrBl, 50)).toEqual({ glyph: '/', major: false });
  });
  it('gentle slopes show minor contours (>= 2 cells apart)', () => {
    // 25 m per cell: 50 m contours are 2 cells apart, the limit
    expect(contourGlyphForCell(plane(0, 25, 1200), 50)).toEqual({ glyph: '-', major: false });
  });
  it('steeper slopes drop minor contours first, keeping index ones', () => {
    // 26 m per cell: minor spacing 1.92 cells -> hidden
    expect(contourGlyphForCell(plane(0, 26, 1200), 50)).toBeNull();
    // 100 m per cell: minor spacing 0.5 (hidden), index spacing 2.5 (shown)
    expect(contourGlyphForCell(plane(0, 100, 1250), 50)).toEqual({ glyph: '-', major: true });
    // same slope, no index level in the cell: nothing
    expect(contourGlyphForCell(plane(0, 100, 1400), 50)).toBeNull();
  });
  it('very steep walls drop index contours too (no hatching)', () => {
    // 190 m per cell: index spacing 1.3 cells < 1.5
    expect(contourGlyphForCell(plane(0, 190, 1250), 50)).toBeNull();
    // 166 m per cell: index spacing 1.506 cells, still shown
    expect(contourGlyphForCell(plane(0, 166, 1250), 50)).toEqual({ glyph: '-', major: true });
  });
  it('atlas order is fixed', () => {
    expect(CONTOUR_GLYPHS).toEqual(['-', '|', '/', BACKSLASH]);
    expect(BACKSLASH.charCodeAt(0)).toBe(92);
  });
});
