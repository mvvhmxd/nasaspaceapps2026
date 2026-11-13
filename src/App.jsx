import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSite } from './data/loadSite.js';
import { stateAt } from './sim/visibility.js';
import { SIM_CONFIG } from './sim/config.js';
import { initialState, advance, MODES } from './sim/survival.js';
import { bestStart } from './sim/solver.js';
import { createSurfaceScene } from './render/scene.js';
import { MISSIONS } from './game/missions.js';
import { dayStats, slipDay, starsFor, utcLabel } from './ui/gameHelpers.js';
import { Title, Brief, Help, Debrief } from './ui/Screens.jsx';
import Planner from './ui/Planner.jsx';
import MissionHud, { MissionStatus } from './ui/MissionHud.jsx';

const SPEEDS = [1, 4, 16]; // game hours per 0.5 s (docs/features/survival-sim)
const TICK_MS = 500;
const mission = MISSIONS[0];
const sleepPlan = () => MODES.ASLEEP;

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const simRef = useRef(null);
  const eventsRef = useRef([]);
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState('title'); // title | brief | planner | surface | debrief
  const [help, setHelp] = useState(false);
  const [day, setDay] = useState(0);
  const [minDay, setMinDay] = useState(0);
  const [pinned, setPinned] = useState([]);
  const [slip, setSlip] = useState(0); // days of launch slip applied (0 = not yet)
  const [slipDone, setSlipDone] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [sim, setSim] = useState(null);
  const [events, setEvents] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [forceSleep, setForceSleep] = useState(false);
  const [result, setResult] = useState(null);
  const [fps, setFps] = useState(0);
  const [renderBlocked, setRenderBlocked] = useState(null);
  const [ascii, setAsciiState] = useState({ on: true, reason: 'user' });

  useEffect(() => {
    loadSite(mission.siteId).then(setSite, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!site) return;
    const params = new URLSearchParams(location.search);
    const s = createSurfaceScene(canvasRef.current, site, {
      onFps: setFps,
      onAsciiChange: setAsciiState,
      cellCss: Number(params.get('cell')) || 10, // ?cell=8 for denser glyphs, 12 for bigger type
    });
    if (params.get('ascii') === '0') s.setAscii(false);
    sceneRef.current = s;
    return () => s.dispose();
  }, [site]);

  const stats = useMemo(() => (site ? dayStats(site, SIM_CONFIG.missionHours) : []), [site]);
  const best = useMemo(() => (site ? bestStart(site) : null), [site]);

  // The hour shown on the map: the sim's hour while flying, else the planned landing hour.
  const inMission = (screen === 'surface' || screen === 'debrief') && sim;
  const viewHour = site ? Math.min(inMission ? sim.hour : day * 24, site.hours - 1) : 0;
  const sky = site ? stateAt(site, viewHour) : null;

  useEffect(() => {
    if (!sky || !sceneRef.current) return;
    const { renderBlocked: rb } = sceneRef.current.setSun(sky.sunAz, sky.sunEl);
    setRenderBlocked(rb);
    sceneRef.current.setLanderInShadow(!sky.sunlit); // the sim decides
  }, [site, sky?.hour]);

  function startMission(landingDay) {
    const s = initialState(SIM_CONFIG, landingDay * 24);
    simRef.current = s;
    setSim(s);
    eventsRef.current = [];
    setEvents([]);
    setForceSleep(false);
    setCountdown(null);
    setPlaying(true);
    setScreen('surface');
  }

  function land() {
    if (!slipDone) {
      setSlipDone(true);
      const slipped = slipDay(day, mission.slipDays, site, SIM_CONFIG.missionHours);
      if (slipped > day) {
        setSlip(slipped - day);
        setMinDay(slipped);
        setDay(slipped);
        setCountdown(mission.replanSeconds);
        return; // back to the planner with the clock running
      }
    }
    startMission(day);
  }

  function retry() {
    setSlip(0);
    setSlipDone(false);
    setMinDay(0);
    setCountdown(null);
    setPlaying(false);
    setScreen('planner');
  }

  // Replan countdown after a launch slip. Paused while "How it works" is open.
  useEffect(() => {
    if (screen !== 'planner' || countdown === null || help) return;
    if (countdown <= 0) { startMission(day); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [screen, countdown, help, day]);

  // Survival clock: every tick advances `speed` hours, one hour at a time inside advance().
  useEffect(() => {
    if (screen !== 'surface' || !playing || help || !site) return;
    const id = setInterval(() => {
      const r = advance(site, simRef.current, speed, forceSleep ? sleepPlan : undefined);
      simRef.current = r.state;
      setSim(r.state);
      if (r.events.length) {
        eventsRef.current = [...eventsRef.current, ...r.events];
        setEvents(eventsRef.current);
      }
      if (r.state.done) {
        setPlaying(false);
        setResult({
          state: r.state,
          events: eventsRef.current,
          best,
          bestDay: Math.floor(best.startHour / 24),
          landingDay: r.state.startHour / 24,
          slip,
          stars: starsFor(r.state, best.score, SIM_CONFIG.starThresholds),
        });
        setScreen('debrief');
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [screen, playing, help, site, speed, forceSleep, best, slip]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && help) setHelp(false);
      if (screen !== 'surface' || help || e.target.closest?.('input, a')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === 's' || e.key === 'S') setForceSleep((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, help]);

  if (error) {
    return (
      <div className="msg" role="alert">
        Could not load site: {error} <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  }

  const agree = sky && renderBlocked !== null ? renderBlocked === !sky.sunlit : null;

  return (
    <div className="app">
      <canvas ref={canvasRef} className="view" aria-label="Top-down terrain map of the landing site" />
      {!site && <div className="msg">Loading site&hellip;</div>}
      {site && sky && (
        <>
          {(screen === 'planner' || screen === 'surface') && (
            <div className="stack-left">
            <div className="hud static">
              <div className="title">{site.name}</div>
              {site.illustrative && <div className="badge">Illustrative</div>}
              <div>{utcLabel(site, sky.hour)}</div>
              <div>Sun az {sky.sunAz.toFixed(1)}&deg; el {sky.sunEl.toFixed(2)}&deg; &middot; ridge {sky.sunMask.toFixed(2)}&deg;</div>
              <div className={sky.sunlit ? 'lit' : 'dark'}>{sky.sunlit ? '☀ SUNLIT' : '● IN SHADOW'}</div>
              <div className={sky.earthVisible ? 'comms' : 'dark'}>
                {sky.earthVisible ? '◆ EARTH IN VIEW' : '◇ NO EARTH CONTACT'} (el {sky.earthEl.toFixed(1)}&deg;)
              </div>
            </div>
            {screen === 'surface' && sim && <MissionStatus site={site} sim={sim} sky={sky} forceSleep={forceSleep} />}
            </div>
          )}
          <div className="hud top-right">
            <div>{fps} fps</div>
            <div>
              <button className={ascii.on ? 'on' : ''} aria-pressed={ascii.on} onClick={() => sceneRef.current?.setAscii(!ascii.on)}>
                ASCII {ascii.on ? 'on' : 'off'} (A)
              </button>
              {ascii.reason === 'auto' && !ascii.on && <div className="dark">switched off: low fps</div>}
            </div>
            <div>
              render check:{' '}
              {agree === null ? '…' : agree ? <span className="lit">agrees &#10003;</span> : <span className="dark">differs &#10007;</span>}
            </div>
            <button onClick={() => setHelp(true)}>How it works</button>
          </div>

          {screen === 'title' && <Title site={site} onStart={() => setScreen('brief')} onHelp={() => setHelp(true)} />}
          {screen === 'brief' && <Brief mission={mission} onBack={() => setScreen('title')} onNext={() => setScreen('planner')} />}
          {screen === 'planner' && stats.length > 0 && (
            <Planner
              site={site} stats={stats} day={day} minDay={minDay} pinned={pinned} slip={slip} countdown={countdown}
              onDay={setDay}
              onPin={(d) => setPinned((p) => (p.includes(d) || p.length >= 3 ? p : [...p, d]))}
              onUnpin={(d) => setPinned((p) => p.filter((x) => x !== d))}
              onLand={land}
              onBack={() => setScreen('brief')}
            />
          )}
          {screen === 'planner' && stats.length === 0 && (
            <div className="panel center" role="alert">This site&rsquo;s data is shorter than one mission. No landing day is available.</div>
          )}
          {screen === 'surface' && sim && (
            <MissionHud
              sim={sim} events={events}
              playing={playing} speed={speed} speeds={SPEEDS} forceSleep={forceSleep}
              onPlay={() => setPlaying((p) => !p)} onSpeed={setSpeed}
              onSleep={() => setForceSleep((f) => !f)} onAbort={retry}
            />
          )}
          {screen === 'debrief' && result && (
            <Debrief result={result} onRetry={retry} onTitle={() => { retry(); setScreen('title'); }} onHelp={() => setHelp(true)} />
          )}
          {help && <><div className="scrim" onClick={() => setHelp(false)} /><Help site={site} onClose={() => setHelp(false)} /></>}
        </>
      )}
    </div>
  );
}
