import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { importUpload, importDocmost } from '../controllers/import.controller.js';

const router = Router();

// All import routes require authentication
router.use(authenticate);

// POST /api/import/docmost - Import from Docmost export
router.post('/docmost', importUpload.array('files', 500), importDocmost);

export default router;
