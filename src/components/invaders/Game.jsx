import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameLoop } from "@/components/invaders/useGameLoop";
import { useTouchControls } from "@/components/invaders/useTouchControls";
import TouchControls from "@/components/invaders/TouchControls";
import Hud from "@/components/invaders/Hud";
import Overlay from "@/components/invaders/Overlay";
import { loadScores, saveScore, getHighScore } from "@/components/invaders/scores";
import { sfx } from "@/components/invaders/sounds";

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

/* Combo: consecutive kills without a miss. Resets on a shot that leaves the
   top of the screen, on taking a hit, or after COMBO_WINDOW without a kill. */
const COMBO_WINDOW = 2.0;
const COMBO_MAX = 5;
const COMBO_PER_STEP = 3; // kills needed to raise the multiplier one step

const SIDE_MARGIN = (W - (COLS * ALIEN_W + (COLS - 1) * ALIEN_GAP_X)) / 2;
const TOTAL_ALIENS = COLS * ROWS;

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
 * Builds the mutable state for one wave. Everything per-frame lives here, in a
 * ref — never in React state, which would thrash at 60fps.
 */
export function makeLevel(level, score, lives) {
  const aliens = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({
        x: c * (ALIEN_W + ALIEN_GAP_X),
        y: r * (ALIEN_H + ALIEN_GAP_Y),
        row: r,
        alive: true,
        flash: 0,
      });
    }
  }

  const motes = Array.from({ length: 34 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    v: 6 + Math.random() * 22,
    s: Math.random() < 0.25 ? 2 : 1,
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
      rapidUntil: 0,
      tripleUntil: 0,
      hitFlash: 0,
    },
    aliens,
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
    enemyFireTimer: ALIEN_FIRE_INTERVAL,
    humTimer: 0,
    baseSpeed: 24 + (level - 1) * 8,
    // Feel state. Streak carries across waves; hit-stop and shake never do.
    streak: 0,
    comboTimer: 0,
    bestStreak: 0,
    shotsFired: 0,
    shotsHit: 0,
    hitStop: 0,
    shake: 0,
    reduceMotion: prefersReducedMotion(),
  };
}

function spawnPopup(g, x, y, text, color) {
  g.popups.push({ x, y, text, color, life: POPUP_LIFE });
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
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 90;
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
  const r = Math.random();
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
  // Hit-stop: hold the whole world still for a few frames on a kill, so the
  // impact lands. Popups and shake keep animating in draw(); nothing else moves.
  if (g.hitStop > 0) {
    g.hitStop -= dt;
    return;
  }

  g.t += dt;
  const p = g.player;

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
  if (input.left) p.x -= PLAYER_SPEED * dt;
  if (input.right) p.x += PLAYER_SPEED * dt;
  p.x = Math.max(2, Math.min(W - PLAYER_W - 2, p.x));
  if (p.hitFlash > 0) p.hitFlash -= dt;

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
    sfx.laser();
  }

  /* ---- formation march: thinner swarm flies faster ---- */
  const alive = aliveCount(g);
  const speedMul = 1 + (1 - alive / TOTAL_ALIENS) * 2.2;
  g.formationX += g.baseSpeed * speedMul * dt * g.dir;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const a of g.aliens) {
    if (!a.alive) continue;
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

  /* ---- player bullets ---- */
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.y -= BULLET_SPEED * dt;
    b.x += (b.vx || 0) * dt;
    if (b.y < -8 || b.x < -8 || b.x > W + 8) {
      g.bullets.splice(i, 1);
      breakCombo(g, cb); // a shot that hit nothing ends the streak
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
        spawnExplosion(g, u.x + POWERUP_SIZE / 2, u.y + POWERUP_SIZE / 2, POWERUP_COLORS[u.type]);
        g.powerups.splice(j, 1);
        g.bullets.splice(i, 1);
        sfx.pop();
        consumed = true;
        break;
      }
    }
    if (consumed) continue;

    for (const a of g.aliens) {
      if (!a.alive) continue;
      const ax = g.formationX + a.x;
      const ay = g.formationY + a.y;
      if (b.x < ax + ALIEN_W && b.x + 3 > ax && b.y < ay + ALIEN_H && b.y + 7 > ay) {
        a.alive = false;
        a.flash = 0.12;
        g.shotsHit += 1;

        g.streak += 1;
        g.bestStreak = Math.max(g.bestStreak, g.streak);
        g.comboTimer = COMBO_WINDOW;
        const mult = comboMultiplier(g.streak);
        const points = SPECIES[a.row].pts * mult;
        g.score += points;
        cb.onScore(g.score);
        cb.onSwarm(alive - 1);
        cb.onCombo(mult);

        spawnPopup(
          g,
          ax + ALIEN_W / 2,
          ay,
          mult > 1 ? `+${points} ×${mult}` : `+${points}`,
          mult > 1 ? "#ffb02e" : "#efe6ff"
        );
        spawnExplosion(g, ax + ALIEN_W / 2, ay + ALIEN_H / 2, SPECIES[a.row].body);
        if (Math.random() < POWERUP_CHANCE) spawnPowerup(g, ax + ALIEN_W / 2, ay);
        g.bullets.splice(i, 1);
        g.hitStop = HIT_STOP;
        sfx.hit(mult);
        break;
      }
    }
  }

  /* ---- enemy fire ---- */
  g.enemyFireTimer -= dt;
  if (g.enemyFireTimer <= 0) {
    const shooters = g.aliens.filter((a) => a.alive);
    if (shooters.length) {
      const a = shooters[Math.floor(Math.random() * shooters.length)];
      g.ebullets.push({
        x: g.formationX + a.x + ALIEN_W / 2 - 1.5,
        y: g.formationY + a.y + ALIEN_H,
      });
    }
    const base = Math.max(0.32, ALIEN_FIRE_INTERVAL - (g.level - 1) * 0.09);
    g.enemyFireTimer = base * (0.7 + Math.random() * 0.6);
  }

  for (let i = g.ebullets.length - 1; i >= 0; i--) {
    const b = g.ebullets[i];
    b.y += ALIEN_BULLET_SPEED * dt;
    if (b.y > H + 8) {
      g.ebullets.splice(i, 1);
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
        if (g.lives <= 0) {
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

  /* ---- end conditions ---- */
  for (const a of g.aliens) {
    if (a.alive && g.formationY + a.y + ALIEN_H >= p.y) {
      cb.onGameOver("landed");
      return;
    }
  }
  if (alive === 0) cb.onLevelClear();
}

/* ───────────────────────── draw ───────────────────────── */

function drawMosquito(ctx, x, y, color, flash, t, row) {
  const wing = Math.sin(t * 26 + row * 1.7) * 1.6;
  ctx.fillStyle = "rgba(200,225,255,.26)";
  ctx.fillRect(x + 2, y + 2 + wing, 7, 4);
  ctx.fillRect(x + ALIEN_W - 9, y + 2 - wing, 7, 4);

  const c = flash ? "#ffffff" : color;
  ctx.fillStyle = c;
  ctx.fillRect(x + 7, y + 6, 9, 6); // thorax
  ctx.fillRect(x + 15, y + 7, 6, 4); // abdomen
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
  const { x, y } = p;
  if (p.hitFlash > 0 && Math.floor(p.hitFlash * 20) % 2 === 0) return;

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

  for (const a of g.aliens) {
    if (!a.alive) continue;
    drawMosquito(ctx, g.formationX + a.x, g.formationY + a.y, SPECIES[a.row].body, a.flash > 0, g.t, a.row);
  }

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
}

/* ───────────────────────── component ───────────────────────── */

export default function Game() {
  const canvasRef = useRef(null);
  const game = useRef(makeLevel(1, 0, 3));

  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [swarm, setSwarm] = useState(TOTAL_ALIENS);
  const [combo, setCombo] = useState(1);
  const [summary, setSummary] = useState(null);
  const [deathReason, setDeathReason] = useState("shot");
  const [scores, setScores] = useState(() => loadScores());
  const [highScore, setHighScore] = useState(() => getHighScore());

  // Mirrors `status` so the frame closure can early-return without going stale.
  const statusRef = useRef(status);
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
    sfx.unlock();
    game.current = makeLevel(1, 0, 3);
    setScore(0);
    setLives(3);
    setLevel(1);
    setSwarm(TOTAL_ALIENS);
    setCombo(1);
    setSummary(null);
    setStatus("playing");
  }, []);

  const nextLevel = useCallback(() => {
    sfx.unlock();
    const prev = game.current;
    const next = makeLevel(prev.level + 1, prev.score, prev.lives);
    next.player.shield = prev.player.shield; // an unbroken shield carries over
    // Run stats span the whole run, not one wave.
    next.bestStreak = prev.bestStreak;
    next.shotsFired = prev.shotsFired;
    next.shotsHit = prev.shotsHit;
    game.current = next;
    setLevel(next.level);
    setSwarm(TOTAL_ALIENS);
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
  }, []);

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
      const fired = g.shotsFired || 0;
      setSummary({
        wave: g.level,
        bestStreak: g.bestStreak,
        accuracy: fired ? Math.round(((g.shotsHit || 0) / fired) * 100) : 0,
      });
      setDeathReason(reason);
      setLives(0);
      setStatus("gameover");
      const next = saveScore(finalScore);
      setScores(next);
      setHighScore(next[0] || 0);
      sfx.gameOver();
    },
  };

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
    <div className="w-full max-w-[430px] mx-auto flex flex-col gap-2.5">
      <div className="relative border border-[#33254a] bg-gradient-to-b from-[#221635] to-[#160e21] px-3.5 py-3 text-center overflow-hidden">
        <h1 className="font-['Silkscreen',monospace] font-bold text-[clamp(20px,6.6vw,30px)] leading-none m-0 text-[#ffb02e] drop-shadow-[0_0_12px_rgba(255,176,46,0.45)]">
          MOSQUITO INVADERS
        </h1>
        <div className="mt-1.5 text-[9.5px] tracking-[0.34em] uppercase text-[#9a8cb4]">
          Citronella Squadron · Sector 7
        </div>
      </div>

      <Hud score={score} level={level} swarm={swarm} lives={lives} />

      <div className="relative border border-[#33254a] bg-[#0b0910] aspect-[360/540] overflow-hidden">
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
          highScore={highScore}
          scores={scores}
          deathReason={deathReason}
          species={SPECIES}
          onStart={onStart}
        />
      </div>

      <TouchControls press={press} onPause={togglePause} paused={status === "paused"} />

      <p className="text-[10px] leading-relaxed text-[#9a8cb4] text-center">
        ← → or A · D to fly, Space to fire, P to pause. Chain kills without missing to raise the
        multiplier; shooting a falling power-up destroys it.
      </p>
    </div>
  );
}
