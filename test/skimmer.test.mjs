/**
 * Skimmer's rules: the stone bounces off everything it should, rafts take the
 * right number of hits, hatchers open on time, and a level can be cleared.
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
    bundle: true, write: false, format: "cjs", platform: "node",
    alias: { "@": path.join(root, "src") }, logLevel: "silent",
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

const M = await load("src/components/skimmer/model.js");
const L = await load("src/components/skimmer/levels.js");

const results = [];
const check = (name, pass, detail = "") => results.push([pass ? "PASS" : "FAIL", name, detail]);

const cb = () => {
  const seen = { score: 0, lives: 3, cleared: 0, over: null, breaks: 0, hatched: 0,
                 escaped: 0, squashed: 0, lost: 0, powerups: [] };
  return {
    seen,
    onScore: (v) => (seen.score = v),
    onLives: (v) => (seen.lives = v),
    onLevelClear: () => seen.cleared++,
    onGameOver: (r) => (seen.over = r),
    onBreak: () => seen.breaks++,
    onHatch: () => seen.hatched++,
    onEscape: () => seen.escaped++,
    onSquash: () => seen.squashed++,
    onLoseBall: () => seen.lost++,
    onPowerup: (k) => seen.powerups.push(k),
  };
};
const none = { left: false, right: false, launch: false, dragTarget: null };
const step = (g, c, input = none, seconds = 1, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) M.update(dt, g, input, c);
};
/** A level that's ready to play: no intro, stone served. */
const live = (opts = {}) => {
  const g = M.makeLevel(1, 0, 3, { rng: () => 0.5, ...opts });
  g.intro = 0;
  return g;
};

/* ---- the levels ---- */
check("every level is the declared width and has rafts",
  L.LAYOUTS.length >= 3 &&
    L.LAYOUTS.every((rows) => rows.length === L.ROWS && rows.every((r) => r.length === L.COLS)) &&
    L.LAYOUTS.every((rows) => rows.join("").split("").some((c) => c !== ".")),
  `${L.LAYOUTS.length} levels`);

check("every level is symmetric",
  L.LAYOUTS.every((rows) => rows.every((r) => r === r.split("").reverse().join(""))), "");

check("hatchers appear after the first level",
  !L.LAYOUTS[0].join("").includes("h") && L.LAYOUTS.slice(1).every((r) => r.join("").includes("h")),
  "");

check("levels repeat, faster each lap",
  L.layoutForLevel(1) === L.LAYOUTS[0] &&
    L.layoutForLevel(L.LAYOUTS.length + 1) === L.LAYOUTS[0] &&
    L.lapForLevel(L.LAYOUTS.length + 1) === 1,
  "");

/* ---- serving ---- */
let g = live(), c = cb();
step(g, c, none, 0.3);
check("the stone rests on the punt until served",
  g.balls.length === 1 && g.balls[0].held && !g.launched, "");

step(g, c, { ...none, launch: true }, 0.1);
check("tapping serves it", g.launched && !g.balls[0].held, "");

/* ---- bouncing ---- */
g = live(); c = cb();
g.launched = true;
g.balls = [{ x: 4, y: 300, vx: -200, vy: -100, r: M.BALL_R }];
step(g, c, none, 0.1);
check("the stone comes off the left wall", g.balls[0].vx > 0, `vx=${g.balls[0].vx.toFixed(0)}`);

g = live(); c = cb();
g.launched = true;
g.balls = [{ x: 180, y: 4, vx: 60, vy: -200, r: M.BALL_R }];
step(g, c, none, 0.1);
check("and off the top", g.balls[0].vy > 0, `vy=${g.balls[0].vy.toFixed(0)}`);

// The punt sends it back up, and the angle depends where it lands.
g = live(); c = cb();
g.launched = true;
g.paddle.x = 180;
g.balls = [{ x: 180, y: M.PADDLE_Y - 6, vx: 0, vy: 200, r: M.BALL_R }];
step(g, c, none, 0.05);
const centreHit = g.balls[0];
check("the punt sends it back up", centreHit.vy < 0, `vy=${centreHit.vy.toFixed(0)}`);

g = live(); c = cb();
g.launched = true;
g.paddle.x = 180;
g.balls = [{ x: 180 + M.PADDLE_W / 2 - 2, y: M.PADDLE_Y - 6, vx: 0, vy: 200, r: M.BALL_R }];
step(g, c, none, 0.05);
check("hitting the edge of the punt angles it outward", g.balls[0].vx > 40,
  `vx=${g.balls[0].vx.toFixed(0)}`);

/* ---- rafts ---- */
g = live(); c = cb();
g.launched = true;
g.bricks = [{ x: 100, y: 200, w: 28, h: 18, kind: "1", hp: 1, hatch: null, flash: 0 }];
g.balls = [{ x: 114, y: 224, vx: 0, vy: -200, r: M.BALL_R }];
step(g, c, none, 0.2);
check("a raft breaks in one hit and scores", g.bricks.length === 0 && c.seen.score > 0,
  `score=${c.seen.score}`);

g = live(); c = cb();
g.launched = true;
g.bricks = [{ x: 100, y: 200, w: 28, h: 18, kind: "2", hp: 2, hatch: null, flash: 0 }];
g.balls = [{ x: 114, y: 224, vx: 0, vy: -300, r: M.BALL_R }];
step(g, c, none, 0.05);
check("a thick raft survives the first hit", g.bricks.length === 1 && g.bricks[0].hp === 1,
  `hp=${g.bricks[0]?.hp}`);

/* ---- hatchers ---- */
g = live(); c = cb();
g.launched = true;
g.bricks = [{ x: 100, y: 120, w: 28, h: 18, kind: "hatcher", hp: 1, hatch: 0.05, flash: 0 }];
g.balls = [{ x: 300, y: 300, vx: 0, vy: -100, r: M.BALL_R }];
step(g, c, none, 0.2);
check("a hatcher left too long opens", c.seen.hatched === 1 && g.mosquitoes.length === 1,
  `hatched=${c.seen.hatched}`);

// It flies down, and the punt can squash it. At 46px/s it needs a while to
// cross the water, and no stone in play so a lost ball can't interrupt.
g.balls = [];
g.paddle.x = g.mosquitoes[0].x;
step(g, c, none, 9);
check("a mosquito caught by the punt scores", c.seen.squashed === 1 && c.seen.escaped === 0,
  `squashed=${c.seen.squashed}`);

// ...or it gets past, and that costs.
g = live(); c = cb();
g.launched = true;
g.bricks = [];
g.mosquitoes = [{ x: 40, y: M.H - 40, vx: 0, t: 0 }];
g.paddle.x = 300;
g.score = 500;
step(g, c, none, 3);
check("a mosquito that gets past costs points", c.seen.escaped === 1 && g.score < 500,
  `escaped=${c.seen.escaped} score=${g.score}`);

/* ---- rallies, lives, levels ---- */
g = live(); c = cb();
g.launched = true;
// Stacked rafts would bounce the stone away from the second; one above and one
// below means it breaks one going up and the next coming down.
g.bricks = [
  { x: 100, y: 200, w: 28, h: 18, kind: "1", hp: 1, hatch: null, flash: 0 },
  { x: 100, y: 250, w: 28, h: 18, kind: "1", hp: 1, hatch: null, flash: 0 },
];
g.balls = [{ x: 114, y: 232, vx: 0, vy: -260, r: M.BALL_R }];
step(g, c, none, 0.5);
check("a rally counts up as rafts break without touching the punt", g.bestCombo >= 2,
  `bestCombo=${g.bestCombo}`);

g = live(); c = cb();
g.launched = true;
g.balls = [{ x: 180, y: M.H - 2, vx: 0, vy: 300, r: M.BALL_R }];
step(g, c, none, 0.2);
check("losing the stone costs a life", c.seen.lives === 2 && c.seen.lost === 1,
  `lives=${c.seen.lives}`);

g = live(); c = cb();
g.lives = 1;
g.launched = true;
g.balls = [{ x: 180, y: M.H - 2, vx: 0, vy: 300, r: M.BALL_R }];
step(g, c, none, 0.2);
check("the last stone ends the game", c.seen.over === "drowned", `over=${c.seen.over}`);

g = live(); c = cb();
g.launched = true;
g.bricks = [];
g.mosquitoes = [];
step(g, c, none, 0.1);
check("clearing the water finishes the level", c.seen.cleared === 1, "");

/* ---- power-ups ---- */
g = live(); c = cb();
const startW = g.paddle.w;
M.applyPowerup(g, "wide", c.current ?? c);
check("wide makes the punt wider, for a while", g.paddle.w > startW && g.paddle.wideUntil > 0,
  `w=${g.paddle.w}`);

g = live(); c = cb();
g.launched = true;
g.balls = [{ x: 180, y: 300, vx: 60, vy: -180, r: M.BALL_R }];
M.applyPowerup(g, "multi", c);
check("multi splits every stone in play", g.balls.length === 3, `balls=${g.balls.length}`);

/* ---- the stuck-ball guard ---- */
g = live(); c = cb();
g.launched = true;
g.bricks = [{ x: 100, y: 200, w: 28, h: 18, kind: "1", hp: 1, hatch: null, flash: 0 }];
g.balls = [{ x: 114, y: 209, vx: 300, vy: 2, r: M.BALL_R }]; // skimming along a raft's face
step(g, c, none, 0.1);
const ball = g.balls[0];
const ratio = Math.abs(ball.vy) / Math.hypot(ball.vx, ball.vy);
check("a near-horizontal stone is nudged back off the flat", ratio > 0.3,
  `vy/speed=${ratio.toFixed(2)}`);

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? "  (" + d + ")" : ""}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
