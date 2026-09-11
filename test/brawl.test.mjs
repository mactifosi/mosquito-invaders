/**
 * Bayou Brawl's rules: hits land only during active frames, blocking works only
 * facing the attacker, low attacks need a low block, and rounds resolve.
 *
 *   npm test
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

const built = await esbuild.build({
  entryPoints: [path.join(root, "src/components/brawl/model.js")],
  bundle: true, write: false, format: "cjs", platform: "node",
  alias: { "@": path.join(root, "src") }, logLevel: "silent",
});
const mod = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);
const M = mod.exports;

const results = [];
const check = (name, pass, detail = "") => results.push([pass ? "PASS" : "FAIL", name, detail]);

const cb = () => {
  const seen = { score: 0, wins: [0, 0], hits: 0, playerHits: 0, blocks: 0, ko: null, over: null, specials: 0 };
  return {
    seen,
    onScore: (v) => (seen.score = v),
    onRound: (w) => (seen.wins = [...w]),
    onHit: (_d, by) => { seen.hits++; if (by === "vex") seen.playerHits++; },
    onBlock: () => seen.blocks++,
    onKO: (who) => (seen.ko = who),
    onSpecial: () => seen.specials++,
    onMatchOver: (who) => (seen.over = who),
  };
};
const none = {};
const step = (g, c, input = none, seconds = 0.5, dt = 1 / 60, opp = none) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) M.update(dt, g, input, c, opp);
};
/** ...and these two let the AI off its leash. */
const stepLive = (g, c, input = none, seconds = 0.5, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) M.update(dt, g, input, c);
};
/** Put the two fighters at a chosen gap, ready to act. */
const setup = (gap = 40, opts = {}) => {
  const g = M.makeMatch(1, 0, { rng: () => 0.5, ...opts });
  g.intro = 0;
  const [p, o] = g.fighters;
  p.x = M.STAGE_W / 2 - gap / 2;
  o.x = M.STAGE_W / 2 + gap / 2;
  p.facing = 1;
  o.facing = -1;
  return g;
};

/* ---- attacks ---- */
let g = setup(46), c = cb();
step(g, c, { light: true }, 0.02);
check("an attack commits: the fighter is locked into the move",
  g.fighters[0].state === "attack" && g.fighters[0].move === "light",
  `state=${g.fighters[0].state}`);

const beforeHealth = g.fighters[1].health;
step(g, c, {}, 0.2);
check("a jab in range takes health", g.fighters[1].health < beforeHealth,
  `${beforeHealth} → ${g.fighters[1].health}`);

// Out of range it whiffs entirely.
g = setup(150); c = cb();
step(g, c, { light: true }, 0.4);
check("a jab out of range hits nothing", g.fighters[1].health === M.MAX_HEALTH, "");

// One swing, one hit — no multi-hit from a single active window.
g = setup(46); c = cb();
step(g, c, { light: true }, 0.4);
check("a single swing lands at most once", c.seen.playerHits === 1, `hits=${c.seen.playerHits}`);

/* ---- blocking ---- */
g = setup(46); c = cb();
const hp = g.fighters[1].health;
step(g, c, { heavy: true }, 0.6, 1 / 60, { block: true });
check("blocking a heavy costs only chip damage",
  c.seen.blocks === 1 && g.fighters[1].health > hp - M.MOVES.heavy.damage,
  `blocked=${c.seen.blocks} health=${g.fighters[1].health}`);

// A standing block does not stop a sweep.
g = setup(46); c = cb();
step(g, c, { low: true }, 0.6, 1 / 60, { block: true });
check("a standing block doesn't stop a sweep", c.seen.playerHits === 1 && c.seen.blocks === 0,
  `hits=${c.seen.playerHits} blocked=${c.seen.blocks}`);

// Crouch-blocking does.
g = setup(46); c = cb();
step(g, c, { low: true }, 0.6, 1 / 60, { block: true, down: true });
check("crouch-blocking stops a sweep", c.seen.blocks === 1, `blocked=${c.seen.blocks}`);

// Blocking the wrong way round doesn't work.
g = setup(46); c = cb();
step(g, c, { light: true }, 0.02, 1 / 60, { block: true });
g.fighters[1].facing = 1; // turned away mid-swing
step(g, c, { light: true }, 0.4, 1 / 60, { block: true });
check("a block facing the wrong way is no block", c.seen.playerHits === 1, `hits=${c.seen.playerHits}`);

/* ---- specials ---- */
g = setup(200); c = cb();
g.fighters[0].meter = 100;
step(g, c, { special: true }, 0.35);
check("a special spends meter and throws a projectile",
  c.seen.specials === 1 && g.fighters[0].meter < 100,
  `meter=${g.fighters[0].meter} projectiles=${g.projectiles.length}`);

g = setup(200); c = cb();
g.fighters[0].meter = 5;
step(g, c, { special: true }, 0.35);
check("a special needs a full enough meter", c.seen.specials === 0, "");

/* ---- rounds and the match ---- */
g = setup(46); c = cb();
g.fighters[1].health = 4;
step(g, c, { heavy: true }, 0.6, 1 / 60);
check("dropping a fighter triggers the finisher and a KO", c.seen.ko !== null && Boolean(g.finisher),
  `ko=${c.seen.ko}`);
step(g, c, {}, 3.2); // the finisher holds for 1.6s, then a 1.2s breath
check("the round is awarded and the next one starts", c.seen.wins[0] === 1 && g.round === 2,
  `wins=${c.seen.wins} round=${g.round}`);

// Two rounds ends it.
g = setup(46); c = cb();
g.wins = [1, 0];
g.fighters[1].health = 4;
step(g, c, { heavy: true }, 2.4, 1 / 60);
check("two rounds wins the match", c.seen.over === "player" && g.ended,
  `over=${c.seen.over}`);

// Running out of time gives it to whoever is healthier.
g = setup(120); c = cb();
g.time = 0.02;
g.fighters[0].health = 80;
g.fighters[1].health = 30;
step(g, c, {}, 0.1);
check("time out goes to the healthier fighter", g.fighters[1].health === 0 && Boolean(g.finisher),
  `p=${g.fighters[0].health} o=${g.fighters[1].health}`);

/* ---- movement and the stage ---- */
g = setup(60); c = cb();
const x0 = g.fighters[0].x;
step(g, c, { right: true }, 0.3);
check("walking moves the fighter", g.fighters[0].x > x0, `${Math.round(x0)} → ${Math.round(g.fighters[0].x)}`);

g = setup(60); c = cb();
g.fighters[0].x = 10;
step(g, c, { left: true }, 1);
check("the stage edge holds", g.fighters[0].x >= M.FIGHTER_W / 2 - 0.01,
  `x=${g.fighters[0].x.toFixed(1)}`);

g = setup(40); c = cb();
step(g, c, { right: true }, 1);
check("fighters can't walk through each other",
  Math.abs(g.fighters[0].x - g.fighters[1].x) >= M.PUSH_APART - 1,
  `gap=${Math.abs(g.fighters[0].x - g.fighters[1].x).toFixed(1)}`);

g = setup(60); c = cb();
step(g, c, { up: true }, 0.1);
check("jumping leaves the ground", !g.fighters[0].onGround && g.fighters[0].y < M.GROUND_Y, "");
step(g, c, {}, 1.2);
check("and lands again", g.fighters[0].onGround && g.fighters[0].y === M.GROUND_Y, "");

/* ---- the opponent ---- */
g = setup(240); c = cb();
const gap0 = Math.abs(g.fighters[0].x - g.fighters[1].x);
stepLive(g, c, {}, 3);
check("the opponent closes the distance rather than standing still",
  Math.abs(g.fighters[0].x - g.fighters[1].x) < gap0,
  `${Math.round(gap0)} → ${Math.round(Math.abs(g.fighters[0].x - g.fighters[1].x))}`);

g = setup(46); c = cb();
stepLive(g, c, {}, 6);
check("the opponent actually attacks", g.fighters[0].health < M.MAX_HEALTH,
  `player health ${g.fighters[0].health}`);

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? "  (" + d + ")" : ""}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
