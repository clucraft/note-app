import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db.js';

const recordActivitySchema = z.object({
  charCount: z.number().min(0),
  wordCount: z.number().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD from client
  hour: z.number().min(0).max(23),
});

export async function recordActivity(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const validation = recordActivitySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { charCount, wordCount, date, hour } = validation.data;

    // Upsert: insert or update if exists
    db.prepare(`
      INSERT INTO activity_logs (user_id, date, hour, char_count, word_count, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, date, hour) DO UPDATE SET
        char_count = char_count + excluded.char_count,
        word_count = word_count + excluded.word_count,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, date, hour, charCount, wordCount);

    res.json({ success: true });
  } catch (error) {
    console.error('Record activity error:', error);
    res.status(500).json({ error: 'Failed to record activity' });
  }
}

export async function getTodayActivity(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    // Use date from client query param (client's local date)
    const today = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const activities = db.prepare(`
      SELECT hour, char_count, word_count
      FROM activity_logs
      WHERE user_id = ? AND date = ?
      ORDER BY hour
    `).all(userId, today) as Array<{ hour: number; char_count: number; word_count: number }>;

    // Build full 24-hour array
    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const activity = activities.find(a => a.hour === hour);
      return {
        hour,
        charCount: activity?.char_count || 0,
        wordCount: activity?.word_count || 0,
      };
    });

    // Calculate totals
    const totalChars = hourlyData.reduce((sum, h) => sum + h.charCount, 0);
    const totalWords = hourlyData.reduce((sum, h) => sum + h.wordCount, 0);

    res.json({
      date: today,
      hourly: hourlyData,
      totals: {
        charCount: totalChars,
        wordCount: totalWords,
      },
    });
  } catch (error) {
    console.error('Get today activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
}

export async function getActivityHistory(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const days = Math.min(parseInt(req.query.days as string) || 7, 30);
    // Use client's current date for proper week calculation
    const currentDate = (req.query.currentDate as string) || new Date().toISOString().split('T')[0];

    const activities = db.prepare(`
      SELECT date, SUM(char_count) as total_chars, SUM(word_count) as total_words
      FROM activity_logs
      WHERE user_id = ? AND date > date(?, '-' || ? || ' days') AND date <= date(?)
      GROUP BY date
      ORDER BY date DESC
    `).all(userId, currentDate, days, currentDate) as Array<{ date: string; total_chars: number; total_words: number }>;

    res.json(activities.map(a => ({
      date: a.date,
      charCount: a.total_chars,
      wordCount: a.total_words,
    })));
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({ error: 'Failed to get activity history' });
  }
}

export async function getStreak(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    // Use client's current date for accurate streak calculation
    const currentDate = (req.query.currentDate as string) || new Date().toISOString().split('T')[0];

    // Get all dates with activity, ordered by date descending
    const activities = db.prepare(`
      SELECT DISTINCT date
      FROM activity_logs
      WHERE user_id = ? AND date <= ?
      ORDER BY date DESC
      LIMIT 365
    `).all(userId, currentDate) as Array<{ date: string }>;

    if (activities.length === 0) {
      res.json({ currentStreak: 0, longestStreak: 0 });
      return;
    }

    // Calculate current streak
    let currentStreak = 0;
    const dates = activities.map(a => a.date);

    // Check if today or yesterday has activity (streak can continue from yesterday)
    const today = new Date(currentDate);
    const todayStr = currentDate;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let checkDate: Date;
    if (dates[0] === todayStr) {
      // Activity today, start counting from today
      checkDate = today;
      currentStreak = 1;
    } else if (dates[0] === yesterdayStr) {
      // No activity today but activity yesterday, streak still valid
      checkDate = yesterday;
      currentStreak = 1;
    } else {
      // No recent activity, streak is 0
      res.json({ currentStreak: 0 });
      return;
    }

    // Count consecutive days backwards
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(checkDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      if (dates[i] === prevDateStr) {
        currentStreak++;
        checkDate = prevDate;
      } else {
        break;
      }
    }

    res.json({ currentStreak });
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({ error: 'Failed to get streak' });
  }
}
