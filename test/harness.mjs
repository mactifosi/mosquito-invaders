/**
 * Loads the game's pure logic into Node so update() can be driven without a
 * browser: no canvas, no React, no rAF.
 *
 * Game.jsx is JSX and imports React and the Capacitor plugins, so esbuild
 * bundles it with those left external and the "@/" alias resolved. Only the
 * exported model functions are used here — the component itself is never
 * rendered, and the dynamic import of @capacitor/haptics is never executed
 * because initHaptics() isn't called.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

const built = await esbuild.build({
  entryPoints: [path.join(root, "src/components/invaders/Game.jsx")],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
  external: ["react", "react-dom", "lucide-react", "@capacitor/haptics"],
  alias: { "@": path.join(root, "src") },
  loader: { ".js": "jsx", ".jsx": "jsx" },
  logLevel: "silent",
});

// Minimal DOM stubs. No AudioContext, so every sfx call no-ops; no matchMedia
// match, so reduced motion is off. localStorage is absent, and the score store
// is written to fail soft without it — which this exercises for free.
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.document = { addEventListener() {}, removeEventListener() {} };

const mod = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);

export const {
  makeLevel,
  update,
  comboMultiplier,
  formationSpeedMul,
  waveTitle,
  makeBunkers,
  alienPos,
  isBossLevel,
} = mod.exports;
