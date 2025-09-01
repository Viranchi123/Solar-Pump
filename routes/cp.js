import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { receiveUnitsInCP, dispatchToContractor } from '../controllers/cpController.js';

const router = express.Router();

// Step 1: CP receives units from warehouse (units assigned to contractor)
router.post('/receive-units', authenticateToken, receiveUnitsInCP);

// Step 2: CP dispatches units to contractor
router.post('/dispatch-to-contractor', authenticateToken, dispatchToContractor);

export default router;
