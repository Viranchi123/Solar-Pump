import express from 'express';
import { receiveAndVerifyUnits, approveOrRejectJSR, dispatchToWarehouse } from '../controllers/jsrController.js';
import { authenticateToken } from '../middleware/auth.js';
import { jsrPhotoUpload, handleMulterError } from '../config/multer.js';

const router = express.Router();

// Step 1: JSR receives and verifies units from factory
router.post('/receive-and-verify', authenticateToken, receiveAndVerifyUnits);

// Step 2: JSR approves or rejects the work order (with photo uploads)
router.post('/approve-or-reject', authenticateToken, jsrPhotoUpload.fields([
  { name: 'installation_site_photo', maxCount: 1 },
  { name: 'lineman_installation_set', maxCount: 1 },
  { name: 'set_close_up_photo', maxCount: 1 }
]), handleMulterError, approveOrRejectJSR);

// Step 3: JSR dispatches approved units to warehouse
router.post('/dispatch-to-warehouse', authenticateToken, dispatchToWarehouse);

export default router;
