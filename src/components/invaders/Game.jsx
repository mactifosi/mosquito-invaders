import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameLoop } from "@/engine/useGameLoop";
import { useTouchControls } from "@/components/invaders/useTouchControls";
import TouchControls from "@/components/invaders/TouchControls";
import Hud from "@/components/invaders/Hud";
import Overlay from "@/components/invaders/Overlay";
import { loadScores, saveScore, getHighScore, qualifies } from "@/components/invaders/scores";
import { loadSettings, difficultyOf, saveSettings } from "@/lib/settings";
import { dailyChallenge, mulberry32, recordDaily } from "@/lib/daily";
import { sfx } from "@/components/invaders/sounds";
import { haptics, initHaptics } from "@/components/invaders/haptics";

/* ───────────────────────── constants ───────────────────────── */

export const W = 360;
export const H = 540;

const COLS = 9;
const ROWS = 4;
const ALIEN_W = 22;
const ALIEN_H = 16;
const ALIEN_GAP_X = 12;
const ALIEN_GAP_Y = 14;
const ALIEN_TOP = 70;

const PLAYER_W = 26;
const PLAYER_H = 14;
const PLAYER_Y = H - 60;
const PLAYER_SPEED = 200;

const BULLET_SPEED = 420;
const ALIEN_BULLET_SPEED = 180;
const FIRE_COOLDOWN = 0.35;
const RAPID_COOLDOWN = 0.16;
const ALIEN_FIRE_INTERVAL = 1.1;
const STEP_DOWN = 14;

const POWERUP_CHANCE = 0.16;
const POWERUP_SHOT_POINTS = 50; // shooting one pays out instead of collecting it
const POWERUP_SPEED = 75;
const POWERUP_SIZE = 14;
const RAPID_DURATION = 8;
const TRIPLE_DURATION = 8;
const MAX_LIVES = 5;

/* Feel. Small numbers, disproportionate effect — tune these first. */
const HIT_STOP = 0.045; // freeze frames on a kill, seconds
const SHAKE_ON_HIT = 5; // px, player takes a bite
const SHAKE_ON_SHIELD = 2.5; // px, shield absorbs it
const SHAKE_DECAY = 14; // px per second
const POPUP_LIFE = 0.7; // floating score, seconds
const POPUP_RISE = 26; // px it drifts upward over its life
const MUZZLE_TIME = 0.05; // flash at the barrel, seconds
const RECOIL_TIME = 0.08; // craft sits 1px lower for this long after firing

/* A breath between waves: the card is up, the swarm holds station. */
const INTRO_TIME = 1.2;

/* How much faster a thinned swarm flies. At 0.8 the last mosquito moves 1.8x
   the opening speed; it was 2.2 (3.2x), which by wave 6 outran the craft. */
const SPEED_MUL_RANGE = 0.8;

/* Bunkers: four eroding shields between the swarm and the craft. Each is a
   grid of 4px cells; every bullet that lands chews a small crater. */
const BUNKER_COUNT = 4;
const BUNKER_COLS = 11;
const BUNKER_ROWS = 6;
const BUNKER_CELL = 4;
const BUNKER_W = BUNKER_COLS * BUNKER_CELL;
const BUNKER_H = BUNKER_ROWS * BUNKER_CELL;
const BUNKER_Y = PLAYER_Y - 66;

/* Divers: mosquitoes that break formation and swoop, which is what mosquitoes
   actually do. They arrive from wave DIVE_FROM_LEVEL and are worth double. */
const DIVE_FROM_LEVEL = 3;
const DIVE_MAX_ACTIVE = 2;
const DIVE_INTERVAL = 4.5; // seconds, shortens with the level
const DIVE_ACCEL = 150;
const DIVE_SPEED_MAX = 190;
const DIVE_TRACK = 1.4; // how hard it steers toward the craft
const DIVE_TRACK_MAX = 95;
const DIVE_BONUS = 2; // points multiplier for killing one mid-dive

/* Boss waves: every BOSS_EVERY levels the formation is replaced by a queen who
   sits at the top, seeds brood that dive, and has to be worn down. */
const BOSS_EVERY = 4;
const BOSS_W = 64;
const BOSS_H = 34;
const BOSS_HP_BASE = 28;
const BOSS_HP_STEP = 8; // per boss tier
const BOSS_SPEED = 46;
const BOSS_DESCENT = 1.6; // px/sec of slow, relentless creep
const BOSS_FIRE_INTERVAL = 1.5;
const BOSS_BROOD_INTERVAL = 3.4;
const BOSS_BROOD_MAX = 3;
const BOSS_HIT_POINTS = 5; // chip damage pays a little
const BOSS_KILL_POINTS = 500;

/** Blood-fed: visibly engorged, takes two hits, worth triple. */
const FED_CHANCE = 0.17; // of mosquitoes in the back two rows
const FED_BONUS = 3;

/* The bonus target: one that got away, crossing the top for big points. */
const STRAY_INTERVAL = 14; // seconds between attempts
const STRAY_CHANCE = 0.55; // ...and it doesn't always show
const STRAY_SPEED = 70;
const STRAY_W = 20;
const STRAY_H = 14;
const STRAY_Y = 30;
const STRAY_POINTS = 150;

/**
 * Every BOSS_EVERY waves is the queen; the daily challenge can change the
 * cadence. The cadence is validated rather than defaulted, because this gets
 * used as a predicate (`levels.every(isBossLevel)`) where the second argument
 * arrives as an array index — and `level % 0` is NaN, silently false.
 */
export const isBossLevel = (level, opts) => {
  // Options object rather than a positional cadence: this gets used as a bare
  // predicate (`levels.some(isBossLevel)`), where the second argument arrives as
  // an array index. A number there would silently redefine the cadence — index 1
  // would make every wave a boss wave. An object can't be confused for one.
  const every =
    opts && typeof opts === "object" && Number.isInteger(opts.every) && opts.every > 0
      ? opts.every
      : BOSS_EVERY;
  return level % every === 0;
};

/* Combo: consecutive kills without a miss. Resets on a shot that leaves the
   top of the screen, on taking a hit, or after COMBO_WINDOW without a kill. */
const COMBO_WINDOW = 2.0;
const COMBO_MAX = 5;
const COMBO_PER_STEP = 3; // kills needed to raise the multiplier one step

const SIDE_MARGIN = (W - (COLS * ALIEN_W + (COLS - 1) * ALIEN_GAP_X)) / 2;
const TOTAL_ALIENS = COLS * ROWS;

/** How much the formation speeds up as it thins. Capped by SPEED_MUL_RANGE. */
export const formationSpeedMul = (alive) => 1 + (1 - alive / TOTAL_ALIENS) * SPEED_MUL_RANGE;

/** The card shown between waves. */
export function waveTitle(level) {
  if (isBossLevel(level)) return { wave: `WAVE ${level}`, sub: "THE QUEEN" };
  const species = SPECIES[(level - 1) % SPECIES.length];
  return { wave: `WAVE ${level}`, sub: `${species.name.toUpperCase()} SURGE` };
}

/** Multiplier from a kill streak: 3 kills → ×2, 6 → ×3, capped at COMBO_MAX. */
export const comboMultiplier = (streak) =>
  Math.max(1, Math.min(COMBO_MAX, 1 + Math.floor(streak / COMBO_PER_STEP)));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Row index → species. Body color also drives explosion particles. */
export const SPECIES = [
  { name: "Aedes aegypti", body: "#e0384f", pts: 40 },
  { name: "Anopheles gambiae", body: "#ffb02e", pts: 30 },
  { name: "Culex pipiens", body: "#6fe3c0", pts: 20 },
  { name: "Aedes albopictus", body: "#a78bfa", pts: 10 },
];

const POWERUP_COLORS = {
  rapid: "#f59e0b",
  triple: "#a78bfa",
  shield: "#38bdf8",
  life: "#f472b6",
};
const POWERUP_LETTERS = { rapid: "R", triple: "T", shield: "S", life: "+" };

/* ───────────────────────── model ───────────────────────── */

/**
 * Four bunkers, each an arch of 4px cells. Cell value 1 is intact, 0 is gone —
 * bullets from either side chew craters until there's nothing left to hide behind.
 */
export function makeBunkers() {
  const bunkers = [];
  const lane = W / BUNKER_COUNT;
  for (let i = 0; i < BUNKER_COUNT; i++) {
    const cells = new Uint8Array(BUNKER_COLS * BUNKER_ROWS).fill(1);
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        const topCorner = r < 2 && (c < 2 - r || c > BUNKER_COLS - 3 + r);
        const doorway = r >= BUNKER_ROWS - 2 && c >= 4 && c <= 6;
        if (topCorner || doorway) cells[r * BUNKER_COLS + c] = 0;
      }
    }
    bunkers.push({ x: Math.round(lane * (i + 0.5) - BUNKER_W / 2), y: BUNKER_Y, cells });
  }
  return bunkers;
}

/** Chew a crater at a point. Returns true if anything was actually there. */
function erodeBunker(b, px, py, radius = 1, rand = null) {
  const c0 = Math.floor((px - b.x) / BUNKER_CELL);
  const r0 = Math.floor((py - b.y) / BUNKER_CELL);
  if (c0 < 0 || r0 < 0 || c0 >= BUNKER_COLS || r0 >= BUNKER_ROWS) return false;
  if (!b.cells[r0 * BUNKER_COLS + c0]) return false;

  for (let r = r0 - radius; r <= r0 + radius; r++) {
    for (let c = c0 - radius; c <= c0 + radius; c++) {
      if (r < 0 || c < 0 || r >= BUNKER_ROWS || c >= BUNKER_COLS) continue;
      // Ragged edge: corners of the blast survive sometimes.
      if (Math.abs(r - r0) + Math.abs(c - c0) > radius && (rand?.() ?? Math.random()) < 0.5) continue;
      b.cells[r * BUNKER_COLS + c] = 0;
    }
  }
  return true;
}

/**
 * Bullets move up to 7px a frame and cells are 4px, so test along the path
 * rather than at the endpoint — otherwise fast shots tunnel through.
 */
function bulletHitsBunker(g, fromX, fromY, toX, toY) {
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 2));
  for (let i = 0; i <= steps; i++) {
    const px = fromX + ((toX - fromX) * i) / steps;
    const py = fromY + ((toY - fromY) * i) / steps;
    for (const b of g.bunkers) {
      if (px < b.x || px > b.x + BUNKER_W || py < b.y || py > b.y + BUNKER_H) continue;
      if (erodeBunker(b, px, py, 1, g.rng)) return true;
    }
  }
  return false;
}

/** A brood mosquito: born mid-air, dives once, and never joins a formation. */
function spawnBrood(g, x, y) {
  g.aliens.push({
    x: 0, y: 0, row: ROWS - 1, alive: true, flash: 0, brood: true,
    dive: { x, y, vx: 0, vy: 50, t: 0 },
  });
}

/** Where an alien actually is: its dive position, or its slot in the formation. */
export function alienPos(g, a) {
  return a.dive
    ? { x: a.dive.x, y: a.dive.y }
    : { x: g.formationX + a.x, y: g.formationY + a.y };
}

/**
 * Builds the mutable state for one wave. Everything per-frame lives here, in a
 * ref — never in React state, which would thrash at 60fps.
 */
export function makeLevel(level, score, lives, opts = {}) {
  const {
    speed = 1,        // difficulty: formation speed
    fireRate = 1,     // difficulty: multiplies enemy fire interval
    diveRate = 1,     // difficulty: multiplies the dive interval
    bunkers = true,   // daily: cover can be taken away
    diveFrom = DIVE_FROM_LEVEL,
    bossEvery = BOSS_EVERY,
    startRapid = false,
    fedChance = FED_CHANCE,
    rng = Math.random,
  } = opts;

  const boss = isBossLevel(level, { every: bossEvery })
    ? {
        x: W / 2 - BOSS_W / 2,
        y: 44,
        vx: BOSS_SPEED,
        hp: BOSS_HP_BASE + (Math.floor(level / BOSS_EVERY) - 1) * BOSS_HP_STEP,
        maxHp: BOSS_HP_BASE + (Math.floor(level / BOSS_EVERY) - 1) * BOSS_HP_STEP,
        flash: 0,
        fireTimer: BOSS_FIRE_INTERVAL,
        broodTimer: 1.6,
      }
    : null;

  const aliens = [];
  for (let r = 0; r < ROWS && !boss; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({
        x: c * (ALIEN_W + ALIEN_GAP_X),
        y: r * (ALIEN_H + ALIEN_GAP_Y),
        row: r,
        alive: true,
        flash: 0,
        dive: null,
        // Only the back two rows carry a blood meal, so the tough ones sit
        // behind the cheap ones and have to be dug out.
        fed: r < 2 && rng() < fedChance,
        hp: 1,
      });
    }
  }

  for (const a of aliens) a.hp = a.fed ? 2 : 1;

  const motes = Array.from({ length: 34 }, () => ({
    x: rng() * W,
    y: rng() * H,
    v: 6 + rng() * 22,
    s: rng() < 0.25 ? 2 : 1,
  }));

  return {
    level,
    score,
    lives,
    player: {
      x: W / 2 - PLAYER_W / 2,
      y: PLAYER_Y,
      cooldown: 0,
      shield: false,
      rapidUntil: startRapid ? Infinity : 0,
      tripleUntil: 0,
      hitFlash: 0,
      muzzle: 0,
      recoil: 0,
    },
    aliens,
    boss,
    bunkers: bunkers ? makeBunkers() : [],
    stray: null,
    strayTimer: STRAY_INTERVAL,
    diveFrom,
    bossEvery,
    fireRate,
    diveRate,
    rng,
    diveTimer: DIVE_INTERVAL,
    formationX: SIDE_MARGIN,
    formationY: ALIEN_TOP,
    dir: 1,
    bullets: [],
    ebullets: [],
    powerups: [],
    particles: [],
    popups: [],
    motes,
    t: 0,
    intro: INTRO_TIME,
    enemyFireTimer: ALIEN_FIRE_INTERVAL,
    humTimer: 0,
    baseSpeed: (24 + (level - 1) * 8) * speed,
    // Feel state. Streak carries across waves; hit-stop and shake never do.
    streak: 0,
    comboTimer: 0,
    bestStreak: 0,
    shotsFired: 0,
    shotsHit: 0,
    hitStop: 0,
    shake: 0,
    // Latched once the wave or run is over. React needs a frame or two to flip
    // status, and without this the loop re-fires onLevelClear / onGameOver every
    // frame in between — overlapping the jingle and saving the score repeatedly.
    ended: false,
    reduceMotion: prefersReducedMotion(),
  };
}

function spawnPopup(g, x, y, text, color) {
  g.popups.push({ x, y, text, color, life: POPUP_LIFE });
}

/**
 * The swarm reached the craft's altitude. That used to end the run outright,
 * however many lives were left, which reads as a bug rather than a rule. Now it
 * costs one craft and drives the swarm back to the top — pressure kept, and the
 * lives on the HUD mean what they say. Its speed is untouched, so a thinned
 * swarm comes back just as fast.
 */
function breachDefences(g, cb) {
  g.lives -= 1;
  cb.onLives(g.lives);
  g.player.hitFlash = 0.5;
  g.shake = Math.max(g.shake, SHAKE_ON_HIT);
  breakCombo(g, cb);
  spawnPopup(g, W / 2, PLAYER_Y - 40, "SWARM BREACHED", "#e0384f");
  sfx.loseLife();
  haptics.loseCraft();

  g.formationY = ALIEN_TOP;
  g.ebullets.length = 0;
  for (const a of g.aliens) if (!a.brood) a.dive = null;
  if (g.boss) g.boss.y = 44;
  g.intro = INTRO_TIME * 0.6; // a moment to recover before it starts again

  if (g.lives <= 0) {
    g.ended = true;
    cb.onGameOver("landed");
    return true;
  }
  return false;
}

/** A miss, a bite, or two quiet seconds — any of them ends the streak. */
function breakCombo(g, cb) {
  if (g.streak === 0) return;
  g.streak = 0;
  g.comboTimer = 0;
  cb.onCombo(1);
}

const aliveCount = (g) => g.aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);

function spawnExplosion(g, x, y, color) {
  const rng = g.rng || Math.random;
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2;
    const sp = 30 + rng() * 90;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4,
      max: 0.4,
      color,
    });
  }
}

/** Drop weighting: rapid 40%, triple 32%, shield 18%, life 10%. */
function spawnPowerup(g, x, y) {
  const r = (g.rng || Math.random)();
  const type = r < 0.4 ? "rapid" : r < 0.72 ? "triple" : r < 0.9 ? "shield" : "life";
  g.powerups.push({ x: x - POWERUP_SIZE / 2, y, type });
}

function applyPowerup(g, type, cb) {
  const p = g.player;
  if (type === "rapid") p.rapidUntil = g.t + RAPID_DURATION;
  else if (type === "triple") p.tripleUntil = g.t + TRIPLE_DURATION;
  else if (type === "shield") p.shield = true;
  else if (type === "life") {
    g.lives = Math.min(MAX_LIVES, g.lives + 1);
    cb.onLives(g.lives);
  }
  sfx.powerup();
}

/* ───────────────────────── update ───────────────────────── */

/**
 * Advances one frame. Mutates `g`; reports only HUD-relevant changes back to
 * React through `cb` (onScore / onLives / onSwarm / onGameOver / onLevelClear).
 */
export function update(dt, g, input, cb) {
  if (g.ended) return;

  // Hit-stop: hold the whole world still for a few frames on a kill, so the
  // impact lands. Popups and shake keep animating in draw(); nothing else moves.
  if (g.hitStop > 0) {
    g.hitStop -= dt;
    return;
  }

  g.t += dt;
  const p = g.player;

  const intro = g.intro > 0;
  if (intro) g.intro -= dt;

  if (g.shake > 0) g.shake = Math.max(0, g.shake - SHAKE_DECAY * dt);

  for (let i = g.popups.length - 1; i >= 0; i--) {
    g.popups[i].life -= dt;
    if (g.popups[i].life <= 0) g.popups.splice(i, 1);
  }

  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) breakCombo(g, cb);
  }

  for (const m of g.motes) {
    m.y += m.v * dt;
    if (m.y > H) {
      m.y = -2;
      m.x = Math.random() * W;
    }
  }

  /* ---- player ---- */
  // A finger on the field beats the keyboard: the craft tracks the drag
  // one-to-one, which is what makes touch feel precise rather than laggy.
  if (input.dragTarget != null) {
    p.x = input.dragTarget;
  } else {
    if (input.left) p.x -= PLAYER_SPEED * dt;
    if (input.right) p.x += PLAYER_SPEED * dt;
  }
  p.x = Math.max(2, Math.min(W - PLAYER_W - 2, p.x));
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (p.recoil > 0) p.recoil -= dt;

  p.cooldown -= dt;
  if (input.fire && p.cooldown <= 0) {
    p.cooldown = g.t < p.rapidUntil ? RAPID_COOLDOWN : FIRE_COOLDOWN;
    const bx = p.x + PLAYER_W / 2 - 1.5;
    const by = p.y - 6;
    if (g.t < p.tripleUntil) {
      g.bullets.push({ x: bx, y: by, vx: -120 }, { x: bx, y: by, vx: 0 }, { x: bx, y: by, vx: 120 });
      g.shotsFired += 3;
    } else {
      g.bullets.push({ x: bx, y: by, vx: 0 });
      g.shotsFired += 1;
    }
    p.muzzle = MUZZLE_TIME;
    p.recoil = RECOIL_TIME;
    sfx.laser();
  }

  /* ---- formation march: thinner swarm flies faster ---- */
  const alive = aliveCount(g);
  if (!intro) g.formationX += g.baseSpeed * formationSpeedMul(alive) * dt * g.dir;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const a of g.aliens) {
    if (!a.alive || a.dive) continue; // brood and divers aren't in formation
    minX = Math.min(minX, g.formationX + a.x);
    maxX = Math.max(maxX, g.formationX + a.x + ALIEN_W);
  }
  if (minX < 6 && g.dir < 0) {
    g.dir = 1;
    g.formationY += STEP_DOWN;
    g.formationX += 6 - minX;
    sfx.wingHum();
  } else if (maxX > W - 6 && g.dir > 0) {
    g.dir = -1;
    g.formationY += STEP_DOWN;
    g.formationX -= maxX - (W - 6);
    sfx.wingHum();
  }

  for (const a of g.aliens) if (a.flash > 0) a.flash -= dt;

  /* ---- divers: break formation and swoop at the craft ---- */
  if (g.level >= g.diveFrom && !intro) {
    g.diveTimer -= dt;
    const active = g.aliens.filter((a) => a.alive && a.dive).length;
    if (g.diveTimer <= 0 && active < DIVE_MAX_ACTIVE) {
      // Prefer the front rank — the ones with a clear run at the player.
      const ready = g.aliens.filter((a) => a.alive && !a.dive);
      if (ready.length) {
        const front = ready.filter((a) => a.row >= ROWS - 2);
        const pool = front.length ? front : ready;
        const a = pool[Math.floor(g.rng() * pool.length)];
        const pos = alienPos(g, a);
        a.dive = { x: pos.x, y: pos.y, vx: 0, vy: 40, t: 0 };
        sfx.dive();
      }
      g.diveTimer = Math.max(1.6, DIVE_INTERVAL - (g.level - g.diveFrom) * 0.45) * g.diveRate;
    }
  }

  for (const a of g.aliens) {
    if (!a.alive || !a.dive) continue;
    const d = a.dive;
    d.t += dt;
    d.vy = Math.min(DIVE_SPEED_MAX, d.vy + DIVE_ACCEL * dt);
    // Steer toward the craft, with a wobble so the path isn't a straight line.
    const toPlayer = p.x + PLAYER_W / 2 - (d.x + ALIEN_W / 2);
    d.vx = Math.max(-DIVE_TRACK_MAX, Math.min(DIVE_TRACK_MAX, toPlayer * DIVE_TRACK));
    d.x += (d.vx + Math.sin(d.t * 7) * 40) * dt;
    d.y += d.vy * dt;
    d.x = Math.max(0, Math.min(W - ALIEN_W, d.x));

    // Divers chew through cover on the way past.
    for (const b of g.bunkers) {
      if (d.x + ALIEN_W < b.x || d.x > b.x + BUNKER_W) continue;
      if (d.y + ALIEN_H < b.y || d.y > b.y + BUNKER_H) continue;
      erodeBunker(b, d.x + ALIEN_W / 2, d.y + ALIEN_H / 2, 2, g.rng);
    }

    // Collision with the craft: same cost as a bite, and the diver is spent.
    if (
      d.x < p.x + PLAYER_W && d.x + ALIEN_W > p.x &&
      d.y < p.y + PLAYER_H && d.y + ALIEN_H > p.y
    ) {
      a.alive = false;
      a.dive = null;
      cb.onSwarm(aliveCount(g));
      spawnExplosion(g, p.x + PLAYER_W / 2, p.y, SPECIES[a.row].body);
      if (p.shield) {
        p.shield = false;
        g.shake = Math.max(g.shake, SHAKE_ON_SHIELD);
        sfx.shieldBreak();
      } else {
        g.lives -= 1;
        p.hitFlash = 0.5;
        g.shake = Math.max(g.shake, SHAKE_ON_HIT);
        breakCombo(g, cb);
        cb.onLives(g.lives);
        sfx.loseLife();
        haptics.loseCraft();
        if (g.lives <= 0) {
          g.ended = true;
          cb.onGameOver("swarmed");
          return;
        }
      }
      continue;
    }

    // Off the bottom: brood are spent, formation mosquitoes rejoin their slot.
    if (d.y > H + ALIEN_H) {
      if (a.brood) {
        a.alive = false;
        a.dive = null;
        cb.onSwarm(aliveCount(g));
      } else {
        a.dive = null;
      }
    }
  }

  /* ---- the stray: one that got away, crossing the top for big points ---- */
  if (!intro) {
    if (g.stray) {
      g.stray.x += g.stray.dir * STRAY_SPEED * dt;
      if (g.stray.x < -STRAY_W - 4 || g.stray.x > W + 4) g.stray = null;
    } else {
      g.strayTimer -= dt;
      if (g.strayTimer <= 0) {
        if (g.rng() < STRAY_CHANCE) {
          const dir = g.rng() < 0.5 ? 1 : -1;
          g.stray = { x: dir > 0 ? -STRAY_W : W, y: STRAY_Y, dir, t: 0 };
          sfx.stray();
        }
        g.strayTimer = STRAY_INTERVAL;
      }
    }
  }
  if (g.stray) g.stray.t += dt;

  /* ---- the queen ---- */
  if (g.boss) {
    const boss = g.boss;
    if (boss.flash > 0) boss.flash -= dt;

    if (!intro) boss.x += boss.vx * dt;
    if (boss.x < 4) {
      boss.x = 4;
      boss.vx = Math.abs(boss.vx);
    } else if (boss.x > W - BOSS_W - 4) {
      boss.x = W - BOSS_W - 4;
      boss.vx = -Math.abs(boss.vx);
    }
    if (!intro) boss.y += BOSS_DESCENT * dt;

    // She fires faster the more damage she has taken.
    const urgency = 1 - (boss.hp / boss.maxHp) * 0.55;
    if (!intro) boss.fireTimer -= dt;
    if (boss.fireTimer <= 0) {
      const cx = boss.x + BOSS_W / 2 - 1.5;
      const by = boss.y + BOSS_H;
      g.ebullets.push({ x: cx - 14, y: by }, { x: cx, y: by }, { x: cx + 14, y: by });
      boss.fireTimer = BOSS_FIRE_INTERVAL * urgency * (0.8 + g.rng() * 0.4) * g.fireRate;
    }

    if (!intro) boss.broodTimer -= dt;
    if (boss.broodTimer <= 0) {
      const brood = g.aliens.filter((a) => a.alive && a.brood).length;
      if (brood < BOSS_BROOD_MAX) {
        spawnBrood(g, boss.x + BOSS_W / 2 - ALIEN_W / 2, boss.y + BOSS_H - 6);
        cb.onSwarm(aliveCount(g));
        sfx.dive();
      }
      boss.broodTimer = BOSS_BROOD_INTERVAL * urgency;
    }

    // She grinds cover away as she descends onto it.
    for (const b of g.bunkers) {
      if (boss.x + BOSS_W < b.x || boss.x > b.x + BUNKER_W) continue;
      if (boss.y + BOSS_H < b.y || boss.y > b.y + BUNKER_H) continue;
      erodeBunker(b, Math.max(b.x, Math.min(boss.x + BOSS_W / 2, b.x + BUNKER_W)), b.y + 2, 3, g.rng);
    }

    if (boss.y + BOSS_H >= p.y) {
      if (breachDefences(g, cb)) return;
    }
  }

  /* ---- player bullets ---- */
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    const fromX = b.x;
    const fromY = b.y;
    b.y -= BULLET_SPEED * dt;
    b.x += (b.vx || 0) * dt;
    if (b.y < -8 || b.x < -8 || b.x > W + 8) {
      g.bullets.splice(i, 1);
      breakCombo(g, cb); // a shot that hit nothing ends the streak
      continue;
    }

    // Your own cover stops your shots — that's the trade.
    if (bulletHitsBunker(g, fromX, fromY, b.x, b.y)) {
      g.bullets.splice(i, 1);
      breakCombo(g, cb);
      sfx.thud();
      continue;
    }

    // Shooting a falling power-up destroys it — intentional risk/reward.
    let consumed = false;
    for (let j = g.powerups.length - 1; j >= 0; j--) {
      const u = g.powerups[j];
      if (
        b.x < u.x + POWERUP_SIZE &&
        b.x + 3 > u.x &&
        b.y < u.y + POWERUP_SIZE &&
        b.y + 7 > u.y
      ) {
        // Shot rather than caught: it pays out. The choice stays — points now,
        // or the power-up's effect if you let it fall to you — but a stray shot
        // during rapid fire no longer feels like the game docking you for it.
        const cashMult = comboMultiplier(g.streak);
        const cash = POWERUP_SHOT_POINTS * cashMult;
        g.score += cash;
        cb.onScore(g.score);
        spawnPopup(g, u.x + POWERUP_SIZE / 2, u.y, `+${cash}`, POWERUP_COLORS[u.type]);
        spawnExplosion(g, u.x + POWERUP_SIZE / 2, u.y + POWERUP_SIZE / 2, POWERUP_COLORS[u.type]);
        g.powerups.splice(j, 1);
        g.bullets.splice(i, 1);
        sfx.pop();
        consumed = true;
        break;
      }
    }
    if (consumed) continue;

    if (g.stray) {
      const st = g.stray;
      if (b.x < st.x + STRAY_W && b.x + 3 > st.x && b.y < st.y + STRAY_H && b.y + 7 > st.y) {
        const mult = comboMultiplier(g.streak);
        const points = STRAY_POINTS * mult;
        g.score += points;
        cb.onScore(g.score);
        g.shotsHit += 1;
        spawnPopup(g, st.x + STRAY_W / 2, st.y, `+${points} STRAY`, "#f472b6");
        spawnExplosion(g, st.x + STRAY_W / 2, st.y + STRAY_H / 2, "#f472b6");
        g.stray = null;
        g.bullets.splice(i, 1);
        g.hitStop = HIT_STOP;
        g.shake = Math.max(g.shake, 2);
        sfx.powerup();
        haptics.hit();
        break;
      }
    }

    if (g.boss) {
      const boss = g.boss;
      if (
        b.x < boss.x + BOSS_W && b.x + 3 > boss.x &&
        b.y < boss.y + BOSS_H && b.y + 7 > boss.y
      ) {
        boss.hp -= 1;
        boss.flash = 0.08;
        g.score += BOSS_HIT_POINTS;
        cb.onScore(g.score);
        spawnExplosion(g, b.x, b.y, "#e0384f");
        g.bullets.splice(i, 1);

        if (boss.hp <= 0) {
          const mult = comboMultiplier(g.streak);
          const points = BOSS_KILL_POINTS * mult;
          g.score += points;
          cb.onScore(g.score);
          spawnPopup(g, boss.x + BOSS_W / 2, boss.y + 8, `QUEEN +${points}`, "#6fe3c0");
          for (let k = 0; k < 5; k++) {
            spawnExplosion(
              g,
              boss.x + Math.random() * BOSS_W,
              boss.y + Math.random() * BOSS_H,
              k % 2 ? "#e0384f" : "#ffb02e"
            );
          }
          g.shake = Math.max(g.shake, 6);
          g.hitStop = HIT_STOP * 3;
          g.boss = null;
          sfx.bossDown();
        } else {
          g.hitStop = HIT_STOP * 0.5;
          sfx.bossHit();
        }
        break;
      }
    }

    for (const a of g.aliens) {
      if (!a.alive) continue;
      const { x: ax, y: ay } = alienPos(g, a);
      if (b.x < ax + ALIEN_W && b.x + 3 > ax && b.y < ay + ALIEN_H && b.y + 7 > ay) {
        g.shotsHit += 1;
        a.flash = 0.12;
        a.hp -= 1;

        // A blood-fed mosquito soaks the first hit — the round goes in, it
        // doesn't go down, and the streak is untouched.
        if (a.hp > 0) {
          spawnExplosion(g, b.x, b.y, "#8b1d2c");
          g.bullets.splice(i, 1);
          g.hitStop = HIT_STOP * 0.4;
          sfx.thud();
          break;
        }

        a.alive = false;
        g.streak += 1;
        g.bestStreak = Math.max(g.bestStreak, g.streak);
        g.comboTimer = COMBO_WINDOW;
        const mult = comboMultiplier(g.streak);
        const diving = Boolean(a.dive);
        a.dive = null;
        const points =
          SPECIES[a.row].pts * mult * (diving ? DIVE_BONUS : 1) * (a.fed ? FED_BONUS : 1);
        g.score += points;
        cb.onScore(g.score);
        cb.onSwarm(alive - 1);
        cb.onCombo(mult);

        spawnPopup(
          g,
          ax + ALIEN_W / 2,
          ay,
          diving ? `+${points} DIVE` : a.fed ? `+${points} FED` : mult > 1 ? `+${points} ×${mult}` : `+${points}`,
          diving ? "#6fe3c0" : a.fed ? "#f472b6" : mult > 1 ? "#ffb02e" : "#efe6ff"
        );
        spawnExplosion(g, ax + ALIEN_W / 2, ay + ALIEN_H / 2, SPECIES[a.row].body);
        if (g.rng() < POWERUP_CHANCE) spawnPowerup(g, ax + ALIEN_W / 2, ay);
        g.bullets.splice(i, 1);
        g.hitStop = HIT_STOP;
        sfx.hit(mult);
        haptics.hit();
        break;
      }
    }
  }

  /* ---- enemy fire ---- */
  if (!intro) g.enemyFireTimer -= dt;
  if (g.enemyFireTimer <= 0) {
    const shooters = g.aliens.filter((a) => a.alive && !a.brood);
    if (shooters.length) {
      const a = shooters[Math.floor(g.rng() * shooters.length)];
      const pos = alienPos(g, a);
      g.ebullets.push({ x: pos.x + ALIEN_W / 2 - 1.5, y: pos.y + ALIEN_H });
    }
    const base = Math.max(0.32, ALIEN_FIRE_INTERVAL - (g.level - 1) * 0.09) * g.fireRate;
    g.enemyFireTimer = base * (0.7 + g.rng() * 0.6);
  }

  for (let i = g.ebullets.length - 1; i >= 0; i--) {
    const b = g.ebullets[i];
    const fromY = b.y;
    b.y += ALIEN_BULLET_SPEED * dt;
    if (b.y > H + 8) {
      g.ebullets.splice(i, 1);
      continue;
    }
    if (bulletHitsBunker(g, b.x, fromY, b.x, b.y)) {
      g.ebullets.splice(i, 1);
      sfx.thud();
      continue;
    }
    if (b.x < p.x + PLAYER_W && b.x + 3 > p.x && b.y < p.y + PLAYER_H && b.y + 8 > p.y) {
      g.ebullets.splice(i, 1);
      if (p.shield) {
        p.shield = false;
        g.shake = Math.max(g.shake, SHAKE_ON_SHIELD);
        spawnExplosion(g, b.x, b.y, POWERUP_COLORS.shield);
        sfx.shieldBreak();
      } else {
        g.lives -= 1;
        p.hitFlash = 0.5;
        g.shake = Math.max(g.shake, SHAKE_ON_HIT);
        breakCombo(g, cb);
        cb.onLives(g.lives);
        spawnExplosion(g, p.x + PLAYER_W / 2, p.y, "#ffb02e");
        sfx.loseLife();
        haptics.loseCraft();
        if (g.lives <= 0) {
          g.ended = true;
          cb.onGameOver("shot");
          return;
        }
      }
    }
  }

  /* ---- power-ups ---- */
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const u = g.powerups[i];
    u.y += POWERUP_SPEED * dt;
    if (u.y > H + POWERUP_SIZE) {
      g.powerups.splice(i, 1);
      continue;
    }
    if (
      u.x < p.x + PLAYER_W + 4 &&
      u.x + POWERUP_SIZE > p.x - 4 &&
      u.y < p.y + PLAYER_H + 4 &&
      u.y + POWERUP_SIZE > p.y - 4
    ) {
      applyPowerup(g, u.type, cb);
      g.powerups.splice(i, 1);
    }
  }

  /* ---- particles ---- */
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const q = g.particles[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.92;
    q.vy *= 0.92;
    q.life -= dt;
    if (q.life <= 0) g.particles.splice(i, 1);
  }

  /* ---- ambient hum, closer swarm = more insistent ---- */
  g.humTimer -= dt;
  if (g.humTimer <= 0) {
    sfx.wingHum();
    g.humTimer = 1.6 - Math.min(1.1, g.formationY / H);
  }

  /* ---- the swarm grinds down whatever cover it reaches ---- */
  for (const a of g.aliens) {
    if (!a.alive || a.dive) continue;
    const ax = g.formationX + a.x;
    const ay = g.formationY + a.y;
    if (ay + ALIEN_H < BUNKER_Y || ay > BUNKER_Y + BUNKER_H) continue;
    for (const b of g.bunkers) {
      if (ax + ALIEN_W < b.x || ax > b.x + BUNKER_W) continue;
      erodeBunker(b, ax + ALIEN_W / 2, ay + ALIEN_H / 2, 2, g.rng);
    }
  }

  /* ---- end conditions ---- */
  for (const a of g.aliens) {
    if (a.alive && !a.dive && g.formationY + a.y + ALIEN_H >= p.y) {
      if (breachDefences(g, cb)) return;
      break;
    }
  }
  if (alive === 0 && !g.boss && !g.stray) {
    g.ended = true;
    cb.onLevelClear();
  }
}

/* ───────────────────────── draw ───────────────────────── */

/**
 * Row markings, so species are distinguishable without relying on hue. Red and
 * mint are the pair most likely to collapse under deuteranopia, and row colour
 * was previously the only thing telling the species apart.
 */
function drawRowMark(ctx, x, y, row, ink) {
  ctx.fillStyle = ink;
  if (row === 0) {
    ctx.fillRect(x + 9, y + 4, 5, 1); // bar
  } else if (row === 1) {
    ctx.fillRect(x + 10, y + 3, 2, 2); // single dot
  } else if (row === 2) {
    ctx.fillRect(x + 8, y + 3, 2, 2); // two dots
    ctx.fillRect(x + 13, y + 3, 2, 2);
  } else {
    ctx.fillRect(x + 9, y + 3, 2, 2); // chevron
    ctx.fillRect(x + 11, y + 5, 2, 2);
    ctx.fillRect(x + 13, y + 3, 2, 2);
  }
}

function drawMosquito(ctx, x, y, color, flash, t, row, diving = false, fed = false) {
  const wing = Math.sin(t * (diving ? 46 : 26) + row * 1.7) * (diving ? 2.4 : 1.6);
  if (diving) {
    // A faint smear behind it, so a swooping mosquito is never a surprise.
    ctx.fillStyle = "rgba(224,56,79,.22)";
    ctx.fillRect(x + 6, y - 7, ALIEN_W - 12, 7);
  }
  ctx.fillStyle = "rgba(200,225,255,.26)";
  ctx.fillRect(x + 2, y + 2 + wing, 7, 4);
  ctx.fillRect(x + ALIEN_W - 9, y + 2 - wing, 7, 4);

  const c = flash ? "#ffffff" : color;
  ctx.fillStyle = c;
  ctx.fillRect(x + 7, y + 6, 9, 6); // thorax
  ctx.fillRect(x + 15, y + 7, 6, 4); // abdomen
  if (fed) {
    // Engorged: the abdomen swells and darkens with a blood meal.
    ctx.fillStyle = flash ? "#ffffff" : "#8b1d2c";
    ctx.fillRect(x + 15, y + 5, 7, 8);
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.fillRect(x + 17, y + 6, 2, 2);
  }
  ctx.fillStyle = "rgba(11,9,16,.55)"; // stripes
  ctx.fillRect(x + 16, y + 7, 1, 4);
  ctx.fillRect(x + 18, y + 7, 1, 4);
  ctx.fillStyle = c;
  ctx.fillRect(x + 4, y + 6, 3, 4); // head
  ctx.fillStyle = "#0b0910";
  ctx.fillRect(x + 4, y + 6, 2, 2); // eye
  ctx.fillStyle = flash ? "#ffffff" : "rgba(239,230,255,.7)";
  ctx.fillRect(x, y + 9, 5, 1); // proboscis
  ctx.fillStyle = "rgba(239,230,255,.35)"; // legs
  ctx.fillRect(x + 8, y + 12, 1, 3);
  ctx.fillRect(x + 12, y + 12, 1, 4);
  ctx.fillRect(x + 15, y + 12, 1, 3);
  ctx.fillRect(x + 9, y + 4, 1, 2);
  ctx.fillRect(x + 13, y + 3, 1, 3);
}

function drawPlayer(ctx, g) {
  const p = g.player;
  const x = p.x;
  const y = p.y + (p.recoil > 0 ? 1 : 0); // the craft sits back a pixel on firing
  if (p.hitFlash > 0 && Math.floor(p.hitFlash * 20) % 2 === 0) return;

  if (p.muzzle > 0) {
    ctx.fillStyle = "#fff6dd";
    ctx.fillRect(x + 11, y - 4, 4, 4);
    ctx.fillStyle = "rgba(255,176,46,.5)";
    ctx.fillRect(x + 9, y - 6, 8, 3);
  }

  ctx.fillStyle = "#ffb02e";
  ctx.fillRect(x + 2, y + 8, PLAYER_W - 4, 5); // wings
  ctx.fillRect(x + 8, y + 3, PLAYER_W - 16, 6); // fuselage
  ctx.fillRect(x + 11, y, 4, 4); // nose
  ctx.fillStyle = "#7a3d00";
  ctx.fillRect(x, y + 10, 3, 3);
  ctx.fillRect(x + PLAYER_W - 3, y + 10, 3, 3);
  ctx.fillStyle = "#6fe3c0";
  ctx.fillRect(x + 11, y + 4, 4, 3); // cockpit

  const thrust = 2 + Math.floor(Math.random() * 3);
  ctx.fillStyle = "rgba(255,176,46,.75)";
  ctx.fillRect(x + 9, y + PLAYER_H - 1, 3, thrust);
  ctx.fillRect(x + 14, y + PLAYER_H - 1, 3, thrust);

  if (p.shield) {
    ctx.strokeStyle = `rgba(56,189,248,${0.55 + Math.sin(g.t * 8) * 0.2})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 4.5, y - 4.5, PLAYER_W + 9, PLAYER_H + 9);
  }
}

function drawPowerup(ctx, u, t) {
  const c = POWERUP_COLORS[u.type];
  const bob = Math.sin(t * 7 + u.x) * 0.8;
  ctx.fillStyle = "rgba(11,9,16,.7)";
  ctx.fillRect(u.x, u.y + bob, POWERUP_SIZE, POWERUP_SIZE);
  ctx.strokeStyle = c;
  ctx.lineWidth = 1;
  ctx.strokeRect(u.x + 0.5, u.y + bob + 0.5, POWERUP_SIZE - 1, POWERUP_SIZE - 1);
  ctx.fillStyle = c;
  ctx.font = "bold 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(POWERUP_LETTERS[u.type], u.x + POWERUP_SIZE / 2, u.y + bob + POWERUP_SIZE / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Depleting bars for the timed boosts, top-left of the field. */
function drawBoostTags(ctx, g) {
  const p = g.player;
  const tags = [];
  if (g.t < p.rapidUntil)
    tags.push({ label: "RAPID", color: POWERUP_COLORS.rapid, f: (p.rapidUntil - g.t) / RAPID_DURATION });
  if (g.t < p.tripleUntil)
    tags.push({ label: "TRIPLE", color: POWERUP_COLORS.triple, f: (p.tripleUntil - g.t) / TRIPLE_DURATION });
  if (p.shield) tags.push({ label: "SHIELD", color: POWERUP_COLORS.shield, f: 1 });

  let y = 8;
  ctx.font = "8px 'IBM Plex Mono', monospace";
  for (const tag of tags) {
    ctx.fillStyle = "rgba(11,9,16,.75)";
    ctx.fillRect(6, y, 54, 11);
    ctx.fillStyle = tag.color;
    ctx.fillRect(6, y, Math.max(1, 54 * tag.f), 11);
    ctx.fillStyle = "#0b0910";
    ctx.fillText(tag.label, 10, y + 8);
    y += 14;
  }
}

/** The queen. Same anatomy as her swarm, four times the size, plus a crown. */
function drawQueen(ctx, boss, t) {
  const { x, y } = boss;
  const beat = Math.sin(t * 16) * 3.2;
  const hurt = boss.hp / boss.maxHp < 0.35;

  ctx.fillStyle = "rgba(200,225,255,.22)";
  ctx.fillRect(x + 4, y + 4 + beat, 24, 9);
  ctx.fillRect(x + BOSS_W - 28, y + 4 - beat, 24, 9);

  const body = boss.flash > 0 ? "#ffffff" : hurt ? "#b8283b" : "#e0384f";
  ctx.fillStyle = body;
  ctx.fillRect(x + 14, y + 12, 26, 14); // thorax
  ctx.fillRect(x + 38, y + 15, 16, 9); // abdomen
  ctx.fillRect(x + 52, y + 17, 8, 5); // tip

  ctx.fillStyle = "rgba(11,9,16,.5)"; // stripes
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 40 + i * 5, y + 15, 2, 9);

  ctx.fillStyle = boss.flash > 0 ? "#ffffff" : "#ffb02e"; // crown
  ctx.fillRect(x + 16, y + 6, 3, 6);
  ctx.fillRect(x + 22, y + 3, 3, 9);
  ctx.fillRect(x + 28, y + 6, 3, 6);

  ctx.fillStyle = body;
  ctx.fillRect(x + 6, y + 13, 10, 10); // head
  ctx.fillStyle = "#0b0910";
  ctx.fillRect(x + 7, y + 15, 4, 4); // eye
  ctx.fillStyle = "#efe6ff";
  ctx.fillRect(x - 6, y + 20, 13, 2); // proboscis

  ctx.fillStyle = "rgba(239,230,255,.35)"; // legs
  ctx.fillRect(x + 18, y + 26, 2, 7);
  ctx.fillRect(x + 26, y + 26, 2, 9);
  ctx.fillRect(x + 34, y + 26, 2, 7);
}

/** Her health, as a bar across the top of the field. */
function drawBossBar(ctx, boss) {
  const w = W - 16;
  const f = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = "rgba(11,9,16,.8)";
  ctx.fillRect(8, H - 14, w, 7);
  ctx.fillStyle = f < 0.35 ? "#ffb02e" : "#e0384f";
  ctx.fillRect(8, H - 14, w * f, 7);
  ctx.font = "7px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#efe6ff";
  ctx.fillText("THE QUEEN", 10, H - 8.5);
}

/** Between waves: a card naming what's coming, while the swarm holds station. */
function drawWaveCard(ctx, g) {
  if (g.intro <= 0) return;
  const { wave, sub } = waveTitle(g.level);
  // Fade in over the first 15% and out over the last 25%, hold in between.
  const f = g.intro / INTRO_TIME;
  const alpha = Math.min(1, Math.min((1 - f) / 0.15, f / 0.25));

  ctx.globalAlpha = Math.max(0, alpha);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(11,9,16,.72)";
  ctx.fillRect(0, H / 2 - 34, W, 68);
  ctx.fillStyle = "#ffb02e";
  ctx.fillRect(0, H / 2 - 34, W, 1);
  ctx.fillRect(0, H / 2 + 33, W, 1);

  ctx.font = "16px 'Silkscreen', monospace";
  ctx.fillText(wave, W / 2, H / 2 - 6);
  ctx.font = "9px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#9a8cb4";
  ctx.fillText(sub, W / 2, H / 2 + 14);

  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

/** Bunkers, drawn cell by cell. Thinning cover reads as a fraying silhouette. */
function drawBunkers(ctx, g) {
  for (const b of g.bunkers) {
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        if (!b.cells[r * BUNKER_COLS + c]) continue;
        // Top rows sit slightly brighter, so erosion is legible at a glance.
        ctx.fillStyle = r < 2 ? "#4f7f68" : "#3c6450";
        ctx.fillRect(b.x + c * BUNKER_CELL, b.y + r * BUNKER_CELL, BUNKER_CELL, BUNKER_CELL);
      }
    }
  }
}

/** Floating score, drifting up and fading as its life runs out. */
function drawPopups(ctx, g) {
  ctx.font = "bold 9px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  for (const s of g.popups) {
    const f = s.life / POPUP_LIFE;
    ctx.globalAlpha = Math.min(1, f * 1.6);
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x, s.y - (1 - f) * POPUP_RISE);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/** Live combo multiplier, top-right, pulsing on the beat of each kill. */
function drawCombo(ctx, g) {
  const mult = comboMultiplier(g.streak);
  if (mult < 2) return;
  const fade = Math.min(1, g.comboTimer / 0.5);
  ctx.globalAlpha = fade;
  ctx.font = "bold 15px 'Silkscreen', monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffb02e";
  ctx.fillText(`×${mult}`, W - 8, 21);
  ctx.font = "7px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#9a8cb4";
  ctx.fillText(`${g.streak} STREAK`, W - 8, 31);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

export function draw(canvas, g) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0910";
  ctx.fillRect(0, 0, W, H);
  if (!g) return;

  // Screen shake: offset everything except the ground already painted.
  const shaking = g.shake > 0.1 && !g.reduceMotion;
  if (shaking) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 2 * g.shake, (Math.random() - 0.5) * 2 * g.shake);
  }

  for (const m of g.motes) {
    ctx.fillStyle = m.s > 1 ? "rgba(167,139,250,.28)" : "rgba(239,230,255,.14)";
    ctx.fillRect(Math.round(m.x), Math.round(m.y), m.s, m.s);
  }

  // The line the swarm must not cross.
  ctx.fillStyle = "rgba(224,56,79,.22)";
  for (let x = 0; x < W; x += 8) ctx.fillRect(x, g.player.y - 1, 4, 1);

  drawBunkers(ctx, g);
  if (g.boss) drawQueen(ctx, g.boss, g.t);

  for (const a of g.aliens) {
    if (!a.alive) continue;
    const { x: ax, y: ay } = alienPos(g, a);
    drawMosquito(ctx, ax, ay, SPECIES[a.row].body, a.flash > 0, g.t, a.row, Boolean(a.dive), a.fed);
  }

  if (g.stray) drawStray(ctx, g.stray);

  ctx.fillStyle = "#ffe9b8";
  for (const b of g.bullets) ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 7);
  for (const b of g.ebullets) {
    ctx.fillStyle = "#e0384f";
    ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 6);
    ctx.fillStyle = "rgba(224,56,79,.4)";
    ctx.fillRect(Math.round(b.x), Math.round(b.y) - 3, 3, 3);
  }

  for (const u of g.powerups) drawPowerup(ctx, u, g.t);

  for (const q of g.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 3, 3);
  }
  ctx.globalAlpha = 1;

  drawPlayer(ctx, g);
  drawPopups(ctx, g);

  if (shaking) ctx.restore();

  // HUD-ish overlays stay steady while the world shakes.
  drawBoostTags(ctx, g);
  drawCombo(ctx, g);
  if (g.boss) drawBossBar(ctx, g.boss);
  drawWaveCard(ctx, g);
}

/* ───────────────────────── component ───────────────────────── */

export default function Game({ daily = false }) {
  // Read once per mount: changing difficulty mid-run would be incoherent.
  const settings = useRef(loadSettings()).current;
  const challenge = useRef(daily ? dailyChallenge() : null).current;

  /** Options for makeLevel: difficulty always, daily modifiers when relevant. */
  const levelOpts = useCallback(
    (level) => {
      const d = difficultyOf(settings);
      const base = { speed: d.speed, fireRate: d.fireRate, diveRate: d.dives };
      if (!challenge) return base;
      // A daily run is the same for everyone: same seed, same modifier.
      return { ...base, ...challenge.mods, rng: mulberry32(challenge.seed + level) };
    },
    [settings, challenge]
  );

  const canvasRef = useRef(null);
  const game = useRef(null);
  if (!game.current) game.current = makeLevel(1, 0, 3);

  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [swarm, setSwarm] = useState(TOTAL_ALIENS);
  const [combo, setCombo] = useState(1);
  const [summary, setSummary] = useState(null);
  const [deathReason, setDeathReason] = useState("shot");
  const [needsInitials, setNeedsInitials] = useState(false);
  const [scores, setScores] = useState(() => loadScores());
  const [highScore, setHighScore] = useState(() => getHighScore());

  // Mirrors `status` so the frame closure can early-return without going stale.
  const statusRef = useRef(status);
  const needsInitialsRef = useRef(false);
  useEffect(() => {
    needsInitialsRef.current = needsInitials;
  }, [needsInitials]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /* canvas backing store, DPR-aware and pixel-crisp */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      draw(canvas, game.current);
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const startGame = useCallback(() => {
    sfx.setMuted(settings.muted);
    sfx.unlock();
    initHaptics();
    const opts = levelOpts(1);
    const startLives = opts.lives ?? 3;
    game.current = makeLevel(1, 0, startLives, opts);
    setScore(0);
    setLives(startLives);
    setLevel(1);
    setSwarm(game.current.aliens.length);
    setCombo(1);
    setSummary(null);
    setStatus("playing");
  }, []);

  const nextLevel = useCallback(() => {
    sfx.unlock();
    initHaptics();
    const prev = game.current;
    const next = makeLevel(prev.level + 1, prev.score, prev.lives, levelOpts(prev.level + 1));
    next.player.shield = prev.player.shield; // an unbroken shield carries over
    // Run stats span the whole run, not one wave.
    next.bestStreak = prev.bestStreak;
    next.shotsFired = prev.shotsFired;
    next.shotsHit = prev.shotsHit;
    game.current = next;
    setLevel(next.level);
    setSwarm(next.aliens.length);
    setCombo(1);
    setStatus("playing");
  }, []);

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") {
      sfx.pause();
      setStatus("paused");
    } else if (statusRef.current === "paused") {
      sfx.resume();
      setStatus("playing");
    }
  }, [levelOpts]);

  /** Called once the player has entered (or skipped) their initials. */
  const commitScore = useCallback(
    (initials) => {
      const finalScore = game.current.score;
      if (initials) saveSettings({ initials });
      const next = saveScore(finalScore, initials || "···");
      setScores(next);
      setHighScore(next[0]?.score || 0);
      setNeedsInitials(false);
    },
    []
  );

  const onStart = useCallback(() => {
    if (statusRef.current === "paused") togglePause();
    else if (statusRef.current === "levelup") nextLevel();
    else startGame();
  }, [nextLevel, startGame, togglePause]);

  // A call, an app switch, or a locked screen must not cost the player a run.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && statusRef.current === "playing") setStatus("paused");
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  const { input, press } = useTouchControls({
    onConfirm: () => {
      if (needsInitialsRef.current) return; // the board is waiting on a name
      if (statusRef.current !== "playing") onStart();
    },
    onPause: togglePause,
  });

  const callbacks = useRef({});
  callbacks.current = {
    onScore: setScore,
    onLives: setLives,
    onSwarm: setSwarm,
    onCombo: setCombo,
    onLevelClear: () => {
      setStatus("levelup");
      sfx.levelClear();
    },
    onGameOver: (reason) => {
      const g = game.current;
      const finalScore = g.score;
      if (challenge) recordDaily(finalScore, g.level, challenge.dateKey);
      const fired = g.shotsFired || 0;
      setSummary({
        wave: g.level,
        bestStreak: g.bestStreak,
        accuracy: fired ? Math.round(((g.shotsHit || 0) / fired) * 100) : 0,
      });
      setDeathReason(reason);
      setLives(0);
      setStatus("gameover");
      setNeedsInitials(qualifies(finalScore));
      sfx.gameOver();
    },
  };

  /* Relative drag: wherever the finger lands, moving it by n px moves the craft
     by the same n logical px. Absolute tracking would put the craft under the
     thumb, which is exactly where you need to see. */
  const drag = useRef(null);

  const beginDrag = useCallback(
    (clientX, rect, id) => {
      if (statusRef.current !== "playing") return;
      drag.current = {
        id,
        clientX,
        startX: game.current.player.x,
        scale: W / rect.width, // CSS px → logical px
      };
      input.current.dragTarget = game.current.player.x;
    },
    [input]
  );

  const moveDrag = useCallback(
    (clientX, id) => {
      const d = drag.current;
      if (!d || d.id !== id) return;
      const dx = (clientX - d.clientX) * d.scale;
      input.current.dragTarget = Math.max(2, Math.min(W - PLAYER_W - 2, d.startX + dx));
    },
    [input]
  );

  const endDrag = useCallback(() => {
    drag.current = null;
    input.current.dragTarget = null;
  }, [input]);

  const onPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "touch") return; // touch handlers own this below
      beginDrag(e.clientX, e.currentTarget.getBoundingClientRect(), e.pointerId);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [beginDrag]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (e.pointerType === "touch") return;
      moveDrag(e.clientX, e.pointerId);
    },
    [moveDrag]
  );

  /* iOS WKWebView routes touches through its own gesture machinery and will
     cancel a pointer stream mid-drag, which reads as the craft sticking. Touch
     events are delivered reliably, so touch devices use them directly. */
  const onTouchStart = useCallback(
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      beginDrag(t.clientX, e.currentTarget.getBoundingClientRect(), t.identifier);
    },
    [beginDrag]
  );

  const onTouchMove = useCallback(
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      if (e.cancelable) e.preventDefault(); // no rubber-banding mid-dogfight
      moveDrag(t.clientX, t.identifier);
    },
    [moveDrag]
  );

  useGameLoop(
    useCallback(
      (dt) => {
        const g = game.current;
        if (statusRef.current === "playing") update(dt, g, input.current, callbacks.current);
        draw(canvasRef.current, g);
      },
      [input]
    ),
    true
  );

  return (
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2">
      <div className="relative border border-[#33254a] bg-gradient-to-b from-[#221635] to-[#160e21] px-3 py-2 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(16px,5vw,22px)] leading-none m-0 text-[#ffb02e] drop-shadow-[0_0_10px_rgba(255,176,46,0.4)]">
          MOSQUITO INVADERS
        </h1>
        <div className="mt-1 text-[8px] tracking-[0.28em] uppercase text-[#9a8cb4]">
          Citronella Squadron · Sector 7
        </div>
      </div>

      <Hud score={score} level={level} swarm={swarm} lives={lives} />

      <div
        className="relative border border-[#33254a] bg-[#0b0910] aspect-[360/540] overflow-hidden touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
      >
        <canvas
          ref={canvasRef}
          aria-label="Mosquito Invaders play field"
          className="block w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        <div
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px)",
          }}
        />
        <Overlay
          status={status}
          score={score}
          level={level}
          summary={summary}
          needsInitials={needsInitials}
          defaultInitials={settings.initials}
          onSubmitInitials={commitScore}
          challenge={challenge}
          bossCleared={isBossLevel(level, { every: game.current?.bossEvery })}
          bossNext={isBossLevel(level + 1, { every: game.current?.bossEvery })}
          highScore={highScore}
          scores={scores}
          deathReason={deathReason}
          species={SPECIES}
          onStart={onStart}
        />
      </div>

      <TouchControls press={press} onPause={togglePause} paused={status === "paused"} />


      <p className="text-[9px] leading-snug text-[#9a8cb4] text-center">
        Drag the field to fly · Space fires · P pauses
      </p>
    </div>
  );
}
