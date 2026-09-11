/**
 * Shared synth core: every cabinet builds its sounds from these, so no game
 * ships audio files and the mute switch applies arcade-wide.
 */
let AC = null;
let muted = false;

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

/** Lazily created, and resumed on the user gesture that unlocks audio. */
export function ac() {
  if (muted) return null;
  if (!AC) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    AC = new Ctor();
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}

export function tone(type, f0, f1, dur, vol = 0.16, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function noise(dur, vol = 0.2, delay = 0) {
  const c = ac();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);

  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(c.destination);
  src.start(c.currentTime + delay);
}
