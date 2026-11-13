// Player settings, kept in localStorage. Pure except load/save.
const KEY = 'crater-expectations-settings-v1';

export const ASCII_QUALITY = [
  { id: 'high', label: 'High', cell: 8 },
  { id: 'balanced', label: 'Balanced', cell: 10 },
  { id: 'performance', label: 'Performance', cell: 12 },
  { id: 'off', label: 'Off (plain shading)', cell: null },
];
export const DEFAULTS = { volume: 0.6, muted: false, ascii: 'balanced' };

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
