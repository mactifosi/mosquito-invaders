/**
 * The river maze.
 *
 * Authored as half-rows and mirrored, which guarantees the symmetry a chase
 * maze needs and halves the chance of a typo. Legend:
 *
 *   #  wall          .  algae (10 pts)
 *   o  carrot (50)   -  den door, passable by fish only
 *   space  open water (no pellet)
 *
 * `npm test` checks every row is the right width, that the maze is fully
 * connected, and that no pellet is walled off — a maze you can't clear is a
 * soft-lock, and it's the kind of mistake that's invisible until wave 3.
 */

export const TILE = 16;
export const COLS = 21;
export const ROWS = 23;

/** Left half of each row (10 columns) plus the centre column. */
const HALF_ROWS = [
  ["##########", "#"],
  ["#........#", "."],
  ["#o##.###.#", "."],
  ["#.##.###.#", "."],
  ["#.........", "."],
  ["#.##.#.###", "#"],
  ["#....#....", "#"],
  ["####.####.", "#"],
  ["   #.#....", "."],
  ["####.#.##-", "-"],
  ["    .  #  ", " "],
  ["####.#.###", "#"],
  ["   #......", "."],
  ["####.####.", "."],
  ["#........#", "."],
  ["#.##.###.#", "."],
  ["#o.#.....#", "."],
  ["##.#.#.###", "#"],
  ["#....#....", "#"],
  ["#.########", "."],
  ["#.........", "."],
  ["#........#", "."],
  ["##########", "#"],
];

const mirror = (half) => half.split("").reverse().join("");

/** The maze as an array of 21-character strings. */
export const MAZE = HALF_ROWS.map(([left, centre]) => left + centre + mirror(left));

export const TUNNEL_ROW = 10; // wraps left/right, the way a river runs off-screen

/* ---- tile queries ---- */

export const tileAt = (maze, col, row) =>
  row < 0 || row >= ROWS || col < 0 || col >= COLS ? "#" : maze[row][col];

/** Walls block everything; the den door blocks the bunny but not the fish. */
export function isWall(maze, col, row, { fish = false } = {}) {
  const t = tileAt(maze, col, row);
  if (t === "#") return true;
  if (t === "-") return !fish;
  return false;
}

export const isPelletTile = (t) => t === "." || t === "o";

/** Mutable pellet layer, so the maze itself stays a constant. */
export function makePellets(maze = MAZE) {
  const pellets = maze.map((row) => row.split("").map((t) => (isPelletTile(t) ? t : null)));
  const total = pellets.flat().filter(Boolean).length;
  return { grid: pellets, remaining: total, total };
}

/* ---- geometry ---- */

export const MAZE_W = COLS * TILE;
export const MAZE_H = ROWS * TILE;

export const tileCentre = (col, row) => ({
  x: col * TILE + TILE / 2,
  y: row * TILE + TILE / 2,
});

export const tileOf = (x, y) => ({
  col: Math.floor(x / TILE),
  row: Math.floor(y / TILE),
});

/** Wrap horizontally through the tunnel; vertically there's nowhere to go. */
export function wrapX(x) {
  if (x < -TILE / 2) return MAZE_W + TILE / 2;
  if (x > MAZE_W + TILE / 2) return -TILE / 2;
  return x;
}

export const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export const OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };

/**
 * Flood fill from a tile, used by the tests to prove the maze is playable and
 * by nothing at runtime.
 */
export function reachableTiles(maze, startCol, startRow) {
  const seen = new Set();
  const queue = [[startCol, startRow]];
  while (queue.length) {
    const [c, r] = queue.pop();
    const key = `${c},${r}`;
    if (seen.has(key)) continue;
    if (isWall(maze, c, r, { fish: true })) continue;
    seen.add(key);
    queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return seen;
}
