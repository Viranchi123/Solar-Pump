import WorkOrderContractor from '../models/WorkOrderContractor.js';
import WorkOrderCP from '../models/WorkOrderCP.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { WorkOrderNotifications } from '../services/notificationService.js';

// Step 1: Contractor receives units from CP (units assigned to contractor)
export const receiveUnitsInContractor = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_to_contractor,
      hp_3_forwarded_by_contractor,
      hp_5_forwarded_by_contractor,
      hp_7_5_forwarded_by_contractor
    } = req.body;

    // Validate required fields
    if (!work_order_id || total_quantity_to_contractor === undefined || hp_3_forwarded_by_contractor === undefined || hp_5_forwarded_by_contractor === undefined || hp_7_5_forwarded_by_contractor === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_to_contractor, hp_3_forwarded_by_contractor, hp_5_forwarded_by_contractor, hp_7_5_forwarded_by_contractor'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_to_contractor < 0 || hp_3_forwarded_by_contractor < 0 || hp_5_forwarded_by_contractor < 0 || hp_7_5_forwarded_by_contractor < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity
    const sumOfHpQuantities = parseInt(hp_3_forwarded_by_contractor) + parseInt(hp_5_forwarded_by_contractor) + parseInt(hp_7_5_forwarded_by_contractor);
    if (sumOfHpQuantities !== parseInt(total_quantity_to_contractor)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity to contractor (${total_quantity_to_contractor})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for contractor
    if (workOrder.current_stage !== 'contractor') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for contractor operations. Current stage: ${workOrder.current_stage}. Expected stage: contractor.`
      });
    }

    // FLOW VALIDATION: Check if CP has properly dispatched units to contractor
    const cpEntry = await WorkOrderCP.findOne({
      where: { 
        work_order_id,
        status: ['dispatched_to_contractor', 'all_units_dispatched']
      }
    });

    if (!cpEntry) {
      return res.status(400).json({
        success: false,
        message: 'This work order has not been dispatched from CP to contractor. Please wait for CP to complete the dispatch process before proceeding with contractor operations.'
      });
    }

    // Validate that contractor quantities don't exceed CP dispatched quantities
    if (total_quantity_to_contractor > cpEntry.total_quantity_assigned) {
      return res.status(400).json({
        success: false,
        message: `Contractor quantity (${total_quantity_to_contractor}) cannot exceed CP dispatched quantity (${cpEntry.total_quantity_assigned})`
      });
    }

    if (hp_3_forwarded_by_contractor > cpEntry.hp_3_to_contractor) {
      return res.status(400).json({
        success: false,
        message: `3 HP contractor quantity (${hp_3_forwarded_by_contractor}) cannot exceed CP dispatched 3 HP quantity (${cpEntry.hp_3_to_contractor})`
      });
    }

    if (hp_5_forwarded_by_contractor > cpEntry.hp_5_to_contractor) {
      return res.status(400).json({
        success: false,
        message: `5 HP contractor quantity (${hp_5_forwarded_by_contractor}) cannot exceed CP dispatched 5 HP quantity (${cpEntry.hp_5_to_contractor})`
      });
    }

    if (hp_7_5_forwarded_by_contractor > cpEntry.hp_7_5_to_contractor) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP contractor quantity (${hp_7_5_forwarded_by_contractor}) cannot exceed CP dispatched 7.5 HP quantity (${cpEntry.hp_7_5_to_contractor})`
      });
    }

    // FLOW VALIDATION: Check if contractor user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'contractor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only contractor users can perform this operation.'
      });
    }

    // Check if contractor entry already exists for this work order
    const existingContractorEntry = await WorkOrderContractor.findOne({
      where: { work_order_id }
    });

    let contractorEntry;

    if (existingContractorEntry) {
      // Update existing entry - add to existing quantities (cumulative)
      const currentTotalReceived = existingContractorEntry.total_quantity_to_contractor || 0;
      const currentHp3Received = existingContractorEntry.hp_3_forwarded_by_contractor || 0;
      const currentHp5Received = existingContractorEntry.hp_5_forwarded_by_contractor || 0;
      const currentHp75Received = existingContractorEntry.hp_7_5_forwarded_by_contractor || 0;

      // Calculate new cumulative quantities
      const newTotalReceived = currentTotalReceived + parseInt(total_quantity_to_contractor);
      const newHp3Received = currentHp3Received + parseInt(hp_3_forwarded_by_contractor);
      const newHp5Received = currentHp5Received + parseInt(hp_5_forwarded_by_contractor);
      const newHp75Received = currentHp75Received + parseInt(hp_7_5_forwarded_by_contractor);

      // Validate that new cumulative quantities don't exceed CP dispatched quantities
      if (newTotalReceived > cpEntry.total_quantity_assigned) {
        return res.status(400).json({
          success: false,
          message: `Cumulative received quantity (${newTotalReceived}) cannot exceed CP dispatched quantity (${cpEntry.total_quantity_assigned})`
        });
      }

      if (newHp3Received > cpEntry.hp_3_to_contractor) {
        return res.status(400).json({
          success: false,
          message: `Cumulative 3 HP received quantity (${newHp3Received}) cannot exceed CP dispatched 3 HP quantity (${cpEntry.hp_3_to_contractor})`
        });
      }

      if (newHp5Received > cpEntry.hp_5_to_contractor) {
        return res.status(400).json({
          success: false,
          message: `Cumulative 5 HP received quantity (${newHp5Received}) cannot exceed CP dispatched 5 HP quantity (${cpEntry.hp_5_to_contractor})`
        });
      }

      if (newHp75Received > cpEntry.hp_7_5_to_contractor) {
        return res.status(400).json({
          success: false,
          message: `Cumulative 7.5 HP received quantity (${newHp75Received}) cannot exceed CP dispatched 7.5 HP quantity (${cpEntry.hp_7_5_to_contractor})`
        });
      }

      // Update existing entry with cumulative quantities
      contractorEntry = await existingContractorEntry.update({
        total_quantity_to_contractor: newTotalReceived,
        hp_3_forwarded_by_contractor: newHp3Received,
        hp_5_forwarded_by_contractor: newHp5Received,
        hp_7_5_forwarded_by_contractor: newHp75Received,
        total_quantity_remaining_in_contractor: newTotalReceived,
        hp_3_remaining_in_contractor: newHp3Received,
        hp_5_remaining_in_contractor: newHp5Received,
        hp_7_5_remaining_in_contractor: newHp75Received,
        status: 'units_received',
        action_by: req.user.id
      });
    } else {
      // Create new entry
      contractorEntry = await WorkOrderContractor.create({
        work_order_id: parseInt(work_order_id),
        cp_entry_id: cpEntry.id,
        total_quantity_to_contractor: parseInt(total_quantity_to_contractor),
        hp_3_forwarded_by_contractor: parseInt(hp_3_forwarded_by_contractor),
        hp_5_forwarded_by_contractor: parseInt(hp_5_forwarded_by_contractor),
        hp_7_5_forwarded_by_contractor: parseInt(hp_7_5_forwarded_by_contractor),
        total_quantity_remaining_in_contractor: parseInt(total_quantity_to_contractor),
        hp_3_remaining_in_contractor: parseInt(hp_3_forwarded_by_contractor),
        hp_5_remaining_in_contractor: parseInt(hp_5_forwarded_by_contractor),
        hp_7_5_remaining_in_contractor: parseInt(hp_7_5_forwarded_by_contractor),
        status: 'units_received',
        action_by: req.user.id
      });
    }

    // Update stage records - mark contractor stage as in progress
    await WorkOrderStage.update(
      { 
        status: 'in_progress', 
        started_at: new Date(),
        notes: `Contractor received units: Total ${total_quantity_to_contractor} (3HP: ${hp_3_forwarded_by_contractor}, 5HP: ${hp_5_forwarded_by_contractor}, 7.5HP: ${hp_7_5_forwarded_by_contractor})`
      },
      { where: { work_order_id, stage_name: 'contractor' } }
    );

    // Get the updated contractor entry to ensure we have the latest quantities
    const updatedContractorEntry = await WorkOrderContractor.findByPk(contractorEntry.id);

    // Calculate remaining units available from CP (CP dispatched - contractor received)
    const totalRemainingFromCP = cpEntry.total_quantity_assigned - updatedContractorEntry.total_quantity_to_contractor;
    const hp3RemainingFromCP = cpEntry.hp_3_to_contractor - updatedContractorEntry.hp_3_forwarded_by_contractor;
    const hp5RemainingFromCP = cpEntry.hp_5_to_contractor - updatedContractorEntry.hp_5_forwarded_by_contractor;
    const hp75RemainingFromCP = cpEntry.hp_7_5_to_contractor - updatedContractorEntry.hp_7_5_forwarded_by_contractor;

    res.status(200).json({
      success: true,
      message: 'Units received in contractor successfully',
      data: {
        id: contractorEntry.id,
        work_order_id: contractorEntry.work_order_id,
        total_quantity_to_contractor: updatedContractorEntry.total_quantity_to_contractor,
        hp_3_forwarded_by_contractor: updatedContractorEntry.hp_3_forwarded_by_contractor,
        hp_5_forwarded_by_contractor: updatedContractorEntry.hp_5_forwarded_by_contractor,
        hp_7_5_forwarded_by_contractor: updatedContractorEntry.hp_7_5_forwarded_by_contractor,
        remaining_in_contractor: {
          total: updatedContractorEntry.total_quantity_remaining_in_contractor,
          hp_3: updatedContractorEntry.hp_3_remaining_in_contractor,
          hp_5: updatedContractorEntry.hp_5_remaining_in_contractor,
          hp_7_5: updatedContractorEntry.hp_7_5_remaining_in_contractor
        },
        remaining_from_cp: {
          total: totalRemainingFromCP,
          hp_3: hp3RemainingFromCP,
          hp_5: hp5RemainingFromCP,
          hp_7_5: hp75RemainingFromCP
        },
        cp_dispatch_details: {
          total_dispatched_by_cp: cpEntry.total_quantity_assigned,
          hp_3_dispatched_by_cp: cpEntry.hp_3_to_contractor,
          hp_5_dispatched_by_cp: cpEntry.hp_5_to_contractor,
          hp_7_5_dispatched_by_cp: cpEntry.hp_7_5_to_contractor
        },
        status: updatedContractorEntry.status,
        action_by: updatedContractorEntry.action_by
      }
    });

  } catch (error) {
    console.error('Error receiving units in contractor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: Contractor dispatches units to farmer and inspection
export const dispatchToFarmerAndInspection = async (req, res) => {
  try {
    const {
      work_order_id,
      name_of_farmer,
      state,
      district,
      taluka,
      village,
      total_quantity_assigned,
      hp_3_to_farmer,
      hp_5_to_farmer,
      hp_7_5_to_farmer,
      notes
    } = req.body;

    // Validate required fields
    if (!work_order_id || !name_of_farmer || !state || !district || !taluka || !village || total_quantity_assigned === undefined || hp_3_to_farmer === undefined || hp_5_to_farmer === undefined || hp_7_5_to_farmer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, name_of_farmer, state, district, taluka, village, total_quantity_assigned, hp_3_to_farmer, hp_5_to_farmer, hp_7_5_to_farmer'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_assigned < 0 || hp_3_to_farmer < 0 || hp_5_to_farmer < 0 || hp_7_5_to_farmer < 0) {
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
    const sumOfHpQuantities = parseInt(hp_3_to_farmer) + parseInt(hp_5_to_farmer) + parseInt(hp_7_5_to_farmer);
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

    // FLOW VALIDATION: Check if work order is in the correct stage for contractor
    if (workOrder.current_stage !== 'contractor') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for contractor operations. Current stage: ${workOrder.current_stage}. Expected stage: contractor.`
      });
    }

    // Check if contractor entry exists
    const contractorEntry = await WorkOrderContractor.findOne({
      where: { work_order_id }
    });

    if (!contractorEntry) {
      return res.status(404).json({
        success: false,
        message: 'No contractor entry found for this work order. Please receive units in contractor first.'
      });
    }

    // FLOW VALIDATION: Check if contractor user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'contractor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only contractor users can perform this operation.'
      });
    }

    // Get current remaining units in contractor
    const currentTotalRemainingInContractor = contractorEntry.total_quantity_remaining_in_contractor;
    const currentHp3RemainingInContractor = contractorEntry.hp_3_remaining_in_contractor;
    const currentHp5RemainingInContractor = contractorEntry.hp_5_remaining_in_contractor;
    const currentHp75RemainingInContractor = contractorEntry.hp_7_5_remaining_in_contractor;

    // Get current cumulative dispatched quantities
    const currentTotalDispatchedToFarmer = contractorEntry.total_quantity_assigned || 0;
    const currentHp3DispatchedToFarmer = contractorEntry.hp_3_to_farmer || 0;
    const currentHp5DispatchedToFarmer = contractorEntry.hp_5_to_farmer || 0;
    const currentHp75DispatchedToFarmer = contractorEntry.hp_7_5_to_farmer || 0;

    // Calculate new cumulative dispatched quantities
    const newTotalDispatchedToFarmer = currentTotalDispatchedToFarmer + total_quantity_assigned;
    
    // Validate that new cumulative dispatch doesn't exceed total units received by contractor
    if (newTotalDispatchedToFarmer > contractorEntry.total_quantity_to_contractor) {
      return res.status(400).json({
        success: false,
        message: `Total cumulative dispatch (${newTotalDispatchedToFarmer}) cannot exceed total units received by contractor (${contractorEntry.total_quantity_to_contractor}). Current remaining: ${currentTotalRemainingInContractor}`
      });
    }

    // Calculate new cumulative HP dispatched quantities
    const newHp3DispatchedToFarmer = currentHp3DispatchedToFarmer + hp_3_to_farmer;
    const newHp5DispatchedToFarmer = currentHp5DispatchedToFarmer + hp_5_to_farmer;
    const newHp75DispatchedToFarmer = currentHp75DispatchedToFarmer + hp_7_5_to_farmer;

    // Validate HP-specific cumulative dispatches
    if (newHp3DispatchedToFarmer > contractorEntry.hp_3_forwarded_by_contractor) {
      return res.status(400).json({
        success: false,
        message: `Total cumulative 3 HP dispatch (${newHp3DispatchedToFarmer}) cannot exceed total 3 HP units received by contractor (${contractorEntry.hp_3_forwarded_by_contractor}). Current remaining: ${currentHp3RemainingInContractor}`
      });
    }

    if (newHp5DispatchedToFarmer > contractorEntry.hp_5_forwarded_by_contractor) {
      return res.status(400).json({
        success: false,
        message: `Total cumulative 5 HP dispatch (${newHp5DispatchedToFarmer}) cannot exceed total 5 HP units received by contractor (${contractorEntry.hp_5_forwarded_by_contractor}). Current remaining: ${currentHp5RemainingInContractor}`
      });
    }

    if (newHp75DispatchedToFarmer > contractorEntry.hp_7_5_forwarded_by_contractor) {
      return res.status(400).json({
        success: false,
        message: `Total cumulative 7.5 HP dispatch (${newHp75DispatchedToFarmer}) cannot exceed total 7.5 HP units received by contractor (${contractorEntry.hp_7_5_forwarded_by_contractor}). Current remaining: ${currentHp75RemainingInContractor}`
      });
    }

    // Current cumulative dispatched quantities already calculated above

    // Update contractor entry with cumulative farmer dispatch details
    const updatedContractorEntry = await contractorEntry.update({
      name_of_farmer,
      state,
      district,
      taluka,
      village,
      total_quantity_assigned: newTotalDispatchedToFarmer,
      hp_3_to_farmer: newHp3DispatchedToFarmer,
      hp_5_to_farmer: newHp5DispatchedToFarmer,
      hp_7_5_to_farmer: newHp75DispatchedToFarmer,
      notes,
      farmer_dispatch_status: 'dispatched_to_farmer',
      action_by: req.user.id
    });

    // Calculate remaining units in contractor after this dispatch
    const totalRemainingInContractor = contractorEntry.total_quantity_to_contractor - newTotalDispatchedToFarmer;
    const hp3RemainingInContractor = contractorEntry.hp_3_forwarded_by_contractor - newHp3DispatchedToFarmer;
    const hp5RemainingInContractor = contractorEntry.hp_5_forwarded_by_contractor - newHp5DispatchedToFarmer;
    const hp75RemainingInContractor = contractorEntry.hp_7_5_forwarded_by_contractor - newHp75DispatchedToFarmer;

    // Update remaining units in contractor
    await contractorEntry.update({
      total_quantity_remaining_in_contractor: totalRemainingInContractor,
      hp_3_remaining_in_contractor: hp3RemainingInContractor,
      hp_5_remaining_in_contractor: hp5RemainingInContractor,
      hp_7_5_remaining_in_contractor: hp75RemainingInContractor
    });

    // Check if all units are dispatched to farmer
    const allUnitsDispatched = (
      newTotalDispatchedToFarmer >= contractorEntry.total_quantity_to_contractor &&
      newHp3DispatchedToFarmer >= contractorEntry.hp_3_forwarded_by_contractor &&
      newHp5DispatchedToFarmer >= contractorEntry.hp_5_forwarded_by_contractor &&
      newHp75DispatchedToFarmer >= contractorEntry.hp_7_5_forwarded_by_contractor
    );

    if (allUnitsDispatched) {
      // All units dispatched - complete contractor stage and start farmer and inspection stages
      await WorkOrder.update(
        { current_stage: 'farmer_inspection' },
        { where: { id: work_order_id } }
      );

      // Update stage records
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: 'Contractor stage completed - all units dispatched to farmer and inspection'
        },
        { where: { work_order_id, stage_name: 'contractor' } }
      );

      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'Farmer stage started - units received from contractor'
        },
        { where: { work_order_id, stage_name: 'farmer' } }
      );

      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'Inspection stage started - units received from contractor'
        },
        { where: { work_order_id, stage_name: 'inspection' } }
      );

      // Update contractor status
      await contractorEntry.update({ 
        status: 'all_units_dispatched',
        farmer_dispatch_status: 'all_units_dispatched'
      });
    } else {
      // Still have units to dispatch - keep contractor stage in progress
      const remainingTotal = contractorEntry.total_quantity_to_contractor - newTotalDispatchedToFarmer;
      await WorkOrderStage.update(
        { 
          status: 'in_progress',
          notes: `Contractor stage in progress - ${remainingTotal} units remaining to dispatch to farmer`
        },
        { where: { work_order_id, stage_name: 'contractor' } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Units successfully assigned to farmer and inspection',
      data: {
        id: updatedContractorEntry.id,
        work_order_id: updatedContractorEntry.work_order_id,
        total_quantity_to_contractor: updatedContractorEntry.total_quantity_to_contractor,
        hp_3_forwarded_by_contractor: updatedContractorEntry.hp_3_forwarded_by_contractor,
        hp_5_forwarded_by_contractor: updatedContractorEntry.hp_5_forwarded_by_contractor,
        hp_7_5_forwarded_by_contractor: updatedContractorEntry.hp_7_5_forwarded_by_contractor,
        current_assignment: {
          total: total_quantity_assigned,
          hp_3: hp_3_to_farmer,
          hp_5: hp_5_to_farmer,
          hp_7_5: hp_7_5_to_farmer
        },
        cumulative_assigned_to_farmer: {
          total: newTotalDispatchedToFarmer,
          hp_3: newHp3DispatchedToFarmer,
          hp_5: newHp5DispatchedToFarmer,
          hp_7_5: newHp75DispatchedToFarmer
        },
        remaining_in_contractor: {
          total: totalRemainingInContractor,
          hp_3: hp3RemainingInContractor,
          hp_5: hp5RemainingInContractor,
          hp_7_5: hp75RemainingInContractor
        },
        farmer_details: {
          name_of_farmer: updatedContractorEntry.name_of_farmer,
          state: updatedContractorEntry.state,
          district: updatedContractorEntry.district,
          taluka: updatedContractorEntry.taluka,
          village: updatedContractorEntry.village,
          notes: updatedContractorEntry.notes
        },
        farmer_dispatch_status: updatedContractorEntry.farmer_dispatch_status,
        dispatch_summary: {
          total_dispatched_to_farmer: newTotalDispatchedToFarmer,
          hp_3_dispatched_to_farmer: newHp3DispatchedToFarmer,
          hp_5_dispatched_to_farmer: newHp5DispatchedToFarmer,
          hp_7_5_dispatched_to_farmer: newHp75DispatchedToFarmer,
          total_dispatched_to_inspection: newTotalDispatchedToFarmer, // Same units go to both farmer and inspection
          hp_3_dispatched_to_inspection: newHp3DispatchedToFarmer,
          hp_5_dispatched_to_inspection: newHp5DispatchedToFarmer,
          hp_7_5_dispatched_to_inspection: newHp75DispatchedToFarmer
        },
        contractor_stage_completed: allUnitsDispatched,
        work_order_current_stage: allUnitsDispatched ? 'farmer_inspection' : 'contractor'
      }
    });

    // Send notifications if all units are dispatched
    if (allUnitsDispatched) {
      try {
        const workOrder = await WorkOrder.findByPk(work_order_id);
        const actionUser = await User.findByPk(req.user.id);
        // Notify both farmer and inspection roles
        await WorkOrderNotifications.stageCompleted(workOrder, 'contractor', 'farmer', actionUser);
        await WorkOrderNotifications.stageCompleted(workOrder, 'contractor', 'inspection', actionUser);
      } catch (notificationError) {
        console.error('Error sending stage completion notifications:', notificationError);
        // Don't fail the request if notifications fail
      }
    }

  } catch (error) {
    console.error('Error dispatching to farmer and inspection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
