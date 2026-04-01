import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getConfig,
  updateConfig,
  uploadGdriveKey,
  deleteGdriveKey,
  testConnection,
  triggerBackup,
  listBackupsHandler,
  downloadBackupHandler,
  restoreFromDrive,
  restoreFromUpload,
} from '../controllers/backup.controller.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// All routes require admin
router.use(authenticate, requireAdmin);

router.get('/config', getConfig);
router.put('/config', updateConfig);
router.put('/gdrive-key', uploadGdriveKey);
router.delete('/gdrive-key', deleteGdriveKey);
router.post('/test-connection', testConnection);
router.post('/trigger', triggerBackup);
router.get('/list', listBackupsHandler);
router.post('/download/:fileId', downloadBackupHandler);
router.post('/restore/:fileId', restoreFromDrive);
router.post('/restore-upload', upload.single('file'), restoreFromUpload);

export default router;
