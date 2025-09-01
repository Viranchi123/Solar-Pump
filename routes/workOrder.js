import express from 'express';
import { createWorkOrder, getWorkOrdersWithApprovalStatus, getWorkOrderWithApprovalStatus, getAllWorkOrders } from '../controllers/workOrderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { farmerListUpload, handleMulterError } from '../config/multer.js';

const router = express.Router();

// Create work order (Admin only) - with Excel file upload
router.post('/create', authenticateToken, farmerListUpload.single('farmer_list_file'), handleMulterError, createWorkOrder);

// Get all work orders (simple list)
router.get('/', authenticateToken, getAllWorkOrders);

// Get all work orders with approval status (with filtering and pagination)
router.get('/approval-status', authenticateToken, getWorkOrdersWithApprovalStatus);

// Get single work order with approval status
router.get('/approval-status/:id', authenticateToken, getWorkOrderWithApprovalStatus);

// Alternative route for easier filtering by approval status
router.get('/status/:status', authenticateToken, getWorkOrdersWithApprovalStatus);

export default router;
