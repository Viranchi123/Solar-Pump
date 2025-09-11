import NotificationService from '../services/notificationService.js';
import { Op } from 'sequelize';

// Get notifications for authenticated user
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await NotificationService.getNotifications(userId, req.user.role, {
      limit: parseInt(limit),
      offset,
      unreadOnly: unread_only === 'true'
    });

    const totalCount = await NotificationService.getNotifications(userId, req.user.role, {
      unreadOnly: unread_only === 'true'
    }).then(notifications => notifications.length);

    const unreadCount = await NotificationService.getUnreadCount(userId, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: notifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data ? JSON.parse(notification.data) : null,
          priority: notification.priority,
          is_read: notification.is_read,
          read_at: notification.read_at,
          work_order: notification.workOrder ? {
            id: notification.workOrder.id,
            work_order_number: notification.workOrder.work_order_number,
            title: notification.workOrder.title,
            status: notification.workOrder.status
          } : null,
          created_at: notification.created_at,
          updated_at: notification.updated_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: page > 1
        },
        unread_count: unreadCount
      }
    });

  } catch (error) {
    console.error('Error retrieving notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get role-based notifications
export const getRoleNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const userRole = req.user.role;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await NotificationService.getRoleNotifications(userRole, {
      limit: parseInt(limit),
      offset,
      unreadOnly: unread_only === 'true'
    });

    const totalCount = await NotificationService.getRoleNotifications(userRole, {
      unreadOnly: unread_only === 'true'
    }).then(notifications => notifications.length);

    res.status(200).json({
      success: true,
      message: 'Role-based notifications retrieved successfully',
      data: {
        role: userRole,
        notifications: notifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data ? JSON.parse(notification.data) : null,
          priority: notification.priority,
          is_read: notification.is_read,
          read_at: notification.read_at,
          work_order: notification.workOrder ? {
            id: notification.workOrder.id,
            work_order_number: notification.workOrder.work_order_number,
            title: notification.workOrder.title,
            status: notification.workOrder.status
          } : null,
          created_at: notification.created_at,
          updated_at: notification.updated_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving role notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await NotificationService.markAsRead(parseInt(id), userId, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await NotificationService.markAllAsRead(userId, req.user.role);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await NotificationService.deleteNotification(parseInt(id), userId, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadCount = await NotificationService.getUnreadCount(userId, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: {
        unread_count: unreadCount
      }
    });

  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Clean up old notifications (admin only)
export const cleanupOldNotifications = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can perform this action'
      });
    }

    const deletedCount = await NotificationService.cleanupOldNotifications();

    res.status(200).json({
      success: true,
      message: 'Old notifications cleaned up successfully',
      data: {
        deleted_count: deletedCount
      }
    });

  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
