import WorkOrderStage from '../models/WorkOrderStage.js';
import WorkOrder from '../models/WorkOrder.js';
import WorkOrderFactory from '../models/WorkOrderFactory.js';

// Get current stage of a work order
export const getCurrentStage = async (req, res) => {
  try {
    const { work_order_id } = req.params;

    // Check if work order exists
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found`
      });
    }

    // Get factory details to check remaining units
    const factoryDetails = await WorkOrderFactory.findOne({
      where: { work_order_id }
    });

    // Get current active stages (can be multiple when farmer and inspection are both active)
    const currentStages = await WorkOrderStage.findAll({
      where: { 
        work_order_id,
        status: 'in_progress'
      },
      order: [['stage_order', 'ASC']]
    });

    // Get the primary current stage (for backward compatibility)
    const currentStage = currentStages.length > 0 ? currentStages[currentStages.length - 1] : null;

    // Get all stages for this work order
    const allStages = await WorkOrderStage.findAll({
      where: { work_order_id },
      order: [['stage_order', 'ASC']]
    });

    // Get next pending stage
    const nextPendingStage = await WorkOrderStage.findOne({
      where: { 
        work_order_id,
        status: 'pending'
      },
      order: [['stage_order', 'ASC']]
    });

    // Get completed stages
    const completedStages = await WorkOrderStage.findAll({
      where: { 
        work_order_id,
        status: 'completed'
      },
      order: [['stage_order', 'ASC']]
    });

    // Get failed stages
    const failedStages = await WorkOrderStage.findAll({
      where: { 
        work_order_id,
        status: 'failed'
      },
      order: [['stage_order', 'ASC']]
    });

    // Prepare response data
    const responseData = {
      work_order_id: parseInt(work_order_id),
      work_order_number: workOrder.work_order_number,
      work_order_title: workOrder.title,
      current_stage: currentStage ? {
        stage_name: currentStage.stage_name,
        stage_order: currentStage.stage_order,
        status: currentStage.status,
        started_at: currentStage.started_at,
        assigned_to: currentStage.assigned_to,
        notes: currentStage.notes
      } : null,
      current_active_stages: currentStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        status: stage.status,
        started_at: stage.started_at,
        assigned_to: stage.assigned_to,
        notes: stage.notes
      })),
      next_pending_stage: nextPendingStage ? {
        stage_name: nextPendingStage.stage_name,
        stage_order: nextPendingStage.stage_order,
        status: nextPendingStage.status
      } : null,
      completed_stages: completedStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        completed_at: stage.completed_at,
        assigned_to: stage.assigned_to
      })),
      failed_stages: failedStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        error_message: stage.error_message,
        retry_count: stage.retry_count
      })),
      total_stages: allStages.length,
      completed_count: completedStages.length,
      failed_count: failedStages.length,
      progress_percentage: allStages.length > 0 ? Math.round((completedStages.length / allStages.length) * 100) : 0
    };

    // Add remaining units information if factory stage exists
    if (factoryDetails) {
      responseData.factory_status = {
        total_manufactured: factoryDetails.total_quantity_manufactured,
        total_dispatched: factoryDetails.total_quantity_to_jsr || 0,
        remaining_to_manufacture: {
          total: factoryDetails.total_quantity_remaining_to_manufacture || 0,
          hp_3: factoryDetails.hp_3_remaining_to_manufacture || 0,
          hp_5: factoryDetails.hp_5_remaining_to_manufacture || 0,
          hp_7_5: factoryDetails.hp_7_5_remaining_to_manufacture || 0
        },
        remaining_manufactured: {
          total: factoryDetails.total_quantity_remaining || 0,
          hp_3: factoryDetails.hp_3_remaining || 0,
          hp_5: factoryDetails.hp_5_remaining || 0,
          hp_7_5: factoryDetails.hp_7_5_remaining || 0
        },
        status: factoryDetails.status,
        all_units_complete: factoryDetails.status === 'all_units_dispatched'
      };
    }

    res.status(200).json({
      success: true,
      message: 'Work order stage information retrieved successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error getting work order current stage:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all stages of a work order with detailed information
export const getAllStages = async (req, res) => {
  try {
    const { work_order_id } = req.params;

    // Check if work order exists
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found`
      });
    }

    // Get all stages with detailed information
    const allStages = await WorkOrderStage.findAll({
      where: { work_order_id },
      order: [['stage_order', 'ASC']]
    });

    res.status(200).json({
      success: true,
      message: 'All work order stages retrieved successfully',
      data: {
        work_order_id: parseInt(work_order_id),
        work_order_number: workOrder.work_order_number,
        work_order_title: workOrder.title,
        stages: allStages.map(stage => ({
          id: stage.id,
          stage_name: stage.stage_name,
          stage_order: stage.stage_order,
          status: stage.status,
          started_at: stage.started_at,
          completed_at: stage.completed_at,
          assigned_to: stage.assigned_to,
          notes: stage.notes,
          error_message: stage.error_message,
          retry_count: stage.retry_count,
          max_retries: stage.max_retries,
          previous_stage_id: stage.previous_stage_id,
          next_stage_id: stage.next_stage_id,
          created_at: stage.createdAt,
          updated_at: stage.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error getting all work order stages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
