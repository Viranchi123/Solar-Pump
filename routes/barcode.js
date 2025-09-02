import express from 'express';
import { createBarcodeData, getBarcodeData, getBarcodeDataById } from '../controllers/barcodeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Create barcode data entry
router.post('/create', authenticateToken, createBarcodeData);

// Get all barcode data with pagination and filtering
router.get('/', authenticateToken, getBarcodeData);

// Get single barcode data entry by ID
router.get('/:id', authenticateToken, getBarcodeDataById);

export default router;
