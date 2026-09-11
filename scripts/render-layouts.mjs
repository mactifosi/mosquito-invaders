// Renders every Piranha layout to a single PNG contact sheet, without a
// browser: the maze is just tiles, and a small PNG encoder beats screenshotting
// each one in the app.
//
//   node scripts/render-layouts.mjs [out.png]
import path from "node:path";
import zlib from "node:zlib";
import fs from "node:fs";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(path.join(root, "package.json"));
const built = await esbuild.build({
  entryPoints: [path.join(root, "src/components/piranha/maze.js")],
  bundle: true, write: false, format: "cjs", platform: "node",
  alias: { "@": path.join(root, "src") }, logLevel: "silent",
});
const mod = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);
const { MAZES, COLS, ROWS } = mod.exports;

const T = 14;                      // px per tile in the sheet
const MW = COLS * T, MH = ROWS * T;
const GAP = 18, COLS_N = 3, LABEL = 20;
const rowsN = Math.ceil(MAZES.length / COLS_N);
const WIDTH = COLS_N * MW + (COLS_N + 1) * GAP;
const HEIGHT = rowsN * (MH + LABEL) + (rowsN + 1) * GAP;

const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
const put = (x, y, [r, g, b]) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255;
};
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x+i, y+j, c); };

const WATER = [7,28,36], WALL = [14,52,66], LIP = [42,143,168];
const ALGAE = [159,232,201], CARROT = [255,138,61], DOOR = [139,208,224], INK = [127,185,201];

rect(0, 0, WIDTH, HEIGHT, WATER);

// 3x5 digits, so each layout can be numbered in its own corner.
const DIGITS = {
  1: ["010","110","010","010","111"], 2: ["111","001","111","100","111"],
  3: ["111","001","111","001","111"], 4: ["101","101","111","001","001"],
  5: ["111","100","111","001","111"], 6: ["111","100","111","101","111"],
};
const digit = (n, x, y, s, c) =>
  DIGITS[n].forEach((row, j) => row.split("").forEach((on, i) => { if (on === "1") rect(x+i*s, y+j*s, s, s, c); }));

MAZES.forEach((maze, idx) => {
  const col = idx % COLS_N, row = (idx / COLS_N) | 0;
  const ox = GAP + col * (MW + GAP);
  const oy = GAP + row * (MH + LABEL + GAP);
  const solid = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && maze[r][c] === "#";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = maze[r][c];
      const x = ox + c * T, y = oy + r * T;
      if (t === "#") {
        rect(x, y, T, T, WALL);
        const E = 2;                       // light only edges facing open water
        if (!solid(c, r-1)) rect(x, y, T, E, LIP);
        if (!solid(c, r+1)) rect(x, y+T-E, T, E, LIP);
        if (!solid(c-1, r)) rect(x, y, E, T, LIP);
        if (!solid(c+1, r)) rect(x+T-E, y, E, T, LIP);
      } else if (t === "-") {
        rect(x, y + T/2 - 1, T, 2, DOOR);
      } else if (t === ".") {
        rect(x + T/2 - 1, y + T/2 - 1, 2, 2, ALGAE);
      } else if (t === "o") {
        rect(x + T/2 - 2, y + T/2 - 4, 4, 8, CARROT);
      }
    }
  }
  digit(idx + 1, ox + 2, oy + MH + 5, 3, INK);
});

// ---- PNG ----
let TABLE = null;
const crc32 = (b) => {
  if (!TABLE) { TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c>>>1) : c>>>1; TABLE[n] = c; } }
  let c = -1; for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return c ^ -1;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
};
const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 4 + 1)] = 0;
  buf.copy(raw, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
]);
const out = process.argv[2] || "piranha-layouts.png";
fs.writeFileSync(out, png);
console.log(`${out}  ${WIDTH}x${HEIGHT}  ${(png.length/1024).toFixed(0)}KB  (${MAZES.length} layouts)`);
