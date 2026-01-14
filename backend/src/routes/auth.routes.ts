import { Router } from 'express';
import { register, login, refresh, logout, getMe, updateTheme, updatePreferences, updateProfile, updateCustomColors } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.put('/theme', authenticate, updateTheme);
router.put('/preferences', authenticate, updatePreferences);
router.put('/profile', authenticate, updateProfile);
router.put('/custom-colors', authenticate, updateCustomColors);

export default router;
