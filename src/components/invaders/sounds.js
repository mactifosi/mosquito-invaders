/**
 * Mosquito Invaders' voice. The synth core is shared with the rest of the
 * arcade (see @/engine/audio); this file is only the sound design.
 */
import { tone, noise, ac, setMuted } from "@/engine/audio";

export const sfx = {
  /** Set from the arcade's Sound setting. The native app plays through the
   *  silent switch, so this is the only way to keep it quiet. */
  setMuted,
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
  /** Chipping away at the queen: lower and heavier than a normal hit. */
  bossHit() {
    noise(0.07, 0.12);
    tone("square", 150, 70, 0.09, 0.1);
  },
  bossDown() {
    [196, 262, 330, 392, 523].forEach((f, i) => tone("triangle", f, f, 0.2, 0.15, i * 0.12));
    noise(0.6, 0.2);
  },
  /** The stray arriving: a lazy, taunting drift across the top. */
  stray() {
    tone("sine", 520, 700, 0.5, 0.07);
    tone("sine", 660, 880, 0.5, 0.05, 0.08);
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
