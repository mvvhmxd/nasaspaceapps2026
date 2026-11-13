// Signal fence warning: shown while the view centre is outside the surveyed
// terrain (see render/fence.js). A red ASCII static border plus a text panel, so
// the state never relies on colour alone. Nobody dies; the camera glides home.
import { memo } from 'react';
import './signalFence.css';

// Deterministic "static" (same on every render and every machine): a small LCG
// over a glyph set, long enough to fill the widest edge.
const STATIC_GLYPHS = '░▒▓#%/\\|-:;.*+=';
function staticLine(seed, length) {
  let s = seed >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out += STATIC_GLYPHS[s % STATIC_GLYPHS.length];
  }
  return out;
}
const H_LINE = staticLine(2026, 400);
const V_LINE = staticLine(1969, 200);

function SignalFence({ fence }) {
  if (fence.state !== 'outside') return null;
  return (
    <div className="signal-fence">
      <div className="sf-edge sf-top" aria-hidden="true"><span>{H_LINE}</span></div>
      <div className="sf-edge sf-bottom" aria-hidden="true"><span>{H_LINE}</span></div>
      <div className="sf-edge sf-left" aria-hidden="true"><span>{V_LINE}</span></div>
      <div className="sf-edge sf-right" aria-hidden="true"><span>{V_LINE}</span></div>
      <div className="sf-panel">
        {/* Announced once when the warning appears; the ticking digit is visual only. */}
        <p className="sf-title" role="alert">
          <span aria-hidden="true">⚠ </span>OUTSIDE SURVEY AREA — NO TERRAIN DATA
          <span className="sr-only">. Returning to the landing site in 5 seconds unless you pan back.</span>
        </p>
        <p className="sf-count" aria-hidden="true">
          Returning to the landing site in <b>{fence.secondsLeft}</b>…
        </p>
        <p className="sf-hint" aria-hidden="true">Pan back toward the lander to cancel</p>
      </div>
    </div>
  );
}

export default memo(SignalFence);
