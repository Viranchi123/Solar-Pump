import WorkOrderFactory from '../models/WorkOrderFactory.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { WorkOrderNotifications } from '../services/notificationService.js';

// Step 1: Enter units manufactured quantities
export const enterManufacturedUnits = async (req, res) => {
  try {
    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing. Please ensure Content-Type is application/json'
      });
    }

    const {
      work_order_id,
      total_quantity_manufactured,
      hp_3_manufactured,
      hp_5_manufactured,
      hp_7_5_manufactured
    } = req.body;

    // Validate required fields
    if (!work_order_id || !total_quantity_manufactured || hp_3_manufactured === undefined || hp_5_manufactured === undefined || hp_7_5_manufactured === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_manufactured, hp_3_manufactured, hp_5_manufactured, hp_7_5_manufactured'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_manufactured <= 0 || hp_3_manufactured < 0 || hp_5_manufactured < 0 || hp_7_5_manufactured < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity must be positive, HP quantities must be non-negative (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total manufactured quantity
    const sumOfHpQuantities = parseInt(hp_3_manufactured) + parseInt(hp_5_manufactured) + parseInt(hp_7_5_manufactured);
    if (sumOfHpQuantities !== parseInt(total_quantity_manufactured)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total manufactured quantity (${total_quantity_manufactured})`
      });
    }

    // Check if work order exists and get its details - THIS CHECK MUST HAPPEN FIRST
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found. Please check the work order ID and try again.`
      });
    }

    // Check if factory entry already exists for this work order
    const existingFactoryEntry = await WorkOrderFactory.findOne({
      where: { work_order_id }
    });

    let factoryEntry;
    let totalRemainingToManufacture;
    let hp3RemainingToManufacture;
    let hp5RemainingToManufacture;
    let hp75RemainingToManufacture;

    if (existingFactoryEntry) {
      // Update existing entry - check against remaining units to manufacture
      const currentRemainingToManufacture = existingFactoryEntry.total_quantity_remaining_to_manufacture !== null ? existingFactoryEntry.total_quantity_remaining_to_manufacture : workOrder.total_quantity;
      const currentHp3RemainingToManufacture = existingFactoryEntry.hp_3_remaining_to_manufacture !== null ? existingFactoryEntry.hp_3_remaining_to_manufacture : workOrder.hp_3_quantity;
      const currentHp5RemainingToManufacture = existingFactoryEntry.hp_5_remaining_to_manufacture !== null ? existingFactoryEntry.hp_5_remaining_to_manufacture : workOrder.hp_5_quantity;
      const currentHp75RemainingToManufacture = existingFactoryEntry.hp_7_5_remaining_to_manufacture !== null ? existingFactoryEntry.hp_7_5_remaining_to_manufacture : workOrder.hp_7_5_quantity;

      // Check if all units are already manufactured (remaining = 0)
      if (currentRemainingToManufacture <= 0) {
        return res.status(400).json({
          success: false,
          message: 'All units have already been manufactured. No more units can be manufactured for this work order.'
        });
      }

      // Validate that new manufactured quantities don't exceed remaining to manufacture
      if (total_quantity_manufactured > currentRemainingToManufacture) {
        return res.status(400).json({
          success: false,
          message: `Manufactured quantity (${total_quantity_manufactured}) cannot exceed remaining units to manufacture (${currentRemainingToManufacture}). You can only manufacture ${currentRemainingToManufacture} more units.`
        });
      }

      if (hp_3_manufactured > currentHp3RemainingToManufacture) {
        return res.status(400).json({
          success: false,
          message: `3 HP manufactured quantity (${hp_3_manufactured}) cannot exceed remaining 3 HP units to manufacture (${currentHp3RemainingToManufacture}). You can only manufacture ${currentHp3RemainingToManufacture} more 3 HP units.`
        });
      }

      if (hp_5_manufactured > currentHp5RemainingToManufacture) {
        return res.status(400).json({
          success: false,
          message: `5 HP manufactured quantity (${hp_5_manufactured}) cannot exceed remaining 5 HP units to manufacture (${currentHp5RemainingToManufacture}). You can only manufacture ${currentHp5RemainingToManufacture} more 5 HP units.`
        });
      }

      if (hp_7_5_manufactured > currentHp75RemainingToManufacture) {
        return res.status(400).json({
          success: false,
          message: `7.5 HP manufactured quantity (${hp_7_5_manufactured}) cannot exceed remaining 7.5 HP units to manufacture (${currentHp75RemainingToManufacture}). You can only manufacture ${currentHp75RemainingToManufacture} more 7.5 HP units.`
        });
      }

      // Add to existing manufactured quantities
      const newTotalManufactured = existingFactoryEntry.total_quantity_manufactured + total_quantity_manufactured;
      const newHp3Manufactured = existingFactoryEntry.hp_3_manufactured + hp_3_manufactured;
      const newHp5Manufactured = existingFactoryEntry.hp_5_manufactured + hp_5_manufactured;
      const newHp75Manufactured = existingFactoryEntry.hp_7_5_manufactured + hp_7_5_manufactured;

      // Update existing entry
      factoryEntry = await existingFactoryEntry.update({
        total_quantity_manufactured: newTotalManufactured,
        hp_3_manufactured: newHp3Manufactured,
        hp_5_manufactured: newHp5Manufactured,
        hp_7_5_manufactured: newHp75Manufactured,
        status: 'units_entered',
        action_by: req.user.id
      });

      // Calculate new remaining units to manufacture
      totalRemainingToManufacture = workOrder.total_quantity - newTotalManufactured;
      hp3RemainingToManufacture = workOrder.hp_3_quantity - newHp3Manufactured;
      hp5RemainingToManufacture = workOrder.hp_5_quantity - newHp5Manufactured;
      hp75RemainingToManufacture = workOrder.hp_7_5_quantity - newHp75Manufactured;

    } else {
      // Create new entry - work order existence is already validated above
      factoryEntry = await WorkOrderFactory.create({
        work_order_id: parseInt(work_order_id),
        total_quantity_manufactured: parseInt(total_quantity_manufactured),
        hp_3_manufactured: parseInt(hp_3_manufactured),
        hp_5_manufactured: parseInt(hp_5_manufactured),
        hp_7_5_manufactured: parseInt(hp_7_5_manufactured),
        status: 'units_entered',
        action_by: req.user.id
      });

      // Calculate remaining units to manufacture (admin total - manufactured)
      totalRemainingToManufacture = workOrder.total_quantity - total_quantity_manufactured;
      hp3RemainingToManufacture = workOrder.hp_3_quantity - hp_3_manufactured;
      hp5RemainingToManufacture = workOrder.hp_5_quantity - hp_5_manufactured;
      hp75RemainingToManufacture = workOrder.hp_7_5_quantity - hp_7_5_manufactured;
    }

    // Set initial remaining manufactured units (same as manufactured since nothing dispatched yet)
    const totalRemainingManufactured = factoryEntry.total_quantity_manufactured;
    const hp3RemainingManufactured = factoryEntry.hp_3_manufactured;
    const hp5RemainingManufactured = factoryEntry.hp_5_manufactured;
    const hp75RemainingManufactured = factoryEntry.hp_7_5_manufactured;

    // Update remaining units
    await factoryEntry.update({
      total_quantity_remaining_to_manufacture: totalRemainingToManufacture,
      hp_3_remaining_to_manufacture: hp3RemainingToManufacture,
      hp_5_remaining_to_manufacture: hp5RemainingToManufacture,
      hp_7_5_remaining_to_manufacture: hp75RemainingToManufacture,
      total_quantity_remaining: totalRemainingManufactured,
      hp_3_remaining: hp3RemainingManufactured,
      hp_5_remaining: hp5RemainingManufactured,
      hp_7_5_remaining: hp75RemainingManufactured
    });

    // Update stage records - mark factory stage as in progress
    await WorkOrderStage.update(
      { 
        status: 'in_progress', 
        started_at: new Date(),
        notes: `Factory entered manufactured units: Total ${total_quantity_manufactured} (3HP: ${hp_3_manufactured}, 5HP: ${hp_5_manufactured}, 7.5HP: ${hp_7_5_manufactured}). Remaining to manufacture: ${totalRemainingToManufacture} units. Remaining manufactured: ${totalRemainingManufactured} units`
      },
      { where: { work_order_id, stage_name: 'factory' } }
    );

    res.status(200).json({
      success: true,
      message: 'Manufactured units recorded successfully',
      data: {
        id: factoryEntry.id,
        work_order_id: factoryEntry.work_order_id,
        total_quantity_manufactured: factoryEntry.total_quantity_manufactured,
        hp_3_manufactured: factoryEntry.hp_3_manufactured,
        hp_5_manufactured: factoryEntry.hp_5_manufactured,
        hp_7_5_manufactured: factoryEntry.hp_7_5_manufactured,
        status: factoryEntry.status,
        action_by: factoryEntry.action_by,
        remaining_to_manufacture: {
          total: totalRemainingToManufacture,
          hp_3: hp3RemainingToManufacture,
          hp_5: hp5RemainingToManufacture,
          hp_7_5: hp75RemainingToManufacture
        },
        remaining_manufactured: {
          total: totalRemainingManufactured,
          hp_3: hp3RemainingManufactured,
          hp_5: hp5RemainingManufactured,
          hp_7_5: hp75RemainingManufactured
        }
      }
    });

  } catch (error) {
    console.error('Error recording manufactured units:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: Dispatch units to JSR for verification
export const dispatchToJSR = async (req, res) => {
  try {
    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing. Please ensure Content-Type is application/json'
      });
    }

    const {
      work_order_id,
      total_quantity_to_jsr,
      hp_3_to_jsr,
      hp_5_to_jsr,
      hp_7_5_to_jsr,
      state,
      district,
      taluka,
      village
    } = req.body;

    // Validate required fields
    if (!work_order_id || !total_quantity_to_jsr || hp_3_to_jsr === undefined || hp_5_to_jsr === undefined || hp_7_5_to_jsr === undefined || !state || !district || !taluka || !village) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_to_jsr, hp_3_to_jsr, hp_5_to_jsr, hp_7_5_to_jsr, state, district, taluka, village'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_to_jsr <= 0 || hp_3_to_jsr < 0 || hp_5_to_jsr < 0 || hp_7_5_to_jsr < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total quantity must be positive, HP quantities must be non-negative (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity to JSR
    const sumOfHpQuantities = parseInt(hp_3_to_jsr) + parseInt(hp_5_to_jsr) + parseInt(hp_7_5_to_jsr);
    if (sumOfHpQuantities !== parseInt(total_quantity_to_jsr)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity to JSR (${total_quantity_to_jsr})`
      });
    }

    // Check if work order exists - THIS CHECK MUST HAPPEN FIRST
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: `Work order with ID ${work_order_id} not found. Please check the work order ID and try again.`
      });
    }

    // Validate that JSR location exists in user database with 'jsr' role
    const jsrUser = await User.findOne({
      where: {
        role: 'jsr',
        state: state,
        district: district,
        taluka: taluka,
        village: village
      }
    });

    if (!jsrUser) {
      return res.status(400).json({
        success: false,
        message: `No JSR user found for the specified location: State: ${state}, District: ${district}, Taluka: ${taluka}, Village: ${village}. Please ensure the location matches an existing JSR user in the system.`
      });
    }

    // Get existing factory entry
    const factoryEntry = await WorkOrderFactory.findOne({
      where: { work_order_id }
    });

    if (!factoryEntry) {
      return res.status(404).json({
        success: false,
        message: 'No manufactured units found for this work order. Please enter manufactured quantities first.'
      });
    }

    // Get current remaining manufactured units (manufactured - already dispatched)
    const currentTotalRemainingManufactured = factoryEntry.total_quantity_remaining || factoryEntry.total_quantity_manufactured;
    const currentHp3RemainingManufactured = factoryEntry.hp_3_remaining || factoryEntry.hp_3_manufactured;
    const currentHp5RemainingManufactured = factoryEntry.hp_5_remaining || factoryEntry.hp_5_manufactured;
    const currentHp75RemainingManufactured = factoryEntry.hp_7_5_remaining || factoryEntry.hp_7_5_manufactured;

    // Validate that quantities to JSR don't exceed remaining manufactured units
    if (total_quantity_to_jsr > currentTotalRemainingManufactured) {
      return res.status(400).json({
        success: false,
        message: `Quantity to JSR (${total_quantity_to_jsr}) cannot exceed remaining manufactured units (${currentTotalRemainingManufactured})`
      });
    }

    if (hp_3_to_jsr > currentHp3RemainingManufactured) {
      return res.status(400).json({
        success: false,
        message: `3 HP quantity to JSR (${hp_3_to_jsr}) cannot exceed remaining manufactured 3 HP units (${currentHp3RemainingManufactured})`
      });
    }

    if (hp_5_to_jsr > currentHp5RemainingManufactured) {
      return res.status(400).json({
        success: false,
        message: `5 HP quantity to JSR (${hp_5_to_jsr}) cannot exceed remaining manufactured 5 HP units (${currentHp5RemainingManufactured})`
      });
    }

    if (hp_7_5_to_jsr > currentHp75RemainingManufactured) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP quantity to JSR (${hp_7_5_to_jsr}) cannot exceed remaining manufactured 7.5 HP units (${currentHp75RemainingManufactured})`
      });
    }

    // Calculate cumulative dispatched quantities (add to existing)
    const currentTotalDispatched = factoryEntry.total_quantity_to_jsr || 0;
    const currentHp3Dispatched = factoryEntry.hp_3_to_jsr || 0;
    const currentHp5Dispatched = factoryEntry.hp_5_to_jsr || 0;
    const currentHp75Dispatched = factoryEntry.hp_7_5_to_jsr || 0;

    const newTotalDispatched = currentTotalDispatched + total_quantity_to_jsr;
    const newHp3Dispatched = currentHp3Dispatched + hp_3_to_jsr;
    const newHp5Dispatched = currentHp5Dispatched + hp_5_to_jsr;
    const newHp75Dispatched = currentHp75Dispatched + hp_7_5_to_jsr;

    // Validate that cumulative quantities to JSR don't exceed manufactured quantities
    if (newTotalDispatched > factoryEntry.total_quantity_manufactured) {
      return res.status(400).json({
        success: false,
        message: `Cumulative quantity to JSR (${newTotalDispatched}) cannot exceed manufactured quantity (${factoryEntry.total_quantity_manufactured})`
      });
    }

    if (newHp3Dispatched > factoryEntry.hp_3_manufactured) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 3 HP quantity to JSR (${newHp3Dispatched}) cannot exceed manufactured 3 HP quantity (${factoryEntry.hp_3_manufactured})`
      });
    }

    if (newHp5Dispatched > factoryEntry.hp_5_manufactured) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 5 HP quantity to JSR (${newHp5Dispatched}) cannot exceed manufactured 5 HP quantity (${factoryEntry.hp_5_manufactured})`
      });
    }

    if (newHp75Dispatched > factoryEntry.hp_7_5_manufactured) {
      return res.status(400).json({
        success: false,
        message: `Cumulative 7.5 HP quantity to JSR (${newHp75Dispatched}) cannot exceed manufactured 7.5 HP quantity (${factoryEntry.hp_7_5_manufactured})`
      });
    }

    // Update factory entry with cumulative JSR dispatch details
    const updatedFactoryEntry = await factoryEntry.update({
      total_quantity_to_jsr: newTotalDispatched,
      hp_3_to_jsr: newHp3Dispatched,
      hp_5_to_jsr: newHp5Dispatched,
      hp_7_5_to_jsr: newHp75Dispatched,
      state,
      district,
      taluka,
      village,
      status: 'dispatched_to_jsr',
      action_by: req.user.id
    });

    // Calculate remaining manufactured units based on cumulative dispatched
    const totalRemainingManufactured = factoryEntry.total_quantity_manufactured - newTotalDispatched;
    const hp3RemainingManufactured = factoryEntry.hp_3_manufactured - newHp3Dispatched;
    const hp5RemainingManufactured = factoryEntry.hp_5_manufactured - newHp5Dispatched;
    const hp75RemainingManufactured = factoryEntry.hp_7_5_manufactured - newHp75Dispatched;

    // Update remaining manufactured units
    await factoryEntry.update({
      total_quantity_remaining: totalRemainingManufactured,
      hp_3_remaining: hp3RemainingManufactured,
      hp_5_remaining: hp5RemainingManufactured,
      hp_7_5_remaining: hp75RemainingManufactured
    });

    // Check if all admin units are manufactured and dispatched
    const allAdminUnitsManufactured = factoryEntry.total_quantity_remaining_to_manufacture === 0;
    const allManufacturedUnitsDispatched = totalRemainingManufactured === 0;
    const allUnitsComplete = allAdminUnitsManufactured && allManufacturedUnitsDispatched;

    // Update work order current stage to JSR when dispatching
    await WorkOrder.update(
      { current_stage: 'jsr' },
      { where: { id: work_order_id } }
    );

    // Update stage records - factory stage remains in progress until all admin units are manufactured and dispatched
    if (allUnitsComplete) {
      // All admin units manufactured and dispatched - mark factory stage as completed
      await WorkOrderStage.update(
        { 
          status: 'completed', 
          completed_at: new Date(),
          notes: `All admin units manufactured and dispatched to JSR. Total: ${workOrder.total_quantity} units`
        },
        { where: { work_order_id, stage_name: 'factory' } }
      );

      // Update factory status to all_units_dispatched
      await factoryEntry.update({ status: 'all_units_dispatched' });
    } else {
      // Some units remaining - update factory stage notes
      let notes = `Factory dispatched ${total_quantity_to_jsr} units to JSR. `;
      
      if (!allAdminUnitsManufactured) {
        notes += `Remaining to manufacture: ${factoryEntry.total_quantity_remaining_to_manufacture} units. `;
      }
      
      notes += `Remaining manufactured: ${totalRemainingManufactured} units (3HP: ${hp3RemainingManufactured}, 5HP: ${hp5RemainingManufactured}, 7.5HP: ${hp75RemainingManufactured})`;
      
      await WorkOrderStage.update(
        { notes },
        { where: { work_order_id, stage_name: 'factory' } }
      );
    }

    // Update JSR stage to in progress
    await WorkOrderStage.update(
      { 
        status: 'in_progress', 
        started_at: new Date(),
        notes: `Factory dispatched ${total_quantity_to_jsr} units to JSR at ${state}, ${district}, ${taluka}, ${village}`
      },
      { where: { work_order_id, stage_name: 'jsr' } }
    );

    // Get updated work order to verify stage change
    const updatedWorkOrder = await WorkOrder.findByPk(work_order_id);

    // Send notifications
    try {
      const actionUser = await User.findByPk(req.user.id);
      await WorkOrderNotifications.stageCompleted(updatedWorkOrder, 'factory', 'jsr', actionUser);
    } catch (notificationError) {
      console.error('Error sending stage completion notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(200).json({
      success: true,
      message: 'Units successfully dispatched to JSR for verification',
      data: {
        id: factoryEntry.id,
        work_order_id: factoryEntry.work_order_id,
        total_quantity_manufactured: factoryEntry.total_quantity_manufactured,
        hp_3_manufactured: factoryEntry.hp_3_manufactured,
        hp_5_manufactured: factoryEntry.hp_5_manufactured,
        hp_7_5_manufactured: factoryEntry.hp_7_5_manufactured,
        current_dispatch: {
          total: total_quantity_to_jsr,
          hp_3: hp_3_to_jsr,
          hp_5: hp_5_to_jsr,
          hp_7_5: hp_7_5_to_jsr
        },
        cumulative_dispatched: {
          total: newTotalDispatched,
          hp_3: newHp3Dispatched,
          hp_5: newHp5Dispatched,
          hp_7_5: newHp75Dispatched
        },
        remaining_to_manufacture: {
          total: factoryEntry.total_quantity_remaining_to_manufacture,
          hp_3: factoryEntry.hp_3_remaining_to_manufacture,
          hp_5: factoryEntry.hp_5_remaining_to_manufacture,
          hp_7_5: factoryEntry.hp_7_5_remaining_to_manufacture
        },
        remaining_manufactured: {
          total: totalRemainingManufactured,
          hp_3: hp3RemainingManufactured,
          hp_5: hp5RemainingManufactured,
          hp_7_5: hp75RemainingManufactured
        },
        all_units_complete: allUnitsComplete,
        work_order_stage_updated: {
          current_stage: updatedWorkOrder.current_stage,
          status: factoryEntry.status
        }
      }
    });

  } catch (error) {
    console.error('Error dispatching to JSR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
