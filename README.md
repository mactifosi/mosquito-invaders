# Mosquito Invaders

A Space Invaders–style arcade shooter. You fly a citronella craft along the bottom of the
screen and hold Sector 7 against descending waves of mosquitoes. React + Canvas, a custom
`requestAnimationFrame` loop, and synthesized retro sound — no audio assets.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the build
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly left / right | `←` `→` or `A` `D` | ◀ ▶ buttons |
| Fire | `Space` | FIRE button |
| Start / continue | `Space` | on-screen button |

## Rules

The swarm marches sideways, drops 14px each time it hits an edge, and speeds up as it
thins out — the last few mosquitoes move roughly three times faster than a full formation.
You lose a life to an enemy bite, and the run ends immediately if any mosquito reaches the
craft's altitude, however many lives are left. Clearing a wave advances the level: the
formation starts faster and fires sooner.

Row determines species and value:

| Row | Species | Points |
| --- | --- | --- |
| 1 | *Aedes aegypti* | 40 |
| 2 | *Anopheles gambiae* | 30 |
| 3 | *Culex pipiens* | 20 |
| 4 | *Aedes albopictus* | 10 |

## Power-ups

A destroyed mosquito has a 16% chance of dropping one, weighted rapid 40 / triple 32 /
shield 18 / life 10.

| Drop | Effect | Duration |
| --- | --- | --- |
| **R** Rapid | fire cooldown 0.35s → 0.16s | 8s |
| **T** Triple | 3-way spread shot | 8s |
| **S** Shield | absorbs one hit | until broken |
| **+** Life | +1 craft (max 5) | instant |

Shooting a falling power-up **destroys** it rather than collecting it — that's deliberate.
Clearing a lane with rapid fire can cost you the bonus you were shooting toward. Timed
boosts show as depleting bars in the top-left of the field; an unbroken shield carries
across a wave.

## Architecture

**State ownership.** The loop runs ~60×/s, so per-frame data (positions, bullets,
particles, timers) lives in a mutable object behind a `useRef` and is never React state.
Only HUD-relevant values — score, lives, level, swarm count, status — are lifted, through
a callbacks ref that `update()` calls when they change. `statusRef` mirrors `status` so the
frame closure can early-return when the game isn't playing without going stale.

**The loop.** `useGameLoop(callback, active)` runs a delta-time `requestAnimationFrame`
loop with `dt` clamped to 0.05s, so a backgrounded tab can't teleport everything through
walls. The callback lives in a ref, so re-rendering never re-binds the loop. `update()`
stops when the game isn't playing but `draw()` keeps running — that's what gives the title
screen a live swarm behind it.

**Rendering.** A logical 360×540 play field, drawn to a canvas whose backing store is
`W×dpr` by `H×dpr` with `imageSmoothingEnabled = false` and `image-rendering: pixelated`.
Everything is drawn from primitives — no sprite sheets.

**Audio.** Every sound is built on demand from oscillators and gain envelopes in
`sounds.js`. The AudioContext is created lazily and unlocked from a real user gesture
(`sfx.unlock()` on Play / Continue / Play Again), because browsers won't start audio
otherwise. Add a sound by adding a method to the `sfx` object.

**Scores** are local-only, in `localStorage` under `mosquito-invaders.scores`. Nothing else
reads the store, so swapping `scores.js` for a backend is a three-function change.

## File map

```
src/
├─ pages/Home.jsx                  # the single route: cabinet ground + <Game/>
├─ App.jsx                         # router — "/" → Home
├─ lib/utils.js                    # cn()
├─ components/ui/button.jsx        # shadcn-style Button
└─ components/invaders/
   ├─ Game.jsx                     # constants, makeLevel(), update(), draw(), component
   ├─ useGameLoop.js               # delta-time rAF loop
   ├─ useTouchControls.js          # input ref + keyboard binding
   ├─ TouchControls.jsx            # on-screen ◀ ▶ / FIRE
   ├─ Hud.jsx                      # score / wave / swarm / craft
   ├─ Overlay.jsx                  # ready · levelup · gameover screens
   ├─ Leaderboard.jsx              # ranked list
   ├─ scores.js                    # localStorage store
   └─ sounds.js                    # Web Audio SFX
```

`mosquito-invaders.standalone.html` is the same game as one dependency-free HTML file —
useful for a quick look without a build step, not part of the app.

## Conventions

- ESM only; import through the `@/` alias, never relative `src/` paths.
- Tailwind class names must be literal substrings in source — the build purges anything
  assembled at runtime.
- Tune gameplay from the constants block at the top of `Game.jsx`; the numbers there are
  the whole difficulty curve.
- Don't name a component and a module the same word in one directory. `Leaderboard.jsx`
  next to a former `leaderboard.js` resolved to the wrong file on case-insensitive
  filesystems (Vite tries `.js` before `.jsx`); the store is called `scores.js` for that
  reason.

## Ideas not yet built

- Backend-backed global leaderboard to supplement the local one.
- Enemy variety — a boss swarm every N levels.
- Settings: mute toggle, difficulty select.
- Haptics on hit and lost craft.
