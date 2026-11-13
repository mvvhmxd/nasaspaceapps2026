// The living horizon: a 360° panorama of the skyline seen from the lander, drawn
// from the site's own horizon mask, with the Sun and Earth on it. It shows the
// rule the sim uses: a body is visible only when it is above the ridge at its
// azimuth. Solid marker = above the ridge, hollow = hidden (same as the map).
//
// Props carry the once-per-hour sim state (text, screen-reader line). For smooth
// motion the parent calls ref.setSky(sample) every frame with an interpolated
// sample (render/skyClock.skyAt); that updates SVG attributes directly, with no
// React re-render per frame.
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  azToX, elToY, elevationScale, pinState, skylinePaths, exaggeration, compassTicks, gapLabel,
} from './horizonGeometry.js';
import './horizonStrip.css';

const W = 600; // viewBox units; the strip scales with CSS, keeping its aspect ratio
const H = 84; // plot height
const PAD_TOP = 8;
const AXIS_H = 16; // compass labels under the plot
const SUN_R = 5;
const EARTH_R = 5.5;

const fmt = (v) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)}°`;

function srLine(sky) {
  const sun = `Sun ${fmt(sky.sunEl)} at azimuth ${Math.round(sky.sunAz)}°, ridge ${fmt(sky.sunMask)}: ${sky.sunlit ? 'visible' : 'hidden'}.`;
  const earth = `Earth ${fmt(sky.earthEl)} at azimuth ${Math.round(sky.earthAz)}°, ridge ${fmt(sky.earthMask)}: ${sky.earthVisible ? 'visible' : 'hidden'}.`;
  return `${sun} ${earth}`;
}

const HorizonStrip = forwardRef(function HorizonStrip({ site, sky }, ref) {
  const scale = useMemo(() => elevationScale(site.horizonMask, site.series), [site]);
  const paths = useMemo(() => skylinePaths(site.horizonMask, W, H, scale), [site, scale]);
  const ticks = useMemo(() => compassTicks(W), []);
  const vx = useMemo(() => exaggeration(W, H, scale), [scale]);

  const sunRef = useRef(null);
  const earthRef = useRef(null);
  const gapRef = useRef(null);
  const gapTextRef = useRef(null);

  const apply = useCallback((s) => {
    if (!s || !sunRef.current) return;
    const sx = azToX(s.sunAz, W);
    const sy = elToY(s.sunEl, scale, H);
    const ex = azToX(s.earthAz, W);
    const ey = elToY(s.earthEl, scale, H);
    const ry = elToY(s.sunMask, scale, H);
    const sun = sunRef.current;
    sun.setAttribute('transform', `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`);
    sun.dataset.state = s.sunlit ? 'up' : 'hidden';
    sun.dataset.pinned = pinState(s.sunEl, scale);
    const earth = earthRef.current;
    earth.setAttribute('transform', `translate(${ex.toFixed(2)} ${ey.toFixed(2)})`);
    earth.dataset.state = s.earthVisible ? 'up' : 'hidden';
    earth.dataset.pinned = pinState(s.earthEl, scale);
    const gap = gapRef.current;
    gap.setAttribute('x1', sx.toFixed(2));
    gap.setAttribute('x2', sx.toFixed(2));
    gap.setAttribute('y1', sy.toFixed(2));
    gap.setAttribute('y2', ry.toFixed(2));
    gapTextRef.current.textContent = gapLabel('Sun', s.sunEl, s.sunMask);
  }, [scale]);

  useImperativeHandle(ref, () => ({ setSky: apply }), [apply]);
  // Initial position only (and after a site change). From then on the parent
  // drives every position through ref.setSky, so a new hourly `sky` prop never
  // snaps the markers ahead of the eased display clock.
  const skyRef = useRef(sky);
  skyRef.current = sky;
  useEffect(() => { apply(skyRef.current); }, [apply]);

  return (
    <section className="hud horizon-strip" aria-label="Horizon seen from the lander">
      <header className="hs-head">
        <span className="hs-title">
          Horizon from the lander
          <span className="hs-note"><span className="hs-sep" aria-hidden="true"> · </span>hourly data, motion smoothed</span>
        </span>
        <span className="hs-gap" aria-hidden="true" ref={gapTextRef} />
      </header>
      <svg
        className="hs-svg"
        viewBox={`0 0 ${W} ${PAD_TOP + H + AXIS_H}`}
        role="img"
        aria-label={`360 degree skyline from the site's horizon mask, north in the middle, heights exaggerated ${vx} times. Sun and Earth markers are solid when above the ridge and hollow when hidden.`}
      >
        <g transform={`translate(0 ${PAD_TOP})`}>
          {scale.grid.map((g) => {
            const y = elToY(g, scale, H);
            return (
              <g key={g} className={g === 0 ? 'hs-grid hs-zero' : 'hs-grid'}>
                <line x1="0" x2={W} y1={y} y2={y} />
                <text x="3" y={y - 2}>{g}°</text>
              </g>
            );
          })}
          {ticks.minor.map((t) => <line key={t.az} className="hs-tick-minor" x1={t.x} x2={t.x} y1={H - 4} y2={H} />)}
          <path className="hs-ground" d={paths.ground} />
          <path className="hs-skyline" d={paths.line} />
          <line className="hs-north" x1={W / 2} x2={W / 2} y1="0" y2={H} />
          <line className="hs-gapline" ref={gapRef} />
          <g className="hs-body hs-earth" ref={earthRef}>
            <rect x={-EARTH_R / Math.SQRT2} y={-EARTH_R / Math.SQRT2} width={EARTH_R * Math.SQRT2} height={EARTH_R * Math.SQRT2} transform="rotate(45)" />
            <path className="hs-pin hs-pin-up" d={`M-4 ${-EARTH_R - 3}L0 ${-EARTH_R - 8}L4 ${-EARTH_R - 3}`} />
            <path className="hs-pin hs-pin-down" d={`M-4 ${-EARTH_R - 9}L0 ${-EARTH_R - 4}L4 ${-EARTH_R - 9}`} />
          </g>
          <g className="hs-body hs-sun" ref={sunRef}>
            <circle r={SUN_R} />
            <path className="hs-pin hs-pin-up" d={`M-4 ${-SUN_R - 3}L0 ${-SUN_R - 8}L4 ${-SUN_R - 3}`} />
            <path className="hs-pin hs-pin-down" d={`M-4 ${-SUN_R - 9}L0 ${-SUN_R - 4}L4 ${-SUN_R - 9}`} />
          </g>
        </g>
        <g className="hs-axis" transform={`translate(0 ${PAD_TOP + H + 12})`}>
          {ticks.major.map((t, i) => (
            <text key={i} x={t.x} textAnchor={i === 0 ? 'start' : i === ticks.major.length - 1 ? 'end' : 'middle'}>{t.label}</text>
          ))}
          <text className="hs-vx" x={W / 2 + 14} textAnchor="start">heights ×{vx}</text>
        </g>
      </svg>
      {sky && <div className="sr-only" aria-live="polite">{srLine(sky)}</div>}
    </section>
  );
});

export default memo(HorizonStrip);
