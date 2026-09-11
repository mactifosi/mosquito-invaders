/**
 * Arcade-wide settings, owned by the shell rather than by any one game.
 *
 * Deliberately tiny and synchronous: the game loop reads difficulty every wave
 * and `muted` on every sound, so this has to be cheap and never throw.
 */

const KEY = "caddora.settings";

export const DIFFICULTIES = {
  easy: {
    label: "Easy",
    note: "Slower swarm, rarer fire — for a bumpy descent",
    speed: 0.8,
    fireRate: 1.35, // multiplies the interval, so higher is gentler
    dives: 1.4,
  },
  normal: { label: "Normal", note: "As designed", speed: 1, fireRate: 1, dives: 1 },
  hard: {
    label: "Hard",
    note: "Faster, and they bite sooner",
    speed: 1.25,
    fireRate: 0.72,
    dives: 0.65,
  },
};

const DEFAULTS = {
  difficulty: "normal",
  muted: false,
  initials: "AAA",
};

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const merged = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
    if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = DEFAULTS.difficulty;
    merged.initials = String(merged.initials || "AAA").slice(0, 3).toUpperCase();
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* nothing to do — settings just don't persist */
  }
  return next;
}

export const difficultyOf = (settings) =>
  DIFFICULTIES[settings?.difficulty] || DIFFICULTIES.normal;
