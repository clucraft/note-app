import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getRegistrationStatus,
  getSystemSettings,
  updateSystemSetting
} from '../controllers/settings.controller.js';

const router = Router();

// Public route - needed for login page to know if registration is available
router.get('/registration-status', getRegistrationStatus);

// Admin-only routes
router.get('/', authenticate, requireAdmin, getSystemSettings);
router.put('/', authenticate, requireAdmin, updateSystemSetting);

export default router;
