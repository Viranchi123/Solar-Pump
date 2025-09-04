import express from 'express';
import { addRemark, editRemark, listRemarks } from '../controllers/remarkController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Add a new remark
router.post('/add', addRemark);

// Edit an existing remark
router.put('/edit', editRemark);

// List remarks (with optional filters)
router.get('/list', listRemarks);

export default router;

