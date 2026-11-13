// Title, mission select, briefing, "How it works", credits and debrief panels. Display only.
import { MISSIONS } from '../game/missions.js';
import { isUnlocked } from '../game/progress.js';
import { ASCII_QUALITY } from '../game/settings.js';

export function Stars({ n }) {
  return (
    <span className="starrow" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'lit' : 'dim'}>{i <= n ? '★' : '☆'}</span>)}
    </span>
  );
}

export function SkyBadge({ site }) {
  return (
    <>
      {site.terrain?.real && <div className="badge teal">Terrain: NASA LOLA</div>}
      {site.sky?.real && <div className="badge teal">Sky: SPICE DE440 &#10003; Horizons</div>}
      {site.illustrative && <div className="badge">Illustrative</div>}
    </>
  );
}

export function Title({ onStart, onHelp, onCredits, onSettings }) {
  return (
    <div className="panel center" role="dialog" aria-label="Title">
      <h1>CRATER EXPECTATIONS</h1>
      <p className="tag">Plan a landing at the Moon&rsquo;s south pole. Then live with it.</p>
      <div className="badge teal">Terrain and horizons: NASA LOLA</div>{' '}
      <div className="badge teal">Sun and Earth: SPICE DE440, checked against JPL Horizons</div>
      <div className="row">
        <button className="primary" onClick={onStart} autoFocus>Play</button>
        <button onClick={onHelp}>How it works</button>
        <button onClick={onSettings}>Settings</button>
        <button onClick={onCredits}>Data and credits</button>
      </div>
    </div>
  );
}

export function MissionSelect({ progress, onPick, onBack }) {
  return (
    <div className="panel center" role="dialog" aria-label="Mission select">
      <div className="kicker">Campaign</div>
      <h2>Choose a mission</h2>
      <div className="missions">
        {MISSIONS.map((m, i) => {
          const open = isUnlocked(progress, m.id);
          return (
            <button key={m.id} className="mission" disabled={!open} onClick={() => onPick(m.id)} autoFocus={i === 0}>
              <span className="kicker">Mission {i + 1} &middot; {m.teaches}</span>
              <span className="title">{m.name}</span>
              <span className="dim small">
                {m.siteIds.length} site{m.siteIds.length > 1 ? 's' : ''} &middot; {m.config.missionHours / 24} days
                {m.slipDays ? ' · launch slip' : ''}
              </span>
              {open ? <Stars n={progress[m.id] ?? 0} /> : <span className="dim small">&#128274; Locked: survive mission {i} first</span>}
            </button>
          );
        })}
      </div>
      <div className="row"><button onClick={onBack}>Back</button></div>
    </div>
  );
}

export function Brief({ mission, index, onNext, onBack }) {
  return (
    <div className="panel center" role="dialog" aria-label="Mission briefing">
      <div className="kicker">Mission {index + 1}</div>
      <h2>{mission.name}</h2>
      {mission.brief.map((p) => <p key={p}>{p}</p>)}
      <ul className="legend">
        <li><span className="lit">&#9728; Sunlit</span> battery charges, drilling possible</li>
        <li><span className="comms">&#9670; Earth in view</span> data can be transmitted</li>
        <li><span className="dark">&#9679; In shadow</span> battery drains; sleep to save power</li>
      </ul>
      <p className="dim small">Stars: 1 for surviving, 2 for returning 70% of the best possible science, 3 for 90%.</p>
      <div className="row">
        <button onClick={onBack}>Back</button>
        <button className="primary" onClick={onNext} autoFocus>Plan the landing</button>
      </div>
    </div>
  );
}

export function Help({ onClose }) {
  return (
    <div className="panel center help" role="dialog" aria-label="How it works">
      <h2>How it works</h2>
      <p><b>Horizon.</b> For each of 360 compass directions the game knows how high the terrain rises as seen from the lander. The Sun or Earth is visible only when its elevation is above the terrain in its direction.</p>
      <p><b>Sky.</b> Hourly Sun and Earth directions are computed with NASA&rsquo;s SPICE toolkit and the DE440 ephemeris for each site&rsquo;s coordinates, then checked against JPL Horizons. The game never moves them for drama.</p>
      <p><b>Terrain.</b> The map and the horizon come from NASA&rsquo;s LOLA laser-altimeter elevation model of the south pole. The horizon looks out to 250 km, because a distant ridge can hide a Sun that is only 1&deg; up.</p>
      <p><b>Simplifications.</b> The Sun counts as up when its centre clears the horizon (the real disc is about 0.5&deg; wide, so real sunrise is gradual). The lander&rsquo;s eye is 2 m above a 40 m terrain grid, so boulders and small bumps are not modelled. The 3D shadows drawn on the map use only the 10 km around the site and are a visual aid; the SUNLIT / IN SHADOW status is the calculated truth.</p>
      <p><b>Power.</b> Battery numbers are <b>game values</b>, balanced for play, not taken from a real lander. Sunlit hours charge; every hour drains; sleeping drains least.</p>
      <p><b>Science.</b> Drilling fills the data store in sunlight. Data scores only when transmitted with Earth in view. Transmitting in the dark costs battery you cannot get back until sunrise: use Force sleep.</p>
      <div className="row"><button className="primary" onClick={onClose} autoFocus>Close</button></div>
    </div>
  );
}

export function Credits({ sites, onClose }) {
  return (
    <div className="panel center help" role="dialog" aria-label="Data and credits">
      <h2>Data and credits</h2>
      <p><b>Sun and Earth positions (real).</b> NASA NAIF SPICE toolkit with kernels {sites[0]?.sky?.kernels?.join(', ')}. Frame {sites[0]?.sky?.frame}, apparent directions ({sites[0]?.sky?.aberration}), no atmosphere.</p>
      <table className="stats">
        <thead><tr><th>Site</th><td>Lat, lon</td><td>Max difference vs Horizons (Sun / Earth)</td></tr></thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id}>
              <th>{s.name}</th>
              <td>{s.lat}&deg;, {s.lon}&deg; E</td>
              <td>{s.sky.validation.sunMaxSeparationDeg}&deg; / {s.sky.validation.earthMaxSeparationDeg}&deg;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">Checked {sites[0]?.sky?.validation?.checkedUtc} against the JPL Horizons API, tolerance {sites[0]?.sky?.validation?.toleranceDeg}&deg;. The sites are high points this team found by searching the LOLA terrain. They are not official or proposed landing sites.</p>
      <p><b>Terrain and horizons (real).</b> NASA LOLA gridded elevation, PDS data set {sites[0]?.terrain?.dataSet}, product version {sites[0]?.terrain?.productVersion}: {sites[0]?.terrain?.horizonProducts?.join(' and ')}. Frame: {sites[0]?.terrain?.frame?.toLowerCase()}. Resampled to a local east/north grid; horizon computed out to {sites[0]?.terrain?.horizonRangeKm} km for an observer {sites[0]?.terrain?.eyeHeightM} m above the surface.</p>
      <p><b>Challenge resources.</b> JPL Horizons, LROC QuickMap, NASA Moon Trek, Canadian Space Agency Moon exploration pages.</p>
      <p><b>Sound.</b> All sounds are synthesised in the browser by this game&rsquo;s own code. No audio files or third-party assets are used.</p>
      <p><b>Built with.</b> React, three.js, Vite, SpiceyPy. AI coding assistance was used during development; see the team&rsquo;s AI use log.</p>
      <p className="dim small">Made for the NASA Space Apps Challenge 2026. Not affiliated with or endorsed by NASA.</p>
      <div className="row"><button className="primary" onClick={onClose} autoFocus>Close</button></div>
    </div>
  );
}

export function Settings({ settings, onChange, onTest, onClose }) {
  return (
    <div className="panel center help" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <div className="field">
        <label htmlFor="vol">Sound volume: {Math.round(settings.volume * 100)}%</label>
        <input id="vol" type="range" min="0" max="1" step="0.05" value={settings.volume}
          onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) })} />
        <div className="row" style={{ marginTop: 0 }}>
          <button aria-pressed={settings.muted} className={settings.muted ? 'on' : ''} onClick={() => onChange({ ...settings, muted: !settings.muted })}>
            {settings.muted ? 'Muted' : 'Mute'}
          </button>
          <button onClick={onTest}>Test sound</button>
        </div>
        <div className="dim small">Every sound also appears as text in the event feed.</div>
      </div>
      <fieldset className="field">
        <legend>ASCII terrain detail</legend>
        <div className="choices" role="radiogroup" aria-label="ASCII terrain detail">
          {ASCII_QUALITY.map((q) => (
            <button key={q.id} role="radio" aria-checked={settings.ascii === q.id} className={settings.ascii === q.id ? 'on' : ''}
              onClick={() => onChange({ ...settings, ascii: q.id })}>{q.label}</button>
          ))}
        </div>
        <div className="dim small">Lower detail runs faster. The game switches ASCII off by itself if the frame rate drops too low.</div>
      </fieldset>
      <div className="row"><button className="primary" onClick={onClose} autoFocus>Close</button></div>
    </div>
  );
}

const STAR_TEXT = ['Power down', 'Survived', 'Good plan', 'Near-perfect plan'];

export function Debrief({ result, onRetry, onNext, onMissions, onHelp }) {
  const { state, stars, best, bestSiteName, siteName, landingDay, slip, events, mission } = result;
  const count = (t) => events.filter((e) => e.type === t).length;
  return (
    <div className="panel center" role="dialog" aria-label="Debrief">
      <div className="kicker">Debrief &middot; {mission.name}</div>
      <h2 className={state.alive ? 'lit' : 'dark'}>{state.alive ? 'MISSION SURVIVED' : 'POWER DOWN'}</h2>
      <div className="stars"><Stars n={stars} /> <span className="dim">{STAR_TEXT[stars]}</span></div>
      <table className="stats">
        <tbody>
          <tr><th>Science returned</th><td>{state.score} packets</td></tr>
          <tr><th>Best automatic plan</th><td>{best.score} packets ({bestSiteName}, day {best.day + 1})</td></tr>
          <tr><th>Your landing</th><td>{siteName}, day {landingDay + 1}{slip ? ` (after a ${slip}-day slip)` : ''}</td></tr>
          <tr><th>Hours survived</th><td>{state.hour - state.startHour} of {state.config.missionHours}</td></tr>
          <tr><th>Battery at end</th><td>{Math.round((100 * state.battery) / state.config.batteryCapacity)}%</td></tr>
          <tr><th>Sunsets / Earthsets</th><td>{count('sunset')} / {count('earthset')}</td></tr>
          {!state.alive && <tr><th>Data lost on board</th><td>all unsent packets</td></tr>}
        </tbody>
      </table>
      {!state.alive && <p className="dim small">Tip: transmitting or staying awake in the dark drains the battery. Use Force sleep (S) before a long shadow, or pick a day with less darkness.</p>}
      <div className="row">
        {onNext && <button className="primary" onClick={onNext} autoFocus>Next mission</button>}
        <button className={onNext ? '' : 'primary'} onClick={onRetry} autoFocus={!onNext}>Replan and retry</button>
        <button onClick={onMissions}>Missions</button>
        <button onClick={onHelp}>How it works</button>
      </div>
    </div>
  );
}
