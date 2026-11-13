// Site and date planner: pick the landing day, preview it, pin up to 3 to compare.
import { bestPerRow, utcLabel } from './gameHelpers.js';

const ROWS = [
  ['sunlitPct', 'Sunlit', (v) => `${v.toFixed(0)}%`],
  ['earthPct', 'Earth in view', (v) => `${v.toFixed(0)}%`],
  ['longestDarkH', 'Longest darkness', (v) => `${v} h`],
  ['sunElAtLanding', 'Sun elevation at landing', (v) => `${v.toFixed(2)}°`],
  ['hoursToFirstSunset', 'First sunset in', (v) => (v === null ? 'none' : `${v} h`)],
  ['hoursToFirstEarthset', 'First Earthset in', (v) => (v === null ? 'none' : `${v} h`)],
];

export default function Planner({ site, stats, day, minDay, pinned, slip, countdown, onDay, onPin, onUnpin, onLand, onBack }) {
  const s = stats[day];
  const best = bestPerRow(pinned.map((d) => stats[d]));
  return (
    <div className="panel planner" role="dialog" aria-label="Landing planner">
      <div className="kicker">Plan &middot; {site.name}</div>
      {slip > 0 && (
        <div className="alert" role="alert">
          &#9888; LAUNCH SLIP: +{slip} days. Earliest landing is now day {minDay + 1}.
          {countdown !== null && <> Replan within <b>{countdown} s</b> or the slipped date is used.</>}
        </div>
      )}
      <div className="strip" role="radiogroup" aria-label="Landing day">
        {stats.map((d, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={i === day}
            aria-label={`Day ${i + 1}: ${d.sunlitPct.toFixed(0)}% sunlit, ${d.earthPct.toFixed(0)}% Earth in view${d.exceedsSleepBudget ? ', darkness warning' : ''}`}
            disabled={i < minDay}
            className={`cell${i === day ? ' on' : ''}`}
            onClick={() => onDay(i)}
          >
            <span className="sunbar" style={{ height: `${d.sunlitPct}%` }} />
            <span className="earthbar" style={{ width: `${d.earthPct}%` }} />
            <span className="n">{i + 1}{d.exceedsSleepBudget ? '!' : ''}</span>
          </button>
        ))}
      </div>
      <div className="dim small">Bar height = sunlit share of the 14-day mission (amber). Underline = Earth in view (teal). ! = darkness longer than the battery survives asleep.</div>

      <div className="cards">
        <div className="card">
          <div className="title">Landing day {day + 1}</div>
          <div className="dim small">{utcLabel(site, day * 24)}</div>
          <table className="stats"><tbody>
            {ROWS.map(([k, label, fmt]) => <tr key={k}><th>{label}</th><td>{fmt(s[k])}</td></tr>)}
          </tbody></table>
          {s.exceedsSleepBudget && <div className="dark">&#9888; Darkness exceeds the sleep budget. You can still land.</div>}
          <div className="row">
            <button onClick={() => onPin(day)} disabled={pinned.includes(day) || pinned.length >= 3}>
              {pinned.includes(day) ? 'Pinned' : pinned.length >= 3 ? 'Tray full' : 'Pin to compare'}
            </button>
          </div>
        </div>
        {pinned.map((d, i) => (
          <div className="card pin" key={d}>
            <div className="title">Pinned: day {d + 1}</div>
            <table className="stats"><tbody>
              {ROWS.map(([k, label, fmt]) => (
                <tr key={k} className={pinned.length > 1 && best[k] === i ? 'best' : ''}>
                  <th>{label}</th><td>{fmt(stats[d][k])}{pinned.length > 1 && best[k] === i ? ' ✓' : ''}</td>
                </tr>
              ))}
            </tbody></table>
            <div className="row">
              <button onClick={() => onDay(d)} disabled={d < minDay}>Select</button>
              <button onClick={() => onUnpin(d)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        {countdown === null && <button onClick={onBack}>Back</button>}
        <button className="primary" onClick={onLand}>Land on day {day + 1}</button>
      </div>
    </div>
  );
}
