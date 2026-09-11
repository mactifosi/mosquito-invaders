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
        ctx.fillRect(x - 2, y - 2, 4, 4);
      } else {
        // The carrot: unmistakable, and it pulses so you can find it in a panic.
        const pulse = 1 + Math.sin(g.t * 6) * 0.12;
        ctx.fillStyle = "#ff8a3d";
        ctx.fillRect(x - 3 * pulse, y - 6 * pulse, 6 * pulse, 12 * pulse);
        ctx.fillStyle = "#c96a26";
        ctx.fillRect(x - 3 * pulse, y - 2, 6 * pulse, 1);
        ctx.fillStyle = "#6fe3c0"; // leaves
        ctx.fillRect(x - 4, y - 10, 3, 4);
        ctx.fillRect(x + 1, y - 10, 3, 4);
      }
    }
  }
}

function drawBunny(ctx, g) {
  const b = g.bunny;
  const kick = Math.sin(b.mouth) * 2; // paddling
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const left = b.dir === "left";
  const f = left ? -1 : 1; // facing multiplier

  // Ears, laid back along the water like a swimming rabbit's.
  ctx.fillStyle = "#efe6dc";
  ctx.fillRect(x - f * 2, y - 10 - kick * 0.5, 3, 7);
  ctx.fillRect(x - f * 6, y - 9 + kick * 0.5, 3, 7);
  ctx.fillStyle = "#f9b4c8";
  ctx.fillRect(x - f * 2 + 1, y - 9 - kick * 0.5, 1, 5);
  ctx.fillRect(x - f * 6 + 1, y - 8 + kick * 0.5, 1, 5);

  ctx.fillStyle = "#f5f0e6";
  ctx.fillRect(x - 8, y - 5, 16, 11); // body
  ctx.fillRect(x + f * 6, y - 4, 4, 8); // head, out front
  ctx.fillRect(x - f * 9, y - 3, 3, 6); // haunch

  ctx.fillStyle = "#fffdf8"; // belly highlight
  ctx.fillRect(x - 6, y + 2, 12, 3);

  ctx.fillStyle = "#2a1b2e"; // eye
  ctx.fillRect(x + f * 6, y - 3, 2, 2);
  ctx.fillStyle = "#f9b4c8"; // nose
  ctx.fillRect(x + f * 9, y, 2, 2);

  ctx.fillStyle = "#fffdf8"; // scut
  ctx.fillRect(x - f * 11, y - 2, 4, 4);

  ctx.fillStyle = "rgba(159,232,201,.5)"; // paddling feet
  ctx.fillRect(x - 5, y + 6, 4, 3 + kick);
  ctx.fillRect(x + 2, y + 6, 4, 3 - kick);
}

function drawFish(ctx, g, f) {
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  const frightened = g.frightened > 0 && f.state === "hunting";
  // Flash white as the carrot runs out — the last warning before they turn.
  const flashing = frightened && g.frightened < 2 && Math.floor(g.frightened * 6) % 2 === 0;
  const body = f.state === "eaten" ? null : flashing ? "#efe6ff" : frightened ? "#3b6ea8" : f.colour;
  const left = f.dir === "left";
  const d = left ? -1 : 1;
  const chomp = Math.sin(g.t * 12 + x * 0.3) > 0;

  if (body) {
    ctx.fillStyle = body;
    // Deep, blunt-headed body — a piranha is tall for its length.
    ctx.fillRect(x - 7, y - 6, 14, 13);
    ctx.fillRect(x + d * 7, y - 4, 3, 9); // snout
    ctx.fillRect(x - d * 8, y - 4, 2, 9); // peduncle

    ctx.fillStyle = "rgba(255,255,255,.18)"; // flank sheen
    ctx.fillRect(x - 5, y - 4, 10, 3);
    ctx.fillStyle = "rgba(11,9,16,.3)"; // dorsal
    ctx.fillRect(x - 4, y - 7, 8, 2);

    ctx.fillStyle = body; // tail fin
    ctx.fillRect(x - d * 11, y - 7, 3, 5);
    ctx.fillRect(x - d * 11, y + 2, 3, 5);
    ctx.fillRect(x - d * 10, y - 3, 2, 7);

    ctx.fillStyle = "rgba(11,9,16,.25)"; // pectoral fin
    ctx.fillRect(x - d * 1, y + 4, 5, 3);

    // The jaw: underslung, and the teeth are the whole point.
    const jaw = x + d * 5;
    ctx.fillStyle = "#2a0b10";
    ctx.fillRect(left ? jaw - 6 : jaw, y + (chomp ? 1 : 2), 6, chomp ? 4 : 3);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(left ? jaw - 5 + i * 2 : jaw + 1 + i * 2, y + (chomp ? 1 : 2), 1, 2);
    }
  }

  // Eyes stay visible even once eaten — that's all that swims home.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + d * 2, y - 4, 4, 4);
  ctx.fillStyle = frightened && !flashing ? "#9fe8c9" : "#0b0910";
  ctx.fillRect(x + d * 3, y - 3, 2, 2);
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
