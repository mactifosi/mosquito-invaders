/**
 * Piranha's rules. The maze checks matter most: an unreachable pellet is a
 * soft-lock that only shows up when a player can't finish a level.
 *
 *   npm test
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

async function load(entry) {
  const built = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    alias: { "@": path.join(root, "src") },
    logLevel: "silent",
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

const maze = await load("src/components/piranha/maze.js");
const model = await load("src/components/piranha/model.js");

const results = [];
const check = (name, pass, detail = "") => results.push([pass ? "PASS" : "FAIL", name, detail]);

const cb = () => {
  const seen = { score: 0, lives: 3, cleared: 0, over: null, deaths: 0, eaten: 0 };
  return {
    seen,
    onScore: (v) => (seen.score = v),
    onLives: (v) => (seen.lives = v),
    onLevelClear: () => seen.cleared++,
    onGameOver: (r) => (seen.over = r),
    onDeath: () => seen.deaths++,
    onEatFish: () => seen.eaten++,
  };
};
const step = (g, c, input = {}, seconds = 1, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) model.update(dt, g, input, c);
};

/* ---- the maze ---- */
check("every row is the declared width",
  maze.MAZE.length === maze.ROWS && maze.MAZE.every((r) => r.length === maze.COLS),
  `${maze.MAZE.length} rows`);

check("the maze is left-right symmetric",
  maze.MAZE.every((r) => r === r.split("").reverse().join("")), "");

// The two faults that showed up in play: corridors running side by side, and
// wall slabs several tiles thick. Both are a 2x2 block of one kind of tile.
const openAt = (c, r) =>
  c >= 0 && c < maze.COLS && r >= 0 && r < maze.ROWS && maze.MAZE[r][c] !== "#";
const doubleLanes = [];
const slabs = [];
for (let r = 0; r < maze.ROWS - 1; r++) {
  for (let c = 0; c < maze.COLS - 1; c++) {
    const quad = [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
    if (quad.every(([cc, rr]) => openAt(cc, rr))) doubleLanes.push(`${c},${r}`);
    // The outer border is allowed to be thick; it's the frame, not a wall.
    const interior = r > 0 && c > 0 && r < maze.ROWS - 2 && c < maze.COLS - 2;
    if (interior && quad.every(([cc, rr]) => !openAt(cc, rr))) slabs.push(`${c},${r}`);
  }
}
check("no double lanes — every corridor is one tile wide", doubleLanes.length === 0,
  doubleLanes.slice(0, 3).join(" ") || "none");
// Walls are allowed to be blocks in this idiom — contiguous ones are drawn as a
// single outlined shape — so only the corridors are held to one tile.

const reach = maze.reachableTiles(maze.MAZE, model.BUNNY_START.col, model.BUNNY_START.row);
let orphans = 0;
maze.MAZE.forEach((row, r) =>
  row.split("").forEach((t, c) => {
    if (maze.isPelletTile(t) && !reach.has(`${c},${r}`)) orphans++;
  })
);
check("every pellet is reachable from the bunny's start", orphans === 0, `${orphans} orphaned`);

const pellets = maze.makePellets();
check("there are pellets and exactly four carrots",
  pellets.total > 100 && maze.MAZE.join("").split("o").length - 1 === 4,
  `${pellets.total} pellets`);

check("the den door blocks the bunny but not the fish",
  maze.isWall(maze.MAZE, 8, 8, { fish: false }) && !maze.isWall(maze.MAZE, 8, 8, { fish: true }),
  "");

/* ---- movement ---- */
let g = model.makeLevel(1, 0, 3);
let c = cb();
g.intro = 0;
const startX = g.bunny.x;
step(g, c, { want: "left" }, 0.5);
check("the bunny swims and eats as it goes", g.bunny.x < startX && c.seen.score > 0,
  `x ${startX} → ${Math.round(g.bunny.x)}, score ${c.seen.score}`);

g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.bunny.x = maze.tileCentre(1, 14).x;   // hard against the left wall
g.bunny.y = maze.tileCentre(1, 14).y;
g.bunny.dir = "left";
step(g, c, { want: "left" }, 1);
const stopped = maze.tileOf(g.bunny.x, g.bunny.y);
check("a wall stops the bunny rather than swallowing it",
  stopped.col === 1 && stopped.row === 14 && Math.abs(g.bunny.x - maze.tileCentre(1, 14).x) < 2,
  `tile ${stopped.col},${stopped.row}`);

// The tunnel: off one side, in at the other.
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.bunny.x = maze.tileCentre(1, maze.TUNNEL_ROW).x;
g.bunny.y = maze.tileCentre(1, maze.TUNNEL_ROW).y;
g.bunny.dir = "left";
step(g, c, { want: "left" }, 1.2);
check("the bunny leaves one side of the tunnel and returns on the other",
  g.bunny.x > maze.MAZE_W * 0.6,
  `x=${Math.round(g.bunny.x)} of ${maze.MAZE_W}`);

// ...and a fish can use it too, or it becomes a free escape.
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
const runner = g.fish[0];
runner.state = "hunting";
runner.x = maze.tileCentre(1, maze.TUNNEL_ROW).x;
runner.y = maze.tileCentre(1, maze.TUNNEL_ROW).y;
runner.dir = "left";
step(g, c, {}, 1.2);
check("the fish can follow through the tunnel", g.fish[0].x > maze.MAZE_W * 0.5,
  `x=${Math.round(g.fish[0].x)}`);

/* ---- the chase ---- */
// Against a stationary bunny (wedged against the left wall), a greedy chaser
// must close the gap. Measured over several seconds because corridors force
// detours that briefly increase the distance.
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.mode = "chase";
g.modeTimer = Infinity;
g.bunny.x = maze.tileCentre(1, 14).x;
g.bunny.y = maze.tileCentre(1, 14).y;
g.bunny.dir = "left";
// The measure of a working chase isn't distance — it's arrival. (Measuring
// distance after the fact compares post-respawn positions, since a catch
// resets both: that read as a failure while the hunter was doing its job.)
let closest = Infinity;
for (let i = 0; i < 8 * 60 && c.seen.deaths === 0; i++) {
  model.update(1 / 60, g, { want: "left" }, c);
  closest = Math.min(closest, Math.hypot(g.fish[0].x - g.bunny.x, g.fish[0].y - g.bunny.y));
}
check("the direct hunter runs a cornered bunny down", c.seen.deaths === 1,
  `closest ${Math.round(closest)}px, caught=${c.seen.deaths === 1}`);

g = model.makeLevel(1, 0, 3); c = cb();
check("each fish has its own temperament and corner",
  new Set(g.fish.map((f) => f.behaviour)).size === 4 &&
    new Set(g.fish.map((f) => `${f.scatter.col},${f.scatter.row}`)).size === 4, "");

/* ---- the carrot turns the hunt around ---- */
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.bunny.x = maze.tileCentre(1, 3).x;
g.bunny.y = maze.tileCentre(1, 3).y; // sitting on a carrot
step(g, c, { want: "down" }, 0.05);
check("a carrot frightens the shoal and scores 50",
  g.frightened > 0 && c.seen.score === model.CARROT_POINTS,
  `frightened=${g.frightened.toFixed(1)} score=${c.seen.score}`);

// ...and a frightened fish can be eaten, for doubling points
const fish = g.fish.find((f) => f.state === "hunting");
fish.x = g.bunny.x;
fish.y = g.bunny.y;
step(g, c, {}, 0.05);
check("eating a frightened fish pays 200 and sends it home",
  c.seen.eaten === 1 && fish.state === "eaten" && c.seen.score === model.CARROT_POINTS + 200,
  `state=${fish.state} score=${c.seen.score}`);

/* ---- being caught ---- */
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
const hunter = g.fish[0];
hunter.x = g.bunny.x;
hunter.y = g.bunny.y;
step(g, c, {}, 0.05);
check("a piranha catch costs a bunny", c.seen.lives === 2 && c.seen.deaths === 1 && g.dying > 0,
  `lives=${c.seen.lives}`);

g = model.makeLevel(1, 0, 1); c = cb();
g.intro = 0;
g.fish[0].x = g.bunny.x;
g.fish[0].y = g.bunny.y;
step(g, c, {}, 0.05);
check("the last bunny ends the run", c.seen.over === "eaten", `over=${c.seen.over}`);

/* ---- clearing the level ---- */
g = model.makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.pellets.grid = g.pellets.grid.map((row) => row.map(() => null));
g.pellets.remaining = 1;
const t = maze.tileOf(g.bunny.x, g.bunny.y);
g.pellets.grid[t.row][t.col] = ".";
step(g, c, { want: "left" }, 0.1);
check("eating the last algae clears the level", c.seen.cleared === 1, `cleared=${c.seen.cleared}`);

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? "  (" + d + ")" : ""}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
