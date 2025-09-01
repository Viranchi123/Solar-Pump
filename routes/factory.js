import express from 'express';
import { enterManufacturedUnits, dispatchToJSR } from '../controllers/factoryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Step 1: Enter units manufactured quantities
router.post('/enter-manufactured-units', authenticateToken, enterManufacturedUnits);

// Step 2: Dispatch units to JSR for verification
router.post('/dispatch-to-jsr', authenticateToken, dispatchToJSR);

export default router;
