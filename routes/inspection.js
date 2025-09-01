import express from 'express';
import { 
  receiveAndVerifyUnits, 
  acceptOrRejectInspection 
} from '../controllers/inspectionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload, handleMulterError } from '../config/multer.js';

const router = express.Router();

// Step 1: Receive and verify units for inspection
router.post('/receive-units', authenticateToken, receiveAndVerifyUnits);

// Step 2: Accept or reject inspection with photos
router.post('/accept-reject', authenticateToken, upload.fields([
  { name: 'installation_site_photo', maxCount: 1 },
  { name: 'lineman_installation_set', maxCount: 1 },
  { name: 'set_close_up_photo', maxCount: 1 }
]), handleMulterError, acceptOrRejectInspection);

export default router;
