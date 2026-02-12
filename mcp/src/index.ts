import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './server.js';
import { ApiClient } from './api-client.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

const app = express();

// CORS headers for Claude Desktop
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Parse JSON bodies — needed because reverse proxies can consume the raw stream
app.use(express.json());

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  const apiKey = (req.query.apiKey as string) || (req.headers['x-api-key'] as string);

  if (!apiKey) {
    res.status(401).json({ error: 'API key required. Pass as ?apiKey= query param or X-API-Key header.' });
    return;
  }

  const apiClient = new ApiClient({ apiKey });
  const server = createMcpServer(apiClient);

  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId query parameter required' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Pass pre-parsed body so the SDK doesn't try to read the consumed stream
  await transport.handlePostMessage(req, res, req.body);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Cache Notes MCP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
