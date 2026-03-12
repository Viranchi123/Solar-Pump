import WorkOrderJSR from '../models/WorkOrderJSR.js';
import WorkOrderFactory from '../models/WorkOrderFactory.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { WorkOrderNotifications } from '../services/notificationService.js';

// Step 1: JSR receives and verifies units from factory
export const receiveAndVerifyUnits = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_received,
      hp_3_received,
      hp_5_received,
      hp_7_5_received
    } = req.body;

    // Validate required fields
    if (!work_order_id || !total_quantity_received || hp_3_received === undefined || hp_5_received === undefined || hp_7_5_received === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_received, hp_3_received, hp_5_received, hp_7_5_received'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_received <= 0 || hp_3_received < 0 || hp_5_received < 0 || hp_7_5_received < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity must be positive, HP quantities must be non-negative (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total received quantity
    const sumOfHpQuantities = parseInt(hp_3_received) + parseInt(hp_5_received) + parseInt(hp_7_5_received);
    if (sumOfHpQuantities !== parseInt(total_quantity_received)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total received quantity (${total_quantity_received})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for JSR
    if (workOrder.current_stage !== 'jsr') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for JSR. Current stage: ${workOrder.current_stage}. Expected stage: jsr. Please ensure the work order has been properly dispatched from factory.`
      });
    }

    // FLOW VALIDATION: Check if factory has properly dispatched units to JSR
    const factoryEntry = await WorkOrderFactory.findOne({
      where: { 
        work_order_id,
        status: ['dispatched_to_jsr', 'all_units_dispatched']
      }
    });

    if (!factoryEntry) {
      return res.status(400).json({
        success: false,
        message: 'This work order has not been dispatched from factory to JSR. Please wait for factory to complete the dispatch process before proceeding with JSR operations.'
      });
    }

    // FLOW VALIDATION: Check if factory dispatch has all required location details
    if (!factoryEntry.state || !factoryEntry.district || !factoryEntry.taluka || !factoryEntry.village) {
      return res.status(400).json({
        success: false,
        message: 'Factory dispatch is incomplete. Location details (state, district, taluka, village) are missing. Please contact factory to complete the dispatch.'
      });
    }

    // FLOW VALIDATION: Check if JSR user location matches factory dispatch location
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'jsr') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only JSR users can perform this operation.'
      });
    }

    // Validate that JSR user location matches the dispatched location
    if (currentUser.state !== factoryEntry.state || 
        currentUser.district !== factoryEntry.district || 
        currentUser.taluka !== factoryEntry.taluka || 
        currentUser.village !== factoryEntry.village) {
      return res.status(400).json({
        success: false,
        message: `Location mismatch. You are assigned to: ${currentUser.state}, ${currentUser.district}, ${currentUser.taluka}, ${currentUser.village}. But work order was dispatched to: ${factoryEntry.state}, ${factoryEntry.district}, ${factoryEntry.taluka}, ${factoryEntry.village}.`
      });
    }

    // Validate that received quantities don't exceed dispatched quantities
    if (total_quantity_received > factoryEntry.total_quantity_to_jsr) {
      return res.status(400).json({
        success: false,
        message: `Received quantity (${total_quantity_received}) cannot exceed dispatched quantity (${factoryEntry.total_quantity_to_jsr})`
      });
    }

    if (hp_3_received > factoryEntry.hp_3_to_jsr) {
      return res.status(400).json({
        success: false,
        message: `3 HP received quantity (${hp_3_received}) cannot exceed dispatched 3 HP quantity (${factoryEntry.hp_3_to_jsr})`
      });
    }

    if (hp_5_received > factoryEntry.hp_5_to_jsr) {
      return res.status(400).json({
        success: false,
        message: `5 HP received quantity (${hp_5_received}) cannot exceed dispatched 5 HP quantity (${factoryEntry.hp_5_to_jsr})`
      });
    }

    if (hp_7_5_received > factoryEntry.hp_7_5_to_jsr) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP received quantity (${hp_7_5_received}) cannot exceed dispatched 7.5 HP quantity (${factoryEntry.hp_7_5_to_jsr})`
      });
    }

    // Check if JSR entry already exists for this work order
    const existingJSREntry = await WorkOrderJSR.findOne({
      where: { work_order_id }
    });

    let jsrEntry;
    let totalRemainingToReceive;
    let hp3RemainingToReceive;
    let hp5RemainingToReceive;
    let hp75RemainingToReceive;

    if (existingJSREntry) {
      // Update existing entry - check against remaining units to receive from factory
      const currentTotalReceived = existingJSREntry.total_quantity_received || 0;
      const currentHp3Received = existingJSREntry.hp_3_received || 0;
      const currentHp5Received = existingJSREntry.hp_5_received || 0;
      const currentHp75Received = existingJSREntry.hp_7_5_received || 0;

      // Calculate remaining units to receive from factory
      totalRemainingToReceive = factoryEntry.total_quantity_to_jsr - currentTotalReceived;
      hp3RemainingToReceive = factoryEntry.hp_3_to_jsr - currentHp3Received;
      hp5RemainingToReceive = factoryEntry.hp_5_to_jsr - currentHp5Received;
      hp75RemainingToReceive = factoryEntry.hp_7_5_to_jsr - currentHp75Received;

      // Validate that new received quantities don't exceed remaining to receive
      if (total_quantity_received > totalRemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `Received quantity (${total_quantity_received}) cannot exceed remaining units to receive from factory (${totalRemainingToReceive})`
        });
      }

      if (hp_3_received > hp3RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `3 HP received quantity (${hp_3_received}) cannot exceed remaining 3 HP units to receive (${hp3RemainingToReceive})`
        });
      }

      if (hp_5_received > hp5RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `5 HP received quantity (${hp_5_received}) cannot exceed remaining 5 HP units to receive (${hp5RemainingToReceive})`
        });
      }

      if (hp_7_5_received > hp75RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `7.5 HP received quantity (${hp_7_5_received}) cannot exceed remaining 7.5 HP units to receive (${hp75RemainingToReceive})`
        });
      }

      // Add to existing received quantities
      const newTotalReceived = currentTotalReceived + total_quantity_received;
      const newHp3Received = currentHp3Received + hp_3_received;
      const newHp5Received = currentHp5Received + hp_5_received;
      const newHp75Received = currentHp75Received + hp_7_5_received;

      // Update existing entry
      jsrEntry = await existingJSREntry.update({
        total_quantity_received: newTotalReceived,
        hp_3_received: newHp3Received,
        hp_5_received: newHp5Received,
        hp_7_5_received: newHp75Received,
        jsr_status: 'pending',
        action_by: req.user.id
      });

      // Calculate new remaining units to receive
      totalRemainingToReceive = factoryEntry.total_quantity_to_jsr - newTotalReceived;
      hp3RemainingToReceive = factoryEntry.hp_3_to_jsr - newHp3Received;
      hp5RemainingToReceive = factoryEntry.hp_5_to_jsr - newHp5Received;
      hp75RemainingToReceive = factoryEntry.hp_7_5_to_jsr - newHp75Received;

    } else {
      // Create new entry
      jsrEntry = await WorkOrderJSR.create({
        work_order_id: parseInt(work_order_id),
        factory_entry_id: factoryEntry.id,
        total_quantity_received: parseInt(total_quantity_received),
        hp_3_received: parseInt(hp_3_received),
        hp_5_received: parseInt(hp_5_received),
        hp_7_5_received: parseInt(hp_7_5_received),
        jsr_status: 'pending',
        action_by: req.user.id
      });

      // Calculate remaining units to receive
      totalRemainingToReceive = factoryEntry.total_quantity_to_jsr - total_quantity_received;
      hp3RemainingToReceive = factoryEntry.hp_3_to_jsr - hp_3_received;
      hp5RemainingToReceive = factoryEntry.hp_5_to_jsr - hp_5_received;
      hp75RemainingToReceive = factoryEntry.hp_7_5_to_jsr - hp_7_5_received;
    }

    res.status(200).json({
      success: true,
      message: 'Units received and verified successfully',
      data: {
        id: jsrEntry.id,
        work_order_id: jsrEntry.work_order_id,
        total_quantity_received: jsrEntry.total_quantity_received,
        hp_3_received: jsrEntry.hp_3_received,
        hp_5_received: jsrEntry.hp_5_received,
        hp_7_5_received: jsrEntry.hp_7_5_received,
        jsr_status: jsrEntry.jsr_status,
        action_by: jsrEntry.action_by,
        remaining_to_receive: {
          total: totalRemainingToReceive,
          hp_3: hp3RemainingToReceive,
          hp_5: hp5RemainingToReceive,
          hp_7_5: hp75RemainingToReceive
        }
      }
    });

  } catch (error) {
    console.error('Error receiving and verifying units:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: JSR approves or rejects the work order
export const approveOrRejectJSR = async (req, res) => {
  try {
    console.log('JSR Approve/Reject - Request received:', {
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'No files'
    });

    const {
      work_order_id,
      jsr_status,
      farmer_name,
      state,
      district,
      taluka,
      village
    } = req.body;

    // Get uploaded files
    const installation_site_photo = req.files?.installation_site_photo?.[0];
    const lineman_installation_set_photo = req.files?.['lineman_installation_set']?.[0];
    const set_close_up_photo = req.files?.set_close_up_photo?.[0];

    console.log('JSR Approve/Reject - Files extracted:', {
      installation_site_photo: installation_site_photo?.filename,
      lineman_installation_set_photo: lineman_installation_set_photo?.filename,
      set_close_up_photo: set_close_up_photo?.filename
    });

    // Validate required fields
    if (!work_order_id || !jsr_status) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id and jsr_status are required fields'
      });
    }

    // Validate jsr_status
    if (!['approved', 'rejected'].includes(jsr_status)) {
      return res.status(400).json({
        success: false,
        message: 'jsr_status must be either "approved" or "rejected"'
      });
    }

    // Validate required fields for approval
    if (jsr_status === 'approved') {
      if (!farmer_name || !state || !district || !taluka || !village) {
        return res.status(400).json({
          success: false,
          message: 'For approval, farmer_name, state, district, taluka, and village are required'
        });
      }

      if (!installation_site_photo || !lineman_installation_set_photo || !set_close_up_photo) {
        return res.status(400).json({
          success: false,
          message: 'For approval, all three photos are required: installation_site_photo, lineman_installation_set, and set_close_up_photo'
        });
      }
    }

    // Check if work order exists
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found. Please check the work order ID and try again.`
      });
    }

    // FLOW VALIDATION: Check if work order is in the correct stage for JSR
    if (workOrder.current_stage !== 'jsr') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for JSR operations. Current stage: ${workOrder.current_stage}. Expected stage: jsr.`
      });
    }

    // Check if JSR entry exists
    const jsrEntry = await WorkOrderJSR.findOne({
      where: { work_order_id }
    });

    if (!jsrEntry) {
      return res.status(404).json({
        success: false,
        message: 'No JSR entry found for this work order. Please receive and verify units first.'
      });
    }

    // FLOW VALIDATION: Check if JSR user has permission for this work order
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'jsr') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only JSR users can perform this operation.'
      });
    }

    // Get factory entry to validate location
    const factoryEntry = await WorkOrderFactory.findOne({
      where: { work_order_id }
    });

    if (factoryEntry) {
      // Validate that JSR user location matches the dispatched location
      if (currentUser.state !== factoryEntry.state || 
          currentUser.district !== factoryEntry.district || 
          currentUser.taluka !== factoryEntry.taluka || 
          currentUser.village !== factoryEntry.village) {
        return res.status(400).json({
          success: false,
          message: `Location mismatch. You are assigned to: ${currentUser.state}, ${currentUser.district}, ${currentUser.taluka}, ${currentUser.village}. But work order was dispatched to: ${factoryEntry.state}, ${factoryEntry.district}, ${factoryEntry.taluka}, ${factoryEntry.village}.`
        });
      }
    }

    // Prepare update data
    const updateData = {
      jsr_status,
      farmer_name,
      state,
      district,
      taluka,
      village,
      action_by: req.user.id
    };

    // Add photo file paths if files are uploaded
    if (installation_site_photo) {
      updateData.installation_site_photo = installation_site_photo.filename;
    }
    if (lineman_installation_set_photo) {
      updateData.lineman_installation_set_photo = lineman_installation_set_photo.filename;
    }
    if (set_close_up_photo) {
      updateData.set_close_up_photo = set_close_up_photo.filename;
    }

    // Update JSR entry with approval/rejection details
    const updatedJSREntry = await jsrEntry.update(updateData);

    // Update work order with JSR approval status
    const workOrderUpdateData = {
      jsr_approval_status: jsr_status,
      jsr_approved_by: req.user.id,
      jsr_approval_date: new Date()
    };

    if (jsr_status === 'rejected') {
      workOrderUpdateData.current_stage = 'rejected_by_jsr';
    }

    await WorkOrder.update(workOrderUpdateData, { where: { id: work_order_id } });

    res.status(200).json({
      success: true,
      message: `JSR ${jsr_status} successfully`,
      data: {
        id: updatedJSREntry.id,
        work_order_id: updatedJSREntry.work_order_id,
        total_quantity_received: updatedJSREntry.total_quantity_received,
        hp_3_received: updatedJSREntry.hp_3_received,
        hp_5_received: updatedJSREntry.hp_5_received,
        hp_7_5_received: updatedJSREntry.hp_7_5_received,
        jsr_status: updatedJSREntry.jsr_status,
        farmer_name: updatedJSREntry.farmer_name,
        location: {
          state: updatedJSREntry.state,
          district: updatedJSREntry.district,
          taluka: updatedJSREntry.taluka,
          village: updatedJSREntry.village
        },
        photos: {
          installation_site_photo: updatedJSREntry.installation_site_photo,
          lineman_installation_set_photo: updatedJSREntry.lineman_installation_set_photo,
          set_close_up_photo: updatedJSREntry.set_close_up_photo
        },
        action_by: updatedJSREntry.action_by,
        updatedAt: updatedJSREntry.updatedAt
      }
    });

  } catch (error) {
    console.error('Error approving/rejecting JSR:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 3: JSR dispatches approved units to warehouse
export const dispatchToWarehouse = async (req, res) => {
  try {
    const {
      work_order_id,
      warehouse_location,
      total_quantity_to_warehouse,
      hp_3_to_warehouse,
      hp_5_to_warehouse,
      hp_7_5_to_warehouse
    } = req.body;

    // Validate required fields
    if (!work_order_id || !warehouse_location || total_quantity_to_warehouse === undefined || hp_3_to_warehouse === undefined || hp_5_to_warehouse === undefined || hp_7_5_to_warehouse === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, warehouse_location, total_quantity_to_warehouse, hp_3_to_warehouse, hp_5_to_warehouse, hp_7_5_to_warehouse'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_to_warehouse < 0 || hp_3_to_warehouse < 0 || hp_5_to_warehouse < 0 || hp_7_5_to_warehouse < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that total quantity is positive (at least one unit must be dispatched)
    if (total_quantity_to_warehouse <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity to warehouse must be greater than 0. You must dispatch at least one unit.'
      });
    }

    // Validate that HP quantities sum up to total quantity to warehouse
    const sumOfHpQuantities = parseInt(hp_3_to_warehouse) + parseInt(hp_5_to_warehouse) + parseInt(hp_7_5_to_warehouse);
    if (sumOfHpQuantities !== parseInt(total_quantity_to_warehouse)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity to warehouse (${total_quantity_to_warehouse})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for JSR
    if (workOrder.current_stage !== 'jsr') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for JSR operations. Current stage: ${workOrder.current_stage}. Expected stage: jsr.`
      });
    }

    // Check if JSR entry exists and is approved
    const jsrEntry = await WorkOrderJSR.findOne({
      where: { work_order_id }
    });

    if (!jsrEntry) {
      return res.status(404).json({
        success: false,
        message: 'No JSR entry found for this work order. Please complete JSR verification first.'
      });
    }

    if (jsrEntry.jsr_status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot dispatch to warehouse. JSR status must be "approved".'
      });
    }

    // FLOW VALIDATION: Check if JSR user has permission for this work order
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'jsr') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only JSR users can perform this operation.'
      });
    }

    // Get current remaining received units (received - already dispatched to warehouse)
    const currentTotalDispatchedToWarehouse = jsrEntry.total_quantity_to_warehouse || 0;
    const currentHp3DispatchedToWarehouse = jsrEntry.hp_3_to_warehouse || 0;
    const currentHp5DispatchedToWarehouse = jsrEntry.hp_5_to_warehouse || 0;
    const currentHp75DispatchedToWarehouse = jsrEntry.hp_7_5_to_warehouse || 0;

    // Calculate remaining received units available for dispatch to warehouse
    const totalRemainingReceived = jsrEntry.total_quantity_received - currentTotalDispatchedToWarehouse;
    const hp3RemainingReceived = jsrEntry.hp_3_received - currentHp3DispatchedToWarehouse;
    const hp5RemainingReceived = jsrEntry.hp_5_received - currentHp5DispatchedToWarehouse;
    const hp75RemainingReceived = jsrEntry.hp_7_5_received - currentHp75DispatchedToWarehouse;

    // Validate that quantities to warehouse don't exceed remaining received quantities
    if (total_quantity_to_warehouse > totalRemainingReceived) {
      return res.status(400).json({
        success: false,
        message: `Quantity to warehouse (${total_quantity_to_warehouse}) cannot exceed remaining received units (${totalRemainingReceived})`
      });
    }

    if (hp_3_to_warehouse > hp3RemainingReceived) {
      return res.status(400).json({
        success: false,
        message: `3 HP quantity to warehouse (${hp_3_to_warehouse}) cannot exceed remaining received 3 HP units (${hp3RemainingReceived})`
      });
    }

    if (hp_5_to_warehouse > hp5RemainingReceived) {
      return res.status(400).json({
        success: false,
        message: `5 HP quantity to warehouse (${hp_5_to_warehouse}) cannot exceed remaining received 5 HP units (${hp5RemainingReceived})`
      });
    }

    if (hp_7_5_to_warehouse > hp75RemainingReceived) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP quantity to warehouse (${hp_7_5_to_warehouse}) cannot exceed remaining received 7.5 HP units (${hp75RemainingReceived})`
      });
    }

    // Calculate cumulative dispatched quantities (add to existing)
    const newTotalDispatchedToWarehouse = currentTotalDispatchedToWarehouse + total_quantity_to_warehouse;
    const newHp3DispatchedToWarehouse = currentHp3DispatchedToWarehouse + hp_3_to_warehouse;
    const newHp5DispatchedToWarehouse = currentHp5DispatchedToWarehouse + hp_5_to_warehouse;
    const newHp75DispatchedToWarehouse = currentHp75DispatchedToWarehouse + hp_7_5_to_warehouse;

    // Update JSR entry with cumulative warehouse dispatch details
    const updatedJSREntry = await jsrEntry.update({
      warehouse_location,
      total_quantity_to_warehouse: newTotalDispatchedToWarehouse,
      hp_3_to_warehouse: newHp3DispatchedToWarehouse,
      hp_5_to_warehouse: newHp5DispatchedToWarehouse,
      hp_7_5_to_warehouse: newHp75DispatchedToWarehouse,
      warehouse_dispatch_status: 'dispatched',
      action_by: req.user.id
    });

    // Check if all units are dispatched to warehouse
    const allUnitsDispatched = (
      newTotalDispatchedToWarehouse >= jsrEntry.total_quantity_received &&
      newHp3DispatchedToWarehouse >= jsrEntry.hp_3_received &&
      newHp5DispatchedToWarehouse >= jsrEntry.hp_5_received &&
      newHp75DispatchedToWarehouse >= jsrEntry.hp_7_5_received
    );

    if (allUnitsDispatched) {
      // All units dispatched - complete JSR stage and start warehouse stage
      await WorkOrder.update(
        { current_stage: 'whouse' },
        { where: { id: work_order_id } }
      );

      // Update stage records
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: 'JSR stage completed - all units dispatched to warehouse'
        },
        { where: { work_order_id, stage_name: 'jsr' } }
      );

      await WorkOrderStage.update(
        { 
          status: 'in_progress', 
          started_at: new Date(),
          notes: 'Warehouse stage started - units received from JSR'
        },
        { where: { work_order_id, stage_name: 'whouse' } }
      );
    } else {
      // Still have units to dispatch - keep JSR stage in progress
      const remainingTotal = jsrEntry.total_quantity_received - newTotalDispatchedToWarehouse;
      await WorkOrderStage.update(
        { 
          status: 'in_progress',
          notes: `JSR stage in progress - ${remainingTotal} units remaining to dispatch to warehouse`
        },
        { where: { work_order_id, stage_name: 'jsr' } }
      );
    }

    // Calculate final remaining received units after this dispatch
    const finalTotalRemainingReceived = jsrEntry.total_quantity_received - newTotalDispatchedToWarehouse;
    const finalHp3RemainingReceived = jsrEntry.hp_3_received - newHp3DispatchedToWarehouse;
    const finalHp5RemainingReceived = jsrEntry.hp_5_received - newHp5DispatchedToWarehouse;
    const finalHp75RemainingReceived = jsrEntry.hp_7_5_received - newHp75DispatchedToWarehouse;

    // Send notifications if all units are dispatched
    if (allUnitsDispatched) {
      try {
        const workOrder = await WorkOrder.findByPk(work_order_id);
        const actionUser = await User.findByPk(req.user.id);
        await WorkOrderNotifications.stageCompleted(workOrder, 'jsr', 'whouse', actionUser);
      } catch (notificationError) {
        console.error('Error sending stage completion notifications:', notificationError);
        // Don't fail the request if notifications fail
      }
    }

    res.status(200).json({
      success: true,
      message: 'Units successfully dispatched to warehouse',
      data: {
        id: updatedJSREntry.id,
        work_order_id: updatedJSREntry.work_order_id,
        total_quantity_received: updatedJSREntry.total_quantity_received,
        hp_3_received: updatedJSREntry.hp_3_received,
        hp_5_received: updatedJSREntry.hp_5_received,
        hp_7_5_received: updatedJSREntry.hp_7_5_received,
        current_dispatch: {
          total: total_quantity_to_warehouse,
          hp_3: hp_3_to_warehouse,
          hp_5: hp_5_to_warehouse,
          hp_7_5: hp_7_5_to_warehouse
        },
        cumulative_dispatched_to_warehouse: {
          total: newTotalDispatchedToWarehouse,
          hp_3: newHp3DispatchedToWarehouse,
          hp_5: newHp5DispatchedToWarehouse,
          hp_7_5: newHp75DispatchedToWarehouse
        },
        remaining_received: {
          total: finalTotalRemainingReceived,
          hp_3: finalHp3RemainingReceived,
          hp_5: finalHp5RemainingReceived,
          hp_7_5: finalHp75RemainingReceived
        },
        warehouse_location: updatedJSREntry.warehouse_location,
        warehouse_dispatch_status: updatedJSREntry.warehouse_dispatch_status,
        jsr_stage_completed: allUnitsDispatched,
        work_order_current_stage: allUnitsDispatched ? 'whouse' : 'jsr'
      }
    });

  } catch (error) {
    console.error('Error dispatching to warehouse:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
