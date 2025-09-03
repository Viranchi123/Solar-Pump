import express from 'express';
import { registerAdmin, loginAdmin, getAdminProfile, updateAdminProfile, loginAdminWithGoogle } from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Register admin (public route)
router.post('/register', registerAdmin);

// Login admin (public route)
router.post('/login', loginAdmin);
router.post('/login/google', loginAdminWithGoogle);

// Get admin profile (protected route)
router.get('/profile', authenticateToken, getAdminProfile);

// Update admin profile (protected route)
router.put('/profile', authenticateToken, updateAdminProfile);

export default router;
