/**
 * Local high-score leaderboard (localStorage, per device/browser).
 *
 * Scores are intentionally backend-free. To go global, add a Base44 entity and
 * swap these three functions for entity calls — nothing else reads the store.
 */

const KEY = "mosquito-invaders.scores";
const MAX_ENTRIES = 8;

export function loadScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((n) => typeof n === "number" && Number.isFinite(n))
      .sort((a, b) => b - a)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveScore(score) {
  const next = [...loadScores(), score].sort((a, b) => b - a).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private browsing / quota — the run just isn't recorded */
  }
  return next;
}

export function getHighScore() {
  return loadScores()[0] || 0;
}
