// ASCII quality presets (GAME_SPEC 8.1): High, Balanced, Performance and an Off
// fallback. Pure data and helpers, no three.js, so they run in Node tests.

export const QUALITY_ORDER = ['high', 'balanced', 'performance', 'off'];
export const DEFAULT_QUALITY = 'balanced';

export const QUALITY_PRESETS = {
  high: { label: 'High', ascii: true, cellCss: 8, glyphs: 32, shadowMap: 4096 },
  balanced: { label: 'Balanced', ascii: true, cellCss: 10, glyphs: 32, shadowMap: 4096 },
  performance: { label: 'Performance', ascii: true, cellCss: 12, glyphs: 24, shadowMap: 2048 },
  // Off keeps the same terrain, palette and markers with plain shading. It is the
  // accessibility fallback, and unlike glyph cells, plain shading shows a coarse
  // shadow map as jagged edges, so it keeps the full-size map.
  off: { label: 'Off', ascii: false, cellCss: 12, glyphs: 24, shadowMap: 4096 },
};

const STORAGE_KEY = 'ce.asciiQuality';

export function isQuality(name) {
  return Object.hasOwn(QUALITY_PRESETS, name);
}

/** Lowest preset the low-fps fallback may pick on its own. ASCII is the game's
 * identity (spec 8.1), so only the player can choose Off. */
export const AUTO_FLOOR = 'performance';

/** Next step down when the frame rate is too low; stops at AUTO_FLOOR. */
export function lowerQuality(name) {
  const i = QUALITY_ORDER.indexOf(name);
  const floor = QUALITY_ORDER.indexOf(AUTO_FLOOR);
  if (i < 0) return DEFAULT_QUALITY;
  return QUALITY_ORDER[Math.max(i, Math.min(i + 1, floor))];
}

/**
 * Starting quality: `?ascii=0` forces Off, `?quality=<name>` wins next, then the
 * saved choice, then the default. `storage` is localStorage or a stand-in.
 */
export function initialQuality(search = '', storage) {
  const params = new URLSearchParams(search);
  if (params.get('ascii') === '0') return 'off';
  const fromUrl = params.get('quality');
  if (isQuality(fromUrl)) return fromUrl;
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (isQuality(saved)) return saved;
  } catch {
    // storage blocked (private mode, sandboxed iframe): use the default
  }
  return DEFAULT_QUALITY;
}

/** Save a user's choice. Automatic low-fps changes are not saved. */
export function saveQuality(name, storage) {
  if (!isQuality(name)) return;
  try {
    storage?.setItem(STORAGE_KEY, name);
  } catch {
    // ignore: the choice just won't persist
  }
}
