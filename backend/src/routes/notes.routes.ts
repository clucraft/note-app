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
  emptyTrash,
  reindexNotes,
  getIndexStatus,
  getNoteVersions,
  getNoteVersion,
  restoreNoteVersion
} from '../controllers/notes.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getNotesTree);
router.get('/search', searchNotes);
router.get('/index-status', getIndexStatus);
router.post('/reindex', reindexNotes);
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

// Version history routes
router.get('/:id/versions', getNoteVersions);
router.get('/:id/versions/:versionId', getNoteVersion);
router.post('/:id/versions/:versionId/restore', restoreNoteVersion);

export default router;
