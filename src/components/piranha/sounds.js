import { tone, noise, ac, setMuted } from "@/engine/audio";

/** Piranha's voice: wetter and lower than the squadron's. */
export const sfx = {
  setMuted,
  unlock() {
    ac();
  },
  pellet() {
    tone("square", 620, 720, 0.04, 0.05);
  },
  carrot() {
    tone("triangle", 300, 620, 0.25, 0.14);
    tone("triangle", 450, 900, 0.25, 0.09, 0.06);
  },
  chomp() {
    noise(0.05, 0.1);
    tone("square", 180, 90, 0.07, 0.09);
  },
  eatFish() {
    tone("square", 200, 800, 0.18, 0.14);
    noise(0.1, 0.1);
  },
  /** A hunter passing a whisker away — a quick intake of breath. */
  nearMiss() {
    tone("sine", 880, 1250, 0.09, 0.06);
  },
  /** The whole shoal on one carrot. */
  chain() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, 0.18, 0.14, i * 0.09));
  },
  death() {
    [520, 400, 300, 210, 140].forEach((f, i) => tone("sawtooth", f, f * 0.8, 0.22, 0.15, i * 0.12));
    noise(0.5, 0.12, 0.4);
  },
  levelClear() {
    [392, 523, 659, 784].forEach((f, i) => tone("triangle", f, f, 0.16, 0.13, i * 0.11));
  },
  ready() {
    tone("triangle", 330, 440, 0.2, 0.1);
  },
};
