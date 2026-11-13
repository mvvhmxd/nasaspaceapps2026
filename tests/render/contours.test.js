import { describe, expect, it } from 'vitest';
import {
  contourInterval, levelsCrossed, elevationRange, siteContours, nudge, levelSegments, cellContours,
  NUDGE_M, MAJOR_EVERY,
} from '../../src/render/contours.js';

// A plane e = a*x + b*y + c sampled at a cell's 4 corners (x right, y up, in cells):
// a and b are metres per cell.
const plane = (a, b, c) => ({
  tl: a * -0.5 + b * 0.5 + c, tr: a * 0.5 + b * 0.5 + c,
  bl: a * -0.5 + b * -0.5 + c, br: a * 0.5 + b * -0.5 + c,
});

/** Corner grid for elevation f(x, y) with x, y in cells; cell (i, j) has corners (i..i+1, j..j+1). */
function grid(f, cols, rows) {
  const corner = (i, j) => f(i, j);
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      cells.push({ i, j, c: { bl: corner(i, j), br: corner(i + 1, j), tl: corner(i, j + 1), tr: corner(i + 1, j + 1) } });
    }
  }
  return cells;
}

/** Cells whose corners truly straddle level L (min < L <= max, with the nudge). */
function trulyCrossed(c, L) {
  const v = [c.bl, c.br, c.tl, c.tr].map((e) => nudge(e, L));
  return Math.min(...v) < L && Math.max(...v) >= L;
}

/** Endpoints of every segment of level L, in global coordinates, with a counter. */
function endpointCounts(cells, L, interval) {
  const ends = new Map();
  let drawn = 0;
  for (const { i, j, c } of cells) {
    const lv = cellContours(c, interval).find((x) => x.level === L);
    if (!lv) continue;
    drawn++;
    for (const [x0, y0, x1, y1] of lv.segments) {
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        const key = `${(i + x).toFixed(9)},${(j + y).toFixed(9)}`;
        ends.set(key, (ends.get(key) ?? 0) + 1);
      }
    }
  }
  return { ends, drawn };
}

describe('contour interval', () => {
  it('picks 50 m for the demo site relief (1119-1932 m)', () => {
    expect(contourInterval(1119, 1932)).toBe(50);
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
    expect(levelsCrossed(1150, 1151, 50)).toBe(0);
    expect(levelsCrossed(1101, 1251, 50)).toBe(3);
  });
  it('finds the elevation range and caches it per heightmap', () => {
    expect(elevationRange(new Float32Array([3, -2, 7, 1]))).toEqual({ minM: -2, maxM: 7 });
    const hm = { heights: new Float32Array([1119, 1932, 1500]) };
    const a = siteContours(hm);
    expect(a).toEqual({ minM: 1119, maxM: 1932, interval: 50, majorEvery: MAJOR_EVERY });
    expect(siteContours(hm)).toBe(a); // same object: computed once
  });
});

describe('marching-squares segments', () => {
  it('interpolates edge crossings from the corner elevations', () => {
    // rises 10 m per cell to the east; level 1203 crosses bottom and top at x = 0.8
    const c = { bl: 1195, br: 1205, tl: 1195, tr: 1205 };
    const [s] = levelSegments(c, 1203);
    expect(s[0]).toBeCloseTo(0.8, 12); expect(s[1]).toBe(0);
    expect(s[2]).toBeCloseTo(0.8, 12); expect(s[3]).toBe(1);
  });
  it('flat or uncrossed cells give nothing', () => {
    expect(levelSegments(plane(0, 0, 1175), 1200)).toEqual([]);
    expect(cellContours(plane(10, 0, 1175), 50)).toEqual([]);
  });
  it('nudges corners on a level so shared corners agree', () => {
    expect(nudge(1200, 1200)).toBe(1200 + NUDGE_M);
    expect(nudge(1200.005, 1200)).toBe(1200 + NUDGE_M);
    expect(nudge(1200.5, 1200)).toBe(1200.5);
    // corner exactly on the level counts as above; crossing stays on the cell edge
    const [s] = levelSegments({ bl: 1190, br: 1200, tl: 1190, tr: 1200 }, 1200);
    expect(s[0]).toBeGreaterThan(0.99); expect(s[0]).toBeLessThanOrEqual(1);
  });
  it('saddles are resolved by the cell-centre average', () => {
    // tl and br high, bl and tr low
    const hiCentre = { tl: 1220, br: 1220, bl: 1195, tr: 1195 }; // centre 1207.5 >= 1200
    const loCentre = { tl: 1205, br: 1205, bl: 1180, tr: 1180 }; // centre 1192.5 < 1200
    const a = levelSegments(hiCentre, 1200);
    const b = levelSegments(loCentre, 1200);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    // centre high: the low corners bl and tr are cut off (segments touch left+bottom, right+top)
    const touches = (s) => s.map(([x0, y0, x1, y1]) => [x0, y0, x1, y1].map((v) => Math.round(v * 1e6) / 1e6));
    expect(touches(a)[0][0]).toBe(0); // left edge
    expect(touches(a)[0][3]).toBe(0); // bottom edge
    // centre low: the high corners br and tl are cut off (bottom+right, top+left)
    expect(touches(b)[0][1]).toBe(0); // bottom edge
    expect(touches(b)[0][2]).toBe(1); // right edge
  });
});

describe('contour continuity across cells', () => {
  const L = 1200;
  const check = (f, cols, rows, interval = 50) => {
    const cells = grid(f, cols, rows);
    const crossed = cells.filter(({ c }) => trulyCrossed(c, L)).length;
    const { ends, drawn } = endpointCounts(cells, L, interval);
    // every interior endpoint is shared by exactly two segments (a continuous chain);
    // only endpoints on the outer border of the grid appear once
    const onBorder = (key) => {
      const [x, y] = key.split(',').map(Number);
      return x < 1e-9 || y < 1e-9 || x > cols - 1e-9 || y > rows - 1e-9;
    };
    const loose = [...ends].filter(([k, n]) => n !== 2 && !onBorder(k));
    return { crossed, drawn, loose: loose.length };
  };

  it('straight level at 3 m/cell, 20 degrees: every crossed cell drawn, no gaps', () => {
    const a = (20 * Math.PI) / 180;
    const f = (x, y) => 1180 + 3 * (Math.cos(a) * x + Math.sin(a) * y);
    const r = check(f, 60, 40);
    expect(r.crossed).toBeGreaterThan(20);
    expect(r.drawn).toBe(r.crossed);
    expect(r.loose).toBe(0);
  });

  it('axis-aligned level 0.37 m above a corner column is drawn in every cell of that column', () => {
    // 3 m per cell to the east; column x = 4 sits at 1199.63, level 1200 is 0.37 m above it
    const f = (x) => 1199.63 + 3 * (x - 4);
    const r = check(f, 12, 30);
    expect(r.crossed).toBe(30);
    expect(r.drawn).toBe(30);
    expect(r.loose).toBe(0);
  });

  it('curved terrain (a crater bowl) closes into a loop with no loose ends', () => {
    const f = (x, y) => 1150 + 0.9 * ((x - 20) ** 2 + (y - 15) ** 2) / 4;
    const r = check(f, 40, 30);
    expect(r.drawn).toBe(r.crossed);
    expect(r.loose).toBe(0);
  });

  it('a level through grid corners exactly stays continuous', () => {
    const f = (x, y) => 1190 + 2 * x + 3 * y; // passes exactly through integer corners
    const r = check(f, 30, 20);
    expect(r.drawn).toBe(r.crossed);
    expect(r.loose).toBe(0);
  });
});

describe('thinning on steep slopes', () => {
  it('gentle slopes show minor contours (>= 2 cells apart)', () => {
    expect(cellContours(plane(0, 25, 1200), 50).map((x) => x.major)).toEqual([false]);
  });
  it('steeper slopes drop minor contours first, keeping index ones', () => {
    expect(cellContours(plane(0, 26, 1200), 50)).toEqual([]);
    const m = cellContours(plane(0, 100, 1250), 50);
    expect(m.map((x) => [x.level, x.major])).toEqual([[1250, true]]);
    expect(cellContours(plane(0, 100, 1400), 50)).toEqual([]);
  });
  it('very steep walls drop index contours too (no hatching)', () => {
    expect(cellContours(plane(0, 190, 1250), 50)).toEqual([]);
    expect(cellContours(plane(0, 166, 1250), 50).map((x) => x.level)).toEqual([1250]);
  });
});
