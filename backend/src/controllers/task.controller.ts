import { Request, Response } from 'express';
import { db } from '../database/db.js';

// Get all tasks for user
export async function getTasks(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
      ORDER BY due_date, due_time
    `);
    const tasks = stmt.all(userId);

    res.json(tasks.map(transformTask));
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
}

// Get tasks for a specific date
export async function getTasksByDate(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { date } = req.params; // Format: YYYY-MM-DD

    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ? AND due_date = ?
      ORDER BY due_time
    `);
    const tasks = stmt.all(userId, date);

    res.json(tasks.map(transformTask));
  } catch (error) {
    console.error('Get tasks by date error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
}

// Get upcoming tasks (next 3 incomplete)
export async function getUpcomingTasks(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND completed = 0
        AND (due_date > ? OR (due_date = ? AND due_time >= ?))
      ORDER BY due_date, due_time
      LIMIT 3
    `);
    const tasks = stmt.all(userId, currentDate, currentDate, currentTime);

    res.json(tasks.map(transformTask));
  } catch (error) {
    console.error('Get upcoming tasks error:', error);
    res.status(500).json({ error: 'Failed to get upcoming tasks' });
  }
}

// Get due tasks (for notification polling)
export async function getDueTasks(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND completed = 0
        AND datetime(due_date || 'T' || due_time || ':00') <= datetime(?)
        AND (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime(?))
      ORDER BY due_date, due_time
    `);
    const tasks = stmt.all(userId, now, now);

    res.json(tasks.map(transformTask));
  } catch (error) {
    console.error('Get due tasks error:', error);
    res.status(500).json({ error: 'Failed to get due tasks' });
  }
}

// Get dates with tasks for a month (for calendar indicators)
export async function getTaskDates(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { year, month } = req.params;

    // Build date range for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;

    const stmt = db.prepare(`
      SELECT DISTINCT due_date,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_count
      FROM tasks
      WHERE user_id = ? AND due_date >= ? AND due_date <= ?
      GROUP BY due_date
    `);
    const dates = stmt.all(userId, startDate, endDate);

    res.json(dates.map((d: any) => ({
      date: d.due_date,
      pendingCount: d.pending_count,
      completedCount: d.completed_count
    })));
  } catch (error) {
    console.error('Get task dates error:', error);
    res.status(500).json({ error: 'Failed to get task dates' });
  }
}

// Create a new task
export async function createTask(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { taskId, noteId, description, dueDate, dueTime } = req.body;

    if (!taskId || !description || !dueDate || !dueTime) {
      res.status(400).json({ error: 'taskId, description, dueDate, and dueTime are required' });
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO tasks (user_id, note_id, task_id, description, due_date, due_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, noteId || null, taskId, description, dueDate, dueTime);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(transformTask(task));
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

// Update a task
export async function updateTask(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { taskId } = req.params;
    const { description, dueDate, dueTime } = req.body;

    // Check ownership
    const existing = db.prepare('SELECT * FROM tasks WHERE task_id = ? AND user_id = ?').get(taskId, userId);
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(dueDate);
    }
    if (dueTime !== undefined) {
      updates.push('due_time = ?');
      values.push(dueTime);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId, userId);

    const stmt = db.prepare(`
      UPDATE tasks SET ${updates.join(', ')} WHERE task_id = ? AND user_id = ?
    `);
    stmt.run(...values);

    const task = db.prepare('SELECT * FROM tasks WHERE task_id = ? AND user_id = ?').get(taskId, userId);
    res.json(transformTask(task));
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
}

// Complete a task
export async function completeTask(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { taskId } = req.params;
    const { completed } = req.body;

    const stmt = db.prepare(`
      UPDATE tasks
      SET completed = ?,
          completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
          snoozed_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = ? AND user_id = ?
    `);
    const result = stmt.run(completed ? 1 : 0, completed ? 1 : 0, taskId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = db.prepare('SELECT * FROM tasks WHERE task_id = ? AND user_id = ?').get(taskId, userId);
    res.json(transformTask(task));
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
}

// Snooze a task
export async function snoozeTask(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { taskId } = req.params;
    const { snoozeDuration } = req.body; // '5min', '1hr', '1day'

    let snoozeMinutes: number;
    switch (snoozeDuration) {
      case '5min':
        snoozeMinutes = 5;
        break;
      case '1hr':
        snoozeMinutes = 60;
        break;
      case '1day':
        snoozeMinutes = 24 * 60;
        break;
      default:
        res.status(400).json({ error: 'Invalid snooze duration' });
        return;
    }

    const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000).toISOString();

    const stmt = db.prepare(`
      UPDATE tasks
      SET snoozed_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE task_id = ? AND user_id = ?
    `);
    const result = stmt.run(snoozedUntil, taskId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = db.prepare('SELECT * FROM tasks WHERE task_id = ? AND user_id = ?').get(taskId, userId);
    res.json(transformTask(task));
  } catch (error) {
    console.error('Snooze task error:', error);
    res.status(500).json({ error: 'Failed to snooze task' });
  }
}

// Delete a task
export async function deleteTask(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const { taskId } = req.params;

    const stmt = db.prepare('DELETE FROM tasks WHERE task_id = ? AND user_id = ?');
    const result = stmt.run(taskId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
}

// Transform database row to API response
function transformTask(task: any) {
  if (!task) return null;
  return {
    id: task.id,
    taskId: task.task_id,
    noteId: task.note_id,
    description: task.description,
    dueDate: task.due_date,
    dueTime: task.due_time,
    completed: !!task.completed,
    completedAt: task.completed_at,
    snoozedUntil: task.snoozed_until,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}
