import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSite } from './data/loadSite.js';
import { stateAt } from './sim/visibility.js';
import { createSurfaceScene } from './render/scene.js';
import { initialQuality, saveQuality } from './render/quality.js';
import AsciiQuality from './ui/AsciiQuality.jsx';
import MapLegend from './ui/MapLegend.jsx';
import HorizonStrip from './ui/HorizonStrip.jsx';
import { skyAt, createDisplayClock } from './render/skyClock.js';

function safeStorage() {
  try { return window.localStorage; } catch { return undefined; }
}

const SPEEDS = [1, 4, 16]; // game hours per 0.5 s (docs/features/survival-sim)
const TICK_MS = 500;
const EASE_MS = 450; // display easing per hourly step; settles before the next tick

const reducedMotionQuery = () => window.matchMedia?.('(prefers-reduced-motion: reduce)');

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [scene, setScene] = useState(null);
  const stripRef = useRef(null);
  const fpsRef = useRef(null);
  // Display clock: eases the Sun / Earth positions toward each new sim hour.
  const clockRef = useRef(null);
  if (!clockRef.current) {
    clockRef.current = createDisplayClock({ durationMs: EASE_MS, reducedMotion: !!reducedMotionQuery()?.matches });
  }
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);
  // ?h=<hour> opens at a given hour (handy for demos and screenshots).
  const [hour, setHour] = useState(() => Number(new URLSearchParams(location.search).get('h')) || 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ascii, setAsciiState] = useState(() => {
    const quality = initialQuality(location.search, safeStorage());
    return { on: quality !== 'off', reason: 'user', quality };
  });

  useEffect(() => {
    loadSite('demo').then(setSite, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!site) return;
    const params = new URLSearchParams(location.search);
    const s = createSurfaceScene(canvasRef.current, site, {
      // Written straight to the DOM: an fps reading every 0.5 s must not re-render the app.
      onFps: (f) => { if (fpsRef.current) fpsRef.current.textContent = `${f} fps`; },
      onAsciiChange: (a) => {
        setAsciiState(a);
        if (a.reason === 'user') saveQuality(a.quality, safeStorage()); // low-fps steps aren't saved
      },
      quality: ascii.quality, // ?quality=high|balanced|performance|off, ?ascii=0, or the saved choice
      cellCss: Number(params.get('cell')) || undefined, // ?cell=8 overrides the preset's cell size
    });
    sceneRef.current = s;
    setScene(s);
    clockRef.current.jump(hour, performance.now()); // first frame: no easing from hour 0

    // Smooth frames between hourly samples. Positions only; truth stays hourly.
    let easing = false;
    const off = s.onFrame((now) => {
      const clock = clockRef.current;
      if (clock.animating(now)) {
        easing = true;
        const sample = skyAt(site, clock.value(now));
        s.setSkySmooth(sample);
        stripRef.current?.setSky({ ...sample, ...truthRef.current });
      } else if (easing) {
        easing = false; // settled: land exactly on the sim's whole-hour state
        const exact = skyAt(site, clock.value(now));
        s.setSkySmooth(exact, { final: true });
        stripRef.current?.setSky({ ...exact, ...truthRef.current });
      }
    });
    return () => { off(); s.dispose(); setScene(null); };
  }, [site]);

  const state = useMemo(() => (site ? stateAt(site, hour) : null), [site, hour]);
  // The sim's truth flags for the hour on screen (the lander, the pointers and the
  // strip markers show these, never an interpolated guess).
  const truthRef = useRef(null);
  truthRef.current = state && { sunlit: state.sunlit, earthVisible: state.earthVisible };

  // Render check (raycast against the terrain mesh), computed with the hour so the
  // HUD needs one render per hour, not two. A read of the scene, no side effects.
  const renderBlocked = useMemo(
    () => (scene && state ? scene.checkSun(state.sunAz, state.sunEl).renderBlocked : null),
    [scene, state],
  );

  useEffect(() => {
    if (!state || !scene) return;
    scene.setLanderInShadow(!state.sunlit); // the sim decides
    scene.setSky(state); // pointer flags (and positions, until easing moves them)
    const now = performance.now();
    const clock = clockRef.current;
    clock.setTarget(state.hour, now);
    if (!clock.animating(now)) {
      // Snapped (reduced motion, scrub backwards, long jump): show the hour at once.
      scene.setSkySmooth(state, { final: true });
      stripRef.current?.setSky(state);
    }
  }, [scene, state]);

  // Follow the OS reduced-motion setting live.
  useEffect(() => {
    const mq = reducedMotionQuery();
    if (!mq) return;
    const onChange = () => { clockRef.current.reducedMotion = mq.matches; };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const onQuality = useCallback((q) => sceneRef.current?.setQuality(q), []);

  useEffect(() => {
    if (!playing || !site) return;
    const id = setInterval(() => {
      setHour((h) => (h + speed >= site.hours ? 0 : h + speed));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, site]);

  if (error) return <div className="msg">Could not load site: {error}</div>;

  const agree = state && renderBlocked !== null ? renderBlocked === !state.sunlit : null;

  return (
    <div className="app">
      <canvas ref={canvasRef} className="view" />
      {site && state && (
        <>
          <div className="hud top-left">
            <div className="title">{site.name}</div>
            {site.illustrative && <div className="badge">Illustrative</div>}
            <div>{state.timeUtc.toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
            <div>
              Sun az {state.sunAz.toFixed(1)}° el {state.sunEl.toFixed(2)}° · ridge {state.sunMask.toFixed(2)}°
            </div>
            <div className={state.sunlit ? 'lit' : 'dark'}>
              {state.sunlit ? '☀ SUNLIT' : '● IN SHADOW'}
            </div>
            <div className={state.earthVisible ? 'comms' : 'dark'}>
              {state.earthVisible ? '◆ EARTH IN VIEW' : '◇ NO EARTH CONTACT'} (el {state.earthEl.toFixed(1)}°)
            </div>
          </div>
          <div className="hud top-right">
            <div ref={fpsRef}>… fps</div>
            <AsciiQuality ascii={ascii} onChange={onQuality} />
            <div>
              render check:{' '}
              {agree === null ? '…' : agree ? <span className="lit">agrees ✓</span> : <span className="dark">differs ✗</span>}
            </div>
          </div>
          <HorizonStrip ref={stripRef} site={site} sky={state} />
          <MapLegend site={site} />
          <div className="hud bottom">
            <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
            <input
              type="range"
              min={0}
              max={site.hours - 1}
              value={state.hour}
              onChange={(e) => setHour(Number(e.target.value))}
              aria-label="Mission hour"
            />
            <span className="hour">h {state.hour}</span>
          </div>
        </>
      )}
    </div>
  );
}
