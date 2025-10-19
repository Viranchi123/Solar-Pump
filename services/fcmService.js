import { getMessaging } from '../config/firebase.js';
import DeviceToken from '../models/DeviceToken.js';
import { Op } from 'sequelize';

/**
 * FCM Service for sending push notifications
 */
class FCMService {
  /**
   * Send push notification to a specific user
   * @param {number} userId - User ID to send notification to
   * @param {object} notification - Notification object
   * @param {string} notification.title - Notification title
   * @param {string} notification.body - Notification body
   * @param {object} data - Additional data payload
   * @param {string} priority - Notification priority (high, normal)
   * @returns {Promise<object>} Result object with success counts
   */
  async sendToUser(userId, notification, data = {}, priority = 'high') {
    try {
      const messaging = getMessaging();
      if (!messaging) {
        console.warn('Firebase Messaging not initialized. Push notification skipped.');
        return { success: false, reason: 'Firebase not initialized' };
      }

      // Get all active device tokens for this user
      const deviceTokens = await DeviceToken.findAll({
        where: {
          user_id: userId,
          is_active: true
        }
      });

      if (deviceTokens.length === 0) {
        console.log(`No active device tokens found for user ${userId}`);
        return { success: true, sent: 0, failed: 0 };
      }

      const tokens = deviceTokens.map(dt => dt.device_token);
      
      // Prepare the message
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: {
          ...data,
          // Convert all data values to strings (FCM requirement)
          ...(data.notification_id && { notification_id: String(data.notification_id) }),
          ...(data.work_order_id && { work_order_id: String(data.work_order_id) }),
          ...(data.type && { type: String(data.type) }),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          priority: priority,
          notification: {
            sound: 'default',
            channelId: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Send to multiple devices
      const response = await messaging.sendEachForMulticast({
        tokens: tokens,
        ...message
      });

      console.log(`Push notification sent: ${response.successCount} succeeded, ${response.failureCount} failed`);

      // Handle failed tokens (invalid or expired)
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });

        // Mark failed tokens as inactive
        await this.deactivateTokens(failedTokens);
      }

      // Update last_used_at for successful tokens
      if (response.successCount > 0) {
        const successTokens = [];
        response.responses.forEach((resp, idx) => {
          if (resp.success) {
            successTokens.push(tokens[idx]);
          }
        });

        await DeviceToken.update(
          { last_used_at: new Date() },
          {
            where: {
              device_token: {
                [Op.in]: successTokens
              }
            }
          }
        );
      }

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount
      };

    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple users
   * @param {number[]} userIds - Array of user IDs
   * @param {object} notification - Notification object
   * @param {object} data - Additional data payload
   * @param {string} priority - Notification priority
   * @returns {Promise<object>} Result object with aggregated counts
   */
  async sendToMultipleUsers(userIds, notification, data = {}, priority = 'high') {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification, data, priority))
      );

      const aggregate = results.reduce((acc, result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          acc.sent += result.value.sent || 0;
          acc.failed += result.value.failed || 0;
        }
        return acc;
      }, { sent: 0, failed: 0 });

      return { success: true, ...aggregate };

    } catch (error) {
      console.error('Error sending push notifications to multiple users:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to all users with a specific role
   * @param {string} role - User role
   * @param {object} notification - Notification object
   * @param {object} data - Additional data payload
   * @param {string} priority - Notification priority
   * @returns {Promise<object>} Result object with aggregated counts
   */
  async sendToRole(role, notification, data = {}, priority = 'high') {
    try {
      const messaging = getMessaging();
      if (!messaging) {
        console.warn('Firebase Messaging not initialized. Push notification skipped.');
        return { success: false, reason: 'Firebase not initialized' };
      }

      // Get all active device tokens for users with this role
      const deviceTokens = await DeviceToken.findAll({
        where: {
          is_active: true
        },
        include: [{
          model: DeviceToken.associations.user.target,
          as: 'user',
          where: {
            role: role
          },
          attributes: ['id', 'role']
        }]
      });

      if (deviceTokens.length === 0) {
        console.log(`No active device tokens found for role ${role}`);
        return { success: true, sent: 0, failed: 0 };
      }

      const tokens = deviceTokens.map(dt => dt.device_token);

      // Prepare the message
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: {
          ...data,
          ...(data.notification_id && { notification_id: String(data.notification_id) }),
          ...(data.work_order_id && { work_order_id: String(data.work_order_id) }),
          ...(data.type && { type: String(data.type) }),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          priority: priority,
          notification: {
            sound: 'default',
            channelId: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Send in batches of 500 (FCM limit)
      const batchSize = 500;
      let totalSuccess = 0;
      let totalFailed = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          ...message
        });

        totalSuccess += response.successCount;
        totalFailed += response.failureCount;

        // Handle failed tokens
        if (response.failureCount > 0) {
          const failedTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              failedTokens.push(batch[idx]);
            }
          });
          await this.deactivateTokens(failedTokens);
        }

        // Update successful tokens
        if (response.successCount > 0) {
          const successTokens = [];
          response.responses.forEach((resp, idx) => {
            if (resp.success) {
              successTokens.push(batch[idx]);
            }
          });

          await DeviceToken.update(
            { last_used_at: new Date() },
            {
              where: {
                device_token: {
                  [Op.in]: successTokens
                }
              }
            }
          );
        }
      }

      console.log(`Push notifications sent to role ${role}: ${totalSuccess} succeeded, ${totalFailed} failed`);

      return {
        success: true,
        sent: totalSuccess,
        failed: totalFailed
      };

    } catch (error) {
      console.error('Error sending push notifications to role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register or update device token
   * @param {number} userId - User ID
   * @param {string} deviceToken - FCM device token
   * @param {string} platform - Device platform (ios/android/web)
   * @param {object} deviceInfo - Additional device information
   * @returns {Promise<object>} Created or updated device token
   */
  async registerDeviceToken(userId, deviceToken, platform = 'android', deviceInfo = {}) {
    try {
      const [token, created] = await DeviceToken.findOrCreate({
        where: { device_token: deviceToken },
        defaults: {
          user_id: userId,
          device_token: deviceToken,
          platform: platform,
          device_name: deviceInfo.device_name || null,
          app_version: deviceInfo.app_version || null,
          is_active: true,
          last_used_at: new Date()
        }
      });

      // If token exists but belongs to different user, update it
      if (!created && token.user_id !== userId) {
        await token.update({
          user_id: userId,
          platform: platform,
          device_name: deviceInfo.device_name || token.device_name,
          app_version: deviceInfo.app_version || token.app_version,
          is_active: true,
          last_used_at: new Date()
        });
      } else if (!created) {
        // Just update the last_used_at and ensure it's active
        await token.update({
          is_active: true,
          last_used_at: new Date(),
          device_name: deviceInfo.device_name || token.device_name,
          app_version: deviceInfo.app_version || token.app_version
        });
      }

      return token;

    } catch (error) {
      console.error('Error registering device token:', error);
      throw error;
    }
  }

  /**
   * Deactivate device tokens (mark as inactive)
   * @param {string[]} tokens - Array of device tokens to deactivate
   */
  async deactivateTokens(tokens) {
    try {
      if (tokens.length === 0) return;

      await DeviceToken.update(
        { is_active: false },
        {
          where: {
            device_token: {
              [Op.in]: tokens
            }
          }
        }
      );

      console.log(`Deactivated ${tokens.length} invalid device token(s)`);

    } catch (error) {
      console.error('Error deactivating tokens:', error);
    }
  }

  /**
   * Remove a device token
   * @param {number} userId - User ID
   * @param {string} deviceToken - Device token to remove
   */
  async removeDeviceToken(userId, deviceToken) {
    try {
      await DeviceToken.destroy({
        where: {
          user_id: userId,
          device_token: deviceToken
        }
      });

      console.log(`Device token removed for user ${userId}`);

    } catch (error) {
      console.error('Error removing device token:', error);
      throw error;
    }
  }

  /**
   * Get all device tokens for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of device tokens
   */
  async getUserDeviceTokens(userId) {
    try {
      return await DeviceToken.findAll({
        where: {
          user_id: userId
        },
        order: [['last_used_at', 'DESC']]
      });

    } catch (error) {
      console.error('Error fetching user device tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up old inactive device tokens
   * @param {number} daysOld - Remove tokens inactive for this many days
   * @returns {Promise<number>} Number of tokens removed
   */
  async cleanupOldTokens(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await DeviceToken.destroy({
        where: {
          is_active: false,
          last_used_at: {
            [Op.lt]: cutoffDate
          }
        }
      });

      console.log(`Cleaned up ${result} old device tokens`);
      return result;

    } catch (error) {
      console.error('Error cleaning up old tokens:', error);
      throw error;
    }
  }
}

export default new FCMService();

