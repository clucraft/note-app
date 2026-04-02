import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getConfig,
  updateConfig,
  saveOAuthClientCredentials,
  disconnectGdrive,
  getOAuthUrl,
  oauthCallback,
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

// OAuth callback must be before auth middleware (Google redirects here)
router.get('/oauth2/callback', oauthCallback);

// All remaining routes require admin
router.use(authenticate, requireAdmin);

router.get('/config', getConfig);
router.put('/config', updateConfig);
router.put('/oauth-credentials', saveOAuthClientCredentials);
router.delete('/oauth-credentials', disconnectGdrive);
router.post('/oauth-url', getOAuthUrl);
router.post('/test-connection', testConnection);
router.post('/trigger', triggerBackup);
router.get('/list', listBackupsHandler);
router.post('/download/:fileId', downloadBackupHandler);
router.post('/restore/:fileId', restoreFromDrive);
router.post('/restore-upload', upload.single('file'), restoreFromUpload);

export default router;
