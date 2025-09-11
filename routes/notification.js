import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotifications,
  getRoleNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  cleanupOldNotifications
} from '../controllers/notificationController.js';

const router = express.Router();

// Get notifications for authenticated user
router.get('/', authenticateToken, getNotifications);

// Get role-based notifications
router.get('/role', authenticateToken, getRoleNotifications);

// Get unread count
router.get('/unread-count', authenticateToken, getUnreadCount);

// Mark notification as read
router.put('/:id/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, markAllAsRead);

// Delete notification
router.delete('/:id', authenticateToken, deleteNotification);

// Clean up old notifications (admin only)
router.delete('/cleanup', authenticateToken, cleanupOldNotifications);

export default router;
