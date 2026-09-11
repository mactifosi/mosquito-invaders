/**
 * Local high-score store, keyed per game.
 *
 * Every cabinet keeps its own table under `caddora.scores.<id>`, where `<id>` is
 * the game's registry id. Entries are `{ score, initials, at }` — initials being
 * the arcade three-letter kind. Scores are local to the device: the arcade is
 * offline-first, so there is deliberately no backend. To add one later, swap
 * these functions; nothing else touches localStorage.
 */

const PREFIX = "caddora.scores.";
const MAX_ENTRIES = 8;

/**
 * Mosquito Invaders shipped before the arcade existed, writing bare numbers to
 * `mosquito-invaders.scores`. Those runs are carried across on first read (with
 * blank initials) and the old key is left alone, in case an older build is still
 * installed somewhere.
 */
const LEGACY_KEYS = { "mosquito-invaders": "mosquito-invaders.scores" };

const keyFor = (gameId) => `${PREFIX}${gameId}`;

/** Accepts both shapes: a bare number (legacy) or a full entry. */
function normalize(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return { score: raw, initials: "···", at: null };
  if (raw && typeof raw.score === "number" && Number.isFinite(raw.score)) {
    return { score: raw.score, initials: (raw.initials || "···").slice(0, 3), at: raw.at || null };
  }
  return null;
}

function read(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalize).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(key, entries) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* private browsing or quota — the run simply isn't recorded */
  }
}

export function loadScores(gameId) {
  const key = keyFor(gameId);
  const current = read(key);
  if (current.length) return current;

  const legacy = LEGACY_KEYS[gameId] ? read(LEGACY_KEYS[gameId]) : [];
  if (legacy.length) write(key, legacy);
  return legacy;
}

export function saveScore(gameId, score, initials = "···") {
  const entry = { score, initials: initials.slice(0, 3).toUpperCase(), at: Date.now() };
  const next = [...loadScores(gameId), entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  write(keyFor(gameId), next);
  return next;
}

export function getHighScore(gameId) {
  return loadScores(gameId)[0]?.score || 0;
}

/** Does this run earn a place on the board — i.e. is it worth asking for initials? */
export function qualifies(gameId, score) {
  if (score <= 0) return false;
  const board = loadScores(gameId);
  return board.length < MAX_ENTRIES || score > board[board.length - 1].score;
}

/** Every game's best, for the arcade home screen. */
export function allHighScores(gameIds) {
  return Object.fromEntries(gameIds.map((id) => [id, getHighScore(id)]));
}
