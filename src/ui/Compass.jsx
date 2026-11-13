// North-up compass with the Sun and Earth directions. Reads sim state only.
// A filled marker means the body is above the terrain horizon; hollow means hidden.
const pos = (az, r) => [50 + r * Math.sin((az * Math.PI) / 180), 50 - r * Math.cos((az * Math.PI) / 180)];

export default function Compass({ sky }) {
  const [sx, sy] = pos(sky.sunAz, 34);
  const [ex, ey] = pos(sky.earthAz, 34);
  const label = `Compass, north up. Sun at azimuth ${sky.sunAz.toFixed(0)} degrees, ${sky.sunlit ? 'above' : 'below'} the horizon. ` +
    `Earth at azimuth ${sky.earthAz.toFixed(0)} degrees, ${sky.earthVisible ? 'above' : 'below'} the horizon.`;
  return (
    <svg className="compass" viewBox="0 0 100 100" role="img" aria-label={label}>
      <circle cx="50" cy="50" r="34" className="c-ring" />
      <path d="M50 8 L54 18 L46 18 Z" className="c-north" />
      <text x="50" y="30" textAnchor="middle" className="c-text">N</text>
      <line x1="50" y1="50" x2={sx} y2={sy} className={`c-sunline${sky.sunlit ? '' : ' off'}`} />
      <line x1="50" y1="50" x2={ex} y2={ey} className={`c-earthline${sky.earthVisible ? '' : ' off'}`} />
      <circle cx={sx} cy={sy} r="7" className={`c-sun${sky.sunlit ? '' : ' off'}`} />
      <text x={sx} y={sy + 3} textAnchor="middle" className="c-mark">S</text>
      <rect x={ex - 6} y={ey - 6} width="12" height="12" transform={`rotate(45 ${ex} ${ey})`} className={`c-earth${sky.earthVisible ? '' : ' off'}`} />
      <text x={ex} y={ey + 3} textAnchor="middle" className="c-mark">E</text>
      <circle cx="50" cy="50" r="3" className="c-lander" />
    </svg>
  );
}
