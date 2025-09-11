import cron from 'node-cron';
import WorkOrder from '../models/WorkOrder.js';
import { WorkOrderNotifications } from './notificationService.js';
import { Op } from 'sequelize';

class DeadlineMonitorService {
  static isRunning = false;

  /**
   * Start the deadline monitoring service
   */
  static start() {
    if (this.isRunning) {
      console.log('Deadline monitoring service is already running');
      return;
    }

    // Check for approaching deadlines every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Checking for approaching deadlines...');
      await this.checkApproachingDeadlines();
    });

    // Check for units not dispatched daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Checking for units not dispatched...');
      await this.checkUnitsNotDispatched();
    });

    // Clean up old notifications daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Cleaning up old notifications...');
      await this.cleanupOldNotifications();
    });

    this.isRunning = true;
    console.log('✅ Deadline monitoring service started');
  }

  /**
   * Check for approaching deadlines
   */
  static async checkApproachingDeadlines() {
    try {
      const workOrders = await WorkOrder.findAll({
        where: {
          status: {
            [Op.in]: ['created', 'in_progress']
          }
        }
      });

      for (const workOrder of workOrders) {
        await this.checkWorkOrderDeadlines(workOrder);
      }
    } catch (error) {
      console.error('Error checking approaching deadlines:', error);
    }
  }

  /**
   * Check deadlines for a specific work order
   */
  static async checkWorkOrderDeadlines(workOrder) {
    const stages = ['factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection'];
    
    for (const stage of stages) {
      const deadlineInfo = this.calculateStageDeadline(stage, workOrder);
      
      if (deadlineInfo.daysRemaining <= 3 && deadlineInfo.daysRemaining > 0) {
        // Send deadline warning
        try {
          await WorkOrderNotifications.deadlineWarning(
            workOrder,
            stage,
            deadlineInfo.daysRemaining
          );
        } catch (error) {
          console.error(`Error sending deadline warning for ${stage}:`, error);
        }
      }
    }
  }

  /**
   * Calculate stage deadline (same logic as in controllers)
   */
  static calculateStageDeadline(stageName, workOrder) {
    // Use creation date if start_date is in the past (more than 30 days ago)
    const startDate = new Date(workOrder.start_date);
    const creationDate = new Date(workOrder.createdAt);
    const now = new Date();
    const daysSinceStart = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // If start_date is more than 30 days in the past, use creation date instead
    const effectiveStartDate = daysSinceStart > 30 ? creationDate : startDate;
    
    let stageStartDays = 0;
    let stageTimelineDays = 0;

    switch (stageName.toLowerCase()) {
      case 'factory':
        stageStartDays = 0;
        stageTimelineDays = workOrder.factory_timeline || 0;
        break;
      case 'jsr':
        stageStartDays = workOrder.factory_timeline || 0;
        stageTimelineDays = workOrder.jsr_timeline || 0;
        break;
      case 'whouse':
        stageStartDays = (workOrder.factory_timeline || 0) + (workOrder.jsr_timeline || 0);
        stageTimelineDays = workOrder.whouse_timeline || 0;
        break;
      case 'cp':
        stageStartDays = (workOrder.factory_timeline || 0) + (workOrder.jsr_timeline || 0) + (workOrder.whouse_timeline || 0);
        stageTimelineDays = workOrder.cp_timeline || 0;
        break;
      case 'contractor':
        stageStartDays = (workOrder.factory_timeline || 0) + (workOrder.jsr_timeline || 0) + (workOrder.whouse_timeline || 0) + (workOrder.cp_timeline || 0);
        stageTimelineDays = workOrder.contractor_timeline || 0;
        break;
      case 'farmer':
        stageStartDays = (workOrder.factory_timeline || 0) + (workOrder.jsr_timeline || 0) + (workOrder.whouse_timeline || 0) + (workOrder.cp_timeline || 0) + (workOrder.contractor_timeline || 0);
        stageTimelineDays = workOrder.farmer_timeline || 0;
        break;
      case 'inspection':
        stageStartDays = (workOrder.factory_timeline || 0) + (workOrder.jsr_timeline || 0) + (workOrder.whouse_timeline || 0) + (workOrder.cp_timeline || 0) + (workOrder.contractor_timeline || 0) + (workOrder.farmer_timeline || 0);
        stageTimelineDays = workOrder.inspection_timeline || 0;
        break;
      default:
        stageStartDays = 0;
        stageTimelineDays = 0;
    }

    // Calculate stage start date and deadline
    const stageStartDate = new Date(effectiveStartDate);
    stageStartDate.setDate(effectiveStartDate.getDate() + stageStartDays);
    
    const deadlineDate = new Date(stageStartDate);
    deadlineDate.setDate(stageStartDate.getDate() + stageTimelineDays);
    
    // Calculate days remaining
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    return {
      stageStartDate,
      deadlineDate,
      daysRemaining: Math.max(0, daysRemaining),
      isOverdue: now > deadlineDate
    };
  }

  /**
   * Check for units not dispatched
   */
  static async checkUnitsNotDispatched() {
    try {
      const workOrders = await WorkOrder.findAll({
        where: {
          status: {
            [Op.in]: ['created', 'in_progress']
          }
        },
        include: [
          {
            model: require('../models/WorkOrderFactory.js'),
            as: 'factoryDetails',
            required: false
          },
          {
            model: require('../models/WorkOrderJSR.js'),
            as: 'jsrDetails',
            required: false
          },
          {
            model: require('../models/WorkOrderWarehouse.js'),
            as: 'warehouseDetails',
            required: false
          },
          {
            model: require('../models/WorkOrderCP.js'),
            as: 'cpDetails',
            required: false
          },
          {
            model: require('../models/WorkOrderContractor.js'),
            as: 'contractorDetails',
            required: false
          }
        ]
      });

      for (const workOrder of workOrders) {
        await this.checkWorkOrderUnitsNotDispatched(workOrder);
      }
    } catch (error) {
      console.error('Error checking units not dispatched:', error);
    }
  }

  /**
   * Check units not dispatched for a specific work order
   */
  static async checkWorkOrderUnitsNotDispatched(workOrder) {
    // Check factory units not dispatched
    if (workOrder.factoryDetails) {
      const remaining = workOrder.factoryDetails.total_quantity_remaining || 0;
      if (remaining > 0) {
        try {
          await WorkOrderNotifications.unitsNotDispatched(workOrder, 'factory', remaining);
        } catch (error) {
          console.error('Error sending units not dispatched notification for factory:', error);
        }
      }
    }

    // Check JSR units not dispatched
    if (workOrder.jsrDetails) {
      const received = workOrder.jsrDetails.total_quantity_received || 0;
      const dispatched = workOrder.jsrDetails.total_quantity_to_warehouse || 0;
      const remaining = received - dispatched;
      if (remaining > 0) {
        try {
          await WorkOrderNotifications.unitsNotDispatched(workOrder, 'jsr', remaining);
        } catch (error) {
          console.error('Error sending units not dispatched notification for jsr:', error);
        }
      }
    }

    // Check warehouse units not dispatched
    if (workOrder.warehouseDetails) {
      const received = workOrder.warehouseDetails.total_quantity_in_warehouse || 0;
      const dispatched = workOrder.warehouseDetails.total_quantity_to_cp || 0;
      const remaining = received - dispatched;
      if (remaining > 0) {
        try {
          await WorkOrderNotifications.unitsNotDispatched(workOrder, 'whouse', remaining);
        } catch (error) {
          console.error('Error sending units not dispatched notification for warehouse:', error);
        }
      }
    }

    // Check CP units not dispatched
    if (workOrder.cpDetails) {
      const received = workOrder.cpDetails.total_quantity_to_cp || 0;
      const dispatched = workOrder.cpDetails.total_quantity_assigned || 0;
      const remaining = received - dispatched;
      if (remaining > 0) {
        try {
          await WorkOrderNotifications.unitsNotDispatched(workOrder, 'cp', remaining);
        } catch (error) {
          console.error('Error sending units not dispatched notification for cp:', error);
        }
      }
    }

    // Check contractor units not dispatched
    if (workOrder.contractorDetails) {
      const received = workOrder.contractorDetails.total_quantity_to_contractor || 0;
      const dispatched = workOrder.contractorDetails.total_quantity_assigned || 0;
      const remaining = received - dispatched;
      if (remaining > 0) {
        try {
          await WorkOrderNotifications.unitsNotDispatched(workOrder, 'contractor', remaining);
        } catch (error) {
          console.error('Error sending units not dispatched notification for contractor:', error);
        }
      }
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications() {
    try {
      const { NotificationService } = await import('./notificationService.js');
      await NotificationService.cleanupOldNotifications();
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  /**
   * Stop the deadline monitoring service
   */
  static stop() {
    this.isRunning = false;
    console.log('Deadline monitoring service stopped');
  }
}

export default DeadlineMonitorService;
