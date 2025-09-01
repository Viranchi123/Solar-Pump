import WorkOrderInspection from '../models/WorkOrderInspection.js';
import WorkOrderContractor from '../models/WorkOrderContractor.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';

// Step 1: Inspection receives and verifies units from contractor
export const receiveAndVerifyUnits = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_for_inspection,
      hp_3_for_inspection,
      hp_5_for_inspection,
      hp_7_5_for_inspection
    } = req.body;

    // Validate required fields
    if (!work_order_id || total_quantity_for_inspection === undefined || hp_3_for_inspection === undefined || hp_5_for_inspection === undefined || hp_7_5_for_inspection === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_for_inspection, hp_3_for_inspection, hp_5_for_inspection, hp_7_5_for_inspection'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_for_inspection < 0 || hp_3_for_inspection < 0 || hp_5_for_inspection < 0 || hp_7_5_for_inspection < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity for inspection
    const sumOfHpQuantities = parseInt(hp_3_for_inspection) + parseInt(hp_5_for_inspection) + parseInt(hp_7_5_for_inspection);
    if (sumOfHpQuantities !== parseInt(total_quantity_for_inspection)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity for inspection (${total_quantity_for_inspection})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for inspection
    if (workOrder.current_stage !== 'farmer_inspection') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for inspection operations. Current stage: ${workOrder.current_stage}. Expected stage: farmer_inspection.`
      });
    }

    // FLOW VALIDATION: Check if contractor has properly dispatched units
    const contractorEntry = await WorkOrderContractor.findOne({
      where: { 
        work_order_id,
        status: ['all_units_dispatched']
      }
    });

    if (!contractorEntry) {
      return res.status(400).json({
        success: false,
        message: 'This work order has not been dispatched from contractor. Please wait for contractor to complete the dispatch process before proceeding with inspection operations.'
      });
    }

    // Validate that inspection quantities don't exceed contractor dispatched quantities
    if (total_quantity_for_inspection > contractorEntry.total_quantity_assigned) {
      return res.status(400).json({
        success: false,
        message: `Inspection quantity (${total_quantity_for_inspection}) cannot exceed contractor dispatched quantity (${contractorEntry.total_quantity_assigned})`
      });
    }

    if (hp_3_for_inspection > contractorEntry.hp_3_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `3 HP inspection quantity (${hp_3_for_inspection}) cannot exceed contractor dispatched 3 HP quantity (${contractorEntry.hp_3_to_farmer})`
      });
    }

    if (hp_5_for_inspection > contractorEntry.hp_5_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `5 HP inspection quantity (${hp_5_for_inspection}) cannot exceed contractor dispatched 5 HP quantity (${contractorEntry.hp_5_to_farmer})`
      });
    }

    if (hp_7_5_for_inspection > contractorEntry.hp_7_5_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP inspection quantity (${hp_7_5_for_inspection}) cannot exceed contractor dispatched 7.5 HP quantity (${contractorEntry.hp_7_5_to_farmer})`
      });
    }

    // FLOW VALIDATION: Check if inspection user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'inspection') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only inspection users can perform this operation.'
      });
    }

    // Check if inspection entry already exists for this work order
    const existingInspectionEntry = await WorkOrderInspection.findOne({
      where: { work_order_id }
    });

    let inspectionEntry;
    let totalRemainingToReceive;
    let hp3RemainingToReceive;
    let hp5RemainingToReceive;
    let hp75RemainingToReceive;

    if (existingInspectionEntry) {
      // Update existing entry - check against remaining units to receive from contractor
      const currentTotalReceived = existingInspectionEntry.total_quantity_for_inspection || 0;
      const currentHp3Received = existingInspectionEntry.hp_3_for_inspection || 0;
      const currentHp5Received = existingInspectionEntry.hp_5_for_inspection || 0;
      const currentHp75Received = existingInspectionEntry.hp_7_5_for_inspection || 0;

      // Calculate remaining units to receive from contractor
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - currentTotalReceived;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - currentHp3Received;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - currentHp5Received;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - currentHp75Received;

      // Validate that new received quantities don't exceed remaining to receive
      if (total_quantity_for_inspection > totalRemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `Inspection quantity (${total_quantity_for_inspection}) cannot exceed remaining units to receive from contractor (${totalRemainingToReceive})`
        });
      }

      if (hp_3_for_inspection > hp3RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `3 HP inspection quantity (${hp_3_for_inspection}) cannot exceed remaining 3 HP units to receive (${hp3RemainingToReceive})`
        });
      }

      if (hp_5_for_inspection > hp5RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `5 HP inspection quantity (${hp_5_for_inspection}) cannot exceed remaining 5 HP units to receive (${hp5RemainingToReceive})`
        });
      }

      if (hp_7_5_for_inspection > hp75RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `7.5 HP inspection quantity (${hp_7_5_for_inspection}) cannot exceed remaining 7.5 HP units to receive (${hp75RemainingToReceive})`
        });
      }

      // Add to existing received quantities
      const newTotalReceived = currentTotalReceived + total_quantity_for_inspection;
      const newHp3Received = currentHp3Received + hp_3_for_inspection;
      const newHp5Received = currentHp5Received + hp_5_for_inspection;
      const newHp75Received = currentHp75Received + hp_7_5_for_inspection;

      // Update existing entry
      inspectionEntry = await existingInspectionEntry.update({
        total_quantity_for_inspection: newTotalReceived,
        hp_3_for_inspection: newHp3Received,
        hp_5_for_inspection: newHp5Received,
        hp_7_5_for_inspection: newHp75Received,
        inspection_status: 'pending',
        action_by: req.user.id
      });

      // Calculate new remaining units to receive
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - newTotalReceived;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - newHp3Received;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - newHp5Received;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - newHp75Received;

    } else {
      // Create new entry
      inspectionEntry = await WorkOrderInspection.create({
        work_order_id: parseInt(work_order_id),
        contractor_entry_id: contractorEntry.id,
        total_quantity_for_inspection: parseInt(total_quantity_for_inspection),
        hp_3_for_inspection: parseInt(hp_3_for_inspection),
        hp_5_for_inspection: parseInt(hp_5_for_inspection),
        hp_7_5_for_inspection: parseInt(hp_7_5_for_inspection),
        inspection_status: 'pending',
        action_by: req.user.id
      });

      // Calculate remaining units to receive
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - total_quantity_for_inspection;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - hp_3_for_inspection;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - hp_5_for_inspection;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - hp_7_5_for_inspection;
    }

    res.status(200).json({
      success: true,
      message: 'Units received for inspection successfully',
      data: {
        id: inspectionEntry.id,
        work_order_id: inspectionEntry.work_order_id,
        total_quantity_for_inspection: inspectionEntry.total_quantity_for_inspection,
        hp_3_for_inspection: inspectionEntry.hp_3_for_inspection,
        hp_5_for_inspection: inspectionEntry.hp_5_for_inspection,
        hp_7_5_for_inspection: inspectionEntry.hp_7_5_for_inspection,
        inspection_status: inspectionEntry.inspection_status,
        action_by: inspectionEntry.action_by,
        contractor_dispatch_info: {
          total_dispatched_by_contractor: contractorEntry.total_quantity_assigned,
          hp_3_dispatched_by_contractor: contractorEntry.hp_3_to_farmer,
          hp_5_dispatched_by_contractor: contractorEntry.hp_5_to_farmer,
          hp_7_5_dispatched_by_contractor: contractorEntry.hp_7_5_to_farmer
        },
        remaining_to_receive: {
          total: totalRemainingToReceive,
          hp_3: hp3RemainingToReceive,
          hp_5: hp5RemainingToReceive,
          hp_7_5: hp75RemainingToReceive
        }
      }
    });

  } catch (error) {
    console.error('Error receiving units for inspection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: Inspection accepts or rejects the work order
export const acceptOrRejectInspection = async (req, res) => {
  try {
    console.log('Inspection Accept/Reject - Request received:', {
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'No files'
    });

    const {
      work_order_id,
      inspection_status,
      farmer_name,
      district,
      taluka,
      village
    } = req.body;

    // Get uploaded files
    const installation_site_photo = req.files?.installation_site_photo?.[0];
    const lineman_installation_set_photo = req.files?.['lineman_installation_set']?.[0];
    const set_close_up_photo = req.files?.set_close_up_photo?.[0];

    console.log('Inspection Accept/Reject - Files extracted:', {
      installation_site_photo: installation_site_photo?.filename,
      lineman_installation_set_photo: lineman_installation_set_photo?.filename,
      set_close_up_photo: set_close_up_photo?.filename
    });

    // Validate required fields
    if (!work_order_id || !inspection_status) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id and inspection_status are required fields'
      });
    }

    // Validate inspection_status
    if (!['approved', 'rejected'].includes(inspection_status)) {
      return res.status(400).json({
        success: false,
        message: 'inspection_status must be either "approved" or "rejected"'
      });
    }

    // Validate required fields for approval
    if (inspection_status === 'approved') {
      if (!farmer_name || !district || !taluka || !village) {
        return res.status(400).json({
          success: false,
          message: 'For approval, farmer_name, district, taluka, and village are required'
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

    // FLOW VALIDATION: Check if work order is in the correct stage for inspection
    if (workOrder.current_stage !== 'farmer_inspection') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for inspection operations. Current stage: ${workOrder.current_stage}. Expected stage: farmer_inspection.`
      });
    }

    // Check if inspection entry exists
    const inspectionEntry = await WorkOrderInspection.findOne({
      where: { work_order_id }
    });

    if (!inspectionEntry) {
      return res.status(404).json({
        success: false,
        message: 'No inspection entry found for this work order. Please receive and verify units first.'
      });
    }

    // FLOW VALIDATION: Check if inspection user has permission for this work order
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'inspection') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only inspection users can perform this operation.'
      });
    }

    // Prepare update data
    const updateData = {
      inspection_status,
      farmer_name,
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

    // Update inspection entry with approval/rejection details
    const updatedInspectionEntry = await inspectionEntry.update(updateData);

    // Update work order with Inspection approval status
    const workOrderUpdateData = {
      inspection_approval_status: inspection_status,
      inspection_approved_by: req.user.id,
      inspection_approval_date: new Date()
    };

    if (inspection_status === 'rejected') {
      workOrderUpdateData.current_stage = 'rejected_by_inspection';
    }

    await WorkOrder.update(workOrderUpdateData, { where: { id: work_order_id } });

    res.status(200).json({
      success: true,
      message: `Inspection ${inspection_status} successfully`,
      data: {
        id: updatedInspectionEntry.id,
        work_order_id: updatedInspectionEntry.work_order_id,
        total_quantity_for_inspection: updatedInspectionEntry.total_quantity_for_inspection,
        hp_3_for_inspection: updatedInspectionEntry.hp_3_for_inspection,
        hp_5_for_inspection: updatedInspectionEntry.hp_5_for_inspection,
        hp_7_5_for_inspection: updatedInspectionEntry.hp_7_5_for_inspection,
        inspection_status: updatedInspectionEntry.inspection_status,
        farmer_name: updatedInspectionEntry.farmer_name,
        location: {
          district: updatedInspectionEntry.district,
          taluka: updatedInspectionEntry.taluka,
          village: updatedInspectionEntry.village
        },
        photos: {
          installation_site_photo: updatedInspectionEntry.installation_site_photo,
          lineman_installation_set_photo: updatedInspectionEntry.lineman_installation_set_photo,
          set_close_up_photo: updatedInspectionEntry.set_close_up_photo
        },
        action_by: updatedInspectionEntry.action_by,
        updatedAt: updatedInspectionEntry.updatedAt
      }
    });

  } catch (error) {
    console.error('Error accepting/rejecting inspection:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
