import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getTwoFAStatus,
  setupTwoFA,
  enableTwoFA,
  disableTwoFA,
  adminDisableTwoFA
} from '../controllers/twofa.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/2fa/status - Get 2FA status
router.get('/status', getTwoFAStatus);

// POST /api/2fa/setup - Generate QR code and secret for setup
router.post('/setup', setupTwoFA);

// POST /api/2fa/enable - Verify code and enable 2FA
router.post('/enable', enableTwoFA);

// POST /api/2fa/disable - Disable 2FA
router.post('/disable', disableTwoFA);

// POST /api/2fa/admin/disable/:userId - Admin disable 2FA for any user
router.post('/admin/disable/:userId', adminDisableTwoFA);

export default router;
