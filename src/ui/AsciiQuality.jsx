// ASCII quality control: High / Balanced / Performance / Off. The scene owns the
// current value and reports changes (including the `A` key and low-fps steps).
import { memo } from 'react';
import { QUALITY_ORDER, QUALITY_PRESETS, AUTO_FLOOR } from '../render/quality.js';

function AsciiQuality({ ascii, onChange }) {
  return (
    <div>
      <label>
        ASCII{' '}
        <select value={ascii.quality} onChange={(e) => onChange(e.target.value)} aria-describedby="ascii-hint">
          {QUALITY_ORDER.map((q) => <option key={q} value={q}>{QUALITY_PRESETS[q].label}</option>)}
        </select>
      </label>
      <div id="ascii-hint" className="dim">Press A to switch ASCII on or off</div>
      {ascii.reason === 'auto' && (
        <div className="dark" role="status">
          Low fps: lowered to {QUALITY_PRESETS[ascii.quality].label}.
          {ascii.quality === AUTO_FLOOR && <> Choose Off if it still stutters.</>}
        </div>
      )}
    </div>
  );
}

export default memo(AsciiQuality); // re-renders only when the quality changes
