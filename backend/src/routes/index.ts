import { Router } from 'express';
import authRoutes from './auth.routes.js';
import notesRoutes from './notes.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notes', notesRoutes);
router.use('/users', usersRoutes);

export default router;
