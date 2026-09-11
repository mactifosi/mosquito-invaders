/**
 * Bayou Brawl — rendering. Same discipline as the other cabinets: primitives
 * only, no sprite sheets. The camera pans across a stage wider than the screen.
 */
import {
  STAGE_W, VIEW_W, GROUND_Y, FIGHTER_W, FIGHTER_H, CROUCH_H, MOVES,
} from "@/components/brawl/model";

export const W = 360;
export const H = 540;
const ARENA_TOP = 196; // canvas y of the stage's y=0 — the fight sits low, under the sky
const SKY = "#1a1024";
const HAZE = "#2a1838";
const MUD = "#2c2118";
const MUD_LIP = "#4a3a28";

function drawStage(ctx, g) {
  const cam = g.camera;

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // A moon and a treeline, parallaxed: the stage should read as moving.
  ctx.fillStyle = "#3d2a52";
  ctx.beginPath();
  ctx.arc(W - 70 + cam * -0.04, 70, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HAZE;
  for (let i = 0; i < 14; i++) {
    const x = ((i * 70 - cam * 0.25) % (W + 140)) - 70;
    const h = 40 + ((i * 37) % 5) * 9;
    ctx.fillRect(x, ARENA_TOP + GROUND_Y - h - 10, 46, h);
  }

  // Reeds, closer, moving faster.
  ctx.fillStyle = "#243a2c";
  for (let i = 0; i < 26; i++) {
    const x = ((i * 41 - cam * 0.6) % (W + 82)) - 41;
    const h = 24 + ((i * 53) % 7) * 6;
    ctx.fillRect(x, ARENA_TOP + GROUND_Y - h, 3, h);
  }

  // Ground.
  ctx.fillStyle = MUD;
  ctx.fillRect(0, ARENA_TOP + GROUND_Y, W, H - (ARENA_TOP + GROUND_Y));
  ctx.fillStyle = MUD_LIP;
  ctx.fillRect(0, ARENA_TOP + GROUND_Y, W, 3);

  // Stage edges, so the arena's limits are visible.
  ctx.fillStyle = "rgba(11,9,16,.55)";
  if (cam < 6) ctx.fillRect(0, ARENA_TOP, 4 - cam, GROUND_Y);
  if (cam > STAGE_W - VIEW_W - 6) ctx.fillRect(W - (4 - (STAGE_W - VIEW_W - cam)), ARENA_TOP, 4, GROUND_Y);
}

/**
 * One fighter: a heavy silhouette with a readable stance per state. Everything
 * is derived from the fighter's height, so scaling the fighters doesn't mean
 * re-tuning a pile of magic offsets.
 */
function drawFighter(ctx, g, f) {
  const x = Math.round(f.x - g.camera);
  const feet = ARENA_TOP + f.y;
  const crouched = f.state === "crouch";
  const h = crouched ? CROUCH_H : FIGHTER_H;
  const w = FIGHTER_W;
  const d = f.facing;
  const hurt = f.flash > 0;
  const body = hurt ? "#ffffff" : f.body;

  if (x < -80 || x > W + 80) return;

  const top = feet - h;
  const headH = Math.round(h * 0.22);
  const legH = Math.round(h * 0.32);
  const armY = top + headH + Math.round(h * 0.1);

  // Shadow, tighter as they leave the ground.
  const lift = Math.max(0, (GROUND_Y - f.y) / 140);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(x - w / 2 + lift * 6, ARENA_TOP + GROUND_Y - 2, w - lift * 12, 4);

  if (f.state === "ko") {
    ctx.fillStyle = body;
    ctx.fillRect(x - h / 2, feet - 20, h * 0.9, 18);
    ctx.fillStyle = f.trim;
    ctx.fillRect(x - h / 2 - d * 6, feet - 26, 16, 7);
    return;
  }

  // Legs
  ctx.fillStyle = body;
  if (f.state === "walk") {
    const swing = Math.sin(g.t * 12) * 7;
    ctx.fillRect(x - w * 0.32, feet - legH, w * 0.26, legH - Math.abs(swing));
    ctx.fillRect(x + w * 0.06, feet - legH, w * 0.26, legH - Math.abs(-swing));
  } else if (!f.onGround) {
    ctx.fillRect(x - w * 0.34, feet - legH - 4, w * 0.28, legH * 0.7);
    ctx.fillRect(x + w * 0.08, feet - legH, w * 0.28, legH * 0.6);
  } else {
    ctx.fillRect(x - w * 0.34, feet - legH, w * 0.28, legH);
    ctx.fillRect(x + w * 0.08, feet - legH, w * 0.28, legH);
  }

  // Torso and shoulders
  ctx.fillRect(x - w * 0.4, top + headH, w * 0.8, h - headH - legH + 4);
  ctx.fillStyle = f.trim;
  ctx.fillRect(x - w * 0.4, top + headH, w * 0.8, 6);

  // Head
  ctx.fillStyle = body;
  ctx.fillRect(x - w * 0.28, top, w * 0.56, headH);
  ctx.fillStyle = "#0b0910";
  ctx.fillRect(x + (d > 0 ? w * 0.06 : -w * 0.2), top + headH * 0.35, 5, 5);

  // Arms tell you what they're doing.
  ctx.fillStyle = body;
  if (f.state === "block" || (crouched && f.blockHeld)) {
    ctx.fillStyle = "#8bd0e0";
    ctx.fillRect(x + (d > 0 ? w * 0.18 : -w * 0.46), armY, w * 0.28, h * 0.34);
  } else if (f.state === "attack" && f.move) {
    const m = MOVES[f.move];
    const t = f.phase - m.startup;
    const extend = t < 0 ? 0.3 : t <= m.active ? 1 : 0.55;
    if (f.move === "special") {
      ctx.fillStyle = f.projectile;
      ctx.fillRect(x + (d > 0 ? 14 : -36) * extend, armY + 4, 22, 14);
    } else if (f.move === "low") {
      ctx.fillRect(x + (d > 0 ? 14 : -(m.reach + 10)) * extend, feet - 26, m.reach * extend, 11);
    } else {
      ctx.fillRect(x + (d > 0 ? 14 : -(m.reach + 10)) * extend, armY, m.reach * extend, 12);
    }
  } else if (f.state === "hit") {
    ctx.fillRect(x - d * w * 0.5, armY - 4, w * 0.3, 12);
  } else {
    ctx.fillRect(x + (d > 0 ? w * 0.24 : -w * 0.5), armY, w * 0.26, h * 0.26);
  }

  // Trailing detail: Vex's wings, Gnash's fin.
  ctx.fillStyle = hurt ? "#ffffff" : "rgba(255,255,255,.22)";
  if (f.id === "vex") {
    const beat = Math.sin(g.t * 24) * 4;
    ctx.fillRect(x - d * w * 0.62, top + headH + beat, 20, 7);
    ctx.fillRect(x - d * w * 0.7, top + headH + 12 - beat, 20, 7);
  } else {
    ctx.fillRect(x - d * w * 0.62, top + headH + 4, 11, 26);
  }
}

function drawProjectiles(ctx, g) {
  for (const p of g.projectiles) {
    const x = Math.round(p.x - g.camera);
    const y = ARENA_TOP + p.y;
    ctx.fillStyle = p.colour;
    ctx.fillRect(x - 7, y - 5, 14, 10);
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(x - 3, y - 2, 5, 4);
    ctx.fillStyle = "rgba(255,255,255,.15)";
    ctx.fillRect(x - 14 * Math.sign(p.vx), y - 3, 10, 6); // trail
  }
}

function drawHud(ctx, g) {
  const [p, o] = g.fighters;
  const barW = 150;

  const bar = (x, f, flip) => {
    ctx.fillStyle = "rgba(11,9,16,.8)";
    ctx.fillRect(x, 16, barW, 12);
    const w = (barW - 4) * (f.health / 100);
    ctx.fillStyle = f.health > 35 ? f.body : "#e0384f";
    ctx.fillRect(flip ? x + barW - 2 - w : x + 2, 18, w, 8);
    ctx.strokeStyle = "#5a4a72";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 16.5, barW - 1, 11);

    // Meter, under the health bar.
    ctx.fillStyle = "rgba(11,9,16,.8)";
    ctx.fillRect(x, 31, barW, 5);
    const mw = (barW - 4) * (f.meter / 100);
    ctx.fillStyle = f.meter >= MOVES.special.cost ? f.trim : "#5a4a72";
    ctx.fillRect(flip ? x + barW - 2 - mw : x + 2, 32, mw, 3);

    ctx.font = "8px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#efe6ff";
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(f.name, flip ? x + barW : x, 12);
  };

  bar(8, g.fighters[0], false);
  bar(W - barW - 8, g.fighters[1], true);

  // Round pips between the bars.
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = g.wins[0] > i ? "#ffb02e" : "rgba(90,74,114,.6)";
    ctx.fillRect(W / 2 - 14 + i * 6, 30, 4, 4);
    ctx.fillStyle = g.wins[1] > i ? "#ffb02e" : "rgba(90,74,114,.6)";
    ctx.fillRect(W / 2 + 6 + i * 6, 30, 4, 4);
  }

  ctx.font = "16px 'Silkscreen', monospace";
  ctx.fillStyle = g.time <= 10 ? "#e0384f" : "#efe6ff";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.ceil(g.time)).padStart(2, "0"), W / 2, 28);
  ctx.textAlign = "left";
}

function drawBanners(ctx, g) {
  ctx.textAlign = "center";
  if (g.intro > 0) {
    ctx.font = "18px 'Silkscreen', monospace";
    ctx.fillStyle = "#ffb02e";
    ctx.fillText(g.round === 1 ? "ROUND 1" : `ROUND ${g.round}`, W / 2, H / 2 - 40);
    if (g.intro < 0.7) {
      ctx.fillStyle = "#e0384f";
      ctx.fillText("FIGHT", W / 2, H / 2 - 10);
    }
  }
  for (const p of g.popups) {
    ctx.font = p.big ? "24px 'Silkscreen', monospace" : "10px 'IBM Plex Mono', monospace";
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.fillStyle = "#e0384f";
    ctx.fillText(p.text, W / 2, H / 2 - 30);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
}

export function draw(canvas, g) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);
  if (!g) return;

  drawStage(ctx, g);

  // The finishing blow desaturates everything but the two fighters.
  if (g.finisher) {
    ctx.fillStyle = "rgba(224,56,79,.12)";
    ctx.fillRect(0, 0, W, H);
  }

  drawProjectiles(ctx, g);
  for (const f of g.fighters) drawFighter(ctx, g, f);

  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, s.life * 2.6);
    ctx.fillStyle = s.colour;
    ctx.fillRect(Math.round(s.x - g.camera), Math.round(ARENA_TOP + s.y), 3, 3);
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g);
  drawBanners(ctx, g);
}
