import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getTasks,
  getTasksByDate,
  getUpcomingTasks,
  getDueTasks,
  getTaskDates,
  createTask,
  updateTask,
  completeTask,
  snoozeTask,
  deleteTask
} from '../controllers/task.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all tasks
router.get('/', getTasks);

// Get upcoming tasks (next 3)
router.get('/upcoming', getUpcomingTasks);

// Get due tasks (for notification polling)
router.get('/due', getDueTasks);

// Get tasks for a specific date
router.get('/date/:date', getTasksByDate);

// Get dates with tasks for a month
router.get('/dates/:year/:month', getTaskDates);

// Create a new task
router.post('/', createTask);

// Update a task
router.put('/:taskId', updateTask);

// Complete/uncomplete a task
router.patch('/:taskId/complete', completeTask);

// Snooze a task
router.patch('/:taskId/snooze', snoozeTask);

// Delete a task
router.delete('/:taskId', deleteTask);

export default router;
