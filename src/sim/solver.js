// Solver: exhaustive search over sites x landing hours for the best score.
// Deterministic optimisation, not AI. Stretch item (see JAM.md cut list).
import { initialState, advance } from './survival.js';
import { SIM_CONFIG } from './config.js';

/** Best automatic-mode score for each candidate start hour of one site. */
export function bestStart(site, config = SIM_CONFIG, stride = 6) {
  let best = { startHour: 0, score: -1, alive: false };
  const n = site.series.sunAz.length;
  for (let h = 0; h + config.missionHours <= n; h += stride) {
    const { state } = advance(site, initialState(config, h), config.missionHours);
    const better = (state.alive && !best.alive) || (state.alive === best.alive && state.score > best.score);
    if (better) best = { startHour: h, score: state.score, alive: state.alive };
  }
  return best;
}
// TODO(dev3): search across all sites, and star thresholds from SIM_CONFIG.starThresholds.
