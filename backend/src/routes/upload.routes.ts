import { Router } from 'express';
import { upload, uploadVideo, uploadFile, uploadImage, getImage, uploadVideoHandler, uploadFileHandler } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Upload image (requires authentication)
router.post('/', authenticate, upload.single('image'), uploadImage);

// Upload video (requires authentication)
router.post('/video', authenticate, uploadVideo.single('video'), uploadVideoHandler);

// Upload any file (requires authentication)
router.post('/file', authenticate, uploadFile.single('file'), uploadFileHandler);

// Get uploaded file (public - files can be viewed without auth)
router.get('/:filename', getImage);

export default router;
