// Event sounds, synthesised with Web Audio. No audio files, so nothing to license.
// Every sound is short and paired with on-screen text; the game is fully playable muted.
let ctx = null;
let master = null;
let level = 0.6;

/** Call from a user gesture (a click): browsers only start audio after one. */
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.value = level;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setVolume(volume, muted) {
  level = muted ? 0 : volume * 0.5;
  if (master) master.gain.value = level;
}

// [frequency Hz, start s, duration s] per note.
const SOUNDS = {
  sunrise: { type: 'sine', notes: [[392, 0, 0.18], [523, 0.14, 0.18], [659, 0.28, 0.32]] },
  sunset: { type: 'sine', notes: [[523, 0, 0.18], [392, 0.14, 0.18], [294, 0.28, 0.36]] },
  earthrise: { type: 'triangle', notes: [[784, 0, 0.12], [988, 0.1, 0.22]] },
  earthset: { type: 'triangle', notes: [[988, 0, 0.12], [740, 0.1, 0.24]] },
  battery25: { type: 'square', notes: [[440, 0, 0.1], [440, 0.18, 0.1]] },
  battery10: { type: 'square', notes: [[523, 0, 0.09], [523, 0.14, 0.09], [523, 0.28, 0.09]] },
  powerDown: { type: 'sawtooth', notes: [[220, 0, 0.3], [165, 0.25, 0.3], [110, 0.5, 0.6]] },
  success: { type: 'sine', notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]] },
  slip: { type: 'square', notes: [[330, 0, 0.16], [262, 0.2, 0.16], [330, 0.4, 0.16], [262, 0.6, 0.22]] },
  land: { type: 'sine', notes: [[196, 0, 0.25], [262, 0.2, 0.3]] },
  iceCollected: { type: 'triangle', notes: [[659, 0, 0.1], [880, 0.09, 0.1], [1319, 0.18, 0.25]] },
  iceDelivered: { type: 'sine', notes: [[523, 0, 0.12], [784, 0.1, 0.12], [1047, 0.2, 0.3]] },
  roverLost: { type: 'sawtooth', notes: [[196, 0, 0.25], [147, 0.22, 0.5]] },
};
export const SOUND_NAMES = Object.keys(SOUNDS);

export function play(name) {
  const s = SOUNDS[name];
  if (!s || !ctx || level === 0) return;
  const t0 = ctx.currentTime + 0.01;
  for (const [freq, start, dur] of s.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type;
    osc.frequency.value = freq;
    const peak = s.type === 'sine' || s.type === 'triangle' ? 0.5 : 0.18; // harsher waves quieter
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain).connect(master);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}
