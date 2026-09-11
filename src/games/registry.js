/**
 * Every cabinet in the arcade.
 *
 * One entry per game. The shell reads this to build the home screen, so adding
 * a game is: build it under src/components/<game>/, add a route in App.jsx, and
 * add it here. `id` is also its score-store key, so it must not change once
 * anyone has played — see @/lib/scores.
 */
export const GAMES = [
  {
    id: "mosquito-invaders",
    title: "Mosquito Invaders",
    marquee: "CITRONELLA SQUADRON · SECTOR 7",
    blurb: "Hold the line against descending waves of mosquitoes. Bunkers erode, divers swoop, and every fourth wave brings the queen.",
    path: "/mosquito-invaders",
    accent: "#ffb02e",
    ink: "#20130a",
    playable: true,
  },
];

export const findGame = (id) => GAMES.find((g) => g.id === id) || null;
