export interface LoginPageParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
  requiresTwoFactor?: boolean;
  email?: string;
  password?: string;
}

export function renderLoginPage(params: LoginPageParams): string {
  const {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    error,
    requiresTwoFactor,
    email,
    password,
  } = params;

  const esc = (s: string | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cache Notes – Sign In</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.1);
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.4rem; text-align: center; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.25rem; }
    input[type="email"], input[type="password"], input[type="text"] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #4a90d9; }
    button {
      width: 100%;
      padding: 0.7rem;
      background: #4a90d9;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #3a7bc8; }
    .error {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 0.6rem 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
    .hint { font-size: 0.8rem; color: #888; text-align: center; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Cache Notes</h1>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${esc(clientId)}">
      <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}">
      <input type="hidden" name="state" value="${esc(state)}">
      <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${esc(codeChallengeMethod)}">

      ${requiresTwoFactor ? `
        <input type="hidden" name="email" value="${esc(email)}">
        <input type="hidden" name="password" value="${esc(password)}">
        <label for="totp">Two-Factor Code</label>
        <input type="text" id="totp" name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="6-digit code" autofocus required>
      ` : `
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="email" autofocus required>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
      `}

      <button type="submit">${requiresTwoFactor ? 'Verify' : 'Sign In'}</button>
    </form>
    <p class="hint">Sign in to grant MCP access to your notes.</p>
  </div>
</body>
</html>`;
}
