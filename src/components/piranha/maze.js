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

/**
 * 24px tiles rather than 16: the fish and the bunny need room to read as
 * animals rather than blobs, so the grid got coarser and the maze smaller to
 * keep the same play area.
 */
export const TILE = 21;
export const COLS = 17;
export const ROWS = 21;

/**
 * Left half of each row (7 columns) plus the centre column.
 *
 * Laid out in the classic arcade idiom rather than as a uniform lattice: blocks
 * of varied shape, a central pen with one door, an open lane top and bottom, and
 * a tunnel row that runs off both sides and wraps. Corridors stay one tile wide
 * — the suite asserts it — while walls are free to be blocks, since the renderer
 * outlines contiguous walls as one shape rather than tile by tile.
 */
const mirror = (half) => half.split("").reverse().join("");

/* The pen block is shared by every layout: same pen, same door, same tunnel row,
   so the actors' start positions stay valid whichever maze is in play. */
const PEN_ROWS = [
  ["####.###", "."], //  7  above the pen door
  ["####.###", "-"], //  8  pen roof + door
  ["####.#  ", " "], //  9  pen interior
  ["####.###", "#"], // 10  pen floor
  ["####.###", "."], // 11
  ["........", "."], // 12  tunnel: runs off both sides and wraps
  ["####.###", "."], // 13
];

/* Three layouts, rotating by depth, so wave 4 isn't wave 1 with faster fish. */
const LAYOUTS = [
  {
    top: [["########", "#"], ["#.......", "#"], ["#.##.##.", "#"], ["#o##.##.", "#"],
          ["#.......", "."], ["#.##.#.#", "#"], ["#....#..", "."]],
    bottom: [["#.......", "."], ["#o##.##.", "#"], ["#..#....", "."], ["##.#.##.", "#"],
             ["#....#..", "."], ["#.##.##.", "#"], ["########", "#"]],
  },
  {
    top: [["########", "#"], ["#.......", "."], ["#.###.#.", "#"], ["#o..#.#.", "."],
          ["#.#.#.#.", "#"], ["#.#.....", "."], ["#.##.#.#", "."]],
    bottom: [["#.#.....", "."], ["#o#.###.", "#"], ["#.......", "."], ["#.#####.", "#"],
             ["#.......", "."], ["#.##.##.", "#"], ["########", "#"]],
  },
  {
    top: [["########", "#"], ["#..##...", "."], ["#.#..#.#", "#"], ["#o#.##.#", "."],
          ["#.......", "."], ["#.###.#.", "#"], ["#.....#.", "."]],
    bottom: [["#.....#.", "."], ["#.###.#.", "#"], ["#.......", "."], ["#o#.##.#", "#"],
             ["#.#..#.#", "."], ["#..##...", "."], ["########", "#"]],
  },
];

const assemble = ({ top, bottom }) =>
  [...top, ...PEN_ROWS, ...bottom].map(([left, centre]) => left + centre + mirror(left));

/** Every layout, in rotation order. */
export const MAZES = LAYOUTS.map(assemble);

/** Which maze a given depth is played on. */
export const mazeForLevel = (level) => MAZES[(level - 1) % MAZES.length];

/** The first layout, used wherever a single maze is wanted (tests, defaults). */
export const MAZE = MAZES[0];

export const TUNNEL_ROW = 12; // wraps left/right, the way a river runs off-screen

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

/**
 * Wrap horizontally through the tunnel; vertically there's nowhere to go.
 * Leaving the left mouth puts you just outside the right one, still travelling
 * in the same direction, so the crossing looks continuous.
 */
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
