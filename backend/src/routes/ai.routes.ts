import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
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

// Settings endpoints
router.get('/settings', getAISettings);
router.put('/settings', updateAISettings);
router.post('/test', testAIConnection);

// AI operation endpoints
router.post('/summarize', summarizeSearch);
router.post('/expand', expandText);
router.post('/chat', aiChat);

export default router;
