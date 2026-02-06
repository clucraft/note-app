import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { exportAllNotes } from '../controllers/export.controller.js';

const router = Router();

router.use(authenticate);

// GET /api/export/notes?format=markdown|html
router.get('/notes', exportAllNotes);

export default router;
