import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { stateAt } from '../../src/sim/visibility.js';
import { SIM_CONFIG } from '../../src/sim/config.js';
import { nextChange, validStartDays, dayStats, slipDay, starsFor, bestPerRow, bestPlan } from '../../src/ui/gameHelpers.js';
import { initialState, advance } from '../../src/sim/survival.js';
import { MISSIONS } from '../../src/game/missions.js';
import { isUnlocked, recordStars, nextMissionId, sanitize } from '../../src/game/progress.js';
import { sanitizeSettings, DEFAULTS } from '../../src/game/settings.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/demo.json', 'utf8')));
const H = SIM_CONFIG.missionHours;

describe('gameHelpers', () => {
  it('nextChange points at the first hour where the value flips', () => {
    for (const key of ['sunlit', 'earthVisible']) {
      const n = nextChange(site, 0, key);
      if (n === null) continue;
      expect(stateAt(site, n)[key]).not.toBe(stateAt(site, 0)[key]);
      expect(stateAt(site, n - 1)[key]).toBe(stateAt(site, 0)[key]);
    }
  });

  it('nextChange is null at the last hour', () => {
    expect(nextChange(site, site.hours - 1, 'sunlit')).toBeNull();
  });

  it('validStartDays only offers days whose window fits the data', () => {
    const days = validStartDays(site, H);
    expect((days - 1) * 24 + H).toBeLessThanOrEqual(site.hours);
    expect(days * 24 + H).toBeGreaterThan(site.hours);
    expect(validStartDays({ hours: H - 1 }, H)).toBe(0);
  });

  it('dayStats has one entry per valid day with percentages in range', () => {
    const stats = dayStats(site, H);
    expect(stats).toHaveLength(validStartDays(site, H));
    for (const s of stats) {
      expect(s.sunlitPct).toBeGreaterThanOrEqual(0);
      expect(s.sunlitPct).toBeLessThanOrEqual(100);
    }
  });

  it('slipDay moves later and clamps to the last valid day', () => {
    const last = validStartDays(site, H) - 1;
    expect(slipDay(0, 5, site, H)).toBe(5);
    expect(slipDay(last, 5, site, H)).toBe(last);
  });

  it('starsFor: 0 lost, 1 survived, 2 and 3 by share of best', () => {
    const t = [0.7, 0.9];
    expect(starsFor({ alive: false, score: 99 }, 100, t)).toBe(0);
    expect(starsFor({ alive: true, score: 10 }, 100, t)).toBe(1);
    expect(starsFor({ alive: true, score: 70 }, 100, t)).toBe(2);
    expect(starsFor({ alive: true, score: 90 }, 100, t)).toBe(3);
    expect(starsFor({ alive: true, score: 0 }, 0, t)).toBe(1);
  });

  it('bestPerRow picks highest sun/Earth and shortest darkness', () => {
    const b = bestPerRow([
      { sunlitPct: 40, earthPct: 80, sunElAtLanding: 1, longestDarkH: 50 },
      { sunlitPct: 60, earthPct: 20, sunElAtLanding: 2, longestDarkH: 90 },
    ]);
    expect(b).toEqual({ sunlitPct: 1, earthPct: 0, sunElAtLanding: 1, longestDarkH: 0 });
  });
});

const load = (id) => decodeSite(JSON.parse(readFileSync(`public/sites/${id}.json`, 'utf8')));

describe('campaign', () => {
  it('every mission site exists, has a full launch window, real terrain and a validated real sky', () => {
    for (const m of MISSIONS) {
      for (const id of m.siteIds) {
        const s = load(id);
        expect(validStartDays(s, m.config.missionHours)).toBeGreaterThanOrEqual(10);
        expect(s.illustrative).toBe(false);
        expect(s.terrain.real).toBe(true);
        expect(s.maskSource).toBe('lola-wide');
        expect(s.horizonMask).toHaveLength(360);
        expect(s.sky.real).toBe(true);
        expect(s.sky.validation.sunMaxSeparationDeg).toBeLessThanOrEqual(s.sky.validation.toleranceDeg);
        expect(s.sky.validation.earthMaxSeparationDeg).toBeLessThanOrEqual(s.sky.validation.toleranceDeg);
      }
    }
  });

  it('every mission can be survived with a positive score, and bestPlan is reproducible', () => {
    for (const m of MISSIONS) {
      const sites = m.siteIds.map(load);
      const best = bestPlan(sites, m.config);
      expect(best.alive).toBe(true);
      expect(best.score).toBeGreaterThan(0);
      const site = sites.find((s) => s.id === best.siteId);
      const { state } = advance(site, initialState(m.config, best.day * 24), m.config.missionHours);
      expect(state.score).toBe(best.score);
    }
  });

  it('the launch slip always leaves a selectable day', () => {
    for (const m of MISSIONS) {
      for (const id of m.siteIds) {
        const s = load(id);
        const last = validStartDays(s, m.config.missionHours) - 1;
        expect(slipDay(last, m.slipDays, s, m.config.missionHours)).toBe(last);
      }
    }
  });

  it('missions unlock in order and keep the best star count', () => {
    const [m1, m2, m3] = MISSIONS.map((m) => m.id);
    expect(isUnlocked({}, m1)).toBe(true);
    expect(isUnlocked({}, m2)).toBe(false);
    expect(isUnlocked({ [m1]: 0 }, m2)).toBe(false);
    let p = recordStars({}, m1, 2);
    expect(isUnlocked(p, m2)).toBe(true);
    expect(isUnlocked(p, m3)).toBe(false);
    p = recordStars(p, m1, 1);
    expect(p[m1]).toBe(2);
    expect(nextMissionId(m1)).toBe(m2);
    expect(nextMissionId(m3)).toBeNull();
  });

  it('sanitize drops unknown or malformed saved progress', () => {
    expect(sanitize(null)).toEqual({});
    expect(sanitize({ 'first-light': 3, 'call-home': 9, hacked: 3, 'long-shadow': '2' })).toEqual({ 'first-light': 3 });
  });
});

describe('settings', () => {
  it('falls back to defaults for missing or malformed values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULTS);
    expect(sanitizeSettings({ volume: 'loud', muted: 1, ascii: 'ultra' })).toEqual(DEFAULTS);
  });
  it('keeps valid values and clamps the volume', () => {
    expect(sanitizeSettings({ volume: 0.25, muted: true, ascii: 'off' })).toEqual({ volume: 0.25, muted: true, ascii: 'off' });
    expect(sanitizeSettings({ volume: 7 }).volume).toBe(1);
    expect(sanitizeSettings({ volume: -1 }).volume).toBe(0);
    expect(sanitizeSettings({ volume: NaN }).volume).toBe(DEFAULTS.volume);
  });
});
