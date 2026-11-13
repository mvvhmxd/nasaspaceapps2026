// Pure helpers for the screens. No React, no DOM. All truth comes from src/sim/.
import { stateAt } from '../sim/visibility.js';
import { previewStats } from '../sim/planner.js';

/** Hours until `key` ('sunlit' | 'earthVisible') next flips after `hour`; null if it never does. */
export function nextChange(site, hour, key) {
  const now = stateAt(site, hour)[key];
  for (let h = hour + 1; h < site.hours; h++) {
    if (stateAt(site, h)[key] !== now) return h - hour;
  }
  return null;
}

/** Number of landing days whose full mission window fits inside the site's data. */
export function validStartDays(site, missionHours) {
  if (site.hours < missionHours) return 0;
  return Math.floor((site.hours - missionHours) / 24) + 1;
}

/** Preview stats for every valid landing day (index = day). */
export function dayStats(site, missionHours, config) {
  const out = [];
  for (let d = 0; d < validStartDays(site, missionHours); d++) {
    out.push(previewStats(site, d * 24, missionHours, config));
  }
  return out;
}

/** Landing day after a launch slip, clamped to the last valid day. */
export function slipDay(day, slipDays, site, missionHours) {
  return Math.min(day + slipDays, validStartDays(site, missionHours) - 1);
}

/** 0 = lost, 1 = survived, 2 / 3 = share of the best score (thresholds e.g. [0.7, 0.9]). */
export function starsFor(state, bestScore, thresholds) {
  if (!state.alive) return 0;
  if (bestScore <= 0) return 1;
  const share = state.score / bestScore;
  return 1 + thresholds.filter((t) => share >= t).length;
}

/** For each row key, the index of the best pinned choice (ties: first). */
export function bestPerRow(stats) {
  const higher = ['sunlitPct', 'earthPct', 'sunElAtLanding'];
  const lower = ['longestDarkH'];
  const best = {};
  for (const k of [...higher, ...lower]) {
    let bi = -1;
    stats.forEach((s, i) => {
      if (bi < 0 || (higher.includes(k) ? s[k] > stats[bi][k] : s[k] < stats[bi][k])) bi = i;
    });
    best[k] = bi;
  }
  return best;
}

export function utcLabel(site, hour) {
  const t = new Date(Date.parse(site.series.startUtc) + hour * site.series.stepHours * 3600e3);
  return t.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
