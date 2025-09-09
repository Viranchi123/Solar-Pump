import express from 'express';
import {
  loginWithPassword,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  getUserProfile,
  registerUser,
  updateUserPhoto,
  getUserProfilePhoto,
  getRoleFields,
  getUsersByRole,
  loginWithGoogle,
  getAllUsers,
  getAdminDashboard
} from '../controllers/userController.js';
import { authenticateToken, checkAnyRole } from '../middleware/auth.js';
import { generalPhotoUpload } from '../config/multer.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', registerUser);
router.post('/login', loginWithPassword);
router.post('/login/google', loginWithGoogle);
router.post('/send-forgot-password-otp', sendForgotPasswordOTP);
router.post('/verify-forgot-password-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);
router.get('/role-fields/:role', getRoleFields);
router.get('/role-users', getUsersByRole);
router.get('/all-users', authenticateToken, getAllUsers);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getUserProfile);
router.get('/profile-photo', authenticateToken, getUserProfilePhoto);
router.put('/update-photo', authenticateToken, generalPhotoUpload.single('photo'), updateUserPhoto);
router.get('/admin/dashboard', getAdminDashboard);


export default router;
