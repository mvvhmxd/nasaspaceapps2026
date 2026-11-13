// Survival HUD: reads sim state, sends commands. Never computes game truth.
import { MODES } from '../sim/survival.js';
import { nextChange } from './gameHelpers.js';

const MODE_TEXT = {
  [MODES.AWAKE]: '○ Awake',
  [MODES.ASLEEP]: '☾ Asleep',
  [MODES.DRILL]: '⚒ Drilling',
  [MODES.TRANSMIT]: '⇅ Transmitting',
};
const EVENT_TEXT = {
  sunrise: ['lit', '☀ Sunrise over the ridge'],
  sunset: ['dark', '● Sun behind the ridge'],
  earthrise: ['comms', '◆ Earth in view'],
  earthset: ['dark', '◇ Earth contact lost'],
  battery25: ['lit', '⚠ Battery below 25%'],
  battery10: ['dark', '⚠ Battery below 10%'],
  powerDown: ['dark', '✖ Power down'],
  success: ['lit', '★ Mission window complete'],
};

/** Battery, mode, data and countdowns. Sits under the site panel. */
export function MissionStatus({ site, sim, sky, forceSleep }) {
  const cfg = sim.config;
  const pct = Math.round((100 * sim.battery) / cfg.batteryCapacity);
  const elapsed = sim.hour - sim.startHour;
  const sunIn = nextChange(site, sky.hour, 'sunlit');
  const earthIn = nextChange(site, sky.hour, 'earthVisible');
  const level = pct < 10 ? 'crit' : pct < 25 ? 'low' : 'ok';
  return (
      <div className="hud static mission">
        <div className="title">Day {Math.floor(elapsed / 24) + 1} of {cfg.missionHours / 24} &middot; hour {elapsed}</div>
        <div className={`battery ${level}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Battery">
          <span style={{ width: `${pct}%` }} />
          <b>Battery {pct}%{level !== 'ok' ? ' ⚠' : ''}</b>
        </div>
        <div>Mode: {MODE_TEXT[sim.mode]}{forceSleep ? ' (forced)' : ''}</div>
        <div>Data on board: {sim.store} / {cfg.storeSize} &middot; <span className="comms">Returned: {sim.score}</span></div>
        <div className="dim">
          {sky.sunlit ? 'Sunset' : 'Sunrise'} in {sunIn === null ? '—' : `${sunIn} h`} &middot;{' '}
          {sky.earthVisible ? 'Earthset' : 'Earthrise'} in {earthIn === null ? '—' : `${earthIn} h`}
        </div>
        <div className="dim small">Battery numbers are game values</div>
      </div>
  );
}

/** Event feed and time controls. */
export default function MissionHud({ sim, events, playing, speed, speeds, forceSleep, onPlay, onSpeed, onSleep, onAbort }) {
  const cfg = sim.config;
  const elapsed = sim.hour - sim.startHour;
  return (
    <>
      <div className="hud feed" aria-live="polite" aria-label="Mission events">
        {events.length === 0 && <div className="dim">No events yet</div>}
        {events.slice(-5).map((e, i) => {
          const [cls, text] = EVENT_TEXT[e.type] ?? ['', e.type];
          return <div key={`${e.hour}-${e.type}-${i}`} className={cls}>h{e.hour - sim.startHour} {text}</div>;
        })}
      </div>
      <div className="hud bottom">
        <button className="primary" onClick={onPlay}>{playing ? 'Pause' : 'Play'} (Space)</button>
        {speeds.map((s) => (
          <button key={s} className={s === speed ? 'on' : ''} aria-pressed={s === speed} onClick={() => onSpeed(s)}>{s}&times;</button>
        ))}
        <button className={forceSleep ? 'on' : ''} aria-pressed={forceSleep} onClick={onSleep}>
          {forceSleep ? 'Wake lander' : 'Force sleep'} (S)
        </button>
        <div className="progress" aria-hidden="true"><span style={{ width: `${(100 * elapsed) / cfg.missionHours}%` }} /></div>
        <button onClick={onAbort}>Abort to planner</button>
      </div>
    </>
  );
}
