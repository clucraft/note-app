import { Router } from 'express';
import authRoutes from './auth.routes.js';
import notesRoutes from './notes.routes.js';
import usersRoutes from './users.routes.js';
import shareRoutes from './share.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notes', notesRoutes);
router.use('/users', usersRoutes);
router.use('/share', shareRoutes);

export default router;
