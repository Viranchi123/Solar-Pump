import WorkOrderCP from '../models/WorkOrderCP.js';
import WorkOrderWarehouse from '../models/WorkOrderWarehouse.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { WorkOrderNotifications } from '../services/notificationService.js';

// Step 1: CP receives units from warehouse (units assigned to contractor)
export const receiveUnitsInCP = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_to_cp,
      hp_3_forwarded_by_cp,
      hp_5_forwarded_by_cp,
      hp_7_5_forwarded_by_cp
    } = req.body;

    // Validate required fields
    if (!work_order_id || total_quantity_to_cp === undefined || hp_3_forwarded_by_cp === undefined || hp_5_forwarded_by_cp === undefined || hp_7_5_forwarded_by_cp === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_to_cp, hp_3_forwarded_by_cp, hp_5_forwarded_by_cp, hp_7_5_forwarded_by_cp'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_to_cp < 0 || hp_3_forwarded_by_cp < 0 || hp_5_forwarded_by_cp < 0 || hp_7_5_forwarded_by_cp < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity
    const sumOfHpQuantities = parseInt(hp_3_forwarded_by_cp) + parseInt(hp_5_forwarded_by_cp) + parseInt(hp_7_5_forwarded_by_cp);
    if (sumOfHpQuantities !== parseInt(total_quantity_to_cp)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity to CP (${total_quantity_to_cp})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for CP
    if (workOrder.current_stage !== 'cp') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for CP operations. Current stage: ${workOrder.current_stage}. Expected stage: cp.`
      });
    }

    // FLOW VALIDATION: Check if warehouse has properly dispatched units to CP
    const warehouseEntry = await WorkOrderWarehouse.findOne({
      where: { 
        work_order_id,
        status: ['dispatched_to_cp', 'all_units_dispatched']
      }
    });

    if (!warehouseEntry) {
      return res.status(400).json({
        success: false,
        message: 'This work order has not been dispatched from warehouse to CP. Please wait for warehouse to complete the dispatch process before proceeding with CP operations.'
      });
    }

    // Validate that CP quantities don't exceed warehouse dispatched quantities
    if (total_quantity_to_cp > warehouseEntry.total_quantity_to_cp) {
      return res.status(400).json({
        success: false,
        message: `CP quantity (${total_quantity_to_cp}) cannot exceed warehouse dispatched quantity (${warehouseEntry.total_quantity_to_cp})`
      });
    }

    if (hp_3_forwarded_by_cp > warehouseEntry.hp_3_to_cp) {
      return res.status(400).json({
        success: false,
        message: `3 HP CP quantity (${hp_3_forwarded_by_cp}) cannot exceed warehouse dispatched 3 HP quantity (${warehouseEntry.hp_3_to_cp})`
      });
    }

    if (hp_5_forwarded_by_cp > warehouseEntry.hp_5_to_cp) {
      return res.status(400).json({
        success: false,
        message: `5 HP CP quantity (${hp_5_forwarded_by_cp}) cannot exceed warehouse dispatched 5 HP quantity (${warehouseEntry.hp_5_to_cp})`
      });
    }

    if (hp_7_5_forwarded_by_cp > warehouseEntry.hp_7_5_to_cp) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP CP quantity (${hp_7_5_forwarded_by_cp}) cannot exceed warehouse dispatched 7.5 HP quantity (${warehouseEntry.hp_7_5_to_cp})`
      });
    }

    // FLOW VALIDATION: Check if CP user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'cp') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only CP users can perform this operation.'
      });
    }

    // Check if CP entry already exists for this work order
    const existingCPEntry = await WorkOrderCP.findOne({
      where: { work_order_id }
    });

    let cpEntry;

    if (existingCPEntry) {
      // Update existing entry
      cpEntry = await existingCPEntry.update({
        total_quantity_to_cp: parseInt(total_quantity_to_cp),
        hp_3_forwarded_by_cp: parseInt(hp_3_forwarded_by_cp),
        hp_5_forwarded_by_cp: parseInt(hp_5_forwarded_by_cp),
        hp_7_5_forwarded_by_cp: parseInt(hp_7_5_forwarded_by_cp),
        total_quantity_remaining_in_cp: parseInt(total_quantity_to_cp),
        hp_3_remaining_in_cp: parseInt(hp_3_forwarded_by_cp),
        hp_5_remaining_in_cp: parseInt(hp_5_forwarded_by_cp),
        hp_7_5_remaining_in_cp: parseInt(hp_7_5_forwarded_by_cp),
        status: 'units_received',
        action_by: req.user.id
      });
    } else {
      // Create new entry
      cpEntry = await WorkOrderCP.create({
        work_order_id: parseInt(work_order_id),
        warehouse_entry_id: warehouseEntry.id,
        total_quantity_to_cp: parseInt(total_quantity_to_cp),
        hp_3_forwarded_by_cp: parseInt(hp_3_forwarded_by_cp),
        hp_5_forwarded_by_cp: parseInt(hp_5_forwarded_by_cp),
        hp_7_5_forwarded_by_cp: parseInt(hp_7_5_forwarded_by_cp),
        total_quantity_remaining_in_cp: parseInt(total_quantity_to_cp),
        hp_3_remaining_in_cp: parseInt(hp_3_forwarded_by_cp),
        hp_5_remaining_in_cp: parseInt(hp_5_forwarded_by_cp),
        hp_7_5_remaining_in_cp: parseInt(hp_7_5_forwarded_by_cp),
        status: 'units_received',
        action_by: req.user.id
      });
    }

    // Update stage records - mark CP stage as in progress
    await WorkOrderStage.update(
      { 
        status: 'in_progress', 
        started_at: new Date(),
        notes: `CP received units: Total ${total_quantity_to_cp} (3HP: ${hp_3_forwarded_by_cp}, 5HP: ${hp_5_forwarded_by_cp}, 7.5HP: ${hp_7_5_forwarded_by_cp})`
      },
      { where: { work_order_id, stage_name: 'cp' } }
    );

    res.status(200).json({
      success: true,
      message: 'Units received in CP successfully',
      data: {
        id: cpEntry.id,
        work_order_id: cpEntry.work_order_id,
        total_quantity_to_cp: cpEntry.total_quantity_to_cp,
        hp_3_forwarded_by_cp: cpEntry.hp_3_forwarded_by_cp,
        hp_5_forwarded_by_cp: cpEntry.hp_5_forwarded_by_cp,
        hp_7_5_forwarded_by_cp: cpEntry.hp_7_5_forwarded_by_cp,
        remaining_in_cp: {
          total: cpEntry.total_quantity_remaining_in_cp,
          hp_3: cpEntry.hp_3_remaining_in_cp,
          hp_5: cpEntry.hp_5_remaining_in_cp,
          hp_7_5: cpEntry.hp_7_5_remaining_in_cp
        },
        status: cpEntry.status,
        action_by: cpEntry.action_by
      }
    });

  } catch (error) {
    console.error('Error receiving units in CP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: CP dispatches units to contractor
export const dispatchToContractor = async (req, res) => {
  try {
    const {
      work_order_id,
      contractor_name,
      village,
      total_quantity_assigned,
      hp_3_to_contractor,
      hp_5_to_contractor,
      hp_7_5_to_contractor
    } = req.body;

    // Validate required fields
    if (!work_order_id || !contractor_name || !village || total_quantity_assigned === undefined || hp_3_to_contractor === undefined || hp_5_to_contractor === undefined || hp_7_5_to_contractor === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, contractor_name, village, total_quantity_assigned, hp_3_to_contractor, hp_5_to_contractor, hp_7_5_to_contractor'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_assigned < 0 || hp_3_to_contractor < 0 || hp_5_to_contractor < 0 || hp_7_5_to_contractor < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that total quantity is positive (at least one unit must be dispatched)
    if (total_quantity_assigned <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity assigned must be greater than 0. You must assign at least one unit.'
      });
    }

    // Validate that HP quantities sum up to total quantity assigned
    const sumOfHpQuantities = parseInt(hp_3_to_contractor) + parseInt(hp_5_to_contractor) + parseInt(hp_7_5_to_contractor);
    if (sumOfHpQuantities !== parseInt(total_quantity_assigned)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity assigned (${total_quantity_assigned})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for CP
    if (workOrder.current_stage !== 'cp') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for CP operations. Current stage: ${workOrder.current_stage}. Expected stage: cp.`
      });
    }

    // Check if CP entry exists
    const cpEntry = await WorkOrderCP.findOne({
      where: { work_order_id }
    });

    if (!cpEntry) {
      return res.status(404).json({
        success: false,
        message: 'No CP entry found for this work order. Please receive units in CP first.'
      });
    }

    // FLOW VALIDATION: Check if CP user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'cp') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only CP users can perform this operation.'
      });
    }

    // Get current remaining units in CP
    const currentTotalRemainingInCP = cpEntry.total_quantity_remaining_in_cp;
    const currentHp3RemainingInCP = cpEntry.hp_3_remaining_in_cp;
    const currentHp5RemainingInCP = cpEntry.hp_5_remaining_in_cp;
    const currentHp75RemainingInCP = cpEntry.hp_7_5_remaining_in_cp;

    // Validate that quantities to contractor don't exceed remaining units in CP
    if (total_quantity_assigned > currentTotalRemainingInCP) {
      return res.status(400).json({
        success: false,
        message: `Quantity assigned (${total_quantity_assigned}) cannot exceed remaining units in CP (${currentTotalRemainingInCP})`
      });
    }

    if (hp_3_to_contractor > currentHp3RemainingInCP) {
      return res.status(400).json({
        success: false,
        message: `3 HP quantity assigned (${hp_3_to_contractor}) cannot exceed remaining 3 HP units in CP (${currentHp3RemainingInCP})`
      });
    }

    if (hp_5_to_contractor > currentHp5RemainingInCP) {
      return res.status(400).json({
        success: false,
        message: `5 HP quantity assigned (${hp_5_to_contractor}) cannot exceed remaining 5 HP units in CP (${currentHp5RemainingInCP})`
      });
    }

    if (hp_7_5_to_contractor > currentHp75RemainingInCP) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP quantity assigned (${hp_7_5_to_contractor}) cannot exceed remaining 7.5 HP units in CP (${currentHp75RemainingInCP})`
      });
    }

    // Calculate cumulative dispatched quantities (add to existing)
    const currentTotalDispatchedToContractor = cpEntry.total_quantity_assigned || 0;
    const currentHp3DispatchedToContractor = cpEntry.hp_3_to_contractor || 0;
    const currentHp5DispatchedToContractor = cpEntry.hp_5_to_contractor || 0;
    const currentHp75DispatchedToContractor = cpEntry.hp_7_5_to_contractor || 0;

    const newTotalDispatchedToContractor = currentTotalDispatchedToContractor + total_quantity_assigned;
    const newHp3DispatchedToContractor = currentHp3DispatchedToContractor + hp_3_to_contractor;
    const newHp5DispatchedToContractor = currentHp5DispatchedToContractor + hp_5_to_contractor;
    const newHp75DispatchedToContractor = currentHp75DispatchedToContractor + hp_7_5_to_contractor;

    // Update CP entry with cumulative contractor dispatch details
    const updatedCPEntry = await cpEntry.update({
      contractor_name,
      village,
      total_quantity_assigned: newTotalDispatchedToContractor,
      hp_3_to_contractor: newHp3DispatchedToContractor,
      hp_5_to_contractor: newHp5DispatchedToContractor,
      hp_7_5_to_contractor: newHp75DispatchedToContractor,
      contractor_dispatch_status: 'dispatched_to_contractor',
      action_by: req.user.id
    });

    // Calculate remaining units in CP after this dispatch
    const totalRemainingInCP = cpEntry.total_quantity_to_cp - newTotalDispatchedToContractor;
    const hp3RemainingInCP = cpEntry.hp_3_forwarded_by_cp - newHp3DispatchedToContractor;
    const hp5RemainingInCP = cpEntry.hp_5_forwarded_by_cp - newHp5DispatchedToContractor;
    const hp75RemainingInCP = cpEntry.hp_7_5_forwarded_by_cp - newHp75DispatchedToContractor;

    // Update remaining units in CP
    await cpEntry.update({
      total_quantity_remaining_in_cp: totalRemainingInCP,
      hp_3_remaining_in_cp: hp3RemainingInCP,
      hp_5_remaining_in_cp: hp5RemainingInCP,
      hp_7_5_remaining_in_cp: hp75RemainingInCP
    });

    // Check if all units are dispatched to contractor
    const allUnitsDispatched = (
      newTotalDispatchedToContractor >= cpEntry.total_quantity_to_cp &&
      newHp3DispatchedToContractor >= cpEntry.hp_3_forwarded_by_cp &&
      newHp5DispatchedToContractor >= cpEntry.hp_5_forwarded_by_cp &&
      newHp75DispatchedToContractor >= cpEntry.hp_7_5_forwarded_by_cp
    );

    if (allUnitsDispatched) {
      // All units dispatched - complete CP stage and start contractor stage
      await WorkOrder.update(
        { current_stage: 'contractor' },
        { where: { id: work_order_id } }
      );

      // Update stage records
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: 'CP stage completed - all units dispatched to contractor'
        },
        { where: { work_order_id, stage_name: 'cp' } }
      );

      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'Contractor stage started - units received from CP'
        },
        { where: { work_order_id, stage_name: 'contractor' } }
      );

      // Update CP status
      await cpEntry.update({ 
        status: 'all_units_dispatched',
        contractor_dispatch_status: 'all_units_dispatched'
      });
    } else {
      // Still have units to dispatch - keep CP stage in progress
      const remainingTotal = cpEntry.total_quantity_to_cp - newTotalDispatchedToContractor;
      await WorkOrderStage.update(
        { 
          status: 'in_progress',
          notes: `CP stage in progress - ${remainingTotal} units remaining to dispatch to contractor`
        },
        { where: { work_order_id, stage_name: 'cp' } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Units successfully assigned to contractor',
      data: {
        id: updatedCPEntry.id,
        work_order_id: updatedCPEntry.work_order_id,
        total_quantity_to_cp: updatedCPEntry.total_quantity_to_cp,
        hp_3_forwarded_by_cp: updatedCPEntry.hp_3_forwarded_by_cp,
        hp_5_forwarded_by_cp: updatedCPEntry.hp_5_forwarded_by_cp,
        hp_7_5_forwarded_by_cp: updatedCPEntry.hp_7_5_forwarded_by_cp,
        current_assignment: {
          total: total_quantity_assigned,
          hp_3: hp_3_to_contractor,
          hp_5: hp_5_to_contractor,
          hp_7_5: hp_7_5_to_contractor
        },
        cumulative_assigned_to_contractor: {
          total: newTotalDispatchedToContractor,
          hp_3: newHp3DispatchedToContractor,
          hp_5: newHp5DispatchedToContractor,
          hp_7_5: newHp75DispatchedToContractor
        },
        remaining_in_cp: {
          total: totalRemainingInCP,
          hp_3: hp3RemainingInCP,
          hp_5: hp5RemainingInCP,
          hp_7_5: hp75RemainingInCP
        },
        contractor_name: updatedCPEntry.contractor_name,
        village: updatedCPEntry.village,
        contractor_dispatch_status: updatedCPEntry.contractor_dispatch_status,
        cp_stage_completed: allUnitsDispatched,
        work_order_current_stage: allUnitsDispatched ? 'contractor' : 'cp'
      }
    });

    // Send notifications if all units are dispatched
    if (allUnitsDispatched) {
      try {
        const workOrder = await WorkOrder.findByPk(work_order_id);
        const actionUser = await User.findByPk(req.user.id);
        await WorkOrderNotifications.stageCompleted(workOrder, 'cp', 'contractor', actionUser);
      } catch (notificationError) {
        console.error('Error sending stage completion notifications:', notificationError);
        // Don't fail the request if notifications fail
      }
    }

  } catch (error) {
    console.error('Error dispatching to contractor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
