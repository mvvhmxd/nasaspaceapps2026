// The living horizon: a 360° panorama of the skyline seen from the lander, drawn
// from the site's own horizon mask, with the Sun and Earth on it. It shows the
// rule the sim uses: a body is visible only when it is above the ridge at its
// azimuth. Solid marker = above the ridge, hollow = hidden (same as the map).
//
// Props carry the once-per-hour sim state: the gap label and the screen-reader
// line come from it, so they always agree with the solid / hollow markers (which
// show the same hour's truth flags). For smooth motion the parent calls
// ref.setSky(sample) every frame with an interpolated sample (render/skyClock);
// that updates SVG positions directly, with no React re-render per frame.
// Labels keep a constant on-screen size at any strip width (--hs-k, see below).
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
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
/** During playback: only what changed matters (sunrise, sunset, Earth rise / set). */
function srFlags(sunlit, earthVisible) {
  return `Sun ${sunlit ? 'above' : 'behind'} the ridge. Earth ${earthVisible ? 'in view' : 'hidden'}.`;
}

const HorizonStrip = forwardRef(function HorizonStrip({ site, sky, playing = false }, ref) {
  const scale = useMemo(() => elevationScale(site.horizonMask, site.series), [site]);
  const paths = useMemo(() => skylinePaths(site.horizonMask, W, H, scale), [site, scale]);
  const ticks = useMemo(() => compassTicks(W), []);
  const vx = useMemo(() => exaggeration(W, H, scale), [scale]);

  const sunRef = useRef(null);
  const earthRef = useRef(null);
  const gapRef = useRef(null);
  const sectionRef = useRef(null);
  const svgRef = useRef(null);
  // viewBox units per CSS px: SVG text and markers are drawn at size * k so they keep
  // the same on-screen size however narrow the strip gets (otherwise labels shrank
  // to ~5.5 px at 900 px wide).
  const kRef = useRef(1);
  const lastSample = useRef(null);

  const apply = useCallback((s) => {
    lastSample.current = s;
    if (!s || !sunRef.current) return;
    const sx = azToX(s.sunAz, W);
    const sy = elToY(s.sunEl, scale, H);
    const ex = azToX(s.earthAz, W);
    const ey = elToY(s.earthEl, scale, H);
    const ry = elToY(s.sunMask, scale, H);
    const k = kRef.current.toFixed(3);
    const sun = sunRef.current;
    sun.setAttribute('transform', `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${k})`);
    sun.dataset.state = s.sunlit ? 'up' : 'hidden';
    sun.dataset.pinned = pinState(s.sunEl, scale);
    const earth = earthRef.current;
    earth.setAttribute('transform', `translate(${ex.toFixed(2)} ${ey.toFixed(2)}) scale(${k})`);
    earth.dataset.state = s.earthVisible ? 'up' : 'hidden';
    earth.dataset.pinned = pinState(s.earthEl, scale);
    const gap = gapRef.current;
    gap.setAttribute('x1', sx.toFixed(2));
    gap.setAttribute('x2', sx.toFixed(2));
    gap.setAttribute('y1', sy.toFixed(2));
    gap.setAttribute('y2', ry.toFixed(2));
  }, [scale]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const w = svg.getBoundingClientRect().width;
      if (!w) return;
      kRef.current = W / w;
      sectionRef.current?.style.setProperty('--hs-k', kRef.current.toFixed(3));
      if (lastSample.current) apply(lastSample.current); // re-scale the markers
    };
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    update();
    return () => ro.disconnect();
  }, [apply]);

  useImperativeHandle(ref, () => ({ setSky: apply }), [apply]);
  // Initial position only (and after a site change). From then on the parent
  // drives every position through ref.setSky, so a new hourly `sky` prop never
  // snaps the markers ahead of the eased display clock.
  const skyRef = useRef(sky);
  skyRef.current = sky;
  useEffect(() => { apply(skyRef.current); }, [apply]);

  // Screen-reader line, announced politely. Paused: the full line each hour.
  // Playing: only when a truth flag flips (at 16x the full line would be read
  // ten times in five seconds).
  const flagsKey = sky ? `${sky.sunlit}|${sky.earthVisible}` : '';
  const srText = useMemo(
    () => (!sky ? '' : playing ? srFlags(sky.sunlit, sky.earthVisible) : srLine(sky)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playing, playing ? flagsKey : sky],
  );

  return (
    <section className="hud horizon-strip" aria-label="Horizon seen from the lander" ref={sectionRef}>
      <header className="hs-head">
        <span className="hs-title">
          Horizon from the lander
          <span className="hs-note"><span className="hs-sep" aria-hidden="true"> · </span>hourly data, motion smoothed</span>
        </span>
        {/* The hour's own values, like the markers' solid / hollow state. */}
        <span className="hs-gap" aria-hidden="true">{sky ? gapLabel('Sun', sky.sunEl, sky.sunMask) : ''}</span>
      </header>
      <svg
        className="hs-svg"
        ref={svgRef}
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
      {sky && <div className="sr-only" aria-live="polite">{srText}</div>}
    </section>
  );
});

export default memo(HorizonStrip);
