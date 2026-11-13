// Task schedule: paint Drill / Transmit / Sleep onto 6-hour blocks and see the forecast.
// Display and input only: the forecast comes from src/game/schedule.js, which runs the real sim.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_H, TOOLS, blockSky, forecast, isWasted, emptySchedule } from '../game/schedule.js';

const toolFor = (mode) => TOOLS.find((t) => t.mode === mode);

export default function Schedule({ mission, site, day, schedule, slip, countdown, onChange, onLand, onBack }) {
  const cfg = mission.config;
  const start = day * 24;
  const [tool, setTool] = useState(TOOLS[3].mode); // Sleep: the most useful first move
  const painting = useRef(false);
  const sky = useMemo(() => blockSky(site, start, cfg.missionHours), [site, start, cfg]);
  const fc = useMemo(() => forecast(site, cfg, start, schedule), [site, cfg, start, schedule]);
  const auto = useMemo(() => forecast(site, cfg, start, emptySchedule(cfg.missionHours)), [site, cfg, start]);

  useEffect(() => {
    const stop = () => { painting.current = false; };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const paint = (i) => {
    if (schedule[i] === tool) return;
    const next = schedule.slice();
    next[i] = tool;
    onChange(next);
  };
  const wasted = schedule.filter((m, i) => isWasted(m, sky[i])).length;
  const blocksPerDay = 24 / BLOCK_H;

  return (
    <div className="panel planner" role="dialog" aria-label="Task schedule">
      <div className="kicker">Schedule &middot; {mission.name} &middot; {site.name.replace('Training site ', '')}, day {day + 1}</div>
      {slip > 0 && countdown !== null && (
        <div className="alert" role="alert">&#9888; LAUNCH SLIP: +{slip} days. Landing in <b>{countdown} s</b> with this schedule.</div>
      )}
      <div className="tools" role="radiogroup" aria-label="Task to paint">
        {TOOLS.map((t) => (
          <button key={t.key} role="radio" aria-checked={t.mode === tool} className={`tool m-${t.key}${t.mode === tool ? ' on' : ''}`} onClick={() => setTool(t.mode)}>
            <b>{t.key}</b> {t.label}
          </button>
        ))}
        <button onClick={() => onChange(emptySchedule(cfg.missionHours))}>Reset to automatic</button>
      </div>
      <div className="timeline" style={{ '--blocks': schedule.length }}>
        <div className="tl-label">Day</div>
        <div className="tl-row">
          {schedule.map((_, i) => <span key={i} className="tl-day">{i % blocksPerDay === 0 ? i / blocksPerDay + 1 : ''}</span>)}
        </div>
        <div className="tl-label lit">&#9728; Sun</div>
        <div className="tl-row" aria-hidden="true">
          {sky.map((b, i) => <span key={i} className="tl-sky sun" style={{ opacity: 0.12 + 0.88 * (b.sun / b.hours) }} />)}
        </div>
        <div className="tl-label comms">&#9670; Earth</div>
        <div className="tl-row" aria-hidden="true">
          {sky.map((b, i) => <span key={i} className="tl-sky earth" style={{ opacity: 0.12 + 0.88 * (b.earth / b.hours) }} />)}
        </div>
        <div className="tl-label">Plan</div>
        <div className="tl-row">
          {schedule.map((m, i) => {
            const t = toolFor(m);
            const bad = isWasted(m, sky[i]);
            return (
              <button
                key={i}
                className={`tl-block m-${t.key}${bad ? ' bad' : ''}`}
                aria-label={`Day ${Math.floor(i / blocksPerDay) + 1}, hours ${(i % blocksPerDay) * BLOCK_H} to ${(i % blocksPerDay) * BLOCK_H + BLOCK_H}: ${t.label}. Sun ${sky[i].sun} of ${sky[i].hours} hours, Earth ${sky[i].earth}.${bad ? ' Cannot run here.' : ''}`}
                onPointerDown={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); painting.current = true; paint(i); }}
                onPointerEnter={() => painting.current && paint(i)}
                onClick={() => paint(i)}
              >
                {t.key}{bad ? '!' : ''}
              </button>
            );
          })}
        </div>
        <div className="tl-label">Battery</div>
        <div className="tl-row batt" aria-hidden="true">
          {fc.batteryPct.map((pct, i) => (
            <span key={i} className={`tl-batt${pct <= 0 ? ' dead' : pct < 25 ? ' low' : ''}`}><i style={{ height: `${Math.max(pct, 4)}%` }} /></span>
          ))}
        </div>
      </div>
      <div className="dim small">Click or drag across the Plan row to paint 6-hour blocks. Automatic drills in sunlight, transmits when Earth is up and sleeps in the dark. ! = that task cannot run in that block.</div>
      <div className="forecast" aria-live="polite">
        <span className={fc.state.alive ? 'lit' : 'dark'}>
          {fc.state.alive ? '✓ Forecast: survives' : `✖ Forecast: power down at hour ${fc.powerDownHour}`}
        </span>
        <span>Science returned: <b>{fc.state.score}</b> packets</span>
        <span>Lowest battery: <b>{Math.round(fc.minPct)}%</b></span>
        <span className="dim">All-automatic: {auto.state.alive ? `${auto.state.score} packets` : 'power down'}</span>
        {wasted > 0 && <span className="dark">&#9888; {wasted} block{wasted > 1 ? 's' : ''} cannot run</span>}
      </div>
      <div className="row">
        {countdown === null && <button onClick={onBack}>Back to planner</button>}
        <button className="primary" onClick={onLand}>Land with this schedule</button>
      </div>
    </div>
  );
}
