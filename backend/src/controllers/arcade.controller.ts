import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../database/db.js';
import { verifyAccessToken } from '../utils/jwt.js';

const SHARE_TOKEN_KEY = 'arcade_share_token';
const TOP_N = 10;
const KEEP_PER_GAME = 100;

// Whitelisted games and sanity caps to reject absurd posted scores
const GAME_MAX_SCORE: Record<string, number> = {
  snake: 10000,
  breaker: 500000,
  shooter: 500000,
  stacker: 1000000,
  missile: 500000,
  chopper: 100000,
  runner: 100000,
};

const postScoreSchema = z.object({
  game: z.string(),
  initials: z.string().regex(/^[A-Za-z0-9]{1,3}$/),
  score: z.number().int().positive(),
  token: z.string().optional(),
});

function getShareToken(): string | null {
  const row = db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .get(SHARE_TOKEN_KEY) as { value: string } | undefined;
  return row?.value || null;
}

/** Access is granted by a valid share token OR a valid JWT (in-app session). */
function hasArcadeAccess(req: Request, providedToken: string | undefined): boolean {
  const shareToken = getShareToken();
  if (shareToken && providedToken && providedToken === shareToken) return true;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      verifyAccessToken(authHeader.split(' ')[1]);
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}

function topScores(game: string) {
  return db
    .prepare(
      `SELECT initials, score, created_at AS createdAt
       FROM arcade_scores WHERE game = ?
       ORDER BY score DESC, created_at ASC LIMIT ?`
    )
    .all(game, TOP_N);
}

export function getScores(req: Request, res: Response) {
  const game = String(req.query.game || '');
  if (!(game in GAME_MAX_SCORE)) {
    res.status(400).json({ error: 'Unknown game' });
    return;
  }
  if (!hasArcadeAccess(req, req.query.token as string | undefined)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json({ scores: topScores(game) });
}

export function postScore(req: Request, res: Response) {
  const result = postScoreSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const { game, score, token } = result.data;
  const initials = result.data.initials.toUpperCase();

  if (!(game in GAME_MAX_SCORE) || score > GAME_MAX_SCORE[game]) {
    res.status(400).json({ error: 'Invalid score' });
    return;
  }
  if (!hasArcadeAccess(req, token)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  db.prepare('INSERT INTO arcade_scores (game, initials, score) VALUES (?, ?, ?)').run(
    game,
    initials,
    score
  );

  // keep the table tidy: only the top N rows per game survive
  db.prepare(
    `DELETE FROM arcade_scores WHERE game = ? AND id NOT IN (
       SELECT id FROM arcade_scores WHERE game = ?
       ORDER BY score DESC, created_at ASC LIMIT ?
     )`
  ).run(game, game, KEEP_PER_GAME);

  const rank =
    (db
      .prepare('SELECT COUNT(*) AS n FROM arcade_scores WHERE game = ? AND score > ?')
      .get(game, score) as { n: number }).n + 1;

  res.json({ rank, scores: topScores(game) });
}

/** Public: lets the shared arcade page check its link before rendering. */
export function validateShare(req: Request, res: Response) {
  const token = req.query.token as string | undefined;
  const shareToken = getShareToken();
  if (shareToken && token === shareToken) {
    res.json({ valid: true });
  } else {
    res.status(404).json({ valid: false });
  }
}

// ---- share management (authenticated) ----

export function getShareStatus(_req: Request, res: Response) {
  const token = getShareToken();
  res.json({ enabled: !!token, token });
}

export function enableShare(_req: Request, res: Response) {
  let token = getShareToken();
  if (!token) {
    token = crypto.randomBytes(16).toString('base64url');
    db.prepare(
      `INSERT INTO system_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).run(SHARE_TOKEN_KEY, token);
  }
  res.json({ enabled: true, token });
}

export function disableShare(_req: Request, res: Response) {
  db.prepare('DELETE FROM system_settings WHERE key = ?').run(SHARE_TOKEN_KEY);
  res.json({ enabled: false });
}
