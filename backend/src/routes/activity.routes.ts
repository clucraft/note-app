import { Router } from 'express';
import {
  recordActivity,
  getTodayActivity,
  getActivityHistory,
  getStreak,
} from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', recordActivity);
router.get('/today', getTodayActivity);
router.get('/history', getActivityHistory);
router.get('/streak', getStreak);

export default router;
