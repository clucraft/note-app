import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { generateApiKey, validateApiKeyFormat } from '../utils/apikey.js';

// List all API keys for the current user (never returns full key)
export async function listApiKeys(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const stmt = db.prepare(`
      SELECT id, name, key_prefix, created_at, last_used_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    const keys = stmt.all(userId);

    res.json(keys.map((k: any) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
    })));
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
}

// Create a new API key (returns raw key once)
export async function createApiKey(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const trimmedName = name.trim();

    // Check uniqueness of name per user
    const existing = db.prepare(
      'SELECT id FROM api_keys WHERE user_id = ? AND name = ?'
    ).get(userId, trimmedName);

    if (existing) {
      res.status(409).json({ error: 'An API key with this name already exists' });
      return;
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    const stmt = db.prepare(`
      INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, trimmedName, keyHash, keyPrefix);

    res.status(201).json({
      id: result.lastInsertRowid,
      name: trimmedName,
      key: rawKey,
      keyPrefix,
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
}

// Delete (revoke) an API key
export async function deleteApiKey(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const keyId = parseInt(req.params.id, 10);

    if (isNaN(keyId)) {
      res.status(400).json({ error: 'Invalid key ID' });
      return;
    }

    const result = db.prepare(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?'
    ).run(keyId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    res.json({ message: 'API key revoked' });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
}
