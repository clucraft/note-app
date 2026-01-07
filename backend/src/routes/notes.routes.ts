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
  searchNotes,
  duplicateNote,
  getDeletedNotes,
  restoreNotes,
  permanentlyDeleteNotes,
  getAutoDeleteDays,
  updateAutoDeleteDays,
  emptyTrash
} from '../controllers/notes.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getNotesTree);
router.get('/search', searchNotes);
router.get('/trash', getDeletedNotes);
router.post('/trash/restore', restoreNotes);
router.post('/trash/permanent-delete', permanentlyDeleteNotes);
router.delete('/trash/empty', emptyTrash);
router.get('/trash/settings', getAutoDeleteDays);
router.put('/trash/settings', updateAutoDeleteDays);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.put('/:id/move', moveNote);
router.put('/:id/reorder', reorderNote);
router.put('/:id/toggle-expand', toggleExpand);
router.post('/:id/duplicate', duplicateNote);

export default router;
