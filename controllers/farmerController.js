import WorkOrderFarmer from '../models/WorkOrderFarmer.js';
import WorkOrderContractor from '../models/WorkOrderContractor.js';
import WorkOrder from '../models/WorkOrder.js';
import User from '../models/User.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

// Step 1: Farmer receives units from contractor
export const receiveUnitsFromContractor = async (req, res) => {
  try {
    const {
      work_order_id,
      total_quantity_received,
      hp_3_received,
      hp_5_received,
      hp_7_5_received
    } = req.body;

    // Validate required fields
    if (!work_order_id || total_quantity_received === undefined || hp_3_received === undefined || hp_5_received === undefined || hp_7_5_received === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided: work_order_id, total_quantity_received, hp_3_received, hp_5_received, hp_7_5_received'
      });
    }

    // Validate quantities are non-negative numbers
    if (total_quantity_received < 0 || hp_3_received < 0 || hp_5_received < 0 || hp_7_5_received < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be non-negative numbers (0 or greater)'
      });
    }

    // Validate that HP quantities sum up to total quantity received
    const sumOfHpQuantities = parseInt(hp_3_received) + parseInt(hp_5_received) + parseInt(hp_7_5_received);
    if (sumOfHpQuantities !== parseInt(total_quantity_received)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity received (${total_quantity_received})`
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

    // FLOW VALIDATION: Check if work order is in the correct stage for farmer
    if (workOrder.current_stage !== 'farmer_inspection' && workOrder.current_stage !== 'defect_reported') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for farmer operations. Current stage: ${workOrder.current_stage}. Expected stage: farmer_inspection or defect_reported.`
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
        message: 'This work order has not been dispatched from contractor. Please wait for contractor to complete the dispatch process before proceeding with farmer operations.'
      });
    }

    // Validate that farmer quantities don't exceed contractor dispatched quantities
    if (total_quantity_received > contractorEntry.total_quantity_assigned) {
      return res.status(400).json({
        success: false,
        message: `Farmer quantity (${total_quantity_received}) cannot exceed contractor dispatched quantity (${contractorEntry.total_quantity_assigned})`
      });
    }

    if (hp_3_received > contractorEntry.hp_3_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `3 HP farmer quantity (${hp_3_received}) cannot exceed contractor dispatched 3 HP quantity (${contractorEntry.hp_3_to_farmer})`
      });
    }

    if (hp_5_received > contractorEntry.hp_5_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `5 HP farmer quantity (${hp_5_received}) cannot exceed contractor dispatched 5 HP quantity (${contractorEntry.hp_5_to_farmer})`
      });
    }

    if (hp_7_5_received > contractorEntry.hp_7_5_to_farmer) {
      return res.status(400).json({
        success: false,
        message: `7.5 HP farmer quantity (${hp_7_5_received}) cannot exceed contractor dispatched 7.5 HP quantity (${contractorEntry.hp_7_5_to_farmer})`
      });
    }

    // FLOW VALIDATION: Check if farmer user has permission
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only farmer users can perform this operation.'
      });
    }

    // Check if farmer entry already exists for this work order
    const existingFarmerEntry = await WorkOrderFarmer.findOne({
      where: { work_order_id }
    });

    let farmerEntry;
    let totalRemainingToReceive;
    let hp3RemainingToReceive;
    let hp5RemainingToReceive;
    let hp75RemainingToReceive;

    if (existingFarmerEntry) {
      // Update existing entry - check against remaining units to receive from contractor
      const currentTotalReceived = existingFarmerEntry.total_quantity_received || 0;
      const currentHp3Received = existingFarmerEntry.hp_3_received || 0;
      const currentHp5Received = existingFarmerEntry.hp_5_received || 0;
      const currentHp75Received = existingFarmerEntry.hp_7_5_received || 0;

      // Calculate remaining units to receive from contractor
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - currentTotalReceived;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - currentHp3Received;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - currentHp5Received;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - currentHp75Received;

      // Validate that new received quantities don't exceed remaining to receive
      if (total_quantity_received > totalRemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `Farmer quantity (${total_quantity_received}) cannot exceed remaining units to receive from contractor (${totalRemainingToReceive})`
        });
      }

      if (hp_3_received > hp3RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `3 HP farmer quantity (${hp_3_received}) cannot exceed remaining 3 HP units to receive (${hp3RemainingToReceive})`
        });
      }

      if (hp_5_received > hp5RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `5 HP farmer quantity (${hp_5_received}) cannot exceed remaining 5 HP units to receive (${hp5RemainingToReceive})`
        });
      }

      if (hp_7_5_received > hp75RemainingToReceive) {
        return res.status(400).json({
          success: false,
          message: `7.5 HP farmer quantity (${hp_7_5_received}) cannot exceed remaining 7.5 HP units to receive (${hp75RemainingToReceive})`
        });
      }

      // Add to existing received quantities
      const newTotalReceived = currentTotalReceived + total_quantity_received;
      const newHp3Received = currentHp3Received + hp_3_received;
      const newHp5Received = currentHp5Received + hp_5_received;
      const newHp75Received = currentHp75Received + hp_7_5_received;

      // Update existing entry
      farmerEntry = await existingFarmerEntry.update({
        total_quantity_received: newTotalReceived,
        hp_3_received: newHp3Received,
        hp_5_received: newHp5Received,
        hp_7_5_received: newHp75Received,
        farmer_status: 'units_received',
        action_by: req.user.id
      });

      // Calculate new remaining units to receive
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - newTotalReceived;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - newHp3Received;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - newHp5Received;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - newHp75Received;

    } else {
      // Create new entry
      farmerEntry = await WorkOrderFarmer.create({
        work_order_id: parseInt(work_order_id),
        contractor_entry_id: contractorEntry.id,
        total_quantity_received: parseInt(total_quantity_received),
        hp_3_received: parseInt(hp_3_received),
        hp_5_received: parseInt(hp_5_received),
        hp_7_5_received: parseInt(hp_7_5_received),
        farmer_status: 'units_received',
        action_by: req.user.id
      });

      // Calculate remaining units to receive
      totalRemainingToReceive = contractorEntry.total_quantity_assigned - total_quantity_received;
      hp3RemainingToReceive = contractorEntry.hp_3_to_farmer - hp_3_received;
      hp5RemainingToReceive = contractorEntry.hp_5_to_farmer - hp_5_received;
      hp75RemainingToReceive = contractorEntry.hp_7_5_to_farmer - hp_7_5_received;
    }

    res.status(200).json({
      success: true,
      message: 'Units received by farmer successfully',
      data: {
        id: farmerEntry.id,
        work_order_id: farmerEntry.work_order_id,
        total_quantity_received: farmerEntry.total_quantity_received,
        hp_3_received: farmerEntry.hp_3_received,
        hp_5_received: farmerEntry.hp_5_received,
        hp_7_5_received: farmerEntry.hp_7_5_received,
        farmer_status: farmerEntry.farmer_status,
        action_by: farmerEntry.action_by,
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
    console.error('Error receiving units by farmer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Step 2: Farmer reports defect
export const reportDefect = async (req, res) => {
  try {
    console.log('Farmer Defect Report - Request received:', {
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'No files'
    });

    const {
      work_order_id,
      issue_title,
      description
    } = req.body;

    // Get uploaded files
    const photo_1 = req.files?.photo_1?.[0];
    const photo_2 = req.files?.photo_2?.[0];
    const photo_3 = req.files?.photo_3?.[0];

    console.log('Farmer Defect Report - Files extracted:', {
      photo_1: photo_1?.filename,
      photo_2: photo_2?.filename,
      photo_3: photo_3?.filename
    });

    // Validate required fields
    if (!work_order_id || !issue_title || !description) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id, issue_title, and description are required fields'
      });
    }

    // Validate that at least one photo is uploaded
    if (!photo_1 && !photo_2 && !photo_3) {
      return res.status(400).json({
        success: false,
        message: 'At least one photo is required for defect report'
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

    // FLOW VALIDATION: Check if work order is in the correct stage for farmer
    if (workOrder.current_stage !== 'farmer_inspection' && workOrder.current_stage !== 'defect_reported') {
      return res.status(400).json({
        success: false,
        message: `Work order is not available for farmer operations. Current stage: ${workOrder.current_stage}. Expected stage: farmer_inspection or defect_reported.`
      });
    }

    // Check if farmer entry exists
    const farmerEntry = await WorkOrderFarmer.findOne({
      where: { work_order_id }
    });

    if (!farmerEntry) {
      return res.status(404).json({
        success: false,
        message: 'No farmer entry found for this work order. Please receive units from contractor first.'
      });
    }

    // FLOW VALIDATION: Check if farmer user has permission for this work order
    const currentUser = await User.findByPk(req.user.id);
    if (currentUser.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only farmer users can perform this operation.'
      });
    }

    // Prepare update data
    const updateData = {
      issue_title,
      description,
      farmer_status: 'defect_reported',
      action_by: req.user.id
    };

    // Add photo file paths if files are uploaded
    if (photo_1) {
      updateData.photo_1 = photo_1.filename;
    }
    if (photo_2) {
      updateData.photo_2 = photo_2.filename;
    }
    if (photo_3) {
      updateData.photo_3 = photo_3.filename;
    }

    // Update farmer entry with defect report details
    const updatedFarmerEntry = await farmerEntry.update(updateData);

    // Update work order status to indicate defect reported
    await WorkOrder.update(
      { current_stage: 'defect_reported' },
      { where: { id: work_order_id } }
    );

    // Update farmer stage status
    await WorkOrderStage.update(
      { 
        status: 'failed',
        notes: `Defect reported by farmer: ${issue_title}`,
        error_message: `Defect reported: ${issue_title} - ${description}`
      },
      { where: { work_order_id, stage_name: 'farmer' } }
    );

    res.status(200).json({
      success: true,
      message: 'Defect reported successfully',
      data: {
        id: updatedFarmerEntry.id,
        work_order_id: updatedFarmerEntry.work_order_id,
        issue_title: updatedFarmerEntry.issue_title,
        description: updatedFarmerEntry.description,
        farmer_status: updatedFarmerEntry.farmer_status,
        photos: {
          photo_1: updatedFarmerEntry.photo_1,
          photo_2: updatedFarmerEntry.photo_2,
          photo_3: updatedFarmerEntry.photo_3
        },
        action_by: updatedFarmerEntry.action_by,
        updatedAt: updatedFarmerEntry.updatedAt
      }
    });

  } catch (error) {
    console.error('Error reporting defect:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all defect details submitted by farmers
export const getAllDefectDetails = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      work_order_id,
      farmer_status,
      search 
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    // Filter by work order ID if provided
    if (work_order_id) {
      whereClause.work_order_id = work_order_id;
    }
    
    // Filter by farmer status if provided
    if (farmer_status) {
      whereClause.farmer_status = farmer_status;
    }
    
    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { issue_title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get defect details with work order information
    const { count, rows: defectDetails } = await WorkOrderFarmer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: WorkOrder,
          as: 'workOrder',
          attributes: ['id', 'work_order_number', 'title', 'region', 'total_quantity', 'status', 'current_stage']
        },
        {
          model: User,
          as: 'actionUser',
          attributes: ['id', 'name', 'email', 'role']
        }
      ],
      order: [['updated_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Get farmer details from authenticated user
    const farmerUser = await User.findByPk(req.user.id);

    // Transform the data to include photo URLs and additional details
    const transformedDefects = defectDetails.map(defect => ({
      id: defect.id,
      work_order_id: defect.work_order_id,
      work_order_number: defect.workOrder?.work_order_number,
      work_order_title: defect.workOrder?.title,
      work_order_region: defect.workOrder?.region,
      work_order_status: defect.workOrder?.status,
      work_order_current_stage: defect.workOrder?.current_stage,
      
      // Farmer details from authenticated user
      farmer_details: {
        farmer_name: farmerUser?.name || 'Unknown',
        farmer_email: farmerUser?.email || 'Unknown',
        farmer_phone: farmerUser?.phone || 'Not specified',
        farmer_location: {
          state: farmerUser?.state || 'Not specified',
          district: farmerUser?.district || 'Not specified',
          taluka: farmerUser?.taluka || 'Not specified',
          village: farmerUser?.village || 'Not specified',
          company_name: farmerUser?.company_name || 'Not specified'
        }
      },
      
      // Farmer receipt details
      total_quantity_received: defect.total_quantity_received,
      hp_3_received: defect.hp_3_received,
      hp_5_received: defect.hp_5_received,
      hp_7_5_received: defect.hp_7_5_received,
      
      // Defect details
      issue_title: defect.issue_title,
      description: defect.description,
      farmer_status: defect.farmer_status,
      date_of_issue: defect.updatedAt, // When the defect was reported/updated
      
      // Photos with full URLs
      photos: {
        photo_1: defect.photo_1 ? `/uploads/farmer-photos/${defect.photo_1}` : null,
        photo_2: defect.photo_2 ? `/uploads/farmer-photos/${defect.photo_2}` : null,
        photo_3: defect.photo_3 ? `/uploads/farmer-photos/${defect.photo_3}` : null
      },
      
      // Action details
      action_by: {
        id: defect.actionUser?.id,
        name: defect.actionUser?.name,
        email: defect.actionUser?.email,
        role: defect.actionUser?.role
      },
      
      // Timestamps
      created_at: defect.createdAt,
      updated_at: defect.updatedAt
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Get summary statistics
    const summaryStats = await WorkOrderFarmer.findAll({
      attributes: [
        'farmer_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['farmer_status']
    });

    const statusSummary = summaryStats.reduce((acc, stat) => {
      acc[stat.farmer_status] = parseInt(stat.dataValues.count);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: 'Defect details retrieved successfully',
      data: {
        defects: transformedDefects,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        summary: {
          total_defects: count,
          status_breakdown: statusSummary
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving defect details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
