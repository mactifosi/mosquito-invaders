/**
 * Rules the game has to keep. Each case drives update() directly at a fixed
 * timestep, so they run in milliseconds and assert behaviour rather than pixels.
 *
 *   npm test
 */
const { makeLevel, update, comboMultiplier, makeBunkers, alienPos, isBossLevel, formationSpeedMul, waveTitle } = await import("./harness.mjs");
const intact = (g) => g.bunkers.reduce((n, b) => n + b.cells.reduce((m, c) => m + c, 0), 0);

const results = [];
const check = (name, pass, detail = "") => results.push([pass ? "PASS" : "FAIL", name, detail]);

const cb = () => {
  const seen = { score: 0, lives: 3, swarm: 36, combo: 1, over: null, cleared: 0 };
  return {
    seen,
    onScore: (v) => (seen.score = v),
    onLives: (v) => (seen.lives = v),
    onSwarm: (v) => (seen.swarm = v),
    onCombo: (v) => { seen.combo = v; seen.maxCombo = Math.max(seen.maxCombo || 1, v); },
    onGameOver: (r) => (seen.over = r),
    onLevelClear: () => seen.cleared++,
  };
};
const step = (g, c, input, seconds, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) update(dt, g, input, c);
};

// 1. multiplier table
check("comboMultiplier steps 3/6/9 → 2/3/4",
  comboMultiplier(0) === 1 && comboMultiplier(3) === 2 && comboMultiplier(6) === 3 && comboMultiplier(99) === 5,
  `${comboMultiplier(0)},${comboMultiplier(3)},${comboMultiplier(6)},${comboMultiplier(99)}`);

// 2. a kill scores, pops, and triggers hit-stop
let g = makeLevel(1, 0, 3), c = cb();
step(g, c, { left: false, right: false, fire: true }, 2.5);
check("kill scores and spawns a popup", c.seen.score > 0 && g.popups.length > 0, `score=${c.seen.score} popups=${g.popups.length}`);
check("kill sets hit-stop", g.hitStop > 0 || g.streak > 0, `hitStop=${g.hitStop.toFixed(3)} streak=${g.streak}`);
check("shots are counted", g.shotsFired > 0 && g.shotsHit > 0, `fired=${g.shotsFired} hit=${g.shotsHit}`);

// 3. hit-stop freezes the world
g = makeLevel(1, 0, 3); c = cb();
g.hitStop = 0.045;
const t0 = g.t, fx = g.formationX;
update(1 / 60, g, { left: false, right: false, fire: false }, c);
check("hit-stop halts time and the formation", g.t === t0 && g.formationX === fx, `t=${g.t} fx=${g.formationX}`);

// 4. streak raises the multiplier and the score with it
g = makeLevel(1, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: true }, 12);
check("sustained fire builds a streak and multiplier", g.bestStreak >= 3 && (c.seen.maxCombo || 1) >= 2, `best=${g.bestStreak} peakCombo=${c.seen.maxCombo}`);

// 5. a miss breaks the combo
g = makeLevel(1, 0, 3); c = cb();
g.streak = 5; g.comboTimer = 2;
g.bullets.push({ x: 5, y: 2, vx: 0 });      // about to leave the top, hitting nothing
step(g, c, { left: false, right: false, fire: false }, 0.2);
check("a miss resets the streak", g.streak === 0 && c.seen.combo === 1, `streak=${g.streak} combo=${c.seen.combo}`);

// 6. combo window expiry
g = makeLevel(1, 0, 3); c = cb();
g.streak = 4; g.comboTimer = 0.1;
step(g, c, { left: false, right: false, fire: false }, 0.5);
check("streak decays after the combo window", g.streak === 0, `streak=${g.streak}`);

// 7. taking a bite shakes the screen and breaks the streak
g = makeLevel(1, 0, 3); c = cb();
g.streak = 6; g.comboTimer = 2;
g.ebullets.push({ x: g.player.x + 10, y: g.player.y - 2 });
step(g, c, { left: false, right: false, fire: false }, 0.15);
check("a bite costs a life, shakes, breaks the streak",
  c.seen.lives === 2 && g.shake > 0 && g.streak === 0,
  `lives=${c.seen.lives} shake=${g.shake.toFixed(2)} streak=${g.streak}`);

// ---- batch 2: bunkers and divers ----

// 8. bunkers exist, are arch-shaped, and sit between craft and swarm
g = makeLevel(1, 0, 3);
const bs = g.bunkers;
check("four bunkers, arch-shaped, above the craft",
  bs.length === 4 && bs.every(b => b.y < g.player.y && b.cells.some(c => c === 0) && b.cells.some(c => c === 1)),
  `count=${bs.length} y=${bs[0].y} craftY=${g.player.y}`);

// 9. a player shot erodes cover and is consumed
g = makeLevel(1, 0, 3); c = cb();
const before = intact(g);
const b0 = g.bunkers[0];
g.bullets.push({ x: b0.x + 20, y: b0.y + 30, vx: 0 });   // just below, travelling up
step(g, c, { left: false, right: false, fire: false }, 0.2);
check("your own shot chews your cover and stops",
  intact(g) < before && g.bullets.length === 0,
  `cells ${before} -> ${intact(g)} bullets=${g.bullets.length}`);

// 10. an enemy shot erodes it from above
g = makeLevel(1, 0, 3); c = cb();
const before2 = intact(g);
const b1 = g.bunkers[1];
g.ebullets.push({ x: b1.x + 8, y: b1.y - 6 });
step(g, c, { left: false, right: false, fire: false }, 0.3);
check("enemy fire erodes cover from above",
  intact(g) < before2 && g.ebullets.length === 0,
  `cells ${before2} -> ${intact(g)}`);

// 11. no divers before wave 3; divers after
g = makeLevel(1, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 12);
const early = g.aliens.some(a => a.dive);
g = makeLevel(3, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 7);   // 1.2s wave card + 4.5s dive timer
const late = g.aliens.filter(a => a.dive).length;
check("divers start at wave 3, capped at 2", !early && late >= 1 && late <= 2, `wave1=${early} wave3=${late}`);

// 12. a diver descends toward the craft and its position tracks the dive
g = makeLevel(3, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 6.5);   // wave card, then the 4.5s dive timer
const diver = g.aliens.find(a => a.dive);
const startY = diver ? diver.dive.y : NaN;
step(g, c, { left: false, right: false, fire: false }, 0.6);
check("a diver accelerates downward",
  Boolean(diver?.dive) && diver.dive.y > startY && alienPos(g, diver).y === diver.dive.y,
  `y ${startY.toFixed(1)} -> ${diver.dive?.y.toFixed(1)}`);

// 13. a diver that reaches the craft costs a life, and dies doing it
g = makeLevel(3, 0, 3); c = cb();
const d2 = g.aliens[30];
d2.dive = { x: g.player.x, y: g.player.y - 2, vx: 0, vy: 60, t: 0 };
step(g, c, { left: false, right: false, fire: false }, 0.1);
check("a diver that connects costs a life and is spent",
  c.seen.lives === 2 && !d2.alive, `lives=${c.seen.lives} alive=${d2.alive}`);

// 14. shooting a diver pays double
g = makeLevel(3, 0, 3); c = cb();
const d3 = g.aliens[27];                       // row 3 → 10 pts base
d3.dive = { x: 100, y: 200, vx: 0, vy: 0, t: 0 };
g.bullets.push({ x: 100 + 10, y: 200 + 20, vx: 0 });
step(g, c, { left: false, right: false, fire: false }, 0.12);
check("a diver kill pays the dive bonus", c.seen.score === 20, `score=${c.seen.score} (expected 20)`);

// 15. divers don't trigger the "swarm landed" loss
g = makeLevel(3, 0, 3); c = cb();
const d4 = g.aliens[31];
d4.dive = { x: 10, y: g.player.y + 4, vx: 0, vy: 0, t: 0 };   // below the craft, off to the side
step(g, c, { left: false, right: false, fire: false }, 0.05);
check("a diver below the craft is not a swarm landing", c.seen.over === null, `over=${c.seen.over}`);

// ---- batch 3: the queen ----

// 16. every 4th wave, and only those, is a boss wave
check("waves 4, 8, 12 are boss waves; others aren't",
  [4, 8, 12].every(isBossLevel) && ![1, 2, 3, 5, 7, 9].some(isBossLevel), "");

// 17. a boss wave has a queen and no formation
g = makeLevel(4, 0, 3);
check("a boss wave replaces the formation with a queen",
  Boolean(g.boss) && g.aliens.length === 0 && g.boss.hp > 0,
  `aliens=${g.aliens.length} hp=${g.boss?.hp}`);
check("queen HP scales per boss tier", makeLevel(8, 0, 3).boss.hp > makeLevel(4, 0, 3).boss.hp,
  `w4=${makeLevel(4,0,3).boss.hp} w8=${makeLevel(8,0,3).boss.hp}`);

// 18. an empty field with a live queen is NOT a cleared wave
g = makeLevel(4, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 1);
check("a live queen keeps the wave open", c.seen.cleared === 0, `cleared=${c.seen.cleared}`);

// 19. shots chip her down; the kill clears the wave and pays out
g = makeLevel(4, 0, 3); c = cb();
const hp0 = g.boss.hp;
g.bullets.push({ x: g.boss.x + 20, y: g.boss.y + 10, vx: 0 });
step(g, c, { left: false, right: false, fire: false }, 0.05);
check("a shot chips the queen and pays chip damage",
  g.boss.hp === hp0 - 1 && c.seen.score === 5, `hp=${g.boss.hp} score=${c.seen.score}`);

g.boss.hp = 1;
g.hitStop = 0;
g.bullets.push({ x: g.boss.x + 20, y: g.boss.y + 10, vx: 0 });
step(g, c, { left: false, right: false, fire: false }, 0.05);
const killScore = c.seen.score;
g.hitStop = 0;
step(g, c, { left: false, right: false, fire: false }, 0.05);
check("killing the queen ends the wave and pays 500",
  g.boss === null && killScore >= 505 && c.seen.cleared === 1,
  `boss=${g.boss} score=${killScore} cleared=${c.seen.cleared}`);

// 20. she seeds brood that dive, and brood are spent when they exit
g = makeLevel(4, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 6.5);
const brood = g.aliens.filter(a => a.alive && a.brood);
check("the queen seeds diving brood, capped at 3",
  brood.length >= 1 && brood.length <= 3 && brood.every(a => a.dive),
  `brood=${brood.length}`);
const bd = brood[0];
bd.dive.y = 600;   // past the bottom of the 540px field
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("brood that fly off the bottom are spent, not rejoined",
  !bd.alive && !bd.dive, `alive=${bd.alive} dive=${Boolean(bd.dive)}`);

// 21. she fires spreads
g = makeLevel(4, 0, 3); c = cb();
step(g, c, { left: false, right: false, fire: false }, 3.2);
check("the queen fires spreads", g.ebullets.length >= 3, `ebullets=${g.ebullets.length}`);

// 22. she descends, and reaching the craft ends the run
g = makeLevel(4, 0, 3); c = cb();
const by0 = g.boss.y;
step(g, c, { left: false, right: false, fire: false }, 3.2);
const descended = g.boss.y > by0;
g.boss.y = g.player.y - 2;
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("the queen creeps down; reaching the craft costs a craft and pushes her back",
  descended && c.seen.lives === 2 && c.seen.over === null && g.boss.y === 44,
  `descended=${descended} lives=${c.seen.lives} over=${c.seen.over} bossY=${g.boss.y}`);

g = makeLevel(4, 0, 1); c = cb();
g.intro = 0;
g.boss.y = g.player.y - 2;
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("the queen reaching the last craft ends the run", c.seen.over === "landed", `over=${c.seen.over}`);

// 23. end-of-run callbacks fire exactly once, however long the loop runs on
g = makeLevel(1, 0, 3); c = cb();
g.aliens.forEach(a => (a.alive = false));
step(g, c, { left: false, right: false, fire: false }, 1);
check("onLevelClear fires once, not once per frame", c.seen.cleared === 1, `cleared=${c.seen.cleared}`);

g = makeLevel(1, 0, 1); c = cb();
let overCount = 0;
const c2 = { ...c, onGameOver: () => { overCount++; c.seen.over = "shot"; } };
g.ebullets.push({ x: g.player.x + 10, y: g.player.y - 2 });
step(g, c2, { left: false, right: false, fire: false }, 1);
check("onGameOver fires once, so the score is saved once", overCount === 1, `calls=${overCount}`);

// ---- batch 4: feel fixes ----

// 24. the difficulty curve is flattened
check("a thinned swarm tops out at 1.8x, not 3.2x",
  formationSpeedMul(36) === 1 && Math.abs(formationSpeedMul(1) - 1.777) < 0.01 && formationSpeedMul(0) === 1.8,
  `full=${formationSpeedMul(36)} last=${formationSpeedMul(1).toFixed(3)}`);

// 25. wave card names the wave, and the swarm holds station while it's up
g = makeLevel(3, 0, 3); c = cb();
const t3 = waveTitle(3), t4 = waveTitle(4);
check("wave card names the wave and its species",
  t3.wave === "WAVE 3" && /SURGE/.test(t3.sub) && t4.sub === "THE QUEEN",
  `${t3.wave} · ${t3.sub} | ${t4.sub}`);

const fx0 = g.formationX;
step(g, c, { left: false, right: false, fire: false }, 0.5);   // still inside the 1.2s card
check("the swarm holds station during the card",
  g.formationX === fx0 && g.ebullets.length === 0, `moved=${(g.formationX - fx0).toFixed(2)}`);
step(g, c, { left: false, right: false, fire: false }, 1.2);   // card over
check("the swarm advances once the card clears", g.formationX !== fx0, `moved=${(g.formationX - fx0).toFixed(2)}`);

// 26. firing sets muzzle flash and recoil
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
step(g, c, { left: false, right: false, fire: true }, 0.02);
check("firing lights the muzzle and recoils the craft",
  g.player.muzzle > 0 && g.player.recoil > 0,
  `muzzle=${g.player.muzzle.toFixed(3)} recoil=${g.player.recoil.toFixed(3)}`);

// 27. a breach costs one craft and resets the swarm, rather than ending the run
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.formationY = g.player.y - 20;      // swarm at the craft's altitude
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("a breach costs one craft and drives the swarm back",
  c.seen.lives === 2 && c.seen.over === null && g.formationY === 70,
  `lives=${c.seen.lives} over=${c.seen.over} formationY=${g.formationY}`);

// 28. ...but the last craft still ends it
g = makeLevel(1, 0, 1); c = cb();
g.intro = 0;
g.formationY = g.player.y - 20;
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("a breach on the last craft ends the run", c.seen.over === "landed", `over=${c.seen.over}`);

// 29. shooting a power-up pays points instead of pure loss
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
g.powerups.push({ x: 100, y: 300, type: "rapid" });
g.bullets.push({ x: 105, y: 304, vx: 0 });
step(g, c, { left: false, right: false, fire: false }, 0.02);
check("a shot power-up pays out and is gone",
  c.seen.score === 50 && g.powerups.length === 0,
  `score=${c.seen.score} powerups=${g.powerups.length}`);

// ---- batch 5: drag to move ----

// 30. a drag target places the craft directly, beating the keyboard
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
step(g, c, { left: true, right: false, fire: false, dragTarget: 200 }, 0.1);
check("a drag places the craft and overrides the keys", g.player.x === 200, `x=${g.player.x}`);

// 31. drag targets are clamped to the field
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
step(g, c, { left: false, right: false, fire: false, dragTarget: 9999 }, 0.02);
const right = g.player.x;
step(g, c, { left: false, right: false, fire: false, dragTarget: -9999 }, 0.02);
check("drag is clamped to the field", right === 360 - 26 - 2 && g.player.x === 2, `right=${right} left=${g.player.x}`);

// 32. releasing the drag hands control back to the keyboard
g = makeLevel(1, 0, 3); c = cb();
g.intro = 0;
step(g, c, { left: false, right: false, fire: false, dragTarget: 100 }, 0.02);
step(g, c, { left: false, right: true, fire: false, dragTarget: null }, 0.5);
check("keys work again once the finger lifts", g.player.x > 100, `x=${g.player.x.toFixed(1)}`);

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? "  (" + d + ")" : ""}`);

const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
