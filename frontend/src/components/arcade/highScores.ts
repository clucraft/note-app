const STORAGE_KEY = 'arcade.highScores';

export type GameId = 'snake' | 'breaker' | 'shooter' | 'stacker' | 'missile' | 'chopper';

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getHighScore(game: GameId): number {
  return load()[game] || 0;
}

/** Stores the score if it beats the current best. Returns true on a new record. */
export function submitHighScore(game: GameId, score: number): boolean {
  const scores = load();
  if (score <= (scores[game] || 0)) return false;
  scores[game] = score;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  return true;
}
