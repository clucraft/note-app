import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { aiLimiter } from '../middleware/rateLimit.middleware.js';
import {
  getAISettings,
  updateAISettings,
  testAIConnection,
  summarizeSearch,
  expandText,
  aiChat,
} from '../controllers/ai.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Settings endpoints (no rate limit - just reading/updating settings)
router.get('/settings', getAISettings);
router.put('/settings', updateAISettings);
router.post('/test', testAIConnection);

// AI operation endpoints (rate limited - expensive operations)
router.post('/summarize', aiLimiter, summarizeSearch);
router.post('/expand', aiLimiter, expandText);
router.post('/chat', aiLimiter, aiChat);

export default router;
