import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { receiveUnitsInWarehouse, dispatchToCP } from '../controllers/warehouseController.js';

const router = express.Router();

// Step 1: Warehouse receives units from JSR (units in warehouse)
router.post('/receive-units', authenticateToken, receiveUnitsInWarehouse);

// Step 2: Warehouse dispatches units to CP
router.post('/dispatch-to-cp', authenticateToken, dispatchToCP);

export default router;
