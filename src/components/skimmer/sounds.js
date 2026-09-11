import { tone, noise, ac, setMuted } from "@/engine/audio";

/** Skimmer's voice: stone on water, wood, and wings. */
export const sfx = {
  setMuted,
  unlock() {
    ac();
  },
  launch() {
    tone("sine", 300, 620, 0.14, 0.1);
  },
  paddle() {
    tone("square", 220, 300, 0.05, 0.09);
  },
  wall() {
    tone("square", 400, 380, 0.03, 0.05);
  },
  chip() {
    noise(0.04, 0.08);
    tone("square", 260, 200, 0.05, 0.07);
  },
  breakRaft(kind) {
    const base = kind === "hatcher" ? 180 : kind === "2" ? 300 : 420;
    tone("square", base, base * 1.6, 0.07, 0.1);
    noise(0.05, 0.07);
  },
  hatch() {
    tone("sawtooth", 120, 520, 0.35, 0.09);
  },
  squash() {
    noise(0.08, 0.14);
    tone("square", 520, 160, 0.1, 0.1);
  },
  escape() {
    tone("sawtooth", 420, 140, 0.4, 0.12);
  },
  powerup() {
    tone("triangle", 520, 1040, 0.16, 0.14);
  },
  loseBall() {
    tone("sawtooth", 260, 70, 0.45, 0.16);
    noise(0.3, 0.1);
  },
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.15, 0.13, i * 0.1));
  },
  gameOver() {
    [392, 294, 220, 165].forEach((f, i) => tone("square", f, f * 0.9, 0.3, 0.15, i * 0.15));
  },
};
