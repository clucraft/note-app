import { Router } from 'express';
import authRoutes from './auth.routes.js';
import notesRoutes from './notes.routes.js';
import usersRoutes from './users.routes.js';
import shareRoutes from './share.routes.js';
import uploadRoutes from './upload.routes.js';
import aiRoutes from './ai.routes.js';
import activityRoutes from './activity.routes.js';
import twofaRoutes from './twofa.routes.js';
import taskRoutes from './task.routes.js';
import settingsRoutes from './settings.routes.js';
import importRoutes from './import.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notes', notesRoutes);
router.use('/users', usersRoutes);
router.use('/share', shareRoutes);
router.use('/upload', uploadRoutes);
router.use('/ai', aiRoutes);
router.use('/activity', activityRoutes);
router.use('/2fa', twofaRoutes);
router.use('/tasks', taskRoutes);
router.use('/settings', settingsRoutes);
router.use('/import', importRoutes);

export default router;
