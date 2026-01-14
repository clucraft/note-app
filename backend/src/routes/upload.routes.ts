import { Router } from 'express';
import { upload, uploadVideo, uploadFile, uploadImage, getImage, uploadVideoHandler, uploadFileHandler } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Upload image (requires authentication, rate limited)
router.post('/', authenticate, uploadLimiter, upload.single('image'), uploadImage);

// Upload video (requires authentication, rate limited)
router.post('/video', authenticate, uploadLimiter, uploadVideo.single('video'), uploadVideoHandler);

// Upload any file (requires authentication, rate limited)
router.post('/file', authenticate, uploadLimiter, uploadFile.single('file'), uploadFileHandler);

// Get uploaded file (public - files can be viewed without auth)
router.get('/:filename', getImage);

export default router;
