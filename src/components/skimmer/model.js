/**
 * Skimmer — model and rules.
 *
 * Breakout on the water: a skimming stone off a punt, against rafts of mosquito
 * eggs. Leave a hatching raft too long and a mosquito gets out and flies for the
 * open air — catching it is worth more than the raft was.
 *
 * No React, no canvas: the suite drives update() directly, like the other
 * cabinets.
 */
import { COLS, ROWS, layoutForLevel, lapForLevel } from "@/components/skimmer/levels";

export const W = 360;
export const H = 540;

export const BRICK_TOP = 92;
export const BRICK_H = 18;
export const BRICK_GAP = 3;
export const SIDE_MARGIN = 10;
export const BRICK_W = (W - SIDE_MARGIN * 2 - BRICK_GAP * (COLS - 1)) / COLS;

export const PADDLE_Y = H - 54;
export const PADDLE_W = 66;
export const PADDLE_H = 10;
export const PADDLE_SPEED = 320; // keyboard; touch drags it directly

export const BALL_R = 5;
export const BASE_SPEED = 232;
export const SPEED_PER_LAP = 26;
/** A ball that never climbs or never falls is a stuck ball; keep it honest. */
const MIN_VY_RATIO = 0.38;
const MAX_BOUNCE_ANGLE = (62 * Math.PI) / 180;

export const HATCH_TIME = 14; // seconds a hatching raft sits before it opens
export const MOSQUITO_SPEED = 46;

export const POINTS = { 1: 50, 2: 90, hatcher: 120, mosquito: 250, escaped: -80 };
export const POWERUP_CHANCE = 0.12;
export const POWERUP_SPEED = 90;
export const WIDE_DURATION = 12;
export const SLOW_DURATION = 9;

export const START_LIVES = 3;

function brickAt(col, row) {
  return {
    x: SIDE_MARGIN + col * (BRICK_W + BRICK_GAP),
    y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
    w: BRICK_W,
    h: BRICK_H,
  };
}

function makeBricks(layout, rng) {
  const bricks = [];
  layout.forEach((rowText, row) => {
    rowText.split("").forEach((cell, col) => {
      if (cell === ".") return;
      const { x, y, w, h } = brickAt(col, row);
      bricks.push({
        x, y, w, h,
        kind: cell === "h" ? "hatcher" : cell,
        hp: cell === "2" ? 2 : 1,
        // Hatchers stagger themselves, so they don't all open at once.
        hatch: cell === "h" ? HATCH_TIME * (0.7 + rng() * 0.6) : null,
        flash: 0,
      });
    });
  });
  return bricks;
}

/** A ball launched from the punt, angled away from straight up. */
function makeBall(x, y, speed, rng) {
  const angle = (-Math.PI / 2) + (rng() - 0.5) * 0.7;
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: BALL_R };
}

export function makeLevel(level, score, lives, opts = {}) {
  const { speed = 1, rng = Math.random } = opts;
  const layout = layoutForLevel(level);
  const ballSpeed = (BASE_SPEED + lapForLevel(level) * SPEED_PER_LAP) * speed;

  return {
    level,
    score,
    lives,
    rng,
    speed: ballSpeed,
    bricks: makeBricks(layout, rng),
    paddle: { x: W / 2, w: PADDLE_W, wideUntil: 0 },
    balls: [],
    mosquitoes: [],
    powerups: [],
    sparks: [],
    popups: [],
    slowUntil: 0,
    launched: false, // the ball sits on the punt until you serve
    intro: 1.1,
    dying: 0,
    ended: false,
    escaped: 0, // mosquitoes that got away this level
    combo: 0, // rafts broken without touching the punt
    bestCombo: 0,
    t: 0,
  };
}

const aliveBricks = (g) => g.bricks.length;

/* ---- update ---- */

export function update(dt, g, input, cb) {
  if (g.ended) return;
  g.t += dt;

  for (let i = g.sparks.length - 1; i >= 0; i--) {
    const s = g.sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 420 * dt;
    s.life -= dt;
    if (s.life <= 0) g.sparks.splice(i, 1);
  }
  for (let i = g.popups.length - 1; i >= 0; i--) {
    g.popups[i].life -= dt;
    if (g.popups[i].life <= 0) g.popups.splice(i, 1);
  }
  for (const b of g.bricks) if (b.flash > 0) b.flash -= dt;

  if (g.dying > 0) {
    g.dying -= dt;
    if (g.dying <= 0) respawn(g, cb);
    return;
  }
  if (g.intro > 0) {
    g.intro -= dt;
    return;
  }

  movePaddle(g, input, dt);

  // The stone rests on the punt until served, so a new life never starts with
  // the ball already falling.
  if (!g.launched) {
    if (g.balls.length === 0) {
      g.balls.push(makeBall(g.paddle.x, PADDLE_Y - BALL_R - 2, g.speed, g.rng));
      g.balls[0].held = true;
    }
    const ball = g.balls[0];
    ball.x = g.paddle.x;
    ball.y = PADDLE_Y - BALL_R - 2;
    if (input.launch) {
      ball.held = false;
      g.launched = true;
      cb.onLaunch?.();
    }
  }

  const slowed = g.t < g.slowUntil ? 0.66 : 1;
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const ball = g.balls[i];
    if (ball.held) continue;
    stepBall(g, ball, dt * slowed, cb);
    if (ball.y - ball.r > H) {
      g.balls.splice(i, 1);
      if (g.balls.length === 0) loseBall(g, cb);
    }
  }

  stepHatchers(g, dt, cb);
  stepMosquitoes(g, dt, cb);
  stepPowerups(g, dt, cb);

  if (g.paddle.wideUntil && g.t > g.paddle.wideUntil) {
    g.paddle.w = PADDLE_W;
    g.paddle.wideUntil = 0;
  }

  if (aliveBricks(g) === 0 && g.mosquitoes.length === 0) {
    g.ended = true;
    cb.onLevelClear();
  }
}

function movePaddle(g, input, dt) {
  const half = g.paddle.w / 2;
  if (input.dragTarget != null) {
    g.paddle.x = input.dragTarget;
  } else if (input.left) {
    g.paddle.x -= PADDLE_SPEED * dt;
  } else if (input.right) {
    g.paddle.x += PADDLE_SPEED * dt;
  }
  g.paddle.x = Math.max(half, Math.min(W - half, g.paddle.x));
}

function stepBall(g, ball, dt, cb) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    cb.onWall?.();
  } else if (ball.x + ball.r > W) {
    ball.x = W - ball.r;
    ball.vx = -Math.abs(ball.vx);
    cb.onWall?.();
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    cb.onWall?.();
  }

  bouncePaddle(g, ball, cb);
  hitBricks(g, ball, cb);
}

function bouncePaddle(g, ball, cb) {
  const half = g.paddle.w / 2;
  if (ball.vy <= 0) return;
  if (ball.y + ball.r < PADDLE_Y || ball.y - ball.r > PADDLE_Y + PADDLE_H) return;
  if (ball.x < g.paddle.x - half - ball.r || ball.x > g.paddle.x + half + ball.r) return;

  // Where it lands on the punt sets the angle — that's the whole control scheme.
  const offset = Math.max(-1, Math.min(1, (ball.x - g.paddle.x) / half));
  const angle = offset * MAX_BOUNCE_ANGLE;
  const speed = Math.hypot(ball.vx, ball.vy);
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.y = PADDLE_Y - ball.r - 0.5;
  g.combo = 0;
  cb.onPaddle?.();
}

function hitBricks(g, ball, cb) {
  for (let i = 0; i < g.bricks.length; i++) {
    const b = g.bricks[i];
    if (
      ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w ||
      ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h
    ) continue;

    // Reflect off whichever face was least penetrated — the cheap trick that
    // stops a ball tunnelling into a brick and coming out sideways.
    const left = ball.x + ball.r - b.x;
    const right = b.x + b.w - (ball.x - ball.r);
    const top = ball.y + ball.r - b.y;
    const bottom = b.y + b.h - (ball.y - ball.r);
    const min = Math.min(left, right, top, bottom);
    if (min === left) { ball.vx = -Math.abs(ball.vx); ball.x = b.x - ball.r; }
    else if (min === right) { ball.vx = Math.abs(ball.vx); ball.x = b.x + b.w + ball.r; }
    else if (min === top) { ball.vy = -Math.abs(ball.vy); ball.y = b.y - ball.r; }
    else { ball.vy = Math.abs(ball.vy); ball.y = b.y + b.h + ball.r; }

    damageBrick(g, i, ball, cb);
    keepHonest(ball);
    return; // one brick a frame, so a corner doesn't clear two at once
  }
}

function damageBrick(g, index, ball, cb) {
  const b = g.bricks[index];
  b.hp -= 1;
  b.flash = 0.09;

  for (let i = 0; i < 7; i++) {
    g.sparks.push({
      x: ball.x, y: ball.y,
      vx: (g.rng() - 0.5) * 180,
      vy: -40 - g.rng() * 120,
      life: 0.3,
      colour: b.kind === "hatcher" ? "#e0384f" : b.kind === "2" ? "#9a8cb4" : "#9fe8c9",
    });
  }

  if (b.hp > 0) {
    cb.onChip?.();
    return;
  }

  g.bricks.splice(index, 1);
  g.combo += 1;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  // Rafts broken in one trip are worth more each: reward the long rally.
  const points = Math.round((POINTS[b.kind] ?? 50) * (1 + (g.combo - 1) * 0.1));
  g.score += points;
  cb.onScore(g.score);
  g.popups.push({ x: b.x + b.w / 2, y: b.y, text: `+${points}`, life: 0.6 });
  cb.onBreak?.(b.kind);

  if (g.rng() < POWERUP_CHANCE) {
    const roll = g.rng();
    g.powerups.push({
      x: b.x + b.w / 2, y: b.y + b.h / 2,
      kind: roll < 0.4 ? "wide" : roll < 0.75 ? "slow" : "multi",
    });
  }
}

/** Stop a ball settling into a near-horizontal path it can never escape. */
function keepHonest(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  const minVy = speed * MIN_VY_RATIO;
  if (Math.abs(ball.vy) < minVy) {
    ball.vy = Math.sign(ball.vy || -1) * minVy;
    ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
  }
}

function stepHatchers(g, dt, cb) {
  for (let i = g.bricks.length - 1; i >= 0; i--) {
    const b = g.bricks[i];
    if (b.kind !== "hatcher" || b.hatch == null) continue;
    b.hatch -= dt;
    if (b.hatch > 0) continue;
    // It opens: the raft is gone and a mosquito is loose.
    g.bricks.splice(i, 1);
    g.mosquitoes.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (g.rng() - 0.5) * 40, t: 0 });
    cb.onHatch?.();
  }
}

function stepMosquitoes(g, dt, cb) {
  for (let i = g.mosquitoes.length - 1; i >= 0; i--) {
    const m = g.mosquitoes[i];
    m.t += dt;
    m.y += MOSQUITO_SPEED * dt;
    m.x += Math.sin(m.t * 4) * 40 * dt + m.vx * dt;
    m.x = Math.max(8, Math.min(W - 8, m.x));

    const half = g.paddle.w / 2;
    const caught =
      m.y > PADDLE_Y - 8 && m.y < PADDLE_Y + PADDLE_H + 8 &&
      m.x > g.paddle.x - half && m.x < g.paddle.x + half;

    if (caught) {
      g.mosquitoes.splice(i, 1);
      g.score += POINTS.mosquito;
      cb.onScore(g.score);
      g.popups.push({ x: m.x, y: m.y, text: `+${POINTS.mosquito}`, life: 0.8 });
      cb.onSquash?.();
      continue;
    }
    if (m.y > H + 10) {
      // It got past: that's the point of the hatchers, and it costs you.
      g.mosquitoes.splice(i, 1);
      g.escaped += 1;
      g.score = Math.max(0, g.score + POINTS.escaped);
      cb.onScore(g.score);
      g.popups.push({ x: m.x, y: H - 60, text: "ESCAPED", life: 1 });
      cb.onEscape?.();
    }
  }
}

function stepPowerups(g, dt, cb) {
  const half = g.paddle.w / 2;
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const p = g.powerups[i];
    p.y += POWERUP_SPEED * dt;
    if (p.y > H + 10) {
      g.powerups.splice(i, 1);
      continue;
    }
    const caught =
      p.y > PADDLE_Y - 6 && p.y < PADDLE_Y + PADDLE_H + 6 &&
      p.x > g.paddle.x - half - 8 && p.x < g.paddle.x + half + 8;
    if (!caught) continue;

    g.powerups.splice(i, 1);
    applyPowerup(g, p.kind, cb);
  }
}

export function applyPowerup(g, kind, cb) {
  if (kind === "wide") {
    g.paddle.w = PADDLE_W * 1.6;
    g.paddle.wideUntil = g.t + WIDE_DURATION;
  } else if (kind === "slow") {
    g.slowUntil = g.t + SLOW_DURATION;
  } else if (kind === "multi") {
    // Split every ball in play, so a multi on a multi is genuinely chaotic.
    for (const ball of [...g.balls]) {
      if (ball.held) continue;
      const speed = Math.hypot(ball.vx, ball.vy);
      for (const turn of [-0.5, 0.5]) {
        const angle = Math.atan2(ball.vy, ball.vx) + turn;
        g.balls.push({
          x: ball.x, y: ball.y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          r: BALL_R,
        });
      }
    }
  }
  cb.onPowerup?.(kind);
}

function loseBall(g, cb) {
  g.lives -= 1;
  g.combo = 0;
  cb.onLives(g.lives);
  cb.onLoseBall?.();
  if (g.lives <= 0) {
    g.ended = true;
    cb.onGameOver("drowned");
    return;
  }
  g.dying = 1;
}

function respawn(g, cb) {
  g.launched = false;
  g.balls = [];
  g.powerups.length = 0;
  g.paddle.w = PADDLE_W;
  g.paddle.wideUntil = 0;
  g.slowUntil = 0;
  cb.onRespawn?.();
}

export { COLS, ROWS };
