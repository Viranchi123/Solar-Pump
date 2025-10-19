import NotificationService from '../services/notificationService.js';
import FCMService from '../services/fcmService.js';
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

// Register device token for push notifications
export const registerDevice = async (req, res) => {
  try {
    const { device_token, platform, device_name, app_version } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!device_token) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    if (platform && !['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Must be ios, android, or web'
      });
    }

    // Register device token
    const deviceTokenRecord = await FCMService.registerDeviceToken(
      userId,
      device_token,
      platform || 'android',
      {
        device_name,
        app_version
      }
    );

    res.status(200).json({
      success: true,
      message: 'Device registered successfully for push notifications',
      data: {
        id: deviceTokenRecord.id,
        platform: deviceTokenRecord.platform,
        device_name: deviceTokenRecord.device_name,
        is_active: deviceTokenRecord.is_active,
        created_at: deviceTokenRecord.created_at
      }
    });

  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unregister device token
export const unregisterDevice = async (req, res) => {
  try {
    const { device_token } = req.body;
    const userId = req.user.id;

    if (!device_token) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    await FCMService.removeDeviceToken(userId, device_token);

    res.status(200).json({
      success: true,
      message: 'Device unregistered successfully'
    });

  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's registered devices
export const getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id;

    const devices = await FCMService.getUserDeviceTokens(userId);

    res.status(200).json({
      success: true,
      message: 'Devices retrieved successfully',
      data: {
        devices: devices.map(device => ({
          id: device.id,
          platform: device.platform,
          device_name: device.device_name,
          app_version: device.app_version,
          is_active: device.is_active,
          last_used_at: device.last_used_at,
          created_at: device.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Error getting user devices:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Test push notification (for testing purposes)
export const testPushNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, message } = req.body;

    const notification = {
      title: title || 'Test Notification',
      body: message || 'This is a test push notification'
    };

    const data = {
      type: 'test',
      timestamp: new Date().toISOString()
    };

    const result = await FCMService.sendToUser(userId, notification, data, 'high');

    res.status(200).json({
      success: true,
      message: 'Test notification sent',
      data: result
    });

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
