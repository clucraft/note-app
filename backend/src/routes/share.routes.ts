import { Router } from 'express';
import {
  createShare,
  getShareInfo,
  deleteShare,
  getSharedNote,
  checkShareAccess,
  listUserShares
} from '../controllers/share.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes (no auth required)
router.get('/public/:token', checkShareAccess);
router.post('/public/:token', getSharedNote);

// Protected routes (require auth)
router.get('/list/all', authenticate, listUserShares);
router.post('/:id', authenticate, createShare);
router.get('/:id', authenticate, getShareInfo);
router.delete('/:id', authenticate, deleteShare);

export default router;
