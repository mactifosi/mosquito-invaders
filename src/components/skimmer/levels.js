/**
 * Skimmer — the rafts, as data.
 *
 * Each level is a grid of egg rafts drawn as text, mirrored left-to-right so
 * every layout is symmetric without authoring both halves. Legend:
 *
 *   .  open water        1  a raft (one hit)
 *   2  a thick raft (two hits)
 *   h  a hatching raft — leave it too long and a mosquito gets out
 *
 * `npm test` checks every level has the right width, at least one raft, and at
 * least one hatcher after the first couple, so a level can't be unclearable or
 * accidentally trivial.
 */

export const COLS = 11;
export const ROWS = 7;

/** Left half of each row (5 columns) plus the centre column. */
const LEVELS = [
  // 1 — a simple wall, to teach the angles
  [
    ["11111", "1"],
    ["11111", "1"],
    ["11111", "1"],
    [".....", "."],
    [".....", "."],
    [".....", "."],
    [".....", "."],
  ],
  // 2 — thick rafts behind a thin front, and the first hatchers
  [
    ["22222", "2"],
    ["11111", "1"],
    ["1.1.1", "."],
    ["..h..", "h"],
    [".....", "."],
    [".....", "."],
    [".....", "."],
  ],
  // 3 — a chevron: the middle is easy, the flanks are the work
  [
    ["2...1", "1"],
    ["12..1", "1"],
    ["112.1", "."],
    ["1112h", "."],
    ["...11", "1"],
    ["....h", "."],
    [".....", "."],
  ],
  // 4 — a hive: hatchers buried where you have to dig for them
  [
    ["11111", "1"],
    ["1h2h1", "2"],
    ["12221", "2"],
    ["1h2h1", "2"],
    ["11111", "1"],
    [".....", "."],
    [".....", "."],
  ],
  // 5 — columns, so the ball has to be threaded rather than scattered
  [
    ["2.2.2", "."],
    ["2.2.2", "."],
    ["1.1.1", "h"],
    ["1.1.1", "."],
    ["1h1h1", "."],
    ["1.1.1", "."],
    [".....", "."],
  ],
];

const mirror = (half) => half.split("").reverse().join("");

export const LAYOUTS = LEVELS.map((rows) =>
  rows.map(([left, centre]) => left + centre + mirror(left))
);

/** Levels repeat once you've cleared them all, each lap a little faster. */
export const layoutForLevel = (level) => LAYOUTS[(level - 1) % LAYOUTS.length];
export const lapForLevel = (level) => Math.floor((level - 1) / LAYOUTS.length);
