import { Router } from 'express';
import { register, login, refresh, logout, getMe, updateTheme, updatePreferences, updateProfile, updateCustomColors } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.put('/theme', authenticate, updateTheme);
router.put('/preferences', authenticate, updatePreferences);
router.put('/profile', authenticate, updateProfile);
router.put('/custom-colors', authenticate, updateCustomColors);

export default router;
