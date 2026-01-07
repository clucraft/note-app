import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';
import * as aiService from '../services/ai.service.js';
import type { AISettings, AIProvider } from '../services/ai.service.js';

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

    // Fetch all user notes for context
    const notes = db.prepare(`
      SELECT id, title, content
      FROM notes
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY updated_at DESC
    `).all(userId) as Array<{ id: number; title: string; content: string }>;

    const settings: AISettings = JSON.parse(user.ai_settings);
    const result = await aiService.chat(
      settings,
      validation.data.message,
      notes,
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
