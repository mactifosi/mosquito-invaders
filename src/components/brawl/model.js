/**
 * Bayou Brawl — model and rules.
 *
 * A one-on-one fighter: two rounds to win, sixty seconds a round, health bars,
 * blocking, specials and a finisher. Kept free of React and canvas so the suite
 * can drive it headlessly, the same as the other two cabinets.
 *
 * The stage is wider than the screen and the camera pans across it — fighters
 * want horizontal room, and this app is portrait.
 */

export const STAGE_W = 620;
export const VIEW_W = 360;
export const GROUND_Y = 250; // feet rest here, in stage space
export const CEILING = 40;

export const GRAVITY = 1700; // px/s²
export const WALK_SPEED = 150;
export const BACK_SPEED = 120; // retreating is slower than advancing
export const JUMP_V = -600;
export const PUSH_APART = 46; // fighters can't stand inside each other

/* Sized for a phone held in portrait: at 62px tall these read as figurines on
   a big empty stage. */
export const FIGHTER_W = 46;
export const FIGHTER_H = 92;
export const CROUCH_H = 58;

export const ROUND_TIME = 60;
export const ROUNDS_TO_WIN = 2;
export const MAX_HEALTH = 100;

/**
 * Moves. Startup / active / recovery are seconds: a move commits you for its
 * whole length, which is what makes spacing matter rather than button mashing.
 */
export const MOVES = {
  light: {
    startup: 0.07, active: 0.06, recovery: 0.14,
    damage: 6, reach: 56, top: -68, height: 28, knockback: 80, stun: 0.22,
  },
  heavy: {
    startup: 0.16, active: 0.09, recovery: 0.3,
    damage: 13, reach: 68, top: -76, height: 38, knockback: 180, stun: 0.38,
  },
  low: {
    startup: 0.1, active: 0.07, recovery: 0.22,
    damage: 8, reach: 62, top: -26, height: 24, knockback: 70, stun: 0.26, mustCrouchBlock: true,
  },
  special: {
    startup: 0.22, active: 0.05, recovery: 0.4,
    damage: 0, reach: 0, projectile: true, cost: 34, // meter
  },
};

export const PROJECTILE_SPEED = 300;
export const PROJECTILE_DAMAGE = 14;
export const METER_PER_HIT = 12; // dealt or taken — aggression and desperation both build it
export const METER_MAX = 100;

/** Chip damage through a block, and how long a blocked hit freezes you. */
const BLOCK_CHIP = 0.15;
const BLOCK_STUN = 0.12;

export const FIGHTERS = {
  vex: {
    id: "vex",
    name: "VEX",
    title: "Queen of Sector 7",
    body: "#e0384f",
    trim: "#ffb02e",
    projectile: "#ff8a3d",
  },
  gnash: {
    id: "gnash",
    name: "GNASH",
    title: "Shoal River",
    body: "#ff8a3d",
    trim: "#9fe8c9",
    projectile: "#6fe3c0",
  },
};

function makeFighter(spec, x, facing) {
  return {
    ...spec,
    x,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing,
    state: "idle", // idle | walk | jump | crouch | block | attack | hit | ko | win
    move: null, // which MOVES entry, while attacking
    phase: 0, // seconds into the current move
    hasHit: false, // one hit per swing
    health: MAX_HEALTH,
    meter: 0,
    stun: 0,
    onGround: true,
    flash: 0,
    prev: {}, // last frame's buttons, so attacks need a fresh press
  };
}

export function makeMatch(level = 1, score = 0, opts = {}) {
  const { difficulty = 1, rng = Math.random } = opts;
  return {
    level,
    score,
    rng,
    difficulty,
    round: 1,
    wins: [0, 0], // [player, opponent]
    time: ROUND_TIME,
    fighters: [
      makeFighter(FIGHTERS.vex, STAGE_W / 2 - 70, 1),
      makeFighter(FIGHTERS.gnash, STAGE_W / 2 + 70, -1),
    ],
    projectiles: [],
    sparks: [],
    popups: [],
    camera: STAGE_W / 2 - VIEW_W / 2,
    intro: 1.6,
    roundOver: 0, // counts down after a KO before the next round
    finisher: null, // { t } while the finishing blow plays
    ended: false,
    t: 0,
    ai: { think: 0, plan: "approach" },
    stats: { hits: 0, blocked: 0, specials: 0, perfect: false },
  };
}

/* ---- geometry ---- */

export const hurtbox = (f) => ({
  x: f.x - FIGHTER_W / 2,
  y: f.y - (f.state === "crouch" ? CROUCH_H : FIGHTER_H),
  w: FIGHTER_W,
  h: f.state === "crouch" ? CROUCH_H : FIGHTER_H,
});

/** The business end of a swing, in front of the fighter. */
export function hitbox(f) {
  if (f.state !== "attack" || !f.move) return null;
  const m = MOVES[f.move];
  if (m.projectile) return null;
  const t = f.phase - m.startup;
  if (t < 0 || t > m.active) return null;
  return {
    x: f.facing > 0 ? f.x + FIGHTER_W / 2 : f.x - FIGHTER_W / 2 - m.reach,
    y: f.y + m.top,
    w: m.reach,
    h: m.height,
  };
}

const overlap = (a, b) =>
  a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Blocking only works facing the attacker, and low hits need a low block. */
function isBlocking(defender, attacker, move) {
  if (defender.state !== "block" && !(defender.state === "crouch" && defender.blockHeld)) return false;
  const facingAttacker = (attacker.x - defender.x) * defender.facing > 0;
  if (!facingAttacker) return false;
  if (move.mustCrouchBlock) return defender.state === "crouch";
  return true;
}

/* ---- update ---- */

/**
 * @param oppInput  drives the opponent directly instead of the AI. The suite
 *   needs it — with a live opponent, a test for "a jab lands" is really a test
 *   of whether the AI happened to block — and it's the seam a two-player mode
 *   would use.
 */
export function update(dt, g, input, cb, oppInput = null) {
  if (g.ended) return;
  g.t += dt;

  for (let i = g.sparks.length - 1; i >= 0; i--) {
    const s = g.sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 600 * dt;
    s.life -= dt;
    if (s.life <= 0) g.sparks.splice(i, 1);
  }
  for (let i = g.popups.length - 1; i >= 0; i--) {
    g.popups[i].life -= dt;
    if (g.popups[i].life <= 0) g.popups.splice(i, 1);
  }

  if (g.finisher) {
    // Time stops for the finishing blow. No gore — a slow, loud knockout.
    g.finisher.t -= dt;
    if (g.finisher.t <= 0) {
      g.finisher = null;
      endRound(g, cb);
    }
    return;
  }

  if (g.roundOver > 0) {
    g.roundOver -= dt;
    if (g.roundOver <= 0) nextRound(g, cb);
    return;
  }

  if (g.intro > 0) {
    g.intro -= dt;
    return;
  }

  g.time = Math.max(0, g.time - dt);

  const [p, o] = g.fighters;
  driveFighter(g, p, readInput(input), dt, cb);
  driveFighter(g, o, oppInput ? readInput(oppInput) : think(g, dt), dt, cb);

  keepApart(p, o);
  faceEachOther(p, o);
  resolveHits(g, p, o, cb);
  resolveHits(g, o, p, cb);
  stepProjectiles(g, dt, cb);

  // Camera holds both fighters, then clamps to the stage.
  const mid = (p.x + o.x) / 2;
  g.camera = Math.max(0, Math.min(STAGE_W - VIEW_W, mid - VIEW_W / 2));

  if (g.time <= 0) decideOnTime(g, cb);
}

/** Player input → the same shape the AI produces. */
function readInput(input) {
  return {
    left: Boolean(input.left),
    right: Boolean(input.right),
    up: Boolean(input.up),
    down: Boolean(input.down),
    block: Boolean(input.block),
    light: Boolean(input.light),
    heavy: Boolean(input.heavy),
    low: Boolean(input.low),
    special: Boolean(input.special),
  };
}

function driveFighter(g, f, want, dt, cb) {
  if (f.flash > 0) f.flash -= dt;

  if (f.state === "ko") {
    applyPhysics(f, dt);
    return;
  }

  if (f.stun > 0) {
    f.stun -= dt;
    applyPhysics(f, dt);
    if (f.stun <= 0) f.state = f.onGround ? "idle" : "jump";
    return;
  }

  if (f.state === "attack") {
    const m = MOVES[f.move];
    f.phase += dt;
    if (f.move === "special" && !f.firedProjectile && f.phase >= m.startup) {
      f.firedProjectile = true;
      g.projectiles.push({
        x: f.x + f.facing * 22,
        y: f.y - 34,
        vx: f.facing * PROJECTILE_SPEED,
        owner: f.id,
        colour: f.projectile,
        life: 3,
      });
      g.stats.specials += 1;
      cb.onSpecial?.();
    }
    if (f.phase >= m.startup + m.active + m.recovery) {
      f.state = f.onGround ? "idle" : "jump";
      f.move = null;
      f.hasHit = false;
      f.firedProjectile = false;
    }
    applyPhysics(f, dt);
    return;
  }

  // Grounded actions
  f.blockHeld = want.block;
  // Attacks are edge-triggered: holding the button doesn't machine-gun jabs,
  // so spacing and commitment matter rather than mashing.
  const pressed = (k) => want[k] && !f.prev[k];
  if (f.onGround) {
    if (pressed("light") || pressed("heavy") || pressed("low") ||
        (pressed("special") && f.meter >= MOVES.special.cost)) {
      const move = pressed("heavy") ? "heavy" : pressed("low") ? "low"
        : pressed("special") ? "special" : "light";
      if (move === "special") f.meter -= MOVES.special.cost;
      f.state = "attack";
      f.move = move;
      f.phase = 0;
      f.hasHit = false;
      f.firedProjectile = false;
      f.vx = 0;
      f.prev = { ...want };
      cb.onSwing?.(move);
      return;
    }
    if (want.block) {
      f.state = want.down ? "crouch" : "block";
      f.vx = 0;
    } else if (want.down) {
      f.state = "crouch";
      f.vx = 0;
    } else if (want.up) {
      f.state = "jump";
      f.vy = JUMP_V;
      f.onGround = false;
      f.vx = want.left ? -WALK_SPEED : want.right ? WALK_SPEED : 0;
      cb.onJump?.();
    } else if (want.left || want.right) {
      const dir = want.left ? -1 : 1;
      f.state = "walk";
      f.vx = dir * (dir === f.facing ? WALK_SPEED : BACK_SPEED);
    } else {
      f.state = "idle";
      f.vx = 0;
    }
  }

  f.prev = { ...want };
  applyPhysics(f, dt);
}

function applyPhysics(f, dt) {
  f.x += f.vx * dt;
  if (!f.onGround) {
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y;
      f.vy = 0;
      f.onGround = true;
      f.vx = 0;
      if (f.state !== "ko" && f.stun <= 0) f.state = "idle";
    }
  }
  f.x = Math.max(FIGHTER_W / 2, Math.min(STAGE_W - FIGHTER_W / 2, f.x));
}

function keepApart(a, b) {
  const gap = Math.abs(a.x - b.x);
  if (gap >= PUSH_APART) return;
  const push = (PUSH_APART - gap) / 2;
  const dir = a.x < b.x ? -1 : 1;
  a.x = Math.max(FIGHTER_W / 2, Math.min(STAGE_W - FIGHTER_W / 2, a.x + dir * push));
  b.x = Math.max(FIGHTER_W / 2, Math.min(STAGE_W - FIGHTER_W / 2, b.x - dir * push));
}

function faceEachOther(a, b) {
  if (a.state === "attack" || b.state === "attack") return; // no turning mid-swing
  a.facing = b.x >= a.x ? 1 : -1;
  b.facing = a.x >= b.x ? 1 : -1;
}

function resolveHits(g, attacker, defender, cb) {
  if (attacker.state !== "attack" || attacker.hasHit) return;
  const box = hitbox(attacker);
  if (!overlap(box, hurtbox(defender))) return;

  attacker.hasHit = true;
  const move = MOVES[attacker.move];
  const blocked = isBlocking(defender, attacker, move);
  const damage = blocked ? Math.max(1, Math.round(move.damage * BLOCK_CHIP)) : move.damage;

  applyDamage(g, attacker, defender, damage, blocked ? 30 : move.knockback,
    blocked ? BLOCK_STUN : move.stun, blocked, cb);
}

function applyDamage(g, attacker, defender, damage, knockback, stun, blocked, cb) {
  defender.health = Math.max(0, defender.health - damage);
  defender.stun = stun;
  defender.state = blocked ? defender.state : "hit";
  defender.flash = 0.1;
  defender.vx = -defender.facing * knockback;
  defender.onGround = defender.onGround; // knockback slides, it doesn't launch

  attacker.meter = Math.min(METER_MAX, attacker.meter + METER_PER_HIT);
  defender.meter = Math.min(METER_MAX, defender.meter + METER_PER_HIT / 2);

  for (let i = 0; i < (blocked ? 4 : 9); i++) {
    g.sparks.push({
      x: defender.x + defender.facing * -12,
      y: defender.y - 34,
      vx: (g.rng() - 0.5) * 200,
      vy: -60 - g.rng() * 160,
      life: 0.35,
      colour: blocked ? "#8bd0e0" : attacker.trim,
    });
  }

  if (blocked) {
    g.stats.blocked += 1;
    cb.onBlock?.(defender.id);
  } else {
    g.stats.hits += 1;
    cb.onHit?.(damage, attacker.id);
  }

  if (defender.health <= 0) {
    defender.state = "ko";
    defender.stun = 0;
    attacker.state = "win";
    // The finishing blow: everything stops and the camera holds on it.
    g.finisher = { t: 1.6, by: attacker.id, on: defender.id };
    g.popups.push({ x: defender.x, y: defender.y - 80, text: "K.O.", life: 1.6, big: true });
    cb.onKO?.(attacker.id);
  }
}

function stepProjectiles(g, dt, cb) {
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const p = g.projectiles[i];
    p.x += p.vx * dt;
    p.life -= dt;
    if (p.life <= 0 || p.x < -20 || p.x > STAGE_W + 20) {
      g.projectiles.splice(i, 1);
      continue;
    }
    for (const f of g.fighters) {
      if (f.id === p.owner || f.state === "ko") continue;
      const box = { x: p.x - 8, y: p.y - 8, w: 16, h: 16 };
      if (!overlap(box, hurtbox(f))) continue;
      const attacker = g.fighters.find((x) => x.id === p.owner);
      const blocked = isBlocking(f, attacker, MOVES.light);
      applyDamage(g, attacker, f, blocked ? 3 : PROJECTILE_DAMAGE, blocked ? 40 : 120,
        blocked ? BLOCK_STUN : 0.3, blocked, cb);
      g.projectiles.splice(i, 1);
      break;
    }
  }
}

/* ---- rounds ---- */

function endRound(g, cb) {
  const [p, o] = g.fighters;
  const playerWon = o.health <= 0 && p.health > 0;
  g.wins[playerWon ? 0 : 1] += 1;
  if (playerWon && p.health === MAX_HEALTH) g.stats.perfect = true;

  g.score += playerWon ? 500 + Math.round(p.health * 5) + Math.round(g.time * 10) : 0;
  cb.onScore(g.score);
  cb.onRound(g.wins);

  if (g.wins[0] >= ROUNDS_TO_WIN || g.wins[1] >= ROUNDS_TO_WIN) {
    g.ended = true;
    cb.onMatchOver(g.wins[0] >= ROUNDS_TO_WIN ? "player" : "opponent");
    return;
  }
  g.roundOver = 1.2;
}

function nextRound(g, cb) {
  const [p, o] = g.fighters;
  g.round += 1;
  g.time = ROUND_TIME;
  for (const [i, f] of g.fighters.entries()) {
    f.health = MAX_HEALTH;
    f.meter = Math.round(f.meter / 2); // carry half, so round two isn't a reset
    f.state = "idle";
    f.stun = 0;
    f.vx = 0;
    f.vy = 0;
    f.y = GROUND_Y;
    f.onGround = true;
    f.x = STAGE_W / 2 + (i === 0 ? -70 : 70);
    f.facing = i === 0 ? 1 : -1;
    f.move = null;
  }
  g.projectiles.length = 0;
  g.intro = 1.2;
  cb.onRoundStart?.(g.round);
}

function decideOnTime(g, cb) {
  const [p, o] = g.fighters;
  // Time out: the healthier fighter takes the round; a dead heat goes to neither.
  if (p.health === o.health) {
    g.roundOver = 1.2;
    g.popups.push({ x: STAGE_W / 2, y: 120, text: "DRAW", life: 1.2, big: true });
    cb.onTimeOut?.("draw");
    return;
  }
  const loser = p.health < o.health ? p : o;
  const winner = loser === p ? o : p;
  loser.health = 0;
  loser.state = "ko";
  winner.state = "win";
  g.finisher = { t: 1.2, by: winner.id, on: loser.id };
  cb.onTimeOut?.(loser === p ? "opponent" : "player");
}

/* ---- the opponent ---- */

/**
 * Distance-based, with a reaction delay — it should read as someone deciding,
 * not as perfect defence. Difficulty scales how often it thinks and how
 * willing it is to press.
 */
function think(g, dt) {
  const [p, o] = g.fighters;
  const idle = { left: false, right: false, up: false, down: false, block: false,
                 light: false, heavy: false, low: false, special: false };
  if (o.state === "ko" || o.stun > 0 || o.state === "attack") return idle;

  g.ai.think -= dt;
  if (g.ai.think <= 0) {
    g.ai.think = Math.max(0.09, (0.34 - g.difficulty * 0.08) * (0.7 + g.rng() * 0.6));
    const gap = Math.abs(p.x - o.x);
    const incoming = p.state === "attack" || g.projectiles.some((q) => q.owner === p.id);

    if (incoming && g.rng() < 0.35 + g.difficulty * 0.2) g.ai.plan = "block";
    else if (gap > 170) g.ai.plan = o.meter >= MOVES.special.cost && g.rng() < 0.5 ? "special" : "approach";
    else if (gap > 70) g.ai.plan = g.rng() < 0.25 ? "retreat" : "approach";
    else g.ai.plan = g.rng() < 0.72 ? "attack" : "block";
  }

  const toward = p.x > o.x ? "right" : "left";
  const away = toward === "right" ? "left" : "right";
  switch (g.ai.plan) {
    case "approach":
      return { ...idle, [toward]: true };
    case "retreat":
      return { ...idle, [away]: true };
    case "block":
      return { ...idle, block: true, down: g.rng() < 0.4 };
    case "special":
      return { ...idle, special: true };
    case "attack": {
      const roll = g.rng();
      return { ...idle, light: roll < 0.5, heavy: roll >= 0.5 && roll < 0.8, low: roll >= 0.8 };
    }
    default:
      return idle;
  }
}
