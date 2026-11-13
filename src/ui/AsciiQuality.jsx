// ASCII quality control: High / Balanced / Performance / Off. The scene owns the
// current value and reports changes (including the `A` key and low-fps steps).
import { QUALITY_ORDER, QUALITY_PRESETS } from '../render/quality.js';

export default function AsciiQuality({ ascii, onChange }) {
  return (
    <div>
      <label>
        ASCII{' '}
        <select value={ascii.quality} onChange={(e) => onChange(e.target.value)} aria-describedby="ascii-hint">
          {QUALITY_ORDER.map((q) => <option key={q} value={q}>{QUALITY_PRESETS[q].label}</option>)}
        </select>
      </label>
      <div id="ascii-hint" className="dim">A: toggle Off</div>
      {ascii.reason === 'auto' && (
        <div className="dark" role="status">
          lowered to {QUALITY_PRESETS[ascii.quality].label}: low fps
        </div>
      )}
    </div>
  );
}
