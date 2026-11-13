// Survival HUD: reads sim state, sends commands. Never computes game truth.
import { MODES } from '../sim/survival.js';
import { nextChange } from './gameHelpers.js';
import { ROVER } from '../sim/rover.js';

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
  iceCollected: ['comms', '\u25c8 Ice sample collected'],
  iceDelivered: ['comms', '\u25c8 Ice delivered to the lander'],
  roverLost: ['dark', '\u2716 Rover battery flat: rover lost'],
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

const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const toward = (dx, dz) => `${Math.round(Math.hypot(dx, dz))} m ${COMPASS8[Math.round(bearing(dx, dz) / 45) % 8]}`;

/** Rover battery, cargo and where to go next. */
export function RoverStatus({ rover, targets, speed }) {
  const pct = Math.round((100 * rover.battery) / ROVER.batteryCapacity);
  const level = pct < 15 ? 'crit' : pct < 35 ? 'low' : 'ok';
  const open = targets.filter((t) => !rover.collected.includes(t.id));
  const nearest = open.slice().sort((a, b) => Math.hypot(a.x - rover.x, a.z - rover.z) - Math.hypot(b.x - rover.x, b.z - rover.z))[0];
  let hint = 'Drive with W A S D or the arrow keys.';
  if (!rover.alive) hint = 'The rover is lost. The lander mission continues.';
  else if (speed !== 1) hint = 'The rover only drives at 1\u00d7 speed.';
  else if (rover.drill) hint = `Drilling ice: ${Math.round((100 * rover.drill.hours) / ROVER.drillHours)}%. Stay parked.`;
  else if (rover.carrying >= ROVER.maxCarry) hint = 'Cargo full. Return to the lander.';
  else if (rover.carrying > 0) hint = 'Carrying ice. Deliver it to the lander, or fetch one more.';
  else if (nearest && Math.hypot(nearest.x - rover.x, nearest.z - rover.z) <= ROVER.targetRadiusM) hint = 'On a prospect. Stop to drill.';
  return (
    <div className="hud static mission">
      <div className="title">Rover{rover.alive ? (rover.docked ? ' \u00b7 at the lander' : '') : ' \u00b7 LOST'}</div>
      <div className={`battery ${level}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Rover battery">
        <span style={{ width: `${pct}%` }} />
        <b>Rover battery {pct}%{level !== 'ok' ? ' \u26a0' : ''}</b>
      </div>
      <div className={rover.sunlit ? 'lit' : 'dark'}>{rover.sunlit ? '\u2600 Rover in sunlight: charging' : '\u25cf Rover in shadow: draining'}</div>
      <div>Ice on board: {rover.carrying} / {ROVER.maxCarry} &middot; <span className="comms">Delivered: {rover.delivered}</span> (+{ROVER.icePackets} science each)</div>
      <div className="dim">
        Lander: {toward(-rover.x, -rover.z)}
        {nearest ? <> &middot; Nearest prospect: {toward(nearest.x - rover.x, nearest.z - rover.z)} ({nearest.depthM} m down)</> : ' \u00b7 No prospects left'}
      </div>
      <div className="small">{hint}</div>
    </div>
  );
}

/** Event feed and time controls. */
export default function MissionHud({ sim, events, playing, speed, speeds, forceSleep, view, onPlay, onSpeed, onSleep, onView, onAbort }) {
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
          {forceSleep ? 'Wake lander' : 'Force sleep'} (Z)
        </button>
        <button className={view === 'surface' ? 'on' : ''} aria-pressed={view === 'surface'} onClick={onView}>
          {view === 'surface' ? 'Map view' : 'Surface view'} (V)
        </button>
        <span className="dim small">H hides panels</span>
        {view === 'surface' && (
          <span className="legend-row small" aria-label="Ground colours">
            <span><i className="sw sw-sun" /> sunlight: charges</span>
            <span><i className="sw sw-shade" /> shadow: drains</span>
            <span><i className="sw sw-lamp" /> rover light</span>
          </span>
        )}
        <div className="progress" aria-hidden="true"><span style={{ width: `${(100 * elapsed) / cfg.missionHours}%` }} /></div>
        <button onClick={onAbort}>Abort to planner</button>
      </div>
    </>
  );
}
