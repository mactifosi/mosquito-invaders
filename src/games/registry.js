/**
 * Every cabinet in the arcade.
 *
 * One entry per game. The shell reads this to build the home screen, so adding
 * a game is: build it under src/components/<game>/, add a route in App.jsx, and
 * add it here — with a drawing in @/components/arcade/Avatar if it has one. `id` is also its score-store key, so it must not change once
 * anyone has played — see @/lib/scores.
 */
export const GAMES = [
  {
    id: "mosquito-invaders",
    title: "Mosquito Invaders",
    tagline: "Swat the swarm before it lands",
    marquee: "CITRONELLA SQUADRON · SECTOR 7",
    blurb: "Hold the line against descending waves of mosquitoes. Bunkers erode, divers swoop, and every fourth wave brings the queen.",
    path: "/mosquito-invaders",
    accent: "#ffb02e",
    ink: "#20130a",
    playable: true,
  },
  {
    id: "piranha",
    title: "Piranha",
    tagline: "Munch carrots, dodge the fish",
    marquee: "SHOAL RIVER · ONE BUNNY",
    blurb: "A maze of algae under the waterline, and four piranhas hunting the bunny eating it. Swallow a carrot and, for seven seconds, they're the ones running.",
    path: "/piranha",
    accent: "#ff8a3d",
    ink: "#231003",
    playable: true,
  },
  {
    id: "skimmer",
    title: "Skimmer",
    tagline: "Skim stones, smash egg rafts",
    marquee: "STILL WATER · EGG RAFTS",
    blurb: "Skim a stone off the punt and break every raft of mosquito eggs. The red ones are hatching — leave one too long and something gets out.",
    path: "/skimmer",
    accent: "#9fe8c9",
    ink: "#06231b",
    playable: true,
  },
];

export const findGame = (id) => GAMES.find((g) => g.id === id) || null;
