import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';
import { ApiClient } from './api-client.js';
import { oauthRouter, extractApiKeyFromBearer } from './oauth.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

const app = express();

// CORS headers for Claude Desktop
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  // Mcp-Session-Id stays allowed: clients that connected to an older,
  // session-based build of this server still send it.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Mcp-Session-Id, Mcp-Protocol-Version, Authorization');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OAuth routes (must be before /mcp)
app.use(oauthRouter);

function getApiKey(req: express.Request): string | undefined {
  return (req.query.apiKey as string)
    || (req.headers['x-api-key'] as string)
    || extractApiKeyFromBearer(req.headers.authorization)
    || undefined;
}

function methodNotAllowed(_req: express.Request, res: express.Response): void {
  res.status(405).set('Allow', 'POST').json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
}

// Stateless Streamable HTTP. Every request gets its own server and transport,
// authenticated by that request's API key, and nothing is kept in memory
// between requests — so restarting this service cannot strand a connected
// client. A session ID sent by a client is ignored.
app.post('/mcp', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: 'API key required.' });
    return;
  }

  const server = createMcpServer(new ApiClient({ apiKey }));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// No server-initiated stream and no sessions to end in stateless mode.
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Cache Notes MCP server running on port ${PORT}`);
  console.log(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
});
