// Player settings, kept in localStorage. Pure except load/save.
import { QUALITY_ORDER, QUALITY_PRESETS, DEFAULT_QUALITY } from '../render/quality.js';

const KEY = 'crater-expectations-settings-v1';


// ASCII detail choices come from the renderer's presets (src/render/quality.js), so the
// Settings screen, the in-game menu and the low-fps step-down all use the same list.
export const ASCII_QUALITY = QUALITY_ORDER.map((id) => ({
  id,
  label: id === 'off' ? 'Off (plain shading)' : QUALITY_PRESETS[id].label,
  cell: QUALITY_PRESETS[id].ascii ? QUALITY_PRESETS[id].cellCss : null,
}));
export const DEFAULTS = { volume: 0.6, muted: false, ascii: DEFAULT_QUALITY };

/** Returns a complete, valid settings object whatever was stored. */
export function sanitizeSettings(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) out.volume = Math.min(1, Math.max(0, raw.volume));
  if (typeof raw.muted === 'boolean') out.muted = raw.muted;
  if (ASCII_QUALITY.some((q) => q.id === raw.ascii)) out.ascii = raw.ascii;
  return out;
}

export function loadSettings() {
  try { return sanitizeSettings(JSON.parse(localStorage.getItem(KEY))); } catch { return { ...DEFAULTS }; }
}
export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
}
