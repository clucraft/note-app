import { Router } from 'express';
import { upload, uploadImage, getImage } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Upload image (requires authentication)
router.post('/', authenticate, upload.single('image'), uploadImage);

// Get image (public - images can be viewed without auth)
router.get('/:filename', getImage);

export default router;
