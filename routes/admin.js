import express from 'express';
import { registerAdmin, loginAdmin, getAdminProfile, updateAdminProfile, loginAdminWithGoogle, updateAdminPhoto, getAdminProfilePhoto, sendForgotPasswordOTP, verifyForgotPasswordOTP, resetPassword } from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';
import { generalPhotoUpload, handleMulterError } from '../config/multer.js';

// Custom middleware for optional photo upload
const optionalPhotoUpload = (req, res, next) => {
  generalPhotoUpload.single('photo')(req, res, (err) => {
    if (err) {
      // If it's an "Unexpected field" error, ignore it and continue
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next();
      }
      // For other errors, pass them to the error handler
      return handleMulterError(err, req, res, next);
    }
    next();
  });
};

const router = express.Router();

// Register admin (public route) - with optional photo upload
router.post('/register', optionalPhotoUpload, registerAdmin);

// Login admin (public route)
router.post('/login', loginAdmin);
router.post('/login/google', loginAdminWithGoogle);

// Forgot password routes (public routes)
router.post('/forgot-password', sendForgotPasswordOTP);
router.post('/verify-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);

// Get admin profile (protected route)
router.get('/profile', authenticateToken, getAdminProfile);

// Update admin profile (protected route)
router.put('/profile', authenticateToken, updateAdminProfile);

// Photo management routes (protected routes)
router.put('/photo', authenticateToken, generalPhotoUpload.single('photo'), handleMulterError, updateAdminPhoto);
router.get('/photo', authenticateToken, getAdminProfilePhoto);

export default router;
