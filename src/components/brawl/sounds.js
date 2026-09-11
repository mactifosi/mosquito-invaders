import { tone, noise, ac, setMuted } from "@/engine/audio";

/** Bayou Brawl's voice: heavier and wetter than the other two cabinets. */
export const sfx = {
  setMuted,
  unlock() {
    ac();
  },
  swing(move) {
    const base = move === "heavy" ? 180 : move === "low" ? 150 : 240;
    tone("sawtooth", base, base * 0.5, 0.07, 0.05);
  },
  hit(damage = 6) {
    noise(0.09, 0.16);
    tone("square", 160 + damage * 6, 70, 0.11, 0.13);
  },
  block() {
    noise(0.05, 0.12);
    tone("square", 520, 300, 0.07, 0.09);
  },
  jump() {
    tone("sine", 260, 420, 0.1, 0.05);
  },
  special() {
    tone("sawtooth", 140, 620, 0.3, 0.12);
    tone("sine", 420, 900, 0.3, 0.07, 0.05);
  },
  ko() {
    noise(0.5, 0.22);
    [220, 165, 110].forEach((f, i) => tone("sawtooth", f, f * 0.7, 0.5, 0.18, i * 0.12));
  },
  roundStart() {
    tone("square", 440, 660, 0.16, 0.12);
  },
  matchWon() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.2, 0.14, i * 0.1));
  },
  matchLost() {
    [330, 262, 196, 147].forEach((f, i) => tone("sawtooth", f, f * 0.9, 0.35, 0.15, i * 0.16));
  },
};
