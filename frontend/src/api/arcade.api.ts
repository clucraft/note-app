import { api } from './index';

export interface ArcadeScore {
  initials: string;
  score: number;
  createdAt: string;
}

export async function getArcadeScores(game: string, token?: string): Promise<ArcadeScore[]> {
  const response = await api.get('/arcade/scores', { params: { game, token } });
  return response.data.scores;
}

export async function postArcadeScore(
  game: string,
  initials: string,
  score: number,
  token?: string
): Promise<{ rank: number; scores: ArcadeScore[] }> {
  const response = await api.post('/arcade/scores', { game, initials, score, token });
  return response.data;
}

export async function validateArcadeShare(token: string): Promise<boolean> {
  try {
    const response = await api.get('/arcade/validate', { params: { token } });
    return !!response.data.valid;
  } catch {
    return false;
  }
}

export async function getArcadeShare(): Promise<{ enabled: boolean; token: string | null }> {
  const response = await api.get('/arcade/share');
  return response.data;
}

export async function enableArcadeShare(): Promise<string> {
  const response = await api.post('/arcade/share');
  return response.data.token;
}

export async function disableArcadeShare(): Promise<void> {
  await api.delete('/arcade/share');
}
