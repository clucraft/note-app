import { Router, type Request, type Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { renderLoginPage } from './login-page.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const MCP_PUBLIC_URL = (process.env.MCP_PUBLIC_URL || 'http://localhost:3002').replace(/\/$/, '');
const JWT_SECRET = process.env.MCP_JWT_SECRET || 'mcp-oauth-dev-secret';

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- In-memory stores ---

interface RegisteredClient {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  apiKey: string;
  userId: string;
  expiresAt: number;
}

const clients = new Map<string, RegisteredClient>();
const authCodes = new Map<string, AuthCode>();

// Periodic cleanup of expired auth codes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (data.expiresAt < now) authCodes.delete(code);
  }
}, 60_000);

// --- Router ---

export const oauthRouter = Router();

// Protected Resource Metadata (RFC 9728)
oauthRouter.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  res.json({
    resource: MCP_PUBLIC_URL,
    authorization_servers: [MCP_PUBLIC_URL],
  });
});

// Authorization Server Metadata (RFC 8414)
oauthRouter.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  res.json({
    issuer: MCP_PUBLIC_URL,
    authorization_endpoint: `${MCP_PUBLIC_URL}/oauth/authorize`,
    token_endpoint: `${MCP_PUBLIC_URL}/oauth/token`,
    registration_endpoint: `${MCP_PUBLIC_URL}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Dynamic Client Registration (RFC 7591)
oauthRouter.post('/oauth/register', (req: Request, res: Response) => {
  const { redirect_uris, client_name } = req.body ?? {};

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris required' });
    return;
  }

  const clientId = `client_${randomUUID()}`;
  const client: RegisteredClient = {
    client_id: clientId,
    client_name: client_name ?? undefined,
    redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
  clients.set(clientId, client);

  res.status(201).json(client);
});

// Authorization endpoint – GET (show login page)
oauthRouter.get('/oauth/authorize', (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } = req.query as Record<string, string>;

  const validationError = validateAuthorizeParams(client_id, redirect_uri, code_challenge, code_challenge_method, response_type);
  if (validationError) {
    res.status(400).json({ error: 'invalid_request', error_description: validationError });
    return;
  }

  res.type('html').send(renderLoginPage({
    clientId: client_id,
    redirectUri: redirect_uri,
    state: state ?? '',
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
  }));
});

// Authorization endpoint – POST (process login)
oauthRouter.post('/oauth/authorize', async (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    email,
    password,
    totp,
  } = req.body ?? {};

  const validationError = validateAuthorizeParams(client_id, redirect_uri, code_challenge, code_challenge_method);
  if (validationError) {
    res.status(400).json({ error: 'invalid_request', error_description: validationError });
    return;
  }

  const renderError = (error: string, show2fa = false) => {
    res.type('html').send(renderLoginPage({
      clientId: client_id,
      redirectUri: redirect_uri,
      state: state ?? '',
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      error,
      requiresTwoFactor: show2fa,
      email,
      password,
    }));
  };

  if (!email || !password) {
    renderError('Email and password are required.');
    return;
  }

  try {
    // Authenticate against the backend
    const loginBody: Record<string, string> = { email, password };
    if (totp) loginBody.totpCode = totp;

    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginBody),
    });

    const loginData = await loginRes.json() as Record<string, unknown>;

    if (loginData.requiresTwoFactor) {
      renderError(totp ? 'Invalid two-factor code. Please try again.' : 'Two-factor authentication required.', true);
      return;
    }

    if (!loginRes.ok) {
      renderError((loginData.error as string) ?? 'Login failed.');
      return;
    }

    // Login succeeded – create an API key via the backend
    const backendToken = loginData.accessToken as string;
    const userId = (loginData.user as Record<string, unknown>)?.id as string ?? 'unknown';

    const keyName = `mcp-oauth-${Date.now()}`;
    const keyRes = await fetch(`${BACKEND_URL}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backendToken}`,
      },
      body: JSON.stringify({ name: keyName }),
    });

    if (!keyRes.ok) {
      const keyErr = await keyRes.json().catch(() => ({})) as Record<string, unknown>;
      console.error('API key creation failed:', keyRes.status, keyErr);
      renderError('Failed to create API key. Please try again.');
      return;
    }

    const keyData = await keyRes.json() as Record<string, unknown>;
    const rawApiKey = keyData.key as string;

    // Generate auth code
    const code = randomUUID();
    authCodes.set(code, {
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      apiKey: rawApiKey,
      userId: String(userId),
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });

    // Redirect back to the client
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(302, redirectUrl.toString());
  } catch (err) {
    console.error('OAuth authorize error:', err);
    renderError('An internal error occurred. Please try again.');
  }
});

// Token endpoint
oauthRouter.post('/oauth/token', (req: Request, res: Response) => {
  const { grant_type } = req.body ?? {};

  if (grant_type === 'authorization_code') {
    handleAuthorizationCodeGrant(req, res);
  } else if (grant_type === 'refresh_token') {
    handleRefreshTokenGrant(req, res);
  } else {
    res.status(400).json({ error: 'unsupported_grant_type' });
  }
});

function handleAuthorizationCodeGrant(req: Request, res: Response): void {
  const { code, code_verifier, redirect_uri, client_id } = req.body ?? {};

  if (!code || !code_verifier) {
    res.status(400).json({ error: 'invalid_request', error_description: 'code and code_verifier required' });
    return;
  }

  const authCode = authCodes.get(code);
  if (!authCode || authCode.expiresAt < Date.now()) {
    authCodes.delete(code);
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
    return;
  }

  // Validate client and redirect_uri match
  if (authCode.clientId !== client_id) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    return;
  }
  if (authCode.redirectUri !== redirect_uri) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    return;
  }

  // PKCE verification: base64url(sha256(code_verifier)) === code_challenge
  const expectedChallenge = base64url(createHash('sha256').update(code_verifier).digest());
  if (expectedChallenge !== authCode.codeChallenge) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    return;
  }

  // Consume the code (one-time use)
  authCodes.delete(code);

  // Issue tokens
  const tokenPayload = { sub: authCode.userId, apiKey: authCode.apiKey };
  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
  });
}

function handleRefreshTokenGrant(req: Request, res: Response): void {
  const { refresh_token } = req.body ?? {};

  if (!refresh_token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token required' });
    return;
  }

  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET) as jwt.JwtPayload & { apiKey: string; type?: string };
    if (payload.type !== 'refresh') {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Not a refresh token' });
      return;
    }

    const tokenPayload = { sub: payload.sub, apiKey: payload.apiKey };
    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    const newRefreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
    });
  } catch {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' });
  }
}

// --- Utilities ---

function validateAuthorizeParams(
  clientId: string | undefined,
  redirectUri: string | undefined,
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined,
  responseType?: string | undefined,
): string | null {
  if (!clientId || !clients.has(clientId)) return 'Unknown client_id';
  if (!redirectUri) return 'redirect_uri required';

  const client = clients.get(clientId)!;
  if (!client.redirect_uris.includes(redirectUri)) return 'redirect_uri not registered for this client';
  if (!codeChallenge) return 'code_challenge required (PKCE)';
  if (codeChallengeMethod !== 'S256') return 'code_challenge_method must be S256';
  if (responseType !== undefined && responseType !== 'code') return 'response_type must be code';

  return null;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Extract an API key from a Bearer JWT token.
 * Returns the embedded apiKey string, or undefined if the token is invalid.
 */
export function extractApiKeyFromBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { apiKey?: string };
    return payload.apiKey;
  } catch {
    return undefined;
  }
}
