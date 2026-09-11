/**
 * Piranha — model and rules.
 *
 * A maze-chase: the bunny eats algae while four piranhas hunt it. Kept free of
 * React and canvas so `npm test` can drive it headlessly, the same way Mosquito
 * Invaders' update() is tested.
 */
import {
  MAZE,
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

export const BUNNY_SPEED = 76; // px/sec
export const FISH_SPEED = 70;
export const FISH_FRIGHTENED_SPEED = 44;
export const FISH_EATEN_SPEED = 170; // hurrying home as a pair of eyes

export const PELLET_POINTS = 10;
export const CARROT_POINTS = 50;
export const FISH_POINTS = [200, 400, 800, 1600]; // per fish within one carrot
export const FRIGHTENED_TIME = 7;
export const INTRO_TIME = 1.6;
export const DEATH_TIME = 1.4;

/**
 * Where everything starts. The bunny sits in the open bottom corridor — row 16
 * looked right but is a vertical shaft, so it could only ever swim up or down
 * from a standing start, which feels broken in the first second of play.
 */
export const BUNNY_START = { col: 10, row: 20 };
export const DEN = { col: 10, row: 10 };
export const DEN_EXIT = { col: 10, row: 8 };

/**
 * Four hunters, four temperaments — that's what turns identical pursuers into a
 * puzzle. Each has a scatter corner it retreats to when the mode flips.
 */
export const FISH = [
  {
    id: "razor",
    colour: "#e0384f",
    behaviour: "direct", // straight for the bunny
    scatter: { col: 19, row: 1 },
    start: { col: 10, row: 8 },
    releaseAt: 0,
  },
  {
    id: "amber",
    colour: "#ff8a3d",
    behaviour: "ambush", // four tiles ahead of where the bunny is going
    scatter: { col: 1, row: 1 },
    start: { col: 9, row: 10 },
    releaseAt: 3,
  },
  {
    id: "coral",
    colour: "#f472b6",
    behaviour: "flank", // plays off the direct one, pincering
    scatter: { col: 19, row: 21 },
    start: { col: 10, row: 10 },
    releaseAt: 7,
  },
  {
    id: "kelp",
    colour: "#6fe3c0",
    behaviour: "shy", // chases from afar, loses nerve up close
    scatter: { col: 1, row: 21 },
    start: { col: 11, row: 10 },
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
  const { speed = 1, rng = Math.random } = opts;
  const pellets = makePellets(MAZE);

  return {
    level,
    score,
    lives,
    maze: MAZE,
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
    })),
    modeIndex: 0,
    modeTimer: MODE_PLAN[0].time,
    mode: MODE_PLAN[0].mode,
    frightened: 0,
    eatenThisCarrot: 0,
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

const centred = (v) => Math.abs((v % TILE) - TILE / 2) < 1.5;

/**
 * Is the tile in `dir` passable? The den door is one-way: only a fish that has
 * been eaten may swim back in. Without that, a hunter targeting a bunny below
 * the den dives through the door and bounces around inside the pen forever —
 * which is exactly what it did on the first run.
 */
function canGo(g, col, row, dir, throughDoor = false) {
  const d = DIRS[dir];
  return !isWall(g.maze, col + d.x, row + d.y, { fish: throughDoor });
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

  let best = legal[0];
  let bestDist = Infinity;
  for (const d of legal) {
    const step = DIRS[d];
    const dist = distance({ col: col + step.x, row: row + step.y }, target);
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

  x += step.x * speed * dt;
  y += step.y * speed * dt;

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
