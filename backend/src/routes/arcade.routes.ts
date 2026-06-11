import { Router } from 'express';
import {
  getScores,
  postScore,
  validateShare,
  getShareStatus,
  enableShare,
  disableShare,
} from '../controllers/arcade.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { shareAccessLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Public-ish routes — access enforced inside via share token or JWT
router.get('/validate', shareAccessLimiter, validateShare);
router.get('/scores', getScores);
router.post('/scores', shareAccessLimiter, postScore);

// Share management (require auth)
router.get('/share', authenticate, getShareStatus);
router.post('/share', authenticate, enableShare);
router.delete('/share', authenticate, disableShare);

export default router;
