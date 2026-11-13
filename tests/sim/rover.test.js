import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { stateAt } from '../../src/sim/visibility.js';
import { ROVER, groundY, localBlocked, sunlitAt, findIceTargets, initialRover, stepRover, iceScore } from '../../src/sim/rover.js';

const load = (id) => decodeSite(JSON.parse(readFileSync(`public/sites/${id}.json`, 'utf8')));
const site = load('ridge');
const targets = findIceTargets(site);
const SUN = { sunAz: 0, sunEl: 80, sunlit: true }; // high Sun: nothing blocks it
const DARK = { sunAz: 0, sunEl: -5, sunlit: false };
const flat = { heightmap: { size: 257, spacingM: 40, heights: new Float32Array(257 * 257) }, horizonMask: new Array(360).fill(-1) };
const drive = (s, rover, input, hours, sky, tg = []) => {
  const events = [];
  for (let i = 0; i < Math.round(hours / 0.1); i++) {
    const r = stepRover(s, rover, input, 0.1, sky, tg);
    rover = r.rover; events.push(...r.events);
  }
  return { rover, events };
};

describe('rover', () => {
  it('finds separated ice prospects below the lander, inside the map, on every mission site', () => {
    for (const id of ['ridge', 'spur', 'knoll', 'hollow']) {
      const s = load(id), t = findIceTargets(s);
      expect(t.length).toBeGreaterThanOrEqual(2);
      const edge = ((s.heightmap.size - 1) / 2) * s.heightmap.spacingM;
      for (const a of t) {
        expect(Math.hypot(a.x, a.z)).toBeGreaterThanOrEqual(600);
        expect(Math.abs(a.x)).toBeLessThan(edge);
        expect(Math.abs(a.z)).toBeLessThan(edge);
        expect(Number.isNaN(groundY(s.heightmap, a.x, a.z))).toBe(false);
        for (const b of t) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(800);
      }
      expect(findIceTargets(s)).toEqual(t); // deterministic
    }
  });

  it('drives north at the flat-ground speed and pays the flat-ground cost', () => {
    const { rover } = drive(flat, initialRover(), { east: 0, north: 1 }, 2, DARK);
    expect(rover.z).toBeCloseTo(-2 * ROVER.speedMPerH, 0); // north is -z
    expect(rover.x).toBeCloseTo(0, 6);
    expect(rover.heading).toBeCloseTo(0, 6);
    const idle = (2 - ROVER.dockRadiusM / ROVER.speedMPerH) * ROVER.idleDrain; // no idle drain while docked
    expect(100 - rover.battery).toBeCloseTo(3 * ROVER.driveCostPer100M + idle, 0);
  });

  it('charges in sunlight, drains in the dark, and never exceeds capacity', () => {
    const away = { ...initialRover(), x: 1000, battery: 50 };
    expect(drive(flat, away, { east: 0, north: 0 }, 2, SUN).rover.battery).toBeCloseTo(50 + 2 * (ROVER.chargeSunlit - ROVER.idleDrain), 6);
    expect(drive(flat, away, { east: 0, north: 0 }, 2, DARK).rover.battery).toBeCloseTo(50 - 2 * ROVER.idleDrain, 6);
    expect(drive(flat, away, { east: 0, north: 0 }, 50, SUN).rover.battery).toBe(ROVER.batteryCapacity);
  });

  it('stays inside the map', () => {
    const { rover } = drive(flat, initialRover(), { east: 1, north: 0 }, 60, SUN);
    expect(rover.x).toBeLessThanOrEqual(5120 - 80);
    expect(rover.x).toBeGreaterThan(4800);
  });

  it('collects ice by parking on a prospect, and delivers it at the lander', () => {
    const t = [{ id: 0, x: 600, z: 0 }];
    let { rover, events } = drive(flat, { ...initialRover(), x: 600 }, { east: 0, north: 0 }, ROVER.drillHours + 0.2, SUN, t);
    expect(events).toEqual(['iceCollected']);
    expect(rover.carrying).toBe(1);
    expect(rover.delivered).toBe(0);
    ({ rover, events } = drive(flat, rover, { east: -1, north: 0 }, 4, SUN, t));
    expect(events).toEqual(['iceDelivered']);
    expect(rover.carrying).toBe(0);
    expect(rover.delivered).toBe(1);
    expect(iceScore(rover)).toBe(ROVER.icePackets);
    // the same prospect cannot be drilled twice
    expect(drive(flat, { ...rover, x: 600, z: 0 }, { east: 0, north: 0 }, 5, SUN, t).events).toEqual([]);
  });

  it('moving cancels drilling', () => {
    const t = [{ id: 0, x: 600, z: 0 }];
    let { rover } = drive(flat, { ...initialRover(), x: 600 }, { east: 0, north: 0 }, 1, SUN, t);
    expect(rover.drill.hours).toBeCloseTo(1, 6);
    ({ rover } = drive(flat, rover, { east: 0, north: 1 }, 0.1, SUN, t));
    expect(rover.drill).toBeNull();
  });

  it('a flat battery loses the rover and what it carries, but not what was delivered', () => {
    const start = { ...initialRover(), x: 2000, battery: 1, carrying: 1, delivered: 1 };
    const { rover, events } = drive(flat, start, { east: 0, north: 0 }, 5, DARK);
    expect(events).toEqual(['roverLost']);
    expect(rover.alive).toBe(false);
    expect(rover.carrying).toBe(0);
    expect(rover.delivered).toBe(1);
    expect(stepRover(flat, rover, { east: 1, north: 0 }, 1, SUN, []).rover).toBe(rover); // a lost rover never moves again
  });

  it('local terrain blocks a low Sun behind a wall but not a high one', () => {
    const wall = { size: 257, spacingM: 40, heights: new Float32Array(257 * 257) };
    for (let r = 0; r < 100; r++) for (let c = 0; c < 257; c++) wall.heights[r * 257 + c] = 300; // high ground to the north
    expect(localBlocked(wall, 0, 0, 0, 2)).toBe(true);
    expect(localBlocked(wall, 0, 0, 180, 2)).toBe(false);
    expect(localBlocked(wall, 0, 0, 0, 60)).toBe(false);
  });

  it('on the real ridge site, the deepest prospect is darker than the lander over the window', () => {
    const deep = targets[0];
    let lander = 0, pit = 0;
    for (let h = 0; h < site.hours; h += 6) {
      const sky = stateAt(site, h);
      if (sunlitAt(site, 0, 0, sky)) lander++;
      if (sunlitAt(site, deep.x, deep.z, sky)) pit++;
    }
    expect(pit).toBeLessThan(lander);
  });
});
