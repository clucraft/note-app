import express from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';
import { ApiClient } from './api-client.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

const app = express();

// CORS headers for Claude Desktop
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

// Store active sessions
const sessions = new Map<string, { transport: StreamableHTTPServerTransport }>();

function getApiKey(req: express.Request): string | undefined {
  return (req.query.apiKey as string) || (req.headers['x-api-key'] as string) || undefined;
}

// Streamable HTTP — handles both new and existing sessions
app.post('/mcp', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: 'API key required.' });
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session — forward the message
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session (or stale sessionId — create fresh)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const apiClient = new ApiClient({ apiKey });
  const server = createMcpServer(apiClient);
  await server.connect(transport);

  // handleRequest processes the initialize message and assigns sessionId
  await transport.handleRequest(req, res, req.body);

  // Register session AFTER handleRequest so sessionId is populated
  const sid = transport.sessionId!;
  sessions.set(sid, { transport });

  transport.onclose = () => {
    sessions.delete(sid);
  };
});

// GET for SSE stream (server-initiated messages)
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const { transport } = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE to close session
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const { transport } = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Cache Notes MCP server running on port ${PORT}`);
  console.log(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
});
