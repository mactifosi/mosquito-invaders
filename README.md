# Mosquito Invaders

A Space Invaders–style arcade shooter. You fly a citronella craft along the bottom of the
screen and hold Sector 7 against descending waves of mosquitoes. React + Canvas, a custom
`requestAnimationFrame` loop, and synthesized retro sound — no audio assets.

**[▶ Play it](https://mactifosi.github.io/mosquito-invaders/)** — sound starts on your first
click, as browsers require.

To run it locally:

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

Each wave opens with a card naming what's coming, during which the swarm holds station —
a breath between waves, and a moment to read the field.

The swarm marches sideways, drops 14px each time it hits an edge, and speeds up as it thins
out, to 1.8× the opening speed at the last mosquito. You lose a craft to an enemy bite, and
also if the swarm reaches your altitude — a breach costs one craft and drives the formation
back to the top at its current speed, rather than ending the run outright. Clearing a wave
advances the level: the formation starts faster and fires sooner.

**Cover.** Four bunkers stand between you and the swarm. They erode cell by cell from
either side — enemy fire chews them from above, *your own shots chew them from below*, and
anything that flies into one grinds it away. Each wave issues fresh cover.

**Divers.** From wave 3, mosquitoes break formation and swoop at the craft, steering toward
you with a wobble and trailing red. A diver that connects costs a life; shooting one down
pays double. They ignore the formation entirely, so a diver below your craft is not a
swarm landing.

**The queen.** Every 4th wave replaces the formation with a boss: a crowned queen who
patrols the top, fires three-bullet spreads, seeds diving brood (up to 3 at once), grinds
down cover, and creeps steadily downward — let her reach your altitude and the run ends.
Her HP is 28 at wave 4 and rises 8 per boss tier; she fires and breeds faster as she takes
damage. Chip damage pays 5 a hit, the kill pays 500 × your current combo multiplier.

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

Shooting a falling power-up cashes it for 50 points × your combo multiplier instead of
collecting it. The choice is real either way — points now, or the power-up's effect if you
let it fall to you — and a stray shot during rapid fire isn't punished. Timed boosts show
as depleting bars in the top-left of the field; an unbroken shield carries across a wave.

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

## Install it on a phone

The site is a PWA — installed to the home screen it runs full-screen, portrait, with no
browser chrome, and works with no signal once it has been opened once.

- **iPhone / iPad:** open <https://mactifosi.github.io/mosquito-invaders/> **in Safari**
  (Chrome on iOS can't install), tap Share → *Add to Home Screen* → Add.
- **Android:** open it in Chrome, then *Install app* from the ⋮ menu (or the install prompt).

Play one round while online so the service worker finishes precaching — after that it's
airplane-safe. Sound needs one tap to start, per browser autoplay policy.

## iOS app

The game also ships as a native iOS app (Capacitor), published to TestFlight as
**CaddoraGames** (`com.caddora.games`). `npm run ios` builds the web assets, syncs them into
the native project and opens Xcode; `npm run archive` produces a distributable archive.

### Shipping a build

```bash
export ASC_ISSUER_ID=<uuid>   # once, from App Store Connect → Users and Access → Integrations
npm run release               # bump the build number, archive, upload to TestFlight
```

`npm run release` is `bump` + `archive` + `upload`. The upload authenticates with an App
Store Connect API key (`~/.appstoreconnect/private_keys/AuthKey_<id>.p8`), so it doesn't
depend on an Xcode login session — those expire, and Organizer reports it only as
`DistributionAppRecordProviderError error 0`. No credentials live in this repo: the key
stays on disk and the issuer ID comes from the environment.

The bump matters — App Store Connect rejects a build number it has already seen.

One wrinkle worth knowing before you tidy it away: the Xcode project is
`ios/App/Caddora Games.xcodeproj`, and `ios/App/App.xcodeproj` is a **symlink** pointing at
it. Capacitor hardcodes the path `ios/App/App.xcodeproj` with no config override, so
without the symlink `npx cap sync` fails to write `Package.swift` and plugins never reach
the native project. Delete the symlink and the next plugin you add will silently not build.

Haptics (a light tap per kill, a heavier one when a craft is lost) come from
`@capacitor/haptics`, loaded by dynamic import so the web build doesn't carry native plugin
code and the Node test harness doesn't have to stub it. Every call fails soft — no
vibration support, haptics switched off, a rejected promise mid-frame — none of it
interrupts the loop.

The native build sets `CAP_BUILD=1`, which disables the service worker — the app bundle
already carries its assets, and a worker can't register over `capacitor://`.

## Deployment

Every push to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — Pages is served from the
Actions artifact, so there's no `gh-pages` branch to maintain.

- Live site: <https://mactifosi.github.io/mosquito-invaders/>
- [Deploy runs](https://github.com/mactifosi/mosquito-invaders/actions/workflows/deploy.yml)

Project Pages serve from a subpath, so `vite.config.js` sets `base` to
`/mosquito-invaders/` when `GITHUB_ACTIONS` is set and leaves it at `/` for local dev; the
router's `basename` follows `import.meta.env.BASE_URL`. Rename the repo and both need
updating. There's no 404 fallback — fine for a single route, but adding routes means
copying `index.html` to `404.html` at build time or switching to `HashRouter`.

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
- Drag-to-move instead of the ◀ ▶ buttons, which suits a thumb better than discrete taps.
