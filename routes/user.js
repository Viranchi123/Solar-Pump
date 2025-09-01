import express from 'express';
import {
  loginWithPassword,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  getUserProfile,
  registerUser,
  updateUserPhoto,
  getRoleFields
} from '../controllers/userController.js';
import { authenticateToken, checkAnyRole } from '../middleware/auth.js';
import { generalPhotoUpload } from '../config/multer.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', registerUser);
router.post('/login', loginWithPassword);
router.post('/send-forgot-password-otp', sendForgotPasswordOTP);
router.post('/verify-forgot-password-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);
router.get('/role-fields/:role', getRoleFields);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getUserProfile);
router.put('/update-photo', authenticateToken, generalPhotoUpload.single('photo'), updateUserPhoto);

export default router;
