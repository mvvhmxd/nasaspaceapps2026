import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSite } from './data/loadSite.js';
import { stateAt } from './sim/visibility.js';
import { initialState, advance, MODES } from './sim/survival.js';
import { findIceTargets, initialRover, stepRover, iceScore } from './sim/rover.js';
import { createSurfaceScene } from './render/scene.js';
import { MISSIONS, missionById } from './game/missions.js';
import { loadProgress, saveProgress, recordStars, nextMissionId, isUnlocked } from './game/progress.js';
import { dayStats, slipDay, starsFor, bestPlan, utcLabel } from './ui/gameHelpers.js';
import { Title, MissionSelect, Brief, Help, Credits, Settings, Debrief, SkyBadge } from './ui/Screens.jsx';
import Planner from './ui/Planner.jsx';
import Schedule from './ui/Schedule.jsx';
import { emptySchedule, planFrom } from './game/schedule.js';
import { loadSettings, saveSettings } from './game/settings.js';
import { unlockAudio, setVolume, play } from './ui/audio.js';
import Compass from './ui/Compass.jsx';
import MissionHud, { MissionStatus, RoverStatus } from './ui/MissionHud.jsx';
import { initialQuality } from './render/quality.js';
import AsciiQuality from './ui/AsciiQuality.jsx';

const SPEEDS = [1, 4, 16]; // game hours per 0.5 s (docs/features/survival-sim)
const TICK_MS = 500;
const ROVER_STEP_MS = 50; // rover moves in small steps between the hourly sim ticks
const DRIVE_KEYS = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
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
  const roverRef = useRef(null);
  const keysRef = useRef(new Set());
  const [rover, setRover] = useState(null);
  const [view, setView] = useState('map');
  const [hudHidden, setHudHidden] = useState(false);
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
  const [ascii, setAsciiState] = useState(() => {
    // ?ascii=0 and ?quality= win, then the player's saved setting.
    const quality = initialQuality(location.search, { getItem: () => loadSettings().ascii });
    return { on: quality !== 'off', reason: 'user', quality };
  });

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
      onAsciiChange: (a) => {
        setAsciiState(a);
        // A player's choice (menu, Settings or G) is saved in settings; low-fps steps are not.
        if (a.reason === 'user') setSettings((cur) => (cur.ascii === a.quality ? cur : { ...cur, ascii: a.quality }));
      },
      quality: ascii.quality, // ?quality=high|balanced|performance|off, ?ascii=0, or the saved setting
      cellCss: Number(params.get('cell')) || undefined, // ?cell=8 overrides the preset's cell size
      autoOff: params.get('ascii') !== 'force', // ?ascii=force keeps the quality fixed on slow machines (demos, screenshots)
    });
    sceneRef.current = s;
    return () => { s.dispose(); sceneRef.current = null; };
  }, [site]);

  // Apply settings: sound level now, ASCII detail on the live map, and save them.
  useEffect(() => {
    setVolume(settings.volume, settings.muted);
    saveSettings(settings);
    const sc = sceneRef.current;
    if (sc && params.get('ascii') !== '0' && sc.quality !== settings.ascii) sc.setQuality(settings.ascii);
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
  const targets = useMemo(() => (site ? findIceTargets(site) : []), [site]);

  // The hour shown on the map: the sim's hour while flying, else the planned landing hour.
  const inMission = (screen === 'surface' || screen === 'debrief') && sim;
  const viewHour = site ? Math.min(inMission ? sim.hour : day * 24, site.hours - 1) : 0;
  const sky = site ? stateAt(site, viewHour) : null;

  useEffect(() => {
    if (!sky || !sceneRef.current) return;
    const { renderBlocked: rb } = sceneRef.current.setSun(sky.sunAz, sky.sunEl, {
      farBlocked: sky.sunBehindFarTerrain,
    });
    setRenderBlocked(rb);
    sceneRef.current.setLanderInShadow(!sky.sunlit); // the sim decides
    sceneRef.current.setEarth(sky.earthAz, sky.earthEl);
  }, [site, sky?.hour]);

  // Rover, prospects and view on the map: only while a mission is running.
  const onSurface = screen === 'surface' && !!rover;
  const collectedKey = rover?.collected.join(',') ?? '';
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setRover(onSurface ? rover : null);
    sc.setView(onSurface ? view : 'map');
  }, [site, onSurface, rover, view]);
  useEffect(() => {
    sceneRef.current?.setProspects(onSurface ? targets : [], onSurface ? rover.collected : []);
  }, [site, onSurface, targets, collectedKey]);

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
    roverRef.current = initialRover();
    if (DEBUG && params.get('rover')) { // ?debug&rover=x,z starts the rover somewhere else (testing)
      const [x, z] = params.get('rover').split(',').map(Number);
      roverRef.current = { ...roverRef.current, x, z, docked: false };
    }
    setRover(roverRef.current);
    setView('map');
    keysRef.current.clear();
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
        const ice = iceScore(roverRef.current);
        const total = r.state.score + ice;
        const stars = starsFor({ ...r.state, score: total }, best.score, cfg.starThresholds);
        setPlaying(false);
        setResult({
          state: r.state, events: eventsRef.current, mission, stars, best, slip, rover: roverRef.current, ice, total,
          siteName: site.name, bestSiteName: sites[best.siteId].name, landingDay: r.state.startHour / 24,
        });
        setProgress((p) => { const next = recordStars(p, mission.id, stars); saveProgress(next); return next; });
        setScreen('debrief');
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [screen, playing, overlay, site, speed, forceSleep, best, slip, mission, cfg, sites]);

  // Rover clock: small steps so driving is smooth. The rover only takes input at 1x speed.
  useEffect(() => {
    if (screen !== 'surface' || !playing || overlay || !site) return;
    const id = setInterval(() => {
      const cur = roverRef.current;
      if (!cur || !simRef.current || simRef.current.done) return;
      const k = keysRef.current, sc = sceneRef.current;
      const input = { east: 0, north: 0 };
      if (speed === 1 && cur.alive) {
        const f = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0);
        const side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        if (sc?.view === 'surface') {
          if (side) sc.turn(side * 2.5);
          const a = (sc.yaw * Math.PI) / 180;
          input.east = Math.sin(a) * f;
          input.north = Math.cos(a) * f;
        } else {
          input.east = side;
          input.north = f;
        }
      }
      const hour = Math.min(simRef.current.hour, site.hours - 1);
      const r = stepRover(site, cur, input, (ROVER_STEP_MS / TICK_MS) * speed, stateAt(site, hour), targets);
      if (r.rover === cur) return;
      roverRef.current = r.rover;
      setRover(r.rover);
      if (r.events.length) {
        eventsRef.current = [...eventsRef.current, ...r.events.map((type) => ({ hour, type }))];
        setEvents(eventsRef.current);
        r.events.forEach(play);
      }
    }, ROVER_STEP_MS);
    return () => clearInterval(id);
  }, [screen, playing, overlay, site, speed, targets]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && overlay) setOverlay(null);
      if (screen !== 'surface' || overlay || e.target.closest?.('input, a')) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPlaying((p) => !p); }
      if (e.code === 'KeyZ' && !e.repeat) setForceSleep((f) => !f);
      if (e.code === 'KeyV' && !e.repeat) setView((v) => (v === 'map' ? 'surface' : 'map'));
      if (e.code === 'KeyH' && !e.repeat) setHudHidden((h) => !h);
      if (DRIVE_KEYS[e.code]) { e.preventDefault(); keysRef.current.add(DRIVE_KEYS[e.code]); }
    };
    const onRelease = (e) => { if (DRIVE_KEYS[e.code]) keysRef.current.delete(DRIVE_KEYS[e.code]); };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener('keyup', onRelease);
    window.addEventListener('blur', onBlur);
    // A focused button also "clicks" on Space key-up; stop that so Space toggles once.
    const onKeyUp = (e) => { if (screen === 'surface' && !overlay && e.code === 'Space') e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('keyup', onRelease); window.removeEventListener('blur', onBlur);
    };
  }, [screen, overlay]);

  if (error) {
    return (
      <div className="msg" role="alert">
        Could not load the landing sites: {error} <button onClick={loadAll}>Retry</button>
      </div>
    );
  }

  // The crop can only cast shadows from terrain inside it, so the render is
  // checked against the near horizon; far-terrain shadows are labelled instead.
  const agree = sky && renderBlocked !== null ? renderBlocked === sky.sunEl <= sky.sunNearMask : null;
  const next = nextMissionId(mission.id);
  const samePin = (a, b) => a.siteId === b.siteId && a.day === b.day;

  return (
    <div className={`app${hudHidden && screen === 'surface' ? ' nohud' : ''}`}>
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
                <div>Sun az {sky.sunAz.toFixed(1)}&deg; el {sky.sunEl.toFixed(2)}&deg; &middot; horizon {sky.sunMask.toFixed(2)}&deg;</div>
                <div className={sky.sunlit ? 'lit' : 'dark'}>{sky.sunlit ? '☀ SUNLIT' : sky.sunBehindFarTerrain ? '● IN SHADOW (far terrain)' : '● IN SHADOW'}</div>
                <div className={sky.earthVisible ? 'comms' : 'dark'}>
                  {sky.earthVisible ? '◆ EARTH IN VIEW' : '◇ NO EARTH CONTACT'} (el {sky.earthEl.toFixed(1)}&deg;)
                </div>
              </div>
              {screen === 'surface' && sim && <MissionStatus site={site} sim={sim} sky={sky} forceSleep={forceSleep} />}
              {screen === 'surface' && rover && <RoverStatus rover={rover} targets={targets} speed={speed} />}
            </div>
          )}
          <div className="hud top-right">
            {DEBUG && <div>{fps} fps</div>}
            <AsciiQuality ascii={ascii} onChange={(q) => sceneRef.current?.setQuality(q)} />
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
              playing={playing} speed={speed} speeds={SPEEDS} forceSleep={forceSleep} view={view}
              onView={() => setView((v) => (v === 'map' ? 'surface' : 'map'))}
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
