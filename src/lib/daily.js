/**
 * The daily challenge: one seeded run a day, identical for anyone playing on the
 * same date, with a modifier that changes how the swarm behaves.
 *
 * Entirely offline — the seed is the date, so no server decides anything. That
 * is the point: it works at 38,000 feet.
 */

/** Small, fast, deterministic PRNG. Same seed, same run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local date, not UTC — the challenge should turn over at your midnight. */
export function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function seedFor(dateKey) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One modifier per day. Each is a real rule change rather than a score tweak,
 * so the day has its own character and its own tactics.
 */
export const MODIFIERS = [
  {
    id: "exposed",
    label: "NO COVER",
    note: "The bunkers never arrived",
    mods: { bunkers: false },
  },
  {
    id: "dive-bombers",
    label: "DIVE-BOMBERS",
    note: "They break formation from wave 1",
    mods: { diveFrom: 1 },
  },
  {
    id: "royal-summons",
    label: "ROYAL SUMMONS",
    note: "A queen every second wave",
    mods: { bossEvery: 2 },
  },
  {
    id: "one-craft",
    label: "SINGLE CRAFT",
    note: "One craft, no spares",
    mods: { lives: 1, maxLives: 1 },
  },
  {
    id: "issued-rapid",
    label: "RAPID ISSUE",
    note: "Rapid fire from the first shot",
    mods: { startRapid: true },
  },
  {
    id: "blood-moon",
    label: "BLOOD MOON",
    note: "Twice as many blood-fed mosquitoes",
    mods: { fedChance: 0.34 },
  },
];

export function dailyChallenge(dateKey = todayKey()) {
  const seed = seedFor(dateKey);
  const modifier = MODIFIERS[seed % MODIFIERS.length];
  return { dateKey, seed, ...modifier };
}

/* ---- one attempt a day, recorded locally ---- */

const resultKey = (dateKey) => `caddora.daily.${dateKey}`;

export function dailyResult(dateKey = todayKey()) {
  try {
    const raw = JSON.parse(localStorage.getItem(resultKey(dateKey)) || "null");
    return raw && typeof raw.score === "number" ? raw : null;
  } catch {
    return null;
  }
}

export function recordDaily(score, wave, dateKey = todayKey()) {
  const entry = { score, wave, at: Date.now() };
  try {
    localStorage.setItem(resultKey(dateKey), JSON.stringify(entry));
  } catch {
    /* not recorded — the run still happened */
  }
  return entry;
}
