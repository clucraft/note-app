import { Router } from 'express';
import {
  getNotesTree,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  moveNote,
  reorderNote,
  toggleExpand,
  searchNotes
} from '../controllers/notes.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getNotesTree);
router.get('/search', searchNotes);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.put('/:id/move', moveNote);
router.put('/:id/reorder', reorderNote);
router.put('/:id/toggle-expand', toggleExpand);

export default router;
