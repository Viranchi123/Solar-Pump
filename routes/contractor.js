import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { receiveUnitsInContractor, dispatchToFarmerAndInspection } from '../controllers/contractorController.js';

const router = express.Router();

// Step 1: Contractor receives units from CP (units assigned to contractor)
router.post('/receive-units', authenticateToken, receiveUnitsInContractor);

// Step 2: Contractor dispatches units to farmer and inspection
router.post('/dispatch-to-farmer-and-inspection', authenticateToken, dispatchToFarmerAndInspection);

export default router;
