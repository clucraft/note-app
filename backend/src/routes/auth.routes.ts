import { Router } from 'express';
import { register, login, refresh, logout, getMe, updateTheme } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.put('/theme', authenticate, updateTheme);

export default router;
