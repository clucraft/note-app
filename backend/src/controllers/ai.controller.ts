import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';
import * as aiService from '../services/ai.service.js';
import type { AISettings, AIProvider } from '../services/ai.service.js';
import {
  generateEmbedding,
  bufferToEmbedding,
  cosineSimilarity,
  isEmbeddingsAvailable,
  stripHtml
} from '../services/embeddings.service.js';

const aiSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openwebui']),
  apiKey: z.string(), // Optional for openwebui/Ollama
  model: z.string().min(1, 'Model is required'),
  endpoint: z.string().url().optional().nullable(),
}).refine((data) => {
  // API key is required for OpenAI and Anthropic, optional for OpenWebUI
  if (data.provider !== 'openwebui' && !data.apiKey) {
    return false;
  }
  return true;
}, { message: 'API key is required for this provider' });

const summarizeSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    preview: z.string(),
  })),
});

const expandSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  context: z.string().optional(),
});

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
});

function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return '••••••••' + apiKey.slice(-4);
}

export async function getAISettings(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;

    if (!user || !user.ai_settings) {
      res.json(null);
      return;
    }

    const settings: AISettings = JSON.parse(user.ai_settings);

    // Mask the API key for security
    res.json({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
      hasApiKey: !!settings.apiKey,
    });
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ error: 'Failed to get AI settings' });
  }
}

export async function updateAISettings(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const validation = aiSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { provider, apiKey, model, endpoint } = validation.data;

    // Get existing settings to check if we should keep the old API key
    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;
    let finalApiKey = apiKey;

    // If the API key looks masked (starts with bullets), keep the existing one
    if (apiKey.startsWith('••••') && user?.ai_settings) {
      const existingSettings: AISettings = JSON.parse(user.ai_settings);
      finalApiKey = existingSettings.apiKey;
    }

    const settings: AISettings = {
      provider: provider as AIProvider,
      apiKey: finalApiKey,
      model,
      endpoint: endpoint || null,
    };

    db.prepare('UPDATE users SET ai_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(settings), userId);

    res.json({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
      hasApiKey: true,
    });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
}

export async function testAIConnection(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;

    if (!user || !user.ai_settings) {
      res.status(400).json({ error: 'AI settings not configured' });
      return;
    }

    const settings: AISettings = JSON.parse(user.ai_settings);
    const result = await aiService.testConnection(settings);

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, message: result.content });
  } catch (error) {
    console.error('Test AI connection error:', error);
    res.status(500).json({ error: 'Failed to test AI connection' });
  }
}

export async function summarizeSearch(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const validation = summarizeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;

    if (!user || !user.ai_settings) {
      res.status(400).json({ error: 'AI settings not configured. Please configure AI in Settings.' });
      return;
    }

    const settings: AISettings = JSON.parse(user.ai_settings);
    const result = await aiService.summarizeSearchResults(settings, validation.data.results);

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ summary: result.content });
  } catch (error) {
    console.error('Summarize search error:', error);
    res.status(500).json({ error: 'Failed to summarize search results' });
  }
}

export async function expandText(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const validation = expandSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;

    if (!user || !user.ai_settings) {
      res.status(400).json({ error: 'AI settings not configured. Please configure AI in Settings.' });
      return;
    }

    const settings: AISettings = JSON.parse(user.ai_settings);
    const result = await aiService.expandText(settings, validation.data.text, validation.data.context);

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ expanded: result.content });
  } catch (error) {
    console.error('Expand text error:', error);
    res.status(500).json({ error: 'Failed to expand text' });
  }
}

export async function aiChat(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const validation = chatSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const user = db.prepare('SELECT ai_settings FROM users WHERE id = ?').get(userId) as any;

    if (!user || !user.ai_settings) {
      res.status(400).json({ error: 'AI settings not configured. Please configure AI in Settings.' });
      return;
    }

    const settings: AISettings = JSON.parse(user.ai_settings);
    const userMessage = validation.data.message;

    // Find relevant notes using semantic search + keyword fallback
    const relevantNotes = await findRelevantNotes(userId, userMessage);

    const result = await aiService.chat(
      settings,
      userMessage,
      relevantNotes,
      validation.data.history
    );

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ response: result.content });
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: `Failed to process chat message: ${error.message || error}` });
  }
}

/**
 * Find relevant notes for a query using semantic search with keyword fallback
 * Returns up to 15 most relevant notes
 */
async function findRelevantNotes(
  userId: number,
  query: string
): Promise<Array<{ id: number; title: string; content: string }>> {
  const MAX_NOTES = 15;
  const SIMILARITY_THRESHOLD = 0.35;

  let semanticResults: Array<{ id: number; title: string; content: string; similarity: number }> = [];
  let keywordResults: Array<{ id: number; title: string; content: string }> = [];

  // Try semantic search if embeddings are available
  if (isEmbeddingsAvailable()) {
    try {
      const queryEmbedding = await generateEmbedding(query);

      // Get all notes with embeddings
      const notesWithEmbeddings = db.prepare(`
        SELECT id, title, content, embedding
        FROM notes
        WHERE user_id = ? AND deleted_at IS NULL AND embedding IS NOT NULL
      `).all(userId) as Array<{ id: number; title: string; content: string; embedding: Buffer }>;

      // Score and rank by similarity
      semanticResults = notesWithEmbeddings
        .map(note => {
          const noteEmbedding = bufferToEmbedding(note.embedding);
          const similarity = cosineSimilarity(queryEmbedding, noteEmbedding);
          return { id: note.id, title: note.title, content: note.content, similarity };
        })
        .filter(note => note.similarity > SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, MAX_NOTES);
    } catch (error) {
      console.error('Semantic search failed, falling back to keyword search:', error);
    }
  }

  // Keyword search (fallback or supplement)
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  if (searchTerms.length > 0) {
    const searchPattern = `%${searchTerms.join('%')}%`;
    keywordResults = db.prepare(`
      SELECT id, title, content
      FROM notes
      WHERE user_id = ? AND deleted_at IS NULL
        AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ?)
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, searchPattern, searchPattern, MAX_NOTES) as Array<{ id: number; title: string; content: string }>;
  }

  // Merge results: semantic first, then keyword (deduplicated)
  const seenIds = new Set<number>();
  const mergedResults: Array<{ id: number; title: string; content: string }> = [];

  for (const note of semanticResults) {
    if (!seenIds.has(note.id)) {
      seenIds.add(note.id);
      mergedResults.push({ id: note.id, title: note.title, content: note.content });
    }
  }

  for (const note of keywordResults) {
    if (!seenIds.has(note.id) && mergedResults.length < MAX_NOTES) {
      seenIds.add(note.id);
      mergedResults.push(note);
    }
  }

  // If still no results, get most recently updated notes
  if (mergedResults.length === 0) {
    const recentNotes = db.prepare(`
      SELECT id, title, content
      FROM notes
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, MAX_NOTES) as Array<{ id: number; title: string; content: string }>;

    return recentNotes;
  }

  return mergedResults;
}
