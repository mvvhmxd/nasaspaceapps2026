// Preview-card stats for the site planner. Pure, runs in Node.
import { stateAt } from './visibility.js';
import { SIM_CONFIG } from './config.js';

export function previewStats(site, startHour, lengthH = SIM_CONFIG.missionHours, config = SIM_CONFIG) {
  const last = site.series.sunAz.length - 1;
  const end = Math.min(last, startHour + lengthH - 1);
  let sun = 0, earth = 0, dark = 0, longestDarkH = 0;
  let hoursToFirstSunset = null, hoursToFirstEarthset = null;
  const first = stateAt(site, startHour);
  let prev = first;
  for (let h = startHour; h <= end; h++) {
    const s = stateAt(site, h);
    if (s.sunlit) { sun++; dark = 0; } else { dark++; longestDarkH = Math.max(longestDarkH, dark); }
    if (s.earthVisible) earth++;
    if (hoursToFirstSunset === null && prev.sunlit && !s.sunlit) hoursToFirstSunset = h - startHour;
    if (hoursToFirstEarthset === null && prev.earthVisible && !s.earthVisible) hoursToFirstEarthset = h - startHour;
    prev = s;
  }
  const n = end - startHour + 1;
  // Hours the battery lasts asleep from full
  const sleepBudgetH = config.batteryCapacity / config.drainAsleep;
  return {
    sunlitPct: (100 * sun) / n,
    earthPct: (100 * earth) / n,
    longestDarkH,
    sunElAtLanding: first.sunEl,
    hoursToFirstSunset,
    hoursToFirstEarthset,
    exceedsSleepBudget: longestDarkH > sleepBudgetH,
  };
}
