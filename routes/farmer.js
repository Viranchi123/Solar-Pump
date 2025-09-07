import express from 'express';
import { receiveUnitsFromContractor, reportDefect, getAllDefectDetails, getFarmerPhoto } from '../controllers/farmerController.js';
import { farmerPhotoUpload, handleMulterError } from '../config/multer.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Step 1: Farmer receives units from contractor
router.post('/receive-units', receiveUnitsFromContractor);

// Step 2: Farmer reports defect (with photo uploads)
router.post('/report-defect', 
  farmerPhotoUpload.fields([
    { name: 'photo_1', maxCount: 1 },
    { name: 'photo_2', maxCount: 1 },
    { name: 'photo_3', maxCount: 1 }
  ]),
  handleMulterError,
  reportDefect
);

// Get all defect details submitted by farmers
router.get('/defect-details', getAllDefectDetails);

// Get farmer photo by filename
router.get('/photo/:filename', getFarmerPhoto);

export default router;
