import WorkOrder from '../models/WorkOrder.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import User from '../models/User.js';
import { Op } from 'sequelize';

// Create work order by admin
export const createWorkOrder = async (req, res) => {
  try {
    const {
      title,
      region,
      total_quantity,
      hp_3_quantity,
      hp_5_quantity,
      hp_7_5_quantity,
      start_date,
      factory_timeline,
      jsr_timeline,
      whouse_timeline,
      cp_timeline,
      contractor_timeline,
      farmer_timeline,
      inspection_timeline
    } = req.body;

    // Validate required fields
    if (!title || !region || !total_quantity || !hp_3_quantity || !hp_5_quantity || !hp_7_5_quantity || !start_date || 
        !factory_timeline || !jsr_timeline || !whouse_timeline || !cp_timeline || !contractor_timeline || !farmer_timeline || !inspection_timeline) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate quantities are positive numbers
    if (total_quantity <= 0 || hp_3_quantity < 0 || hp_5_quantity < 0 || hp_7_5_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'All quantities must be positive numbers'
      });
    }

    // Validate that HP quantities sum up to total quantity
    const sumOfHpQuantities = parseInt(hp_3_quantity) + parseInt(hp_5_quantity) + parseInt(hp_7_5_quantity);
    if (sumOfHpQuantities !== parseInt(total_quantity)) {
      return res.status(400).json({
        success: false,
        message: `Sum of HP quantities (${sumOfHpQuantities}) must equal total quantity (${total_quantity})`
      });
    }

    // Validate timeline fields are positive numbers
    if (factory_timeline <= 0 || jsr_timeline <= 0 || whouse_timeline <= 0 || cp_timeline <= 0 || 
        contractor_timeline <= 0 || farmer_timeline <= 0 || inspection_timeline <= 0) {
      return res.status(400).json({
        success: false,
        message: 'All timeline values must be positive numbers greater than 0'
      });
    }

    // Validate start date
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format'
      });
    }

    // Validate Excel file upload (now mandatory)
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Farmer list Excel file is required to create a work order'
      });
    }

    // Check if uploaded file is Excel
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only Excel files (.xls, .xlsx) are allowed for farmer list'
      });
    }
    
    const farmerListFile = req.file.path;
    const farmerListOriginalName = req.file.originalname;

    // Generate work order number (WO01, WO02, etc.)
    const lastWorkOrder = await WorkOrder.findOne({
      order: [['id', 'DESC']]
    });

    let workOrderNumber = 'WO01';
    if (lastWorkOrder) {
      const lastNumber = parseInt(lastWorkOrder.work_order_number.substring(2));
      workOrderNumber = `WO${String(lastNumber + 1).padStart(2, '0')}`;
    }

    // Create the work order
    const workOrder = await WorkOrder.create({
      work_order_number: workOrderNumber,
      title,
      region,
      total_quantity: parseInt(total_quantity),
      hp_3_quantity: parseInt(hp_3_quantity),
      hp_5_quantity: parseInt(hp_5_quantity),
      hp_7_5_quantity: parseInt(hp_7_5_quantity),
      start_date: startDate,
      status: 'created',
      current_stage: 'admin_created',
      created_by: req.user.id,
      farmer_list_file: farmerListFile,
      farmer_list_original_name: farmerListOriginalName,
      factory_timeline: parseInt(factory_timeline),
      jsr_timeline: parseInt(jsr_timeline),
      whouse_timeline: parseInt(whouse_timeline),
      cp_timeline: parseInt(cp_timeline),
      contractor_timeline: parseInt(contractor_timeline),
      farmer_timeline: parseInt(farmer_timeline),
      inspection_timeline: parseInt(inspection_timeline)
    });

    // Automatically create initial stage record
    await WorkOrderStage.create({
      work_order_id: workOrder.id,
      stage_name: 'admin_created',
      stage_order: 1,
      status: 'completed',
      started_at: new Date(),
      completed_at: new Date(),
      assigned_to: req.user.id,
      notes: 'Work order created by admin',
      stage_data: {
        total_quantity,
        hp_3_quantity,
        hp_5_quantity,
        hp_7_5_quantity,
        timelines: {
          factory: factory_timeline,
          jsr: jsr_timeline,
          whouse: whouse_timeline,
          cp: cp_timeline,
          contractor: contractor_timeline,
          farmer: farmer_timeline,
          inspection: inspection_timeline
        }
      }
    });

    // Create pending stages for the workflow
    const stages = [
      { name: 'factory', order: 2, timeline: factory_timeline },
      { name: 'jsr', order: 3, timeline: jsr_timeline },
      { name: 'whouse', order: 4, timeline: whouse_timeline },
      { name: 'cp', order: 5, timeline: cp_timeline },
      { name: 'contractor', order: 6, timeline: contractor_timeline },
      { name: 'farmer', order: 7, timeline: farmer_timeline },
      { name: 'inspection', order: 8, timeline: inspection_timeline }
    ];

    for (const stage of stages) {
      await WorkOrderStage.create({
        work_order_id: workOrder.id,
        stage_name: stage.name,
        stage_order: stage.order,
        status: 'pending',
        stage_data: { timeline: stage.timeline }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: {
        id: workOrder.id,
        work_order_number: workOrder.work_order_number,
        title: workOrder.title,
        status: workOrder.status,
        current_stage: workOrder.current_stage
      }
    });

  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all work orders with approval status
export const getWorkOrdersWithApprovalStatus = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      current_stage, 
      jsr_approval_status, 
      inspection_approval_status,
      search 
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    // Handle status parameter for approval/rejection filtering
    if (status) {
      if (status === 'rejected') {
        // Get work orders rejected by either JSR or Inspection
        whereClause[Op.or] = [
          { jsr_approval_status: 'rejected' },
          { inspection_approval_status: 'rejected' }
        ];
      } else if (status === 'approved') {
        // Get work orders approved by both JSR and Inspection
        whereClause.jsr_approval_status = 'approved';
        whereClause.inspection_approval_status = 'approved';
      } else {
        // For other status values (created, in_progress, completed, cancelled)
        whereClause.status = status;
      }
    }
    
    if (current_stage) {
      whereClause.current_stage = current_stage;
    }
    
    if (jsr_approval_status) {
      whereClause.jsr_approval_status = jsr_approval_status;
    }
    
    if (inspection_approval_status) {
      whereClause.inspection_approval_status = inspection_approval_status;
    }
    
    if (search) {
      // If we already have Op.or from status filtering, we need to combine them
      if (whereClause[Op.or]) {
        const existingOr = whereClause[Op.or];
        whereClause[Op.and] = [
          { [Op.or]: existingOr },
          { [Op.or]: [
            { work_order_number: { [Op.like]: `%${search}%` } },
            { title: { [Op.like]: `%${search}%` } },
            { region: { [Op.like]: `%${search}%` } }
          ]}
        ];
        delete whereClause[Op.or];
      } else {
        whereClause[Op.or] = [
          { work_order_number: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } },
          { region: { [Op.like]: `%${search}%` } }
        ];
      }
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get work orders with approval status
    const { count, rows: workOrders } = await WorkOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: User,
          as: 'jsrApprover',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        },
        {
          model: User,
          as: 'inspectionApprover',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: 'Work orders retrieved successfully',
      data: {
        workOrders: workOrders.map(wo => ({
          id: wo.id,
          work_order_number: wo.work_order_number,
          title: wo.title,
          region: wo.region,
          total_quantity: wo.total_quantity,
          hp_3_quantity: wo.hp_3_quantity,
          hp_5_quantity: wo.hp_5_quantity,
          hp_7_5_quantity: wo.hp_7_5_quantity,
          start_date: wo.start_date,
          status: wo.status,
          current_stage: wo.current_stage,
          // Approval status fields
          jsr_approval_status: wo.jsr_approval_status,
          inspection_approval_status: wo.inspection_approval_status,
          jsr_approved_by: wo.jsr_approved_by,
          inspection_approved_by: wo.inspection_approved_by,
          jsr_approval_date: wo.jsr_approval_date,
          inspection_approval_date: wo.inspection_approval_date,
          // User details
          created_by: {
            id: wo.creator?.id,
            name: wo.creator?.name,
            email: wo.creator?.email,
            role: wo.creator?.role
          },
          jsr_approver: wo.jsrApprover ? {
            id: wo.jsrApprover.id,
            name: wo.jsrApprover.name,
            email: wo.jsrApprover.email,
            role: wo.jsrApprover.role
          } : null,
          inspection_approver: wo.inspectionApprover ? {
            id: wo.inspectionApprover.id,
            name: wo.inspectionApprover.name,
            email: wo.inspectionApprover.email,
            role: wo.inspectionApprover.role
          } : null,
          // Timelines
          factory_timeline: wo.factory_timeline,
          jsr_timeline: wo.jsr_timeline,
          whouse_timeline: wo.whouse_timeline,
          cp_timeline: wo.cp_timeline,
          contractor_timeline: wo.contractor_timeline,
          farmer_timeline: wo.farmer_timeline,
          inspection_timeline: wo.inspection_timeline,
          createdAt: wo.createdAt,
          updatedAt: wo.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get single work order with approval status
export const getWorkOrderWithApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const workOrder = await WorkOrder.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: User,
          as: 'jsrApprover',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        },
        {
          model: User,
          as: 'inspectionApprover',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        }
      ]
    });

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Work order retrieved successfully',
      data: {
        id: workOrder.id,
        work_order_number: workOrder.work_order_number,
        title: workOrder.title,
        region: workOrder.region,
        total_quantity: workOrder.total_quantity,
        hp_3_quantity: workOrder.hp_3_quantity,
        hp_5_quantity: workOrder.hp_5_quantity,
        hp_7_5_quantity: workOrder.hp_7_5_quantity,
        start_date: workOrder.start_date,
        status: workOrder.status,
        current_stage: workOrder.current_stage,
        // Approval status fields
        jsr_approval_status: workOrder.jsr_approval_status,
        inspection_approval_status: workOrder.inspection_approval_status,
        jsr_approved_by: workOrder.jsr_approved_by,
        inspection_approved_by: workOrder.inspection_approved_by,
        jsr_approval_date: workOrder.jsr_approval_date,
        inspection_approval_date: workOrder.inspection_approval_date,
        // User details
        created_by: {
          id: workOrder.creator?.id,
          name: workOrder.creator?.name,
          email: workOrder.creator?.email,
          role: workOrder.creator?.role
        },
        jsr_approver: workOrder.jsrApprover ? {
          id: workOrder.jsrApprover.id,
          name: workOrder.jsrApprover.name,
          email: workOrder.jsrApprover.email,
          role: workOrder.jsrApprover.role
        } : null,
        inspection_approver: workOrder.inspectionApprover ? {
          id: workOrder.inspectionApprover.id,
          name: workOrder.inspectionApprover.name,
          email: workOrder.inspectionApprover.email,
          role: workOrder.inspectionApprover.role
        } : null,
        // Timelines
        factory_timeline: workOrder.factory_timeline,
        jsr_timeline: workOrder.jsr_timeline,
        whouse_timeline: workOrder.whouse_timeline,
        cp_timeline: workOrder.cp_timeline,
        contractor_timeline: workOrder.contractor_timeline,
        farmer_timeline: workOrder.farmer_timeline,
        inspection_timeline: workOrder.inspection_timeline,
        farmer_list_file: workOrder.farmer_list_file,
        farmer_list_original_name: workOrder.farmer_list_original_name,
        createdAt: workOrder.createdAt,
        updatedAt: workOrder.updatedAt
      }
    });

  } catch (error) {
    console.error('Error retrieving work order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all work orders (simple list without approval status details)
export const getAllWorkOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      current_stage, 
      search 
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (current_stage) {
      whereClause.current_stage = current_stage;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { work_order_number: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } },
        { region: { [Op.like]: `%${search}%` } }
      ];
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get work orders
    const { count, rows: workOrders } = await WorkOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: 'Work orders retrieved successfully',
      data: {
        workOrders: workOrders.map(wo => ({
          id: wo.id,
          work_order_number: wo.work_order_number,
          title: wo.title,
          region: wo.region,
          total_quantity: wo.total_quantity,
          hp_3_quantity: wo.hp_3_quantity,
          hp_5_quantity: wo.hp_5_quantity,
          hp_7_5_quantity: wo.hp_7_5_quantity,
          start_date: wo.start_date,
          status: wo.status,
          current_stage: wo.current_stage,
          created_by: {
            id: wo.creator?.id,
            name: wo.creator?.name,
            email: wo.creator?.email,
            role: wo.creator?.role
          },
          // Timelines
          factory_timeline: wo.factory_timeline,
          jsr_timeline: wo.jsr_timeline,
          whouse_timeline: wo.whouse_timeline,
          cp_timeline: wo.cp_timeline,
          contractor_timeline: wo.contractor_timeline,
          farmer_timeline: wo.farmer_timeline,
          inspection_timeline: wo.inspection_timeline,
          farmer_list_file: wo.farmer_list_file,
          farmer_list_original_name: wo.farmer_list_original_name,
          createdAt: wo.createdAt,
          updatedAt: wo.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
