// Load and decode a site file (format: docs/ARCHITECTURE.md, "Site data").

/** Decode a base64 Uint16 (little-endian) heightmap into metres. */
export function decodeHeightmap(hmJson) {
  const bin = atob(hmJson.data);
  const count = hmJson.size * hmJson.size;
  if (bin.length !== count * 2) {
    throw new Error(`heightmap: expected ${count * 2} bytes, got ${bin.length}`);
  }
  const heights = new Float32Array(count);
  const scale = (hmJson.maxM - hmJson.minM) / 65535;
  for (let i = 0; i < count; i++) {
    const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    heights[i] = hmJson.minM + v * scale;
  }
  return { size: hmJson.size, spacingM: hmJson.spacingM, heights };
}

/** Turn parsed site JSON into the in-memory site object the game uses. */
export function decodeSite(json) {
  const n = json.series.sunAz.length;
  for (const key of ['sunEl', 'earthAz', 'earthEl']) {
    if (json.series[key].length !== n) throw new Error(`series.${key} length differs from sunAz`);
  }
  if (json.horizonMask.length !== 360) throw new Error('horizonMask must have 360 values');
  return { ...json, heightmap: decodeHeightmap(json.heightmap), hours: n };
}

export async function loadSite(id) {
  const res = await fetch(`${import.meta.env.BASE_URL}sites/${id}.json`);
  if (!res.ok) throw new Error(`site ${id}: HTTP ${res.status}`);
  return decodeSite(await res.json());
}
