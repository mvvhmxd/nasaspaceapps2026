import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSite } from './data/loadSite.js';
import { stateAt } from './sim/visibility.js';
import { initialState, advance, MODES } from './sim/survival.js';
import { createSurfaceScene } from './render/scene.js';
import { MISSIONS, missionById } from './game/missions.js';
import { loadProgress, saveProgress, recordStars, nextMissionId, isUnlocked } from './game/progress.js';
import { dayStats, slipDay, starsFor, bestPlan, utcLabel } from './ui/gameHelpers.js';
import { Title, MissionSelect, Brief, Help, Credits, Settings, Debrief, SkyBadge } from './ui/Screens.jsx';
import Planner from './ui/Planner.jsx';
import Schedule from './ui/Schedule.jsx';
import { emptySchedule, planFrom } from './game/schedule.js';
import { ASCII_QUALITY, loadSettings, saveSettings } from './game/settings.js';
import { unlockAudio, setVolume, play } from './ui/audio.js';
import Compass from './ui/Compass.jsx';
import MissionHud, { MissionStatus } from './ui/MissionHud.jsx';

const SPEEDS = [1, 4, 16]; // game hours per 0.5 s (docs/features/survival-sim)
const TICK_MS = 500;
const ALL_SITE_IDS = [...new Set(MISSIONS.flatMap((m) => m.siteIds))];
const sleepPlan = () => MODES.ASLEEP;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug'); // ?debug shows fps and the render-vs-sim shadow check
const REPLAN_OVERRIDE = Number(params.get('replan')) || null; // ?replan=5 shortens the slip countdown for demos

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const simRef = useRef(null);
  const eventsRef = useRef([]);
  const [sites, setSites] = useState(null); // { id: site }
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState('title'); // title | missions | brief | planner | schedule | surface | debrief
  const [overlay, setOverlay] = useState(null); // 'help' | 'credits' | 'settings' | null
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettings] = useState(loadSettings);
  const [missionId, setMissionId] = useState(MISSIONS[0].id);
  const [siteId, setSiteId] = useState(MISSIONS[0].siteIds[0]);
  const [day, setDay] = useState(0);
  const [minDay, setMinDay] = useState(0);
  const [pinned, setPinned] = useState([]);
  const [schedule, setSchedule] = useState(() => emptySchedule(MISSIONS[0].config.missionHours));
  const planRef = useRef(null);
  const [slip, setSlip] = useState(0); // days of launch slip applied (0 = none yet)
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

  const mission = missionById(missionId);
  const cfg = mission.config;
  const site = sites?.[siteId] ?? null;

  function loadAll() {
    setError(null);
    Promise.all(ALL_SITE_IDS.map(loadSite)).then(
      (list) => setSites(Object.fromEntries(list.map((s) => [s.id, s]))),
      (e) => setError(String(e)),
    );
  }
  useEffect(loadAll, []);

  // One map per site: rebuilt when the selected site changes.
  useEffect(() => {
    if (!site) return;
    const s = createSurfaceScene(canvasRef.current, site, {
      onFps: setFps,
      onAsciiChange: setAsciiState,
      cellCss: ASCII_QUALITY.find((q) => q.id === settings.ascii)?.cell ?? 10,
      autoOff: params.get('ascii') !== 'force', // ?ascii=force keeps the ASCII look on slow machines (demos, screenshots)
    });
    if (params.get('ascii') === '0' || settings.ascii === 'off') s.setAscii(false);
    sceneRef.current = s;
    return () => { s.dispose(); sceneRef.current = null; };
  }, [site]);

  // Apply settings: sound level now, ASCII detail on the live map, and save them.
  useEffect(() => {
    setVolume(settings.volume, settings.muted);
    saveSettings(settings);
    const q = ASCII_QUALITY.find((x) => x.id === settings.ascii);
    if (!sceneRef.current || !q) return;
    if (q.cell) sceneRef.current.setCell(q.cell);
    sceneRef.current.setAscii(q.cell !== null && params.get('ascii') !== '0');
  }, [settings]);

  // Browsers only allow sound after a click or key press.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  const missionSites = useMemo(() => (sites ? mission.siteIds.map((id) => sites[id]) : []), [sites, mission]);
  const statsBySite = useMemo(
    () => Object.fromEntries(missionSites.map((s) => [s.id, dayStats(s, cfg.missionHours, cfg)])),
    [missionSites, cfg],
  );
  const best = useMemo(() => (missionSites.length ? bestPlan(missionSites, cfg) : null), [missionSites, cfg]);

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

  function resetPlan(id) {
    setSiteId(missionById(id).siteIds[0]);
    setDay(0);
    setMinDay(0);
    setPinned([]);
    setSchedule(emptySchedule(missionById(id).config.missionHours));
    setSlip(0);
    setSlipDone(false);
    setCountdown(null);
    setPlaying(false);
    setSim(null);
  }

  function pickMission(id) {
    if (!isUnlocked(progress, id)) return;
    setMissionId(id);
    resetPlan(id);
    setScreen('brief');
  }

  function startMission(landingDay) {
    const s = initialState(cfg, landingDay * 24);
    planRef.current = mission.schedule ? planFrom(schedule, landingDay * 24) : undefined;
    simRef.current = s;
    eventsRef.current = [];
    setSim(s);
    setEvents([]);
    setForceSleep(false);
    setCountdown(null);
    setPlaying(true);
    setScreen('surface');
    play('land');
  }

  function land() {
    if (mission.slipDays > 0 && !slipDone) {
      setSlipDone(true);
      const slipped = slipDay(day, mission.slipDays, site, cfg.missionHours);
      if (slipped > day) {
        setSlip(slipped - day);
        setMinDay(slipped);
        setDay(slipped);
        setCountdown(REPLAN_OVERRIDE ?? mission.replanSeconds);
        setScreen('planner');
        play('slip');
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
    setSim(null);
    setScreen('planner');
  }

  // Replan countdown after a launch slip. Paused while an overlay is open.
  useEffect(() => {
    if ((screen !== 'planner' && screen !== 'schedule') || countdown === null || overlay) return;
    if (countdown <= 0) { startMission(day); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [screen, countdown, overlay, day, schedule]);

  // Survival clock: every tick advances `speed` hours, one hour at a time inside advance().
  useEffect(() => {
    if (screen !== 'surface' || !playing || overlay || !site) return;
    const id = setInterval(() => {
      const r = advance(site, simRef.current, speed, forceSleep ? sleepPlan : planRef.current);
      simRef.current = r.state;
      setSim(r.state);
      if (r.events.length) {
        eventsRef.current = [...eventsRef.current, ...r.events];
        setEvents(eventsRef.current);
        // At 16x several events can land in one tick: play the two most important, not a pile-up.
        const order = ['powerDown', 'success', 'battery10', 'battery25', 'sunset', 'earthset', 'sunrise', 'earthrise'];
        [...new Set(r.events.map((e) => e.type))].sort((a, b) => order.indexOf(a) - order.indexOf(b)).slice(0, 2).forEach(play);
      }
      if (r.state.done) {
        const stars = starsFor(r.state, best.score, cfg.starThresholds);
        setPlaying(false);
        setResult({
          state: r.state, events: eventsRef.current, mission, stars, best, slip,
          siteName: site.name, bestSiteName: sites[best.siteId].name, landingDay: r.state.startHour / 24,
        });
        setProgress((p) => { const next = recordStars(p, mission.id, stars); saveProgress(next); return next; });
        setScreen('debrief');
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [screen, playing, overlay, site, speed, forceSleep, best, slip, mission, cfg, sites]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && overlay) setOverlay(null);
      if (screen !== 'surface' || overlay || e.target.closest?.('input, a')) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPlaying((p) => !p); }
      if ((e.key === 's' || e.key === 'S') && !e.repeat) setForceSleep((f) => !f);
    };
    // A focused button also "clicks" on Space key-up; stop that so Space toggles once.
    const onKeyUp = (e) => { if (screen === 'surface' && !overlay && e.code === 'Space') e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [screen, overlay]);

  if (error) {
    return (
      <div className="msg" role="alert">
        Could not load the landing sites: {error} <button onClick={loadAll}>Retry</button>
      </div>
    );
  }

  const agree = sky && renderBlocked !== null ? renderBlocked === !sky.sunlit : null;
  const next = nextMissionId(mission.id);
  const samePin = (a, b) => a.siteId === b.siteId && a.day === b.day;

  return (
    <div className="app">
      <canvas ref={canvasRef} className="view" aria-label="Top-down terrain map of the landing site" />
      {!sites && <div className="msg">Loading landing sites&hellip;</div>}
      {site && sky && (
        <>
          {(screen === 'planner' || screen === 'schedule' || screen === 'surface') && (
            <div className="stack-left">
              <div className="hud static">
                <div className="title">{site.name}</div>
                <SkyBadge site={site} />
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
            {DEBUG && <div>{fps} fps</div>}
            <div>
              <button className={ascii.on ? 'on' : ''} aria-pressed={ascii.on} onClick={() => sceneRef.current?.setAscii(!ascii.on)}>
                ASCII {ascii.on ? 'on' : 'off'} (A)
              </button>
              {ascii.reason === 'auto' && !ascii.on && <div className="dark">switched off: low fps</div>}
            </div>
            <div hidden={!DEBUG}>
              render check:{' '}
              {agree === null ? '…' : agree ? <span className="lit">agrees &#10003;</span> : <span className="dark">differs &#10007;</span>}
            </div>
            <button onClick={() => setOverlay('help')}>How it works</button>
            <button onClick={() => setOverlay('settings')}>Settings</button>
            {(screen === 'planner' || screen === 'schedule' || screen === 'surface') && <Compass sky={sky} />}
          </div>

          {screen === 'title' && (
            <Title onStart={() => setScreen('missions')} onHelp={() => setOverlay('help')} onCredits={() => setOverlay('credits')} onSettings={() => setOverlay('settings')} />
          )}
          {screen === 'missions' && <MissionSelect progress={progress} onPick={pickMission} onBack={() => setScreen('title')} />}
          {screen === 'brief' && (
            <Brief mission={mission} index={MISSIONS.indexOf(mission)} onBack={() => setScreen('missions')} onNext={() => setScreen('planner')} />
          )}
          {screen === 'planner' && (
            <Planner
              mission={mission} sites={missionSites} site={site} statsBySite={statsBySite}
              day={day} minDay={minDay} pinned={pinned} slip={slip} countdown={countdown}
              onSite={setSiteId} onDay={setDay}
              onPin={(p) => setPinned((list) => (list.some((x) => samePin(x, p)) || list.length >= 3 ? list : [...list, p]))}
              onUnpin={(p) => setPinned((list) => list.filter((x) => !samePin(x, p)))}
              onLand={mission.schedule ? () => setScreen('schedule') : land}
              landLabel={mission.schedule ? 'Schedule tasks' : 'Land'}
              onBack={() => setScreen('brief')}
            />
          )}
          {screen === 'schedule' && (
            <Schedule
              mission={mission} site={site} day={day} schedule={schedule} slip={slip} countdown={countdown}
              onChange={setSchedule} onLand={land} onBack={() => setScreen('planner')}
            />
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
            <Debrief
              result={result}
              onRetry={retry}
              onNext={result.stars >= 1 && next ? () => pickMission(next) : null}
              onMissions={() => { resetPlan(mission.id); setScreen('missions'); }}
              onHelp={() => setOverlay('help')}
            />
          )}
          {overlay && <div className="scrim" onClick={() => setOverlay(null)} />}
          {overlay === 'help' && <Help onClose={() => setOverlay(null)} />}
          {overlay === 'settings' && (
            <Settings settings={settings} onChange={setSettings} onTest={() => { unlockAudio(); play('sunrise'); }} onClose={() => setOverlay(null)} />
          )}
          {overlay === 'credits' && <Credits sites={Object.values(sites)} onClose={() => setOverlay(null)} />}
        </>
      )}
    </div>
  );
}
