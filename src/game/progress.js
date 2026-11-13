// Campaign progress: best stars per mission, kept in localStorage. Pure except load/save.
import { MISSIONS } from './missions.js';

const KEY = 'crater-expectations-progress-v1';

/** A mission is unlocked when it is the first one or the previous one has at least 1 star. */
export function isUnlocked(progress, missionId) {
  const i = MISSIONS.findIndex((m) => m.id === missionId);
  if (i <= 0) return i === 0;
  return (progress[MISSIONS[i - 1].id] ?? 0) >= 1;
}

/** New progress object with the better of the old and new star count. */
export function recordStars(progress, missionId, stars) {
  return { ...progress, [missionId]: Math.max(progress[missionId] ?? 0, stars) };
}

export function nextMissionId(missionId) {
  const i = MISSIONS.findIndex((m) => m.id === missionId);
  return MISSIONS[i + 1]?.id ?? null;
}

/** Keeps only known mission ids with integer stars 0-3; anything else is dropped. */
export function sanitize(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const m of MISSIONS) {
    const v = raw[m.id];
    if (Number.isInteger(v) && v >= 0 && v <= 3) out[m.id] = v;
  }
  return out;
}

export function loadProgress() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { return {}; }
}
export function saveProgress(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* private mode: play without saving */ }
}
