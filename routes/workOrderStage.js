import express from 'express';
import { getCurrentStage, getAllStages } from '../controllers/workOrderStageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current stage and progress of a work order
router.get('/current/:work_order_id', authenticateToken, getCurrentStage);

// Get all stages of a work order
router.get('/all/:work_order_id', authenticateToken, getAllStages);

export default router;
