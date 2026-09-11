/** Skimmer's binding to the arcade-wide score store. */
import * as store from "@/lib/scores";

export const GAME_ID = "skimmer";

export const loadScores = () => store.loadScores(GAME_ID);
export const saveScore = (score, initials) => store.saveScore(GAME_ID, score, initials);
export const getHighScore = () => store.getHighScore(GAME_ID);
export const qualifies = (score) => store.qualifies(GAME_ID, score);
