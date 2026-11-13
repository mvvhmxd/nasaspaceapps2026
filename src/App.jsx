import { useEffect, useRef, useState } from 'react';
import { loadSite } from './data/loadSite.js';
import { stateAt } from './sim/visibility.js';
import { createSurfaceScene } from './render/scene.js';

const SPEEDS = [1, 4, 16]; // game hours per 0.5 s (docs/features/survival-sim)

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);
  // ?h=<hour> opens at a given hour (handy for demos and screenshots).
  const [hour, setHour] = useState(() => Number(new URLSearchParams(location.search).get('h')) || 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fps, setFps] = useState(0);
  const [renderBlocked, setRenderBlocked] = useState(null);

  useEffect(() => {
    loadSite('demo').then(setSite, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!site) return;
    const s = createSurfaceScene(canvasRef.current, site, { onFps: setFps });
    sceneRef.current = s;
    return () => s.dispose();
  }, [site]);

  const state = site ? stateAt(site, hour) : null;

  useEffect(() => {
    if (!state || !sceneRef.current) return;
    const { renderBlocked: rb } = sceneRef.current.setSun(state.sunAz, state.sunEl);
    setRenderBlocked(rb);
    sceneRef.current.setLanderInShadow(!state.sunlit); // the sim decides
  }, [site, state?.hour]);

  useEffect(() => {
    if (!playing || !site) return;
    const id = setInterval(() => {
      setHour((h) => (h + speed >= site.hours ? 0 : h + speed));
    }, 500);
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
            <div>{fps} fps</div>
            <div>
              render check:{' '}
              {agree === null ? '…' : agree ? <span className="lit">agrees ✓</span> : <span className="dark">differs ✗</span>}
            </div>
          </div>
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
