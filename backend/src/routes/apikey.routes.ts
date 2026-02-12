import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  listApiKeys,
  createApiKey,
  deleteApiKey
} from '../controllers/apikey.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', deleteApiKey);

export default router;
