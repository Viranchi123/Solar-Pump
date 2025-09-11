import Notification from '../models/Notification.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { Op } from 'sequelize';

// Socket.IO instance (will be set from server.js)
let io = null;

// Set Socket.IO instance
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Get Socket.IO instance
export const getSocketIO = () => io;

class NotificationService {
  /**
   * Create and send a notification
   * @param {Object} options - Notification options
   * @param {number|null} options.userId - Specific user ID (null for role-based)
   * @param {string} options.userRole - Target role
   * @param {string} options.type - Notification type
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {Object} options.data - Additional data
   * @param {number|null} options.workOrderId - Related work order ID
   * @param {string} options.priority - Priority level (low, medium, high, urgent)
   */
  static async createNotification({
    userId = null,
    userRole,
    type,
    title,
    message,
    data = null,
    workOrderId = null,
    priority = 'medium'
  }) {
    try {
      // Create notification in database
      const notification = await Notification.create({
        user_id: userId,
        user_role: userRole,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        work_order_id: workOrderId,
        priority,
        is_read: false
      });

      // Send real-time notification if Socket.IO is available
      if (io) {
        // Send to specific user if userId provided
        if (userId) {
          io.to(`user_${userId}`).emit('newNotification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: data,
            priority: notification.priority,
            created_at: notification.created_at,
            work_order_id: workOrderId
          });
        }

        // Send to role-based room
        io.to(`role_${userRole}`).emit('roleNotification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: data,
          priority: notification.priority,
          created_at: notification.created_at,
          work_order_id: workOrderId
        });

        // Send to admin room for all notifications
        if (userRole !== 'admin') {
          io.to('role_admin').emit('adminNotification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: data,
            priority: notification.priority,
            created_at: notification.created_at,
            work_order_id: workOrderId,
            target_role: userRole
          });
        }
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of notifications to return
   * @param {number} options.offset - Offset for pagination
   * @param {boolean} options.unreadOnly - Only return unread notifications
   */
  static async getNotifications(userId, userRole, options = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    // Get both user-specific and role-based notifications
    const whereClause = {
      [Op.or]: [
        { user_id: userId },
        { user_role: userRole, user_id: null }
      ]
    };
    
    if (unreadOnly) {
      whereClause.is_read = false;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      include: [
        {
          model: WorkOrder,
          as: 'workOrder',
          attributes: ['id', 'work_order_number', 'title', 'status']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return notifications;
  }

  /**
   * Get role-based notifications
   * @param {string} userRole - User role
   * @param {Object} options - Query options
   */
  static async getRoleNotifications(userRole, options = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const whereClause = { user_role: userRole };
    if (unreadOnly) {
      whereClause.is_read = false;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      include: [
        {
          model: WorkOrder,
          as: 'workOrder',
          attributes: ['id', 'work_order_number', 'title', 'status']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return notifications;
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for security)
   * @param {string} userRole - User role
   */
  static async markAsRead(notificationId, userId, userRole) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        [Op.or]: [
          { user_id: userId },
          { user_role: userRole, user_id: null }
        ]
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.update({
      is_read: true,
      read_at: new Date()
    });

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   * @param {number} userId - User ID
   * @param {string} userRole - User role
   */
  static async markAllAsRead(userId, userRole) {
    await Notification.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          [Op.or]: [
            { user_id: userId, is_read: false },
            { user_role: userRole, user_id: null, is_read: false }
          ]
        }
      }
    );
  }

  /**
   * Delete notification
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for security)
   * @param {string} userRole - User role
   */
  static async deleteNotification(notificationId, userId, userRole) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        [Op.or]: [
          { user_id: userId },
          { user_role: userRole, user_id: null }
        ]
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.destroy();
    return true;
  }

  /**
   * Get unread notification count for a user
   * @param {number} userId - User ID
   * @param {string} userRole - User role
   */
  static async getUnreadCount(userId, userRole) {
    return await Notification.count({
      where: {
        [Op.or]: [
          { user_id: userId, is_read: false },
          { user_role: userRole, user_id: null, is_read: false }
        ]
      }
    });
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await Notification.destroy({
      where: {
        created_at: {
          [Op.lt]: thirtyDaysAgo
        },
        is_read: true
      }
    });

    console.log(`Cleaned up ${deletedCount} old notifications`);
    return deletedCount;
  }
}

// Work Order specific notification methods
export const WorkOrderNotifications = {
  /**
   * Notify when work order is created
   */
  async workOrderCreated(workOrder, creator) {
    // Notify all admins
    await NotificationService.createNotification({
      userRole: 'admin',
      type: 'work_order_created',
      title: 'New Work Order Created',
      message: `Work order ${workOrder.work_order_number} has been created by ${creator?.name || 'Unknown'}`,
      data: {
        work_order_number: workOrder.work_order_number,
        title: workOrder.title,
        creator_name: creator?.name || 'Unknown',
        total_quantity: workOrder.total_quantity
      },
      workOrderId: workOrder.id,
      priority: 'high'
    });

    // Notify factory role that units are assigned
    await NotificationService.createNotification({
      userRole: 'factory',
      type: 'units_assigned',
      title: 'Units Assigned to Factory',
      message: `${workOrder.total_quantity} units have been assigned to factory for work order ${workOrder.work_order_number}`,
      data: {
        work_order_number: workOrder.work_order_number,
        total_quantity: workOrder.total_quantity,
        hp_3_quantity: workOrder.hp_3_quantity,
        hp_5_quantity: workOrder.hp_5_quantity,
        hp_7_5_quantity: workOrder.hp_7_5_quantity,
        timeline_days: workOrder.factory_timeline
      },
      workOrderId: workOrder.id,
      priority: 'high'
    });
  },

  /**
   * Notify when stage is completed
   */
  async stageCompleted(workOrder, completedStage, nextStage, actionUser) {
    // Notify next stage role
    if (nextStage) {
      await NotificationService.createNotification({
        userRole: nextStage,
        type: 'stage_ready',
        title: `Work Order Ready for ${nextStage.toUpperCase()}`,
        message: `Work order ${workOrder.work_order_number} is ready for ${nextStage} stage`,
        data: {
          work_order_number: workOrder.work_order_number,
          completed_stage: completedStage,
          next_stage: nextStage,
          action_user: actionUser?.name
        },
        workOrderId: workOrder.id,
        priority: 'high'
      });
    }

    // Notify admins
    await NotificationService.createNotification({
      userRole: 'admin',
      type: 'stage_completed',
      title: `Stage Completed: ${completedStage.toUpperCase()}`,
      message: `${completedStage.toUpperCase()} stage completed for work order ${workOrder.work_order_number}`,
      data: {
        work_order_number: workOrder.work_order_number,
        completed_stage: completedStage,
        next_stage: nextStage,
        action_user: actionUser?.name
      },
      workOrderId: workOrder.id,
      priority: 'medium'
    });
  },

  /**
   * Notify about deadline warnings
   */
  async deadlineWarning(workOrder, stageName, daysRemaining) {
    const priority = daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'high' : 'medium';
    
    await NotificationService.createNotification({
      userRole: stageName,
      type: 'deadline_warning',
      title: `Deadline Warning: ${daysRemaining} days remaining`,
      message: `Work order ${workOrder.work_order_number} has ${daysRemaining} days remaining for ${stageName} stage`,
      data: {
        work_order_number: workOrder.work_order_number,
        stage_name: stageName,
        days_remaining: daysRemaining,
        deadline_date: workOrder.deadline_date
      },
      workOrderId: workOrder.id,
      priority
    });

    // Also notify admins about deadline warnings
    await NotificationService.createNotification({
      userRole: 'admin',
      type: 'deadline_warning_admin',
      title: `Deadline Warning: ${workOrder.work_order_number}`,
      message: `${stageName.toUpperCase()} stage has ${daysRemaining} days remaining for work order ${workOrder.work_order_number}`,
      data: {
        work_order_number: workOrder.work_order_number,
        stage_name: stageName,
        days_remaining: daysRemaining,
        target_role: stageName
      },
      workOrderId: workOrder.id,
      priority
    });
  },

  /**
   * Notify about units not dispatched
   */
  async unitsNotDispatched(workOrder, stageName, remainingUnits) {
    await NotificationService.createNotification({
      userRole: stageName,
      type: 'units_not_dispatched',
      title: 'Units Not Dispatched',
      message: `${remainingUnits} units are still pending dispatch for work order ${workOrder.work_order_number}`,
      data: {
        work_order_number: workOrder.work_order_number,
        stage_name: stageName,
        remaining_units: remainingUnits
      },
      workOrderId: workOrder.id,
      priority: 'high'
    });
  }
};

export default NotificationService;
