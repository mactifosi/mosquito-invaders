/**
 * Piranha — model and rules.
 *
 * A maze-chase: the bunny eats algae while four piranhas hunt it. Kept free of
 * React and canvas so `npm test` can drive it headlessly, the same way Mosquito
 * Invaders' update() is tested.
 */
import {
  MAZE,
  mazeForLevel,
  TILE,
  COLS,
  ROWS,
  DIRS,
  OPPOSITE,
  TUNNEL_ROW,
  isWall,
  makePellets,
  tileCentre,
  tileOf,
  wrapX,
  MAZE_W,
} from "@/components/piranha/maze";

/* Scaled with TILE: a 24px grid needs proportionally faster swimming to feel
   the same, otherwise everything wades. */
export const BUNNY_SPEED = 100; // px/sec, scaled with TILE
export const FISH_SPEED = 92;
export const FISH_FRIGHTENED_SPEED = 58;
export const FISH_EATEN_SPEED = 223; // hurrying home as a pair of eyes

export const PELLET_POINTS = 10;
export const CARROT_POINTS = 50;
export const FISH_POINTS = [200, 400, 800, 1600]; // per fish within one carrot
export const CHAIN_BONUS = 2000; // all four on a single carrot

/* Near miss: slipping past a hunter within a tile. Rewards the brave line, and
   tells a new player that the risky route is the right one. */
export const NEAR_MISS_POINTS = 25;
const NEAR_MISS_RANGE = 1.15; // tiles
const NEAR_MISS_CLEAR = 2.2; // ...and how far away it has to get before it counts again
export const FRIGHTENED_TIME = 7;
export const INTRO_TIME = 1.6;
export const DEATH_TIME = 1.4;

/**
 * Where everything starts. The bunny sits in the open bottom corridor — row 16
 * looked right but is a vertical shaft, so it could only ever swim up or down
 * from a standing start, which feels broken in the first second of play.
 */
export const BUNNY_START = { col: 8, row: 16 };
export const DEN = { col: 8, row: 9 };
export const DEN_EXIT = { col: 8, row: 7 };

/**
 * Four hunters, four temperaments — that's what turns identical pursuers into a
 * puzzle. Each has a scatter corner it retreats to when the mode flips.
 */
export const FISH = [
  {
    id: "razor",
    colour: "#e0384f",
    behaviour: "direct", // straight for the bunny
    scatter: { col: 15, row: 1 },
    start: { col: 8, row: 7 },
    releaseAt: 0,
  },
  {
    id: "amber",
    colour: "#ff8a3d",
    behaviour: "ambush", // four tiles ahead of where the bunny is going
    scatter: { col: 1, row: 1 },
    start: { col: 7, row: 9 },
    releaseAt: 3,
  },
  {
    id: "coral",
    colour: "#f472b6",
    behaviour: "flank", // plays off the direct one, pincering
    scatter: { col: 15, row: 19 },
    start: { col: 8, row: 9 },
    releaseAt: 7,
  },
  {
    id: "kelp",
    colour: "#6fe3c0",
    behaviour: "shy", // chases from afar, loses nerve up close
    scatter: { col: 1, row: 19 },
    start: { col: 9, row: 9 },
    releaseAt: 12,
  },
];

/** Scatter/chase alternation. Later waves spend longer hunting. */
const MODE_PLAN = [
  { mode: "scatter", time: 6 },
  { mode: "chase", time: 20 },
  { mode: "scatter", time: 5 },
  { mode: "chase", time: 20 },
  { mode: "scatter", time: 4 },
  { mode: "chase", time: Infinity },
];

export function makeLevel(level, score, lives, opts = {}) {
  const { speed = 1, rng = Math.random, maze = mazeForLevel(level) } = opts;
  const pellets = makePellets(maze);

  return {
    level,
    score,
    lives,
    maze,
    pellets,
    bunny: {
      ...tileCentre(BUNNY_START.col, BUNNY_START.row),
      dir: "left",
      want: "left",
      mouth: 0, // animation phase
    },
    fish: FISH.map((f) => ({
      ...f,
      ...tileCentre(f.start.col, f.start.row),
      dir: "up",
      state: f.releaseAt === 0 ? "hunting" : "penned",
      releaseTimer: f.releaseAt,
      near: false, // mid near-miss, so one pass scores once
    })),
    modeIndex: 0,
    modeTimer: MODE_PLAN[0].time,
    mode: MODE_PLAN[0].mode,
    frightened: 0,
    eatenThisCarrot: 0,
    nearMisses: 0,
    chains: 0,
    intro: INTRO_TIME,
    dying: 0,
    ended: false,
    speed: speed * (1 + (level - 1) * 0.06),
    rng,
    t: 0,
    popups: [],
  };
}

/* ---- movement helpers ---- */

const centred = (v) => Math.abs((v % TILE) - TILE / 2) < 0.6;

/**
 * If this step crosses a tile centre, stop exactly on it.
 *
 * Turns are only allowed at centres, and at 24px tiles an actor moves up to
 * 4px a frame — enough to step straight over the centre and never register as
 * being on one, so turns would silently fail. Snapping makes that impossible
 * at any speed, at the cost of a hair of velocity through junctions.
 */
function snapToCentre(before, after, step) {
  if (step === 0) return after;
  if (step > 0) {
    const centre = (Math.floor((before - TILE / 2) / TILE) + 1) * TILE + TILE / 2;
    return centre <= after ? centre : after;
  }
  const centre = (Math.ceil((before - TILE / 2) / TILE) - 1) * TILE + TILE / 2;
  return centre >= after ? centre : after;
}

/**
 * Is the tile in `dir` passable? The den door is one-way: only a fish that has
 * been eaten may swim back in. Without that, a hunter targeting a bunny below
 * the den dives through the door and bounces around inside the pen forever —
 * which is exactly what it did on the first run.
 */
function canGo(g, col, row, dir, throughDoor = false) {
  const d = DIRS[dir];
  const nc = col + d.x;
  const nr = row + d.y;
  // The tunnel mouths sit outside the grid, where every lookup reads as wall.
  // On that row, leaving sideways is exactly what's meant to happen.
  if (row === TUNNEL_ROW && d.y === 0 && (nc < 0 || nc >= COLS)) return true;
  return !isWall(g.maze, nc, nr, { fish: throughDoor });
}

function distance(a, b) {
  return (a.col - b.col) ** 2 + (a.row - b.row) ** 2;
}

/** Where each fish wants to be, given its temperament. */
export function targetFor(g, f) {
  const bunny = tileOf(g.bunny.x, g.bunny.y);
  if (f.state === "eaten") return DEN;
  if (g.frightened > 0) return f.scatter; // fleeing, target is ignored anyway
  if (g.mode === "scatter") return f.scatter;

  const ahead = DIRS[g.bunny.dir];
  switch (f.behaviour) {
    case "ambush":
      return { col: bunny.col + ahead.x * 4, row: bunny.row + ahead.y * 4 };
    case "flank": {
      // Twice the vector from the direct hunter through a point ahead of the
      // bunny — so it arrives from the far side.
      const razor = g.fish[0];
      const r = tileOf(razor.x, razor.y);
      const pivot = { col: bunny.col + ahead.x * 2, row: bunny.row + ahead.y * 2 };
      return { col: pivot.col * 2 - r.col, row: pivot.row * 2 - r.row };
    }
    case "shy": {
      const me = tileOf(f.x, f.y);
      return distance(me, bunny) > 64 ? bunny : f.scatter; // 8 tiles
    }
    default:
      return bunny;
  }
}

/** Columns wrap on the tunnel row, and nowhere else. */
const wrapCol = (c) => ((c % COLS) + COLS) % COLS;

function neighbours(g, col, row, throughDoor) {
  const out = [];
  for (const dir of ["up", "left", "down", "right"]) {
    const d = DIRS[dir];
    let nc = col + d.x;
    const nr = row + d.y;
    if (row === TUNNEL_ROW && d.y === 0) nc = wrapCol(nc);
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
    if (isWall(g.maze, nc, nr, { fish: throughDoor })) continue;
    out.push({ dir, col: nc, row: nr });
  }
  return out;
}

/**
 * Distance in tiles from every reachable tile to a target, by breadth-first
 * search.
 *
 * Straight-line distance — the classic rule — can't cope with a tunnel that
 * wraps: a hunter would keep choosing "left" because left always looked closer,
 * ride the tunnel round and round, and never turn off toward its quarry. Real
 * path distance has no local minima, so a fish that wants you finds you.
 *
 * Cached per target per frame: four fish usually share one or two targets.
 */
function distanceField(g, target, throughDoor) {
  const key = `${target.col},${target.row},${throughDoor ? 1 : 0}`;
  if (!g.fields || g.fieldsAt !== g.t) {
    g.fields = new Map();
    g.fieldsAt = g.t;
  }
  const cached = g.fields.get(key);
  if (cached) return cached;

  const dist = new Int16Array(COLS * ROWS).fill(-1);
  const start = { col: Math.max(0, Math.min(COLS - 1, target.col)), row: Math.max(0, Math.min(ROWS - 1, target.row)) };
  if (isWall(g.maze, start.col, start.row, { fish: true })) {
    // A target inside a wall (an ambush point can land in one) — fall back to
    // the nearest open tile, so the field is never empty.
    outer: for (let radius = 1; radius < 6; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = start.col + dc;
          const r = start.row + dr;
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          if (!isWall(g.maze, c, r, { fish: true })) { start.col = c; start.row = r; break outer; }
        }
      }
    }
  }

  const queue = [start.row * COLS + start.col];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const col = idx % COLS;
    const row = (idx / COLS) | 0;
    for (const n of neighbours(g, col, row, throughDoor)) {
      const ni = n.row * COLS + n.col;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[idx] + 1;
      queue.push(ni);
    }
  }

  g.fields.set(key, dist);
  return dist;
}

/** Fish choose at tile centres: best legal direction, never a straight reverse. */
function chooseDirection(g, f, target) {
  const { col, row } = tileOf(f.x, f.y);
  const throughDoor = f.state === "eaten";
  const options = ["up", "left", "down", "right"].filter(
    (d) => d !== OPPOSITE[f.dir] && canGo(g, col, row, d, throughDoor)
  );
  const legal = options.length ? options : [OPPOSITE[f.dir]]; // dead end: turn around

  if (g.frightened > 0 && f.state === "hunting") {
    return legal[Math.floor(g.rng() * legal.length)]; // panic, not strategy
  }

  const field = distanceField(g, target, throughDoor);
  let best = legal[0];
  let bestDist = Infinity;
  for (const d of legal) {
    const step = DIRS[d];
    let nc = col + step.x;
    const nr = row + step.y;
    if (row === TUNNEL_ROW && step.y === 0) nc = wrapCol(nc);
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
    const dist = field[nr * COLS + nc];
    if (dist === -1) continue; // unreachable from here
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function moveAlong(g, actor, dir, speed, dt, throughDoor) {
  const step = DIRS[dir];
  let { x, y } = actor;
  const { col, row } = tileOf(x, y);

  // Only stop at a wall once actually at the tile centre, so corners feel crisp.
  const blocked = !canGo(g, col, row, dir, throughDoor);
  if (blocked && centred(x) && centred(y)) return { x, y, moved: false };

  const fromX = x;
  const fromY = y;
  x += step.x * speed * dt;
  y += step.y * speed * dt;
  x = snapToCentre(fromX, x, step.x);
  y = snapToCentre(fromY, y, step.y);

  // Stay glued to the corridor's centre line on the other axis.
  if (step.x !== 0) y = tileCentre(col, row).y;
  if (step.y !== 0) x = tileCentre(col, row).x;

  if (row === TUNNEL_ROW) x = wrapX(x);
  else x = Math.max(TILE / 2, Math.min(MAZE_W - TILE / 2, x));

  return { x, y, moved: true };
}

/* ---- update ---- */

export function update(dt, g, input, cb) {
  if (g.ended) return;
  g.t += dt;

  for (let i = g.popups.length - 1; i >= 0; i--) {
    g.popups[i].life -= dt;
    if (g.popups[i].life <= 0) g.popups.splice(i, 1);
  }

  if (g.dying > 0) {
    g.dying -= dt;
    if (g.dying <= 0) respawn(g, cb);
    return;
  }

  if (g.intro > 0) {
    g.intro -= dt;
    return;
  }

  /* ---- mode alternation, paused while the carrot is active ---- */
  if (g.frightened > 0) {
    g.frightened -= dt;
    if (g.frightened <= 0) g.eatenThisCarrot = 0;
  } else if (g.modeTimer !== Infinity) {
    g.modeTimer -= dt;
    if (g.modeTimer <= 0 && g.modeIndex < MODE_PLAN.length - 1) {
      g.modeIndex += 1;
      g.mode = MODE_PLAN[g.modeIndex].mode;
      g.modeTimer = MODE_PLAN[g.modeIndex].time;
      // A mode flip turns the shoal around — the tell that something changed.
      for (const f of g.fish) if (f.state === "hunting") f.dir = OPPOSITE[f.dir];
    }
  }

  /* ---- bunny ---- */
  const b = g.bunny;
  if (input.want) b.want = input.want;
  b.mouth += dt * 10;

  const bt = tileOf(b.x, b.y);
  if (b.want !== b.dir && centred(b.x) && centred(b.y) && canGo(g, bt.col, bt.row, b.want, false)) {
    b.dir = b.want;
  }
  const moved = moveAlong(g, b, b.dir, BUNNY_SPEED * g.speed, dt, false);
  b.x = moved.x;
  b.y = moved.y;

  /* ---- eating ---- */
  const here = tileOf(b.x, b.y);
  const pellet = g.pellets.grid[here.row]?.[here.col];
  if (pellet) {
    g.pellets.grid[here.row][here.col] = null;
    g.pellets.remaining -= 1;
    if (pellet === "o") {
      g.score += CARROT_POINTS;
      g.frightened = FRIGHTENED_TIME;
      g.eatenThisCarrot = 0;
      for (const f of g.fish) if (f.state === "hunting") f.dir = OPPOSITE[f.dir];
      cb.onCarrot?.();
    } else {
      g.score += PELLET_POINTS;
      cb.onPellet?.();
    }
    cb.onScore(g.score);
    if (g.pellets.remaining === 0) {
      g.ended = true;
      cb.onLevelClear();
      return;
    }
  }

  /* ---- fish ---- */
  for (const f of g.fish) {
    if (f.state === "penned") {
      f.releaseTimer -= dt;
      // Bob in the den until released, then swim out through the door.
      f.y = tileCentre(DEN.col, DEN.row).y + Math.sin(g.t * 3) * 3;
      if (f.releaseTimer <= 0) {
        f.state = "hunting";
        f.x = tileCentre(DEN_EXIT.col, DEN_EXIT.row).x;
        f.y = tileCentre(DEN_EXIT.col, DEN_EXIT.row).y;
        f.dir = "left";
      }
      continue;
    }

    const speed =
      f.state === "eaten"
        ? FISH_EATEN_SPEED
        : g.frightened > 0
        ? FISH_FRIGHTENED_SPEED
        : FISH_SPEED * g.speed;

    if (centred(f.x) && centred(f.y)) f.dir = chooseDirection(g, f, targetFor(g, f));
    const step = moveAlong(g, f, f.dir, speed, dt, f.state === "eaten");
    f.x = step.x;
    f.y = step.y;

    if (f.state === "eaten") {
      const at = tileOf(f.x, f.y);
      if (at.col === DEN.col && at.row === DEN.row) {
        // Back in the pen. It waits a moment, then is released through the door
        // the same way it started the level — it can't swim out on its own now.
        f.state = "penned";
        f.releaseTimer = 1.5;
      }
      continue;
    }

    /* ---- near miss: close enough to feel it, not close enough to die ---- */
    const gap = Math.hypot(f.x - b.x, f.y - b.y) / TILE;
    if (g.frightened <= 0 && f.state === "hunting") {
      if (!f.near && gap < NEAR_MISS_RANGE) {
        f.near = true;
        g.score += NEAR_MISS_POINTS;
        g.nearMisses = (g.nearMisses || 0) + 1;
        cb.onScore(g.score);
        g.popups.push({ x: b.x, y: b.y - 10, text: "NEAR MISS", life: 0.7 });
        cb.onNearMiss?.();
      } else if (f.near && gap > NEAR_MISS_CLEAR) {
        f.near = false;
      }
    } else {
      f.near = false;
    }

    /* ---- contact ---- */
    if (Math.hypot(f.x - b.x, f.y - b.y) < TILE * 0.7) {
      if (g.frightened > 0) {
        const points = FISH_POINTS[Math.min(g.eatenThisCarrot, FISH_POINTS.length - 1)];
        g.eatenThisCarrot += 1;
        g.score += points;
        cb.onScore(g.score);
        g.popups.push({ x: f.x, y: f.y, text: `+${points}`, life: 0.8 });
        f.state = "eaten";
        cb.onEatFish?.();

        if (g.eatenThisCarrot === g.fish.length) {
          // The whole shoal on one carrot — the skill goal worth chasing.
          g.score += CHAIN_BONUS;
          cb.onScore(g.score);
          g.popups.push({ x: b.x, y: b.y - 16, text: `SHOAL +${CHAIN_BONUS}`, life: 1.4 });
          g.chains = (g.chains || 0) + 1;
          cb.onChain?.();
        }
      } else {
        g.lives -= 1;
        cb.onLives(g.lives);
        g.dying = DEATH_TIME;
        cb.onDeath?.();
        if (g.lives <= 0) {
          g.ended = true;
          cb.onGameOver("eaten");
        }
        return;
      }
    }
  }
}

/** After a death: everything back to its mark, pellets untouched. */
function respawn(g, cb) {
  g.bunny = { ...tileCentre(BUNNY_START.col, BUNNY_START.row), dir: "left", want: "left", mouth: 0 };
  g.fish = FISH.map((f) => ({
    ...f,
    ...tileCentre(f.start.col, f.start.row),
    dir: "up",
    state: f.releaseAt === 0 ? "hunting" : "penned",
    releaseTimer: Math.min(f.releaseAt, 4),
  }));
  g.frightened = 0;
  g.mode = MODE_PLAN[0].mode;
  g.modeIndex = 0;
  g.modeTimer = MODE_PLAN[0].time;
  g.intro = INTRO_TIME * 0.7;
  cb.onRespawn?.();
}

export { COLS, ROWS, TILE };
