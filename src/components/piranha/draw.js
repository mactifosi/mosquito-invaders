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
        // Contiguous walls are drawn as one shape: fill every wall tile, then
        // light only the edges that face open water. Outlining each tile
        // separately made a block of wall read as a stack of bricks.
        ctx.fillStyle = WALL;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_LIP;
        const solid = (cc, rr) =>
          cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && g.maze[rr][cc] === "#";
        const E = 2; // edge thickness
        if (!solid(c, r - 1)) ctx.fillRect(x, y, TILE, E);
        if (!solid(c, r + 1)) ctx.fillRect(x, y + TILE - E, TILE, E);
        if (!solid(c - 1, r)) ctx.fillRect(x, y, E, TILE);
        if (!solid(c + 1, r)) ctx.fillRect(x + TILE - E, y, E, TILE);
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

/**
 * The bunny: just a head, in profile — round face, tall ears with pink inners,
 * one big eye, a pink nose and a blush. A whole body at this size turned into
 * an indistinct blob; a face reads instantly.
 */
function drawBunny(ctx, g) {
  const b = g.bunny;
  const bob = Math.sin(b.mouth) * 1.2;
  const x = Math.round(b.x);
  const y = Math.round(b.y + bob);
  const d = b.dir === "left" ? -1 : 1;

  const FUR = "#f7f3ec";
  const INNER = "#f4a0b5";

  // Ears, swept slightly back, each a rounded blade.
  for (const [lean, len] of [
    [0.6, 13],
    [-0.9, 12],
  ]) {
    const ex = x - d * (1 + lean * 2);
    ctx.fillStyle = FUR;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const w = Math.round(3.4 - t * 1.2);
      ctx.fillRect(Math.round(ex - d * lean * i * 0.55 - w / 2), y - 7 - i, w, 1);
    }
    ctx.fillStyle = INNER;
    for (let i = 2; i < len - 3; i++) {
      const t = i / len;
      const w = Math.max(1, Math.round(1.8 - t));
      ctx.fillRect(Math.round(ex - d * lean * i * 0.55 - w / 2), y - 8 - i, w, 1);
    }
  }

  // Face.
  ctx.fillStyle = FUR;
  pixelDisc(ctx, x, y, 9);
  pixelDisc(ctx, x + d * 4, y + 3, 6); // muzzle, pushed forward

  // Eye: big and dark, the way the reference does it.
  ctx.fillStyle = "#20161f";
  pixelDisc(ctx, x + d * 1, y - 1, 3.4);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x + d * 2), y - 3, 2, 2); // catchlight

  ctx.fillStyle = "rgba(244,160,181,.55)"; // blush
  pixelDisc(ctx, x - d * 4, y + 3, 2.4);

  ctx.fillStyle = "#e8536f"; // nose
  ctx.fillRect(Math.round(x + d * 8), y + 1, 3, 2);
  ctx.fillStyle = "rgba(32,22,31,.5)"; // mouth
  ctx.fillRect(Math.round(x + d * 7), y + 4, 3, 1);

  // Whiskers.
  ctx.fillStyle = "rgba(32,22,31,.28)";
  ctx.fillRect(Math.round(x + d * 9), y - 1, 4, 1);
  ctx.fillRect(Math.round(x + d * 9), y + 6, 4, 1);
}

/** A filled circle drawn as integer spans, so it stays pixel art. */
function pixelDisc(ctx, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
  }
}

/**
 * The piranha: a deep disc of a body with a wedge bitten out of the front for
 * the jaw, big triangular teeth top and bottom, one large eye set high, spiky
 * dorsal and a lobed tail — the cartoon-piranha shape language.
 */
function drawFish(ctx, g, f) {
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  const frightened = g.frightened > 0 && f.state === "hunting";
  const flashing = frightened && g.frightened < 2 && Math.floor(g.frightened * 6) % 2 === 0;
  const eaten = f.state === "eaten";
  const body = flashing ? "#efe6ff" : frightened ? "#3b6ea8" : f.colour;
  const d = f.dir === "left" ? -1 : 1;

  // Gape: chomping open and shut. A frightened fish keeps its mouth shut.
  const gape = frightened ? 2 : 5 + Math.round(Math.sin(g.t * 11 + x * 0.2) * 3);
  const R = 10;

  if (!eaten) {
    // Tail: two lobes behind the body.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - d * 8, y);
    ctx.lineTo(x - d * 15, y - 8);
    ctx.lineTo(x - d * 13, y);
    ctx.lineTo(x - d * 15, y + 8);
    ctx.closePath();
    ctx.fill();

    // Dorsal spikes along the top.
    for (let i = 0; i < 3; i++) {
      const sx = x - d * (2 + i * 4);
      ctx.beginPath();
      ctx.moveTo(sx, y - R + 3);
      ctx.lineTo(sx - d * 2, y - R - 1 + i);
      ctx.lineTo(sx - d * 4, y - R + 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = body;
    pixelDisc(ctx, x, y, R);

    // Belly, lighter underneath.
    ctx.fillStyle = "rgba(255,255,255,.10)";
    pixelDisc(ctx, x - d * 4, y + 3, 4);

    // Pectoral fin.
    ctx.fillStyle = "rgba(11,9,16,.28)";
    ctx.beginPath();
    ctx.moveTo(x + d * 1, y + 5);
    ctx.lineTo(x - d * 4, y + 10);
    ctx.lineTo(x + d * 3, y + 9);
    ctx.closePath();
    ctx.fill();

    // The jaw is carved out of the disc rather than stuck onto it: the cavity
    // and its teeth are clipped to the body, so the silhouette stays a clean
    // circle however wide the fish gapes.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.clip();

    const apexX = x - d * 1; // the bite reaches past the middle of the head
    const apexY = y + 3;
    const far = x + d * (R + 10); // overshoots; the clip trims it to the body
    const upperY = y - gape - 2; // shallower, so the jaw doesn't swallow the eye
    const lowerY = y + gape + 12;

    ctx.fillStyle = "#2a0b10";
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(far, upperY);
    ctx.lineTo(far, lowerY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#8c1f2d"; // throat, deep in the cavity
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + d * 7, apexY - 3);
    ctx.lineTo(apexX + d * 7, apexY + 4);
    ctx.closePath();
    ctx.fill();

    // Teeth ride the jaw lines, pointing into the cavity.
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) {
      const t = 3 + i * 2.6;
      const sFrac = t / (R + 11);
      const tx = apexX + d * t;
      const topY = apexY + (upperY - apexY) * sFrac;
      const botY = apexY + (lowerY - apexY) * sFrac;
      ctx.beginPath(); // upper, pointing down
      ctx.moveTo(tx - d * 1.6, topY - 1);
      ctx.lineTo(tx + d * 1.6, topY - 1);
      ctx.lineTo(tx, topY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); // lower, pointing up
      ctx.moveTo(tx - d * 1.6, botY + 1);
      ctx.lineTo(tx + d * 1.6, botY + 1);
      ctx.lineTo(tx, botY - 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Eye: large, set high and forward. Survives being eaten — it's what swims home.
  ctx.fillStyle = eaten ? "rgba(255,255,255,.9)" : "#ffe9b8";
  pixelDisc(ctx, x + d * 2, y - 6, 3.2);
  ctx.fillStyle = frightened && !flashing ? "#9fe8c9" : "#0b0910";
  pixelDisc(ctx, x + d * 3, y - 6, 1.8);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x + d * 3), y - 8, 1, 1); // catchlight
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
