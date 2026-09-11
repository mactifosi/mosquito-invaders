/**
 * Piranha — rendering. Same pixel discipline as the other cabinet: everything
 * drawn from primitives, no sprite sheets.
 */
import { TILE, COLS, ROWS, MAZE_W, MAZE_H, tileCentre } from "@/components/piranha/maze";
import { FRIGHTENED_TIME } from "@/components/piranha/model";

export const W = 360;
export const H = 540;
export const OFFSET_X = Math.round((W - MAZE_W) / 2);
export const OFFSET_Y = Math.round((H - MAZE_H) / 2);

const WATER = "#071c24";
const WALL = "#0e3442";
const WALL_LIP = "#2a8fa8";

function drawMaze(ctx, g) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = g.maze[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (t === "#") {
        // Outlined blocks rather than solid ones: filled tiles crowded the
        // corridors and the route through the maze stopped being readable.
        ctx.fillStyle = WALL;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = WALL_LIP;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
      } else if (t === "-") {
        ctx.fillStyle = "#8bd0e0";
        ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
      }
    }
  }
}

function drawPellets(ctx, g) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = g.pellets.grid[r][c];
      if (!p) continue;
      const { x, y } = tileCentre(c, r);
      if (p === ".") {
        ctx.fillStyle = "#9fe8c9"; // algae
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      } else {
        // The carrot: unmistakable, and it pulses so you can find it in a panic.
        const pulse = 1 + Math.sin(g.t * 6) * 0.12;
        ctx.fillStyle = "#ff8a3d";
        ctx.fillRect(x - 2 * pulse, y - 5 * pulse, 4 * pulse, 9 * pulse);
        ctx.fillStyle = "#6fe3c0";
        ctx.fillRect(x - 3, y - 7, 2, 3);
        ctx.fillRect(x + 1, y - 7, 2, 3);
      }
    }
  }
}

function drawBunny(ctx, g) {
  const b = g.bunny;
  const kick = Math.sin(b.mouth) * 1.5; // paddling
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const facingLeft = b.dir === "left";

  ctx.fillStyle = "#f5f0e6";
  ctx.fillRect(x - 6, y - 4, 12, 9); // body
  ctx.fillRect(x - 4, y - 9 - kick, 3, 6); // ears
  ctx.fillRect(x + 1, y - 9 + kick, 3, 6);
  ctx.fillStyle = "#f9b4c8";
  ctx.fillRect(x - 3.5, y - 8 - kick, 1.5, 4);
  ctx.fillRect(x + 1.5, y - 8 + kick, 1.5, 4);

  ctx.fillStyle = "#2a1b2e"; // eye, on the side it's facing
  ctx.fillRect(facingLeft ? x - 4 : x + 2, y - 2, 2, 2);
  ctx.fillStyle = "#f9b4c8";
  ctx.fillRect(facingLeft ? x - 6 : x + 4, y, 2, 2); // nose

  ctx.fillStyle = "#efe6ff"; // tail
  ctx.fillRect(facingLeft ? x + 5 : x - 7, y - 1, 3, 3);

  ctx.fillStyle = "rgba(159,232,201,.45)"; // paddling feet
  ctx.fillRect(x - 4, y + 5, 3, 2 + kick);
  ctx.fillRect(x + 1, y + 5, 3, 2 - kick);
}

function drawFish(ctx, g, f) {
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  const frightened = g.frightened > 0 && f.state === "hunting";
  // Flash white as the carrot runs out — the last warning before they turn.
  const flashing = frightened && g.frightened < 2 && Math.floor(g.frightened * 6) % 2 === 0;
  const body = f.state === "eaten" ? null : flashing ? "#efe6ff" : frightened ? "#3b6ea8" : f.colour;
  const facingLeft = f.dir === "left";

  if (body) {
    ctx.fillStyle = body;
    ctx.fillRect(x - 6, y - 4, 11, 9); // body
    // tail
    ctx.fillRect(facingLeft ? x + 5 : x - 8, y - 3, 3, 7);
    ctx.fillRect(facingLeft ? x + 7 : x - 9, y - 5, 2, 11);
    ctx.fillStyle = "rgba(11,9,16,.25)";
    ctx.fillRect(x - 4, y - 4, 7, 2); // dorsal shading

    // Teeth — the whole point of a piranha.
    ctx.fillStyle = "#ffffff";
    const mouthX = facingLeft ? x - 6 : x + 2;
    const chomp = Math.sin(g.t * 14 + x) > 0 ? 1 : 2;
    ctx.fillRect(mouthX, y + 1, 4, chomp);
    if (!frightened) {
      ctx.fillRect(facingLeft ? mouthX : mouthX + 3, y - 1, 1, 2);
      ctx.fillRect(facingLeft ? mouthX + 3 : mouthX, y - 1, 1, 2);
    }
  }

  // Eyes stay visible even when it's been eaten — that's all that swims home.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(facingLeft ? x - 4 : x + 1, y - 3, 3, 3);
  ctx.fillStyle = frightened && !flashing ? "#9fe8c9" : "#0b0910";
  ctx.fillRect(facingLeft ? x - 4 : x + 2, y - 2, 2, 2);
}

function drawHudBanner(ctx, g) {
  if (g.intro > 0) {
    ctx.font = "13px 'Silkscreen', monospace";
    ctx.fillStyle = "#ff8a3d";
    ctx.textAlign = "center";
    ctx.fillText("READY", MAZE_W / 2, MAZE_H / 2 + 30);
    ctx.textAlign = "left";
  }
  if (g.frightened > 0) {
    const f = g.frightened / FRIGHTENED_TIME;
    ctx.fillStyle = "rgba(11,9,16,.6)";
    ctx.fillRect(MAZE_W / 2 - 30, MAZE_H - 10, 60, 5);
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(MAZE_W / 2 - 30, MAZE_H - 10, 60 * f, 5);
  }
}

export function draw(canvas, g) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, W, H);
  if (!g) return;

  ctx.save();
  ctx.translate(OFFSET_X, OFFSET_Y);

  drawMaze(ctx, g);
  drawPellets(ctx, g);

  for (const f of g.fish) drawFish(ctx, g, f);
  if (g.dying > 0) {
    // The bunny thrashes and shrinks rather than simply vanishing.
    const k = Math.max(0, g.dying / 1.4);
    ctx.globalAlpha = k;
    ctx.save();
    ctx.translate(g.bunny.x, g.bunny.y);
    ctx.scale(k, k);
    ctx.translate(-g.bunny.x, -g.bunny.y);
    drawBunny(ctx, g);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    drawBunny(ctx, g);
  }

  ctx.font = "bold 9px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  for (const p of g.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = "#9fe8c9";
    ctx.fillText(p.text, p.x, p.y - (0.8 - p.life) * 16);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  drawHudBanner(ctx, g);
  ctx.restore();
}
