/**
 * Synthesized retro SFX — no asset files.
 *
 * Every sound is built from oscillators + gain envelopes on demand. The
 * AudioContext is created lazily and must be unlocked from a real user gesture
 * (see sfx.unlock(), called on "Insert Coin" / Continue / Play Again) to satisfy
 * browser autoplay policy.
 */

let AC = null;

function ac() {
  if (!AC) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    AC = new Ctor();
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}

/** A single pitched blip, optionally gliding from f0 to f1. */
function tone(type, f0, f1, dur, vol = 0.16, delay = 0) {
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

/** Decaying white noise — impacts and explosions. */
function noise(dur, vol = 0.2, delay = 0) {
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

export const sfx = {
  /** Must be called from a user gesture before any other sound. */
  unlock() {
    ac();
  },
  laser() {
    tone("square", 880, 220, 0.12, 0.1);
  },
  /** Pitch climbs with the combo multiplier, so a streak sounds like one. */
  hit(mult = 1) {
    const step = Math.max(1, Math.min(5, mult));
    noise(0.1, 0.16);
    tone("square", 300 * 1.12 ** (step - 1), 90, 0.1, 0.09);
  },
  loseLife() {
    tone("sawtooth", 300, 60, 0.5, 0.18);
    noise(0.3, 0.14);
  },
  powerup() {
    tone("triangle", 520, 1040, 0.16, 0.16);
    tone("triangle", 780, 1560, 0.16, 0.12, 0.09);
  },
  shieldBreak() {
    tone("square", 640, 120, 0.24, 0.14);
    noise(0.16, 0.14);
  },
  pop() {
    tone("square", 180, 60, 0.16, 0.13);
    noise(0.12, 0.12);
  },
  gameOver() {
    [440, 330, 262, 196].forEach((f, i) => tone("square", f, f * 0.92, 0.28, 0.15, i * 0.16));
  },
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.16, 0.14, i * 0.1));
  },
  /** A diver peeling off: a rising whine you learn to dread. */
  dive() {
    tone("sawtooth", 180, 620, 0.42, 0.09);
  },
  /** A shot burying itself in a bunker. */
  thud() {
    noise(0.06, 0.1);
  },
  pause() {
    tone("square", 420, 300, 0.12, 0.1);
  },
  resume() {
    tone("square", 300, 460, 0.12, 0.1);
  },
  /** Ambient wingbeat — fires on formation step-down and on a timer. */
  wingHum() {
    tone("sine", 70, 58, 0.5, 0.05);
  },
};
