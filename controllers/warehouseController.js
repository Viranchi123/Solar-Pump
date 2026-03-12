import WorkOrderWarehouse from '../models/WorkOrderWarehouse.js';
import WorkOrderJSR from '../models/WorkOrderJSR.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { WorkOrderNotifications } from '../services/notificationService.js';

// Step 1: Warehouse receives units from JSR (units in warehouse)
export const receiveUnitsInWarehouse = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_in_warehouse,
      hp_3_in_warehouse,
      hp_5_in_warehouse,
      hp_7_5_in_warehouse
    } = req.body;

    // Validate required fields
    if (!work_order_id || total_quantity_in_warehouse === undefined || hp_3_in_warehouse === undefined || hp_5_in_warehouse === undefined || hp_7_5_in_warehouse === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_in_warehouse, hp_3_in_warehouse, hp_5_in_warehouse, hp_7_5_in_warehouse'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_in_warehouse < 0 || hp_3_in_warehouse < 0 || hp_5_in_warehouse < 0 || hp_7_5_in_warehouse < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity
    const sumOfHpQuantities = parseInt(hp_3_in_warehouse) + parseInt(hp_5_in_warehouse) + parseInt(hp_7_5_in_warehouse);
    if (sumOfHpQuantities !== parseInt(total_quantity_in_warehouse)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity in warehouse (${total_quantity_in_warehouse})`
      });
    }

    // Check if work order exists
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found. Please check the work order ID and try again.`
      });
    }

    // FLOW VALIDATION: Check if work order is in the correct stage for warehouse
    if (workOrder.current_stage !== 'whouse') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for warehouse operations. Current stage: ${workOrder.current_stage}. Expected stage: whouse.`
      });
    }

    // FLOW VALIDATION: Check if JSR has properly dispatched units to warehouse
    const jsrEntry = await WorkOrderJSR.findOne({
      where: { 
        work_order_id,
        jsr_status: 'approved'
      }
    });

    if (!jsrEntry) {
      return res.status(400).json({
        success: false,
        message: 'No approved JSR entry found for this work order. Please ensure JSR has approved and dispatched units to warehouse.'
      });
    }

    // Check if warehouse entry already exists for this work order
    const existingWarehouseEntry = await WorkOrderWarehouse.findOne({
      where: { work_order_id }
    });

    // Get current received quantities (for existing entries)
    const currentTotalReceived = existingWarehouseEntry ? existingWarehouseEntry.total_quantity_in_warehouse : 0;
    const currentHp3Received = existingWarehouseEntry ? existingWarehouseEntry.hp_3_in_warehouse : 0;
    const currentHp5Received = existingWarehouseEntry ? existingWarehouseEntry.hp_5_in_warehouse : 0;
    const currentHp75Received = existingWarehouseEntry ? existingWarehouseEntry.hp_7_5_in_warehouse : 0;

    // Calculate new total received quantities
    const newTotalReceived = currentTotalReceived + parseInt(total_quantity_in_warehouse);
    const newHp3Received = currentHp3Received + parseInt(hp_3_in_warehouse);
    const newHp5Received = currentHp5Received + parseInt(hp_5_in_warehouse);
    const newHp75Received = currentHp75Received + parseInt(hp_7_5_in_warehouse);

    // Validate that cumulative warehouse quantities don't exceed JSR dispatched quantities
    if (newTotalReceived > jsrEntry.total_quantity_to_warehouse) {
      return res.status(400).json({
        success: false,
        message: `Cumulative warehouse quantity (${newTotalReceived}) cannot exceed JSR dispatched quantity (${jsrEntry.total_quantity_to_warehouse})`
      });
    }

    if (newHp3Received > jsrEntry.hp_3_to_warehouse) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 3 HP warehouse quantity (${newHp3Received}) cannot exceed JSR dispatched 3 HP quantity (${jsrEntry.hp_3_to_warehouse})`
      });
    }

    if (newHp5Received > jsrEntry.hp_5_to_warehouse) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 5 HP warehouse quantity (${newHp5Received}) cannot exceed JSR dispatched 5 HP quantity (${jsrEntry.hp_5_to_warehouse})`
      });
    }

    if (newHp75Received > jsrEntry.hp_7_5_to_warehouse) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 7.5 HP warehouse quantity (${newHp75Received}) cannot exceed JSR dispatched 7.5 HP quantity (${jsrEntry.hp_7_5_to_warehouse})`
      });
    }

    // FLOW VALIDATION: Check if warehouse user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'whouse') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only warehouse users can perform this operation.'
      });
    }

    let warehouseEntry;

    if (existingWarehouseEntry) {
      // Update existing entry with cumulative received quantities
      warehouseEntry = await existingWarehouseEntry.update({
        total_quantity_in_warehouse: newTotalReceived,
        hp_3_in_warehouse: newHp3Received,
        hp_5_in_warehouse: newHp5Received,
        hp_7_5_in_warehouse: newHp75Received,
        total_quantity_remaining_in_warehouse: newTotalReceived - (existingWarehouseEntry.total_quantity_to_cp || 0),
        hp_3_remaining_in_warehouse: newHp3Received - (existingWarehouseEntry.hp_3_to_cp || 0),
        hp_5_remaining_in_warehouse: newHp5Received - (existingWarehouseEntry.hp_5_to_cp || 0),
        hp_7_5_remaining_in_warehouse: newHp75Received - (existingWarehouseEntry.hp_7_5_to_cp || 0),
        status: 'units_received',
        action_by: req.user.id
      });
    } else {
      // Create new entry
      warehouseEntry = await WorkOrderWarehouse.create({
        work_order_id: parseInt(work_order_id),
        jsr_entry_id: jsrEntry.id,
        total_quantity_in_warehouse: newTotalReceived,
        hp_3_in_warehouse: newHp3Received,
        hp_5_in_warehouse: newHp5Received,
        hp_7_5_in_warehouse: newHp75Received,
        total_quantity_remaining_in_warehouse: newTotalReceived,
        hp_3_remaining_in_warehouse: newHp3Received,
        hp_5_remaining_in_warehouse: newHp5Received,
        hp_7_5_remaining_in_warehouse: newHp75Received,
        status: 'units_received',
        action_by: req.user.id
      });
    }

    // Calculate remaining units to receive from JSR
    const totalRemainingToReceive = jsrEntry.total_quantity_to_warehouse - newTotalReceived;
    const hp3RemainingToReceive = jsrEntry.hp_3_to_warehouse - newHp3Received;
    const hp5RemainingToReceive = jsrEntry.hp_5_to_warehouse - newHp5Received;
    const hp75RemainingToReceive = jsrEntry.hp_7_5_to_warehouse - newHp75Received;

    // Check if all units from JSR have been received and all received units have been dispatched to CP
    const allUnitsReceivedFromJSR = totalRemainingToReceive === 0;
    const allReceivedUnitsDispatchedToCP = warehouseEntry.total_quantity_remaining_in_warehouse === 0;
    const allUnitsComplete = allUnitsReceivedFromJSR && allReceivedUnitsDispatchedToCP;

    // Update work order current stage to CP only when both conditions are met
    if (allUnitsComplete) {
      await WorkOrder.update(
        { current_stage: 'cp' },
        { where: { id: work_order_id } }
      );

      // Update stage records - warehouse stage completed
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: 'Warehouse stage completed - all units received from JSR and dispatched to CP'
        },
        { where: { work_order_id, stage_name: 'whouse' } }
      );

      // Start CP stage
      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'CP stage started - units received from warehouse'
        },
        { where: { work_order_id, stage_name: 'cp' } }
      );

      // Update warehouse status
      await warehouseEntry.update({ 
        status: 'all_units_dispatched'
      });
    } else {
      // Update stage records - mark warehouse stage as in progress
      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: `Warehouse received units: Total ${total_quantity_in_warehouse} (3HP: ${hp_3_in_warehouse}, 5HP: ${hp_5_in_warehouse}, 7.5HP: ${hp_7_5_in_warehouse}). Remaining to receive from JSR: ${totalRemainingToReceive} units. Remaining to dispatch to CP: ${warehouseEntry.total_quantity_remaining_in_warehouse} units`
        },
        { where: { work_order_id, stage_name: 'whouse' } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Units received in warehouse successfully',
      data: {
        id: warehouseEntry.id,
        work_order_id: warehouseEntry.work_order_id,
        total_quantity_in_warehouse: warehouseEntry.total_quantity_in_warehouse,
        hp_3_in_warehouse: warehouseEntry.hp_3_in_warehouse,
        hp_5_in_warehouse: warehouseEntry.hp_5_in_warehouse,
        hp_7_5_in_warehouse: warehouseEntry.hp_7_5_in_warehouse,
        jsr_dispatch_info: {
          total_dispatched_from_jsr: jsrEntry.total_quantity_to_warehouse,
          hp_3_dispatched_from_jsr: jsrEntry.hp_3_to_warehouse,
          hp_5_dispatched_from_jsr: jsrEntry.hp_5_to_warehouse,
          hp_7_5_dispatched_from_jsr: jsrEntry.hp_7_5_to_warehouse
        },
        remaining_to_receive_from_jsr: {
          total: totalRemainingToReceive,
          hp_3: hp3RemainingToReceive,
          hp_5: hp5RemainingToReceive,
          hp_7_5: hp75RemainingToReceive
        },
        remaining_in_warehouse: {
          total: warehouseEntry.total_quantity_remaining_in_warehouse,
          hp_3: warehouseEntry.hp_3_remaining_in_warehouse,
          hp_5: warehouseEntry.hp_5_remaining_in_warehouse,
          hp_7_5: warehouseEntry.hp_7_5_remaining_in_warehouse
        },
        status: warehouseEntry.status,
        action_by: warehouseEntry.action_by,
        all_units_complete: allUnitsComplete,
        work_order_current_stage: allUnitsComplete ? 'cp' : 'whouse'
      }
    });

  } catch (error) {
    console.error('Error receiving units in warehouse:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: Warehouse dispatches units to CP
export const dispatchToCP = async (req, res) => {
  try {
    const {
      work_order_id,
      region_of_cp,
      total_quantity_to_assign,
      hp_3_units_to_cp,
      hp_5_units_to_cp,
      hp_7_5_units_to_cp
    } = req.body;

    // Validate required fields
    if (!work_order_id || !region_of_cp || total_quantity_to_assign === undefined || hp_3_units_to_cp === undefined || hp_5_units_to_cp === undefined || hp_7_5_units_to_cp === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, region_of_cp, total_quantity_to_assign, hp_3_units_to_cp, hp_5_units_to_cp, hp_7_5_units_to_cp'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_to_assign < 0 || hp_3_units_to_cp < 0 || hp_5_units_to_cp < 0 || hp_7_5_units_to_cp < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that total quantity is positive (at least one unit must be dispatched)
    if (total_quantity_to_assign <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity to assign must be greater than 0. You must assign at least one unit.'
      });
    }

    // Validate that HP quantities sum up to total quantity to assign
    const sumOfHpQuantities = parseInt(hp_3_units_to_cp) + parseInt(hp_5_units_to_cp) + parseInt(hp_7_5_units_to_cp);
    if (sumOfHpQuantities !== parseInt(total_quantity_to_assign)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity to assign (${total_quantity_to_assign})`
      });
    }

    // Check if work order exists
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found. Please check the work order ID and try again.`
      });
    }

    // FLOW VALIDATION: Check if work order is in the correct stage for warehouse
    if (workOrder.current_stage !== 'whouse') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for warehouse operations. Current stage: ${workOrder.current_stage}. Expected stage: whouse.`
      });
    }

    // Check if warehouse entry exists
    const warehouseEntry = await WorkOrderWarehouse.findOne({
      where: { work_order_id }
    });

    if (!warehouseEntry) {
      return res.status(404).json({
        success: false,
        message: 'No warehouse entry found for this work order. Please receive units in warehouse first.'
      });
    }

    // Get JSR entry to check remaining units to receive
    const jsrEntry = await WorkOrderJSR.findOne({
      where: { 
        work_order_id,
        jsr_status: 'approved'
      }
    });

    if (!jsrEntry) {
      return res.status(404).json({
        success: false,
        message: 'No approved JSR entry found for this work order.'
      });
    }

    // FLOW VALIDATION: Check if warehouse user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'whouse') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only warehouse users can perform this operation.'
      });
    }

    // REGION VALIDATION: Check if CP user exists for the specified region
    const cpUser = await User.findOne({
      where: {
        role: 'cp',
        location: region_of_cp
      }
    });

    if (!cpUser) {
      return res.status(400).json({
        success: false,
        message: `No CP user found for the specified region: ${region_of_cp}. Please ensure the region matches an existing CP user in the system.`
      });
    }

    // Get current remaining units in warehouse
    const currentTotalRemainingInWarehouse = warehouseEntry.total_quantity_remaining_in_warehouse;
    const currentHp3RemainingInWarehouse = warehouseEntry.hp_3_remaining_in_warehouse;
    const currentHp5RemainingInWarehouse = warehouseEntry.hp_5_remaining_in_warehouse;
    const currentHp75RemainingInWarehouse = warehouseEntry.hp_7_5_remaining_in_warehouse;

    // Validate that quantities to CP don't exceed remaining units in warehouse
    if (total_quantity_to_assign > currentTotalRemainingInWarehouse) {
      return res.status(400).json({
        success: false,
        message: `Quantity to assign (${total_quantity_to_assign}) cannot exceed remaining units in warehouse (${currentTotalRemainingInWarehouse})`
      });
    }

    if (hp_3_units_to_cp > currentHp3RemainingInWarehouse) {
      return res.status(400).json({
        success: false,
        message: `3 HP quantity to assign (${hp_3_units_to_cp}) cannot exceed remaining 3 HP units in warehouse (${currentHp3RemainingInWarehouse})`
      });
    }

    if (hp_5_units_to_cp > currentHp5RemainingInWarehouse) {
      return res.status(400).json({
        success: false,
        message: `5 HP quantity to assign (${hp_5_units_to_cp}) cannot exceed remaining 5 HP units in warehouse (${currentHp5RemainingInWarehouse})`
      });
    }

    if (hp_7_5_units_to_cp > currentHp75RemainingInWarehouse) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP quantity to assign (${hp_7_5_units_to_cp}) cannot exceed remaining 7.5 HP units in warehouse (${currentHp75RemainingInWarehouse})`
      });
    }

    // Calculate cumulative dispatched quantities (add to existing)
    const currentTotalDispatchedToCP = warehouseEntry.total_quantity_to_cp || 0;
    const currentHp3DispatchedToCP = warehouseEntry.hp_3_to_cp || 0;
    const currentHp5DispatchedToCP = warehouseEntry.hp_5_to_cp || 0;
    const currentHp75DispatchedToCP = warehouseEntry.hp_7_5_to_cp || 0;

    const newTotalDispatchedToCP = currentTotalDispatchedToCP + total_quantity_to_assign;
    const newHp3DispatchedToCP = currentHp3DispatchedToCP + hp_3_units_to_cp;
    const newHp5DispatchedToCP = currentHp5DispatchedToCP + hp_5_units_to_cp;
    const newHp75DispatchedToCP = currentHp75DispatchedToCP + hp_7_5_units_to_cp;

    // Update warehouse entry with cumulative CP dispatch details
    const updatedWarehouseEntry = await warehouseEntry.update({
      region_of_cp,
      total_quantity_to_cp: newTotalDispatchedToCP,
      hp_3_to_cp: newHp3DispatchedToCP,
      hp_5_to_cp: newHp5DispatchedToCP,
      hp_7_5_to_cp: newHp75DispatchedToCP,
      cp_dispatch_status: 'dispatched_to_cp',
      action_by: req.user.id
    });

    // Calculate remaining units in warehouse after this dispatch
    const totalRemainingInWarehouse = currentTotalRemainingInWarehouse - total_quantity_to_assign;
    const hp3RemainingInWarehouse = currentHp3RemainingInWarehouse - hp_3_units_to_cp;
    const hp5RemainingInWarehouse = currentHp5RemainingInWarehouse - hp_5_units_to_cp;
    const hp75RemainingInWarehouse = currentHp75RemainingInWarehouse - hp_7_5_units_to_cp;

    // Update remaining units in warehouse
    await warehouseEntry.update({
      total_quantity_remaining_in_warehouse: totalRemainingInWarehouse,
      hp_3_remaining_in_warehouse: hp3RemainingInWarehouse,
      hp_5_remaining_in_warehouse: hp5RemainingInWarehouse,
      hp_7_5_remaining_in_warehouse: hp75RemainingInWarehouse
    });

    // Calculate remaining units to receive from JSR
    const totalRemainingToReceive = jsrEntry.total_quantity_to_warehouse - warehouseEntry.total_quantity_in_warehouse;
    const hp3RemainingToReceive = jsrEntry.hp_3_to_warehouse - warehouseEntry.hp_3_in_warehouse;
    const hp5RemainingToReceive = jsrEntry.hp_5_to_warehouse - warehouseEntry.hp_5_in_warehouse;
    const hp75RemainingToReceive = jsrEntry.hp_7_5_to_warehouse - warehouseEntry.hp_7_5_in_warehouse;

    // Check if all units from JSR have been received and all received units have been dispatched to CP
    const allUnitsReceivedFromJSR = totalRemainingToReceive === 0;
    const allReceivedUnitsDispatchedToCP = totalRemainingInWarehouse === 0;
    const allUnitsComplete = allUnitsReceivedFromJSR && allReceivedUnitsDispatchedToCP;

    if (allUnitsComplete) {
      // All units received from JSR and dispatched to CP - complete warehouse stage and start CP stage
      await WorkOrder.update(
        { current_stage: 'cp' },
        { where: { id: work_order_id } }
      );

      // Update stage records
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: 'Warehouse stage completed - all units received from JSR and dispatched to CP'
        },
        { where: { work_order_id, stage_name: 'whouse' } }
      );

      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'CP stage started - units received from warehouse'
        },
        { where: { work_order_id, stage_name: 'cp' } }
      );

      // Update warehouse status
      await warehouseEntry.update({ 
        status: 'all_units_dispatched',
        cp_dispatch_status: 'all_units_dispatched'
      });
    } else {
      // Still have units to receive from JSR or dispatch to CP - keep warehouse stage in progress
      let notes = `Warehouse stage in progress - `;
      
      if (!allUnitsReceivedFromJSR) {
        notes += `Remaining to receive from JSR: ${totalRemainingToReceive} units. `;
      }
      
      if (!allReceivedUnitsDispatchedToCP) {
        notes += `Remaining to dispatch to CP: ${totalRemainingInWarehouse} units`;
      }
      
      await WorkOrderStage.update(
        { 
          status: 'in_progress',
          notes: notes.trim()
        },
        { where: { work_order_id, stage_name: 'whouse' } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Units successfully assigned to CP',
      data: {
        id: updatedWarehouseEntry.id,
        work_order_id: updatedWarehouseEntry.work_order_id,
        total_quantity_in_warehouse: updatedWarehouseEntry.total_quantity_in_warehouse,
        hp_3_in_warehouse: updatedWarehouseEntry.hp_3_in_warehouse,
        hp_5_in_warehouse: updatedWarehouseEntry.hp_5_in_warehouse,
        hp_7_5_in_warehouse: updatedWarehouseEntry.hp_7_5_in_warehouse,
        current_assignment: {
          total: total_quantity_to_assign,
          hp_3: hp_3_units_to_cp,
          hp_5: hp_5_units_to_cp,
          hp_7_5: hp_7_5_units_to_cp
        },
        cumulative_assigned_to_cp: {
          total: newTotalDispatchedToCP,
          hp_3: newHp3DispatchedToCP,
          hp_5: newHp5DispatchedToCP,
          hp_7_5: newHp75DispatchedToCP
        },
        jsr_dispatch_info: {
          total_dispatched_from_jsr: jsrEntry.total_quantity_to_warehouse,
          hp_3_dispatched_from_jsr: jsrEntry.hp_3_to_warehouse,
          hp_5_dispatched_from_jsr: jsrEntry.hp_5_to_warehouse,
          hp_7_5_dispatched_from_jsr: jsrEntry.hp_7_5_to_warehouse
        },
        remaining_to_receive_from_jsr: {
          total: totalRemainingToReceive,
          hp_3: hp3RemainingToReceive,
          hp_5: hp5RemainingToReceive,
          hp_7_5: hp75RemainingToReceive
        },
        remaining_in_warehouse: {
          total: totalRemainingInWarehouse,
          hp_3: hp3RemainingInWarehouse,
          hp_5: hp5RemainingInWarehouse,
          hp_7_5: hp75RemainingInWarehouse
        },
        region_of_cp: updatedWarehouseEntry.region_of_cp,
        cp_dispatch_status: updatedWarehouseEntry.cp_dispatch_status,
        all_units_complete: allUnitsComplete,
        work_order_current_stage: allUnitsComplete ? 'cp' : 'whouse'
      }
    });

    // Send notifications if all units are assigned
    if (allUnitsComplete) {
      try {
        const workOrder = await WorkOrder.findByPk(work_order_id);
        const actionUser = await User.findByPk(req.user.id);
        await WorkOrderNotifications.stageCompleted(workOrder, 'whouse', 'cp', actionUser);
      } catch (notificationError) {
        console.error('Error sending stage completion notifications:', notificationError);
        // Don't fail the request if notifications fail
      }
    }

  } catch (error) {
    console.error('Error dispatching to CP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
