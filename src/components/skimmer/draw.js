/**
 * Skimmer — rendering. Primitives only, like the rest of the arcade.
 */
import {
  W, H, PADDLE_Y, PADDLE_H, HATCH_TIME,
} from "@/components/skimmer/model";

const WATER_TOP = "#0d2733";
const WATER = "#071c24";
const PUNT = "#c98a5b";
const PUNT_LIP = "#f0c9a0";
const STONE = "#efe6ff";

const RAFT = { 1: "#6fa8a0", 2: "#8f7fb0", hatcher: "#b8455c" };
const RAFT_LIP = { 1: "#9fe8c9", 2: "#c5b6e8", hatcher: "#e0384f" };

function drawWater(ctx, g) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, WATER_TOP);
  grad.addColorStop(1, WATER);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Ripples, so the surface reads as water rather than a backdrop.
  ctx.fillStyle = "rgba(159,232,201,.06)";
  for (let i = 0; i < 9; i++) {
    const y = 120 + i * 46 + Math.sin(g.t * 0.8 + i) * 3;
    ctx.fillRect(0, y, W, 1);
  }
}

function drawBricks(ctx, g) {
  for (const b of g.bricks) {
    const flash = b.flash > 0;
    ctx.fillStyle = flash ? "#ffffff" : RAFT[b.kind] ?? RAFT[1];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = flash ? "#ffffff" : RAFT_LIP[b.kind] ?? RAFT_LIP[1];
    ctx.fillRect(b.x, b.y, b.w, 3);

    // Eggs, packed in the raft — more of them on a thick one.
    ctx.fillStyle = "rgba(11,9,16,.35)";
    const eggs = b.kind === "2" && b.hp > 1 ? 5 : 3;
    for (let i = 0; i < eggs; i++) {
      ctx.fillRect(b.x + 4 + i * ((b.w - 8) / eggs), b.y + 8, 3, 5);
    }

    if (b.kind === "hatcher" && b.hatch != null) {
      // A fuse across the raft: how long before this one opens.
      const f = Math.max(0, Math.min(1, b.hatch / HATCH_TIME));
      ctx.fillStyle = f < 0.3 ? "#ffb02e" : "rgba(255,233,184,.5)";
      ctx.fillRect(b.x + 2, b.y + b.h - 4, (b.w - 4) * f, 2);
    }
  }
}

function drawPaddle(ctx, g) {
  const half = g.paddle.w / 2;
  const x = g.paddle.x - half;
  ctx.fillStyle = PUNT;
  ctx.fillRect(x, PADDLE_Y, g.paddle.w, PADDLE_H);
  ctx.fillStyle = PUNT_LIP;
  ctx.fillRect(x, PADDLE_Y, g.paddle.w, 3);
  ctx.fillStyle = "rgba(11,9,16,.4)";
  ctx.fillRect(x + 4, PADDLE_Y + 5, g.paddle.w - 8, 2); // plank line
  if (g.paddle.wideUntil) {
    ctx.fillStyle = "#ffb02e";
    ctx.fillRect(x, PADDLE_Y + PADDLE_H, g.paddle.w, 2);
  }
}

function drawBalls(ctx, g) {
  for (const ball of g.balls) {
    ctx.fillStyle = STONE;
    ctx.fillRect(Math.round(ball.x - ball.r), Math.round(ball.y - ball.r), ball.r * 2, ball.r * 2);
    ctx.fillStyle = "rgba(11,9,16,.35)";
    ctx.fillRect(Math.round(ball.x - 1), Math.round(ball.y - 1), 2, 2);
  }
}

function drawMosquitoes(ctx, g) {
  for (const m of g.mosquitoes) {
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const wing = Math.sin(m.t * 30) * 2;
    ctx.fillStyle = "rgba(200,225,255,.3)";
    ctx.fillRect(x - 8, y - 4 + wing, 7, 3);
    ctx.fillRect(x + 2, y - 4 - wing, 7, 3);
    ctx.fillStyle = "#e0384f";
    ctx.fillRect(x - 4, y - 1, 9, 5);
    ctx.fillStyle = "#0b0910";
    ctx.fillRect(x - 6, y, 3, 3);
  }
}

function drawPowerups(ctx, g) {
  const colour = { wide: "#ffb02e", slow: "#38bdf8", multi: "#f472b6" };
  const letter = { wide: "W", slow: "S", multi: "M" };
  ctx.font = "bold 9px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of g.powerups) {
    ctx.fillStyle = "rgba(11,9,16,.7)";
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.strokeStyle = colour[p.kind];
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 7.5, p.y - 7.5, 15, 15);
    ctx.fillStyle = colour[p.kind];
    ctx.fillText(letter[p.kind], p.x, p.y + 0.5);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawBanners(ctx, g) {
  ctx.textAlign = "center";
  if (g.intro > 0) {
    ctx.font = "15px 'Silkscreen', monospace";
    ctx.fillStyle = "#9fe8c9";
    ctx.fillText(`LEVEL ${g.level}`, W / 2, H / 2 - 40);
  } else if (!g.launched) {
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#9fe8c9";
    ctx.fillText("tap to skim", W / 2, PADDLE_Y - 26);
  }

  ctx.font = "bold 9px 'IBM Plex Mono', monospace";
  for (const p of g.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.text === "ESCAPED" ? "#e0384f" : "#efe6ff";
    ctx.fillText(p.text, p.x, p.y - (0.6 - p.life) * 14);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

export function draw(canvas, g) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, W, H);
  if (!g) return;

  drawWater(ctx, g);
  drawBricks(ctx, g);
  drawPowerups(ctx, g);
  drawMosquitoes(ctx, g);
  drawPaddle(ctx, g);
  drawBalls(ctx, g);

  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, s.life * 3);
    ctx.fillStyle = s.colour;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3);
  }
  ctx.globalAlpha = 1;

  // Combo, while a rally is running.
  if (g.combo > 1) {
    ctx.font = "12px 'Silkscreen', monospace";
    ctx.fillStyle = "#ffb02e";
    ctx.textAlign = "right";
    ctx.fillText(`×${g.combo}`, W - 8, 24);
    ctx.textAlign = "left";
  }

  if (g.dying > 0) {
    ctx.fillStyle = "rgba(224,56,79,.12)";
    ctx.fillRect(0, 0, W, H);
  }

  drawBanners(ctx, g);
}

export { W, H };
