import express from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGoogleUserInfo,
  linkGoogleAccount,
  unlinkGoogleAccount
} from '../controllers/googleAuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/auth-url', getGoogleAuthUrl);
router.get('/callback', handleGoogleCallback);
router.post('/user-info', getGoogleUserInfo);

// Protected routes (require authentication)
router.post('/link', authenticateToken, linkGoogleAccount);
router.post('/unlink', authenticateToken, unlinkGoogleAccount);

export default router;

