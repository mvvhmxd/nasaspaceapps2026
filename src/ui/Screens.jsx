// Title, briefing, "How it works" and debrief panels. Display only.
export function Title({ site, onStart, onHelp }) {
  return (
    <div className="panel center" role="dialog" aria-label="Title">
      <h1>CRATER EXPECTATIONS</h1>
      <p className="tag">Plan a landing at the Moon&rsquo;s south pole. Then live with it.</p>
      {site?.illustrative && <div className="badge">Illustrative terrain and sky &middot; not NASA data</div>}
      <div className="row">
        <button className="primary" onClick={onStart} autoFocus>Start mission</button>
        <button onClick={onHelp}>How it works</button>
      </div>
    </div>
  );
}

export function Brief({ mission, onNext, onBack }) {
  return (
    <div className="panel center" role="dialog" aria-label="Mission briefing">
      <div className="kicker">Mission 1</div>
      <h2>{mission.name}</h2>
      {mission.brief.map((p) => <p key={p}>{p}</p>)}
      <ul className="legend">
        <li><span className="lit">&#9728; Sunlit</span> battery charges, drilling possible</li>
        <li><span className="comms">&#9670; Earth in view</span> data can be transmitted</li>
        <li><span className="dark">&#9679; In shadow</span> battery drains, lander sleeps</li>
      </ul>
      <div className="row">
        <button onClick={onBack}>Back</button>
        <button className="primary" onClick={onNext} autoFocus>Plan the landing</button>
      </div>
    </div>
  );
}

export function Help({ site, onClose }) {
  return (
    <div className="panel center help" role="dialog" aria-label="How it works">
      <h2>How it works</h2>
      <p><b>Horizon.</b> For each of 360 compass directions the game knows how high the terrain rises as seen from the lander. The Sun or Earth is visible only when its elevation is above the terrain in its direction.</p>
      <p><b>Sky.</b> Sun and Earth positions are read hour by hour from the site file. The game never moves them for drama.</p>
      <p><b>Power.</b> Battery numbers are <b>game values</b>, balanced for play, not taken from a real lander. Sunlit hours charge; every hour drains; sleeping drains least.</p>
      <p><b>Science.</b> Drilling fills the data store in sunlight. Data scores only when transmitted with Earth in view. Data on board when the battery dies is lost.</p>
      <p><b>Data.</b> {site?.illustrative
        ? 'This site is ILLUSTRATIVE: procedural terrain and a synthetic Sun/Earth series for development. It is not NASA data.'
        : site?.source}</p>
      <p className="dim">Planned real-data pipeline: LOLA terrain, SPICE (DE440) positions, checked against JPL Horizons. Not affiliated with or endorsed by NASA.</p>
      <div className="row"><button className="primary" onClick={onClose} autoFocus>Close</button></div>
    </div>
  );
}

const STAR_TEXT = ['Power down', 'Survived', 'Good plan', 'Near-perfect plan'];

export function Debrief({ result, onRetry, onTitle, onHelp }) {
  const { state, stars, best, landingDay, bestDay, slip, events } = result;
  const count = (t) => events.filter((e) => e.type === t).length;
  return (
    <div className="panel center" role="dialog" aria-label="Debrief">
      <div className="kicker">Debrief</div>
      <h2 className={state.alive ? 'lit' : 'dark'}>{state.alive ? 'MISSION SURVIVED' : 'POWER DOWN'}</h2>
      <div className="stars" aria-label={`${stars} of 3 stars`}>
        {[1, 2, 3].map((i) => <span key={i} className={i <= stars ? 'lit' : 'dim'}>{i <= stars ? '★' : '☆'}</span>)}
        <span className="dim"> {STAR_TEXT[stars]}</span>
      </div>
      <table className="stats">
        <tbody>
          <tr><th>Science returned</th><td>{state.score} packets</td></tr>
          <tr><th>Best possible (auto plan)</th><td>{best.score} packets, landing day {bestDay + 1}</td></tr>
          <tr><th>Your landing</th><td>day {landingDay + 1}{slip ? ` (after a ${slip}-day launch slip)` : ''}</td></tr>
          <tr><th>Hours survived</th><td>{state.hour - state.startHour} of {state.config.missionHours}</td></tr>
          <tr><th>Battery at end</th><td>{Math.round((100 * state.battery) / state.config.batteryCapacity)}%</td></tr>
          <tr><th>Sunsets / Earthsets</th><td>{count('sunset')} / {count('earthset')}</td></tr>
          {!state.alive && <tr><th>Data lost on board</th><td>all unsent packets</td></tr>}
        </tbody>
      </table>
      <div className="row">
        <button className="primary" onClick={onRetry} autoFocus>Replan and retry</button>
        <button onClick={onHelp}>How it works</button>
        <button onClick={onTitle}>Title</button>
      </div>
    </div>
  );
}
