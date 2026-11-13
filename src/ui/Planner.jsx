// Site and date planner: pick the site and landing day, preview, pin up to 3 to compare.
import { bestPerRow, utcLabel } from './gameHelpers.js';
import { SkyBadge } from './Screens.jsx';

const ROWS = [
  ['sunlitPct', 'Sunlit', (v) => `${v.toFixed(0)}%`],
  ['earthPct', 'Earth in view', (v) => `${v.toFixed(0)}%`],
  ['longestDarkH', 'Longest darkness', (v) => `${v} h`],
  ['sunElAtLanding', 'Sun elevation at landing', (v) => `${v.toFixed(2)}°`],
  ['hoursToFirstSunset', 'First sunset in', (v) => (v === null ? 'none' : `${v} h`)],
  ['hoursToFirstEarthset', 'First Earthset in', (v) => (v === null ? 'none' : `${v} h`)],
];
const samePin = (a, b) => a.siteId === b.siteId && a.day === b.day;

export default function Planner({ mission, sites, site, statsBySite, day, minDay, pinned, slip, countdown, onSite, onDay, onPin, onUnpin, onLand, landLabel = 'Land', onBack }) {
  const stats = statsBySite[site.id];
  const s = stats[day];
  const days = mission.config.missionHours / 24;
  const pinStats = pinned.map((p) => statsBySite[p.siteId][p.day]);
  const best = bestPerRow(pinStats);
  const here = { siteId: site.id, day };
  const isPinned = pinned.some((p) => samePin(p, here));
  const siteName = (id) => sites.find((x) => x.id === id).name.replace('Training site ', '');
  return (
    <div className="panel planner" role="dialog" aria-label="Landing planner">
      <div className="kicker">Plan &middot; {mission.name}</div>
      {slip > 0 && (
        <div className="alert" role="alert">
          &#9888; LAUNCH SLIP: +{slip} days. Earliest landing is now day {minDay + 1}.
          {countdown !== null && <> Replan within <b>{countdown} s</b> or the slipped date is used.</>}
        </div>
      )}
      {sites.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Landing site">
          {sites.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === site.id} className={x.id === site.id ? 'on' : ''} onClick={() => onSite(x.id)}>
              {x.name.replace('Training site ', '')}
            </button>
          ))}
        </div>
      )}
      <div className="siteinfo">
        <span className="title">{site.name}</span> <span className="dim">{site.lat}&deg;, {site.lon}&deg; E</span>
        <SkyBadge site={site} />
        <div className="dim small">{site.blurb}</div>
      </div>
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
      <div className="dim small">Bar height = sunlit share of the {days}-day mission (amber). Underline = Earth in view (teal). ! = darkness longer than the battery survives asleep.</div>

      <div className="cards">
        <div className="card">
          <div className="title">Landing day {day + 1}</div>
          <div className="dim small">{utcLabel(site, day * 24)}</div>
          <table className="stats"><tbody>
            {ROWS.map(([k, label, fmt]) => <tr key={k}><th>{label}</th><td>{fmt(s[k])}</td></tr>)}
          </tbody></table>
          {s.exceedsSleepBudget && <div className="dark">&#9888; Darkness exceeds the sleep budget. You can still land.</div>}
          <div className="row">
            <button onClick={() => onPin(here)} disabled={isPinned || pinned.length >= 3}>
              {isPinned ? 'Pinned' : pinned.length >= 3 ? 'Tray full' : 'Pin to compare'}
            </button>
          </div>
        </div>
        {pinned.map((p, i) => (
          <div className="card pin" key={`${p.siteId}-${p.day}`}>
            <div className="title">Pinned: {siteName(p.siteId)}, day {p.day + 1}</div>
            <table className="stats"><tbody>
              {ROWS.map(([k, label, fmt]) => (
                <tr key={k} className={pinned.length > 1 && best[k] === i ? 'best' : ''}>
                  <th>{label}</th><td>{fmt(pinStats[i][k])}{pinned.length > 1 && best[k] === i ? ' ✓' : ''}</td>
                </tr>
              ))}
            </tbody></table>
            <div className="row">
              <button onClick={() => { onSite(p.siteId); onDay(p.day); }} disabled={p.day < minDay}>Select</button>
              <button onClick={() => onUnpin(p)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        {countdown === null && <button onClick={onBack}>Back</button>}
        <button className="primary" onClick={onLand}>{landLabel}: {siteName(site.id)}, day {day + 1}</button>
      </div>
    </div>
  );
}
