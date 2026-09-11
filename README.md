# CaddoraGames

An offline arcade for planes, trains and departure lounges. The shell is a cabinet floor —
one card per game, a daily challenge, and settings that apply everywhere. **Mosquito
Invaders** is the first cabinet: a Space Invaders–style shooter where you fly a citronella
craft and hold Sector 7 against descending waves of mosquitoes. React + Canvas, a custom
`requestAnimationFrame` loop, and synthesized retro sound — no audio assets, no network.

**[▶ Play it](https://mactifosi.github.io/mosquito-invaders/)** — sound starts on your first
click, as browsers require.

To run it locally:

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # game-rule suite (no browser needed)
npm run build    # production build into dist/
npm run preview  # serve the build
```

## Tests

`npm test` drives `update()` directly in Node at a fixed timestep — no canvas, no React, no
`requestAnimationFrame` — and asserts the rules: combo breaks, breach behaviour, bunker
erosion, dive bonuses, queen HP and cadence, drag clamping, and that end-of-run callbacks
fire exactly once. `test/harness.mjs` bundles `Game.jsx` with esbuild and stubs the few
globals it touches.

They run in milliseconds, run in CI on every push, and gate the Pages deploy. They have
already caught two real bugs: `onGameOver` firing every frame (saving each run to the
leaderboard several times over) and `isBossLevel` being unsafe as a predicate.

## Piranha

The second cabinet: a maze under the waterline. A bunny eats algae; four piranhas hunt it.
Eat a carrot and for seven seconds they flee instead — catch one then and it pays 200,
doubling for each after within the same carrot.

**Three layouts rotate by depth** — channels, reeds, and a basin of concentric rings — so
depth 4 isn't depth 1 with faster fish. `npm run layouts` renders them all to a PNG contact
sheet without opening the app. They share a
pen block — same pen, same door, same tunnel row — so the actors' start positions hold
whichever maze is in play.

No wall mass is thicker than two tiles: a 3x3 of solid wall is a slab that needs a lane cut
through it, and the suite fails on one. That's also why every maze has an outer ring — the
pen block's corners used to be four wide and five tall.

Two things reward playing on the edge rather than safely: slipping **within a tile of a
hunter** scores a near miss (once per pass, not per frame), and eating **all four fish on a
single carrot** pays a 2000-point chain bonus on top of the 200/400/800/1600.

The four hunters have different temperaments, which is what turns identical pursuers into a
puzzle: one comes straight at you, one aims four tiles ahead of where you're going, one
pincers off the first one's position, and one loses its nerve within eight tiles. They
alternate between hunting and scattering to their own corners, and the whole shoal reverses
when the mode flips — the tell that something changed.

Swipe to steer on touch, arrows or WASD on a keyboard.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly left / right | `←` `→` or `A` `D` | drag anywhere on the field |
| Fire | `Space` | FIRE button |
| Pause | `P` or `Esc` | pause button |
| Start / continue | `Space` | on-screen button |

Flying is a *relative* drag: wherever your thumb lands, moving it n px moves the craft n
logical px. Absolute tracking would park the craft under your thumb, hiding the one thing
you need to watch. A drag beats the keyboard while a finger is down, and releasing hands
control straight back.

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

**Blood-fed mosquitoes** ride in the back two rows: visibly engorged, they soak the first
hit without dying and pay triple. A **stray** crosses the top every so often — fat, pink and
worth 150 × your multiplier if you can spare the shots.

Row determines species and value. Each row also carries its own marking — a bar, one dot,
two dots, a chevron — so species stay distinguishable without relying on hue:

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

## The daily challenge

One seeded run a day, the same for everyone playing on that date, with a modifier that
changes the rules — no cover, dive-bombers from wave 1, a queen every second wave, a single
craft, rapid fire from the first shot, or double the blood-fed. The seed is the date, so it
needs no server and works in airplane mode. Your run is recorded locally.

## Difficulty and sound

Set in the arcade, applied to every cabinet. Difficulty scales formation speed, enemy fire
rate and how often mosquitoes break formation. The native app deliberately plays through
the iOS Ring/Silent switch, so the **Sound** toggle is the way to keep it quiet.

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

**Scores** are local-only, keyed per game under `caddora.scores.<game id>`, with three-letter
initials. `src/lib/scores.js` is the only thing that touches `localStorage`, so swapping in a
backend later is a four-function change. Runs saved by pre-arcade builds are migrated across
on first read.

**Randomness** goes through `g.rng` rather than `Math.random` wherever it affects the run,
which is what lets the daily challenge be identical for everyone on the same date. Purely
cosmetic randomness (thruster flicker, screen-shake offset) still uses `Math.random`.

## File map

```
src/
├─ App.jsx                         # routes: "/" → Arcade, "/mosquito-invaders" → the game
├─ games/registry.js               # every cabinet in the arcade
├─ pages/
│  ├─ Layout.jsx                   # cabinet ground, safe areas
│  ├─ Arcade.jsx                   # home screen: cabinets, daily challenge, settings
│  └─ MosquitoInvaders.jsx         # hosts one cabinet
├─ lib/
│  ├─ scores.js                    # per-game score store
│  ├─ settings.js                  # difficulty, sound, initials
│  ├─ daily.js                     # seeded daily challenge
│  └─ utils.js                     # cn()
├─ components/ui/button.jsx        # shadcn-style Button
├─ engine/                         # shared across cabinets
│  ├─ useGameLoop.js               # delta-time rAF loop
│  └─ audio.js                     # synth core + arcade-wide mute
├─ components/piranha/
│  ├─ maze.js                      # the maze, mirrored from half-rows
│  ├─ model.js                     # rules: movement, chase AI, scoring
│  ├─ draw.js                      # rendering
│  ├─ Game.jsx                     # component, input, HUD
│  └─ sounds.js
└─ components/invaders/
   ├─ Game.jsx                     # constants, makeLevel(), update(), draw(), component
   ├─ useTouchControls.js          # input ref + keyboard binding
   ├─ TouchControls.jsx            # on-screen ◀ ▶ / FIRE
   ├─ Hud.jsx                      # score / wave / swarm / craft
   ├─ Overlay.jsx                  # ready · levelup · gameover screens
   ├─ Leaderboard.jsx              # ranked list
   ├─ InitialsEntry.jsx            # three-letter name entry
   ├─ scores.js                    # binding to @/lib/scores for this game
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

### Onto a phone, quickly

```bash
npm run device        # build, install and launch on a connected iPhone
npm run device <udid> # ...or a specific one
```

Development signing over the cable (or over the network, if the phone is paired) — no
TestFlight processing wait. It replaces whatever is installed under the same bundle id,
including a TestFlight build, and its provisioning lasts about a year.

### Shipping a build

```bash
export ASC_ISSUER_ID=<uuid>   # once, from App Store Connect → Users and Access → Integrations
npm run release               # bump the build number, archive, upload to TestFlight
```

`npm run release` is `archive` → `upload` → `bump`, in that order. The upload
authenticates with an App Store Connect API key
(`~/.appstoreconnect/private_keys/AuthKey_<id>.p8`), so it doesn't depend on an Xcode login
session — those expire, and Organizer reports it only as
`DistributionAppRecordProviderError error 0`. No credentials live in this repo: the key
stays on disk and the issuer ID comes from the environment.

**The bump comes last, and that ordering matters.** App Store Connect rejects a build
number it has already seen, so each upload needs a fresh one — but bumping *first* means an
archive or upload that fails still burns a number. Build 6 was lost that way and the
sequence jumped 5 → 7. With the bump last, the number sitting in the project is always the
next one that hasn't been uploaded.

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
