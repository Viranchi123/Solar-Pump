import WorkOrderStage from '../models/WorkOrderStage.js';
import WorkOrder from '../models/WorkOrder.js';
import WorkOrderFactory from '../models/WorkOrderFactory.js';
import WorkOrderJSR from '../models/WorkOrderJSR.js';
import WorkOrderWarehouse from '../models/WorkOrderWarehouse.js';
import WorkOrderCP from '../models/WorkOrderCP.js';
import WorkOrderContractor from '../models/WorkOrderContractor.js';
import WorkOrderFarmer from '../models/WorkOrderFarmer.js';

// Helper function to calculate deadline date for each stage
const getStageDeadline = (stageName, workOrder) => {
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
    case 'admin_created':
      stageStartDays = 0;
      stageTimelineDays = 0;
      break;
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

  // Calculate stage start date and deadline using effective start date
  const stageStartDate = new Date(effectiveStartDate);
  stageStartDate.setDate(effectiveStartDate.getDate() + stageStartDays);
  
  const deadlineDate = new Date(stageStartDate);
  deadlineDate.setDate(stageStartDate.getDate() + stageTimelineDays);
  
  // Calculate days remaining more accurately
  const timeDiff = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  // Debug logging
  console.log(`Stage: ${stageName}`);
  console.log(`Original Start Date: ${startDate.toISOString()}`);
  console.log(`Creation Date: ${creationDate.toISOString()}`);
  console.log(`Effective Start Date: ${effectiveStartDate.toISOString()}`);
  console.log(`Stage Start Date: ${stageStartDate.toISOString()}`);
  console.log(`Deadline Date: ${deadlineDate.toISOString()}`);
  console.log(`Current Date: ${now.toISOString()}`);
  console.log(`Time Diff (ms): ${timeDiff}`);
  console.log(`Days Remaining (raw): ${daysRemaining}`);
  console.log(`Days Remaining (max 0): ${Math.max(0, daysRemaining)}`);
  
  return {
    stage_start_date: stageStartDate.toISOString(),
    deadline_date: deadlineDate.toISOString(),
    timeline_days: stageTimelineDays,
    days_remaining: Math.max(0, daysRemaining),
    is_overdue: now > deadlineDate
  };
};

// Helper function to get HP details for each stage
const getStageHPDetails = (stageName, stageStatus, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails) => {
  const totalQuantity = workOrder.total_quantity;
  const hp3Total = workOrder.hp_3_quantity;
  const hp5Total = workOrder.hp_5_quantity;
  const hp7_5Total = workOrder.hp_7_5_quantity;

  // Helper function to get done values based on stage status
  const getDoneValues = (totalDone, hp3Done, hp5Done, hp7_5Done) => {
    if (stageStatus === 'completed') {
      return {
        total: { done: totalDone, total: totalQuantity },
        hp_3: { done: hp3Done, total: hp3Total },
        hp_5: { done: hp5Done, total: hp5Total },
        hp_7_5: { done: hp7_5Done, total: hp7_5Total }
      };
    } else {
      // For pending or in_progress stages, show 0 done
      return {
        total: { done: 0, total: totalQuantity },
        hp_3: { done: 0, total: hp3Total },
        hp_5: { done: 0, total: hp5Total },
        hp_7_5: { done: 0, total: hp7_5Total }
      };
    }
  };

  switch (stageName.toLowerCase()) {
    case 'admin_created':
      return getDoneValues(0, 0, 0, 0);

    case 'factory':
      if (factoryDetails) {
        return getDoneValues(
          factoryDetails.total_quantity_manufactured || 0,
          factoryDetails.hp_3_manufactured || 0,
          factoryDetails.hp_5_manufactured || 0,
          factoryDetails.hp_7_5_manufactured || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'jsr':
      if (jsrDetails) {
        // JSR stage shows what was received and verified
        return getDoneValues(
          jsrDetails.total_quantity_received || 0,
          jsrDetails.hp_3_received || 0,
          jsrDetails.hp_5_received || 0,
          jsrDetails.hp_7_5_received || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'whouse':
      if (warehouseDetails) {
        // Warehouse stage shows what was received in warehouse
        return getDoneValues(
          warehouseDetails.total_quantity_in_warehouse || 0,
          warehouseDetails.hp_3_in_warehouse || 0,
          warehouseDetails.hp_5_in_warehouse || 0,
          warehouseDetails.hp_7_5_in_warehouse || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'cp':
      if (cpDetails) {
        // CP stage shows what was forwarded by CP
        return getDoneValues(
          cpDetails.total_quantity_to_cp || 0,
          cpDetails.hp_3_forwarded_by_cp || 0,
          cpDetails.hp_5_forwarded_by_cp || 0,
          cpDetails.hp_7_5_forwarded_by_cp || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'contractor':
      if (contractorDetails) {
        // Contractor stage shows what was forwarded by contractor
        return getDoneValues(
          contractorDetails.total_quantity_to_contractor || 0,
          contractorDetails.hp_3_forwarded_by_contractor || 0,
          contractorDetails.hp_5_forwarded_by_contractor || 0,
          contractorDetails.hp_7_5_forwarded_by_contractor || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'farmer':
      if (farmerDetails) {
        // Farmer stage shows what was received by farmer
        return getDoneValues(
          farmerDetails.total_quantity_received || 0,
          farmerDetails.hp_3_received || 0,
          farmerDetails.hp_5_received || 0,
          farmerDetails.hp_7_5_received || 0
        );
      }
      return getDoneValues(0, 0, 0, 0);

    case 'inspection':
      // Inspection stage doesn't have HP tracking, show 0
      return getDoneValues(0, 0, 0, 0);

    default:
      return getDoneValues(0, 0, 0, 0);
  }
};

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

    // Get all stage details for HP tracking
    const factoryDetails = await WorkOrderFactory.findOne({
      where: { work_order_id }
    });

    const jsrDetails = await WorkOrderJSR.findOne({
      where: { work_order_id }
    });

    const warehouseDetails = await WorkOrderWarehouse.findOne({
      where: { work_order_id }
    });

    const cpDetails = await WorkOrderCP.findOne({
      where: { work_order_id }
    });

    const contractorDetails = await WorkOrderContractor.findOne({
      where: { work_order_id }
    });

    const farmerDetails = await WorkOrderFarmer.findOne({
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
        notes: currentStage.notes,
        hp_details: getStageHPDetails(currentStage.stage_name, currentStage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(currentStage.stage_name, workOrder)
      } : null,
      current_active_stages: currentStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        status: stage.status,
        started_at: stage.started_at,
        assigned_to: stage.assigned_to,
        notes: stage.notes,
        hp_details: getStageHPDetails(stage.stage_name, stage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(stage.stage_name, workOrder)
      })),
      next_pending_stage: nextPendingStage ? {
        stage_name: nextPendingStage.stage_name,
        stage_order: nextPendingStage.stage_order,
        status: nextPendingStage.status,
        hp_details: getStageHPDetails(nextPendingStage.stage_name, nextPendingStage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(nextPendingStage.stage_name, workOrder)
      } : null,
      completed_stages: completedStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        completed_at: stage.completed_at,
        assigned_to: stage.assigned_to,
        hp_details: getStageHPDetails(stage.stage_name, stage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(stage.stage_name, workOrder)
      })),
      failed_stages: failedStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        error_message: stage.error_message,
        retry_count: stage.retry_count,
        hp_details: getStageHPDetails(stage.stage_name, stage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(stage.stage_name, workOrder)
      })),
      all_stages: allStages.map(stage => ({
        stage_name: stage.stage_name,
        stage_order: stage.stage_order,
        status: stage.status,
        started_at: stage.started_at,
        completed_at: stage.completed_at,
        assigned_to: stage.assigned_to,
        notes: stage.notes,
        hp_details: getStageHPDetails(stage.stage_name, stage.status, workOrder, factoryDetails, jsrDetails, warehouseDetails, cpDetails, contractorDetails, farmerDetails),
        deadline_info: getStageDeadline(stage.stage_name, workOrder)
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
