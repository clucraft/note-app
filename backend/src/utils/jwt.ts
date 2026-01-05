import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-production';

export interface TokenPayload {
  userId: number;
  role: string;
}

export function generateAccessToken(userId: number, role: string): string {
  return jwt.sign(
    { userId, role } as TokenPayload,
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): { userId: number } {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as { userId: number };
}
