import WorkOrder from '../models/WorkOrder.js';
import WorkOrderStage from '../models/WorkOrderStage.js';
import WorkOrderFactory from '../models/WorkOrderFactory.js';
import WorkOrderJSR from '../models/WorkOrderJSR.js';
import WorkOrderWarehouse from '../models/WorkOrderWarehouse.js';
import WorkOrderCP from '../models/WorkOrderCP.js';
import WorkOrderContractor from '../models/WorkOrderContractor.js';
import WorkOrderFarmer from '../models/WorkOrderFarmer.js';
import WorkOrderInspection from '../models/WorkOrderInspection.js';
import User from '../models/User.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

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

// Dashboard API - Get unit counts across all workflow stages for latest work order only
export const getDashboardSummary = async (req, res) => {
  try {
    // Get the latest work order (most recently created)
    const latestWorkOrder = await WorkOrder.findOne({
      where: {
        status: {
          [Op.ne]: 'cancelled'
        }
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    if (!latestWorkOrder) {
      return res.status(200).json({
        success: true,
        message: 'No work orders found',
        data: {
          summary: {
            factory: { units: 0, label: 'Factory', icon: 'factory', color: 'light-blue' },
            jsr: { units: 0, label: 'PDI', icon: 'document', color: 'light-green' },
            warehouse: { units: 0, label: 'Warehouse', icon: 'warehouse', color: 'light-yellow' },
            cp: { units: 0, label: 'CP', icon: 'person-gear', color: 'light-blue' },
            contractor: { units: 0, label: 'Contractor', icon: 'briefcase', color: 'light-purple' },
            farmer: { units: 0, label: 'Farmer', icon: 'tractor', color: 'light-green', additionalInfo: { installed: 0 } },
            inspection: { units: 0, label: 'Inspection', icon: 'magnifying-glass', color: 'light-green', additionalInfo: { rejected: 0 } }
          },
          metrics: {
            totalWorkOrders: 0,
            activeWorkOrders: 0,
            completedWorkOrders: 0,
            totalUnitsInSystem: 0
          },
          latestWorkOrder: null,
          recentActivity: []
        }
      });
    }

    const latestWorkOrderId = latestWorkOrder.id;

    // Use database aggregation for better performance - only for latest work order
    const [
      factoryManufactured,
      factoryDispatchedToJSR,
      jsrReceived,
      jsrDispatchedToWarehouse,
      warehouseReceived,
      warehouseDispatchedToCP,
      cpReceived,
      cpDispatchedToContractor,
      contractorReceived,
      contractorDispatchedToFarmer,
      farmerReceived,
      inspectionReceived,
      installedResult,
      rejectedResult,
      workOrderStats
    ] = await Promise.all([
      // Factory: total manufactured units
      WorkOrderFactory.sum('total_quantity_manufactured', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Factory: total units dispatched to JSR
      WorkOrderFactory.sum('total_quantity_to_jsr', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // JSR: total units received from factory
      WorkOrderJSR.sum('total_quantity_received', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // JSR: total units dispatched to warehouse
      WorkOrderJSR.sum('total_quantity_to_warehouse', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Warehouse: total units received from JSR
      WorkOrderWarehouse.sum('total_quantity_in_warehouse', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Warehouse: total units dispatched to CP
      WorkOrderWarehouse.sum('total_quantity_to_cp', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // CP: total units received from warehouse
      WorkOrderCP.sum('total_quantity_to_cp', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // CP: total units dispatched to contractor
      WorkOrderCP.sum('total_quantity_assigned', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Contractor: total units received from CP
      WorkOrderContractor.sum('total_quantity_to_contractor', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Contractor: total units dispatched to farmer
      WorkOrderContractor.sum('total_quantity_assigned', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Farmer: total units received from contractor
      WorkOrderFarmer.sum('total_quantity_received', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Inspection: total units received for inspection
      WorkOrderInspection.sum('total_quantity_for_inspection', {
        where: { work_order_id: latestWorkOrderId }
      }),
      
      // Installed units - completed farmer entries for latest work order
      WorkOrderFarmer.sum('total_quantity_received', {
        where: { 
          work_order_id: latestWorkOrderId,
          farmer_status: 'completed' 
        }
      }),
      
      // Rejected units - rejected inspection entries for latest work order
      WorkOrderInspection.sum('total_quantity_for_inspection', {
        where: { 
          work_order_id: latestWorkOrderId,
          inspection_status: 'rejected' 
        }
      }),
      
      // Work order statistics (all work orders for metrics)
      WorkOrder.findAll({
        where: { status: { [Op.ne]: 'cancelled' } },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      })
    ]);

    // Calculate remaining units in each stage
    const factoryUnits = (factoryManufactured || 0) - (factoryDispatchedToJSR || 0);
    const jsrUnits = (jsrReceived || 0) - (jsrDispatchedToWarehouse || 0);
    const warehouseUnits = (warehouseReceived || 0) - (warehouseDispatchedToCP || 0);
    const cpUnits = (cpReceived || 0) - (cpDispatchedToContractor || 0);
    const contractorUnits = (contractorReceived || 0) - (contractorDispatchedToFarmer || 0);
    const farmerUnits = farmerReceived || 0;
    const inspectionUnits = inspectionReceived || 0;
    const installedUnits = installedResult || 0;
    const rejectedUnits = rejectedResult || 0;

    // Calculate additional metrics from work order statistics
    const totalWorkOrders = workOrderStats.reduce((sum, stat) => sum + parseInt(stat.dataValues.count), 0);
    const activeWorkOrders = workOrderStats.find(stat => stat.status === 'in_progress')?.dataValues.count || 0;
    const completedWorkOrders = workOrderStats.find(stat => stat.status === 'completed')?.dataValues.count || 0;

    // Get recent work orders for activity feed
    const recentWorkOrders = await WorkOrder.findAll({
      order: [['updatedAt', 'DESC']],
      limit: 5,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: {
        summary: {
          factory: {
            units: factoryUnits,
            label: 'Factory',
            icon: 'factory',
            color: 'light-blue'
          },
          jsr: {
            units: jsrUnits,
            label: 'PDI',
            icon: 'document',
            color: 'light-green'
          },
          warehouse: {
            units: warehouseUnits,
            label: 'Warehouse',
            icon: 'warehouse',
            color: 'light-yellow'
          },
          cp: {
            units: cpUnits,
            label: 'CP',
            icon: 'person-gear',
            color: 'light-blue'
          },
          contractor: {
            units: contractorUnits,
            label: 'Contractor',
            icon: 'briefcase',
            color: 'light-purple'
          },
          farmer: {
            units: farmerUnits,
            label: 'Farmer',
            icon: 'tractor',
            color: 'light-green',
            additionalInfo: {
              installed: installedUnits
            }
          },
          inspection: {
            units: inspectionUnits,
            label: 'Inspection',
            icon: 'magnifying-glass',
            color: 'light-green',
            additionalInfo: {
              rejected: rejectedUnits
            }
          }
        },
        metrics: {
          totalWorkOrders,
          activeWorkOrders,
          completedWorkOrders,
          totalUnitsInSystem: latestWorkOrder.total_quantity
        },
        latestWorkOrder: {
          id: latestWorkOrder.id,
          work_order_number: latestWorkOrder.work_order_number,
          title: latestWorkOrder.title,
          region: latestWorkOrder.region,
          total_quantity: latestWorkOrder.total_quantity,
          status: latestWorkOrder.status,
          current_stage: latestWorkOrder.current_stage,
          created_by: {
            id: latestWorkOrder.creator?.id,
            name: latestWorkOrder.creator?.name,
            email: latestWorkOrder.creator?.email,
            role: latestWorkOrder.creator?.role
          },
          createdAt: latestWorkOrder.createdAt,
          updatedAt: latestWorkOrder.updatedAt
        },
        recentActivity: recentWorkOrders.map(wo => ({
          id: wo.id,
          work_order_number: wo.work_order_number,
          title: wo.title,
          status: wo.status,
          current_stage: wo.current_stage,
          created_by: {
            id: wo.creator?.id,
            name: wo.creator?.name,
            email: wo.creator?.email,
            role: wo.creator?.role
          },
          updatedAt: wo.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error retrieving dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Role-based summary API
export const getRoleSummary = async (req, res) => {
  try {
    const { role } = req.query;

    // Validate role parameter
    const validRoles = ['admin', 'factory', 'jsr', 'warehouse', 'cp', 'contractor', 'farmer', 'inspection'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Valid roles are: admin, factory, jsr, warehouse, cp, contractor, farmer, inspection'
      });
    }

    // Get the latest work order (current work order)
    const currentWorkOrder = await WorkOrder.findOne({
      where: {
        status: {
          [Op.ne]: 'cancelled'
        }
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    if (!currentWorkOrder) {
      return res.status(200).json({
        success: true,
        message: 'No work orders found',
        data: {
          role,
          totalWorkOrders: 0,
          currentWorkOrder: null,
          summary: {
            totalUnits: 0,
            deliveredUnits: 0,
            remainingUnits: 0,
            workOrderNumber: null
          }
        }
      });
    }

    const currentWorkOrderId = currentWorkOrder.id;

    // Get total work orders count for this role
    const totalWorkOrders = await WorkOrder.count({
      where: {
        status: {
          [Op.ne]: 'cancelled'
        }
      }
    });

    let summary = {};

    switch (role) {
      case 'admin':
        summary = {
          totalUnits: currentWorkOrder.total_quantity,
          deliveredUnits: currentWorkOrder.total_quantity, // Admin creates the total units
          remainingUnits: 0
        };
        break;

      case 'factory':
        const factoryData = await WorkOrderFactory.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (factoryData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: factoryData.total_quantity_manufactured || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (factoryData.total_quantity_manufactured || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'jsr':
        const jsrData = await WorkOrderJSR.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (jsrData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: jsrData.total_quantity_received || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (jsrData.total_quantity_received || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'warehouse':
        const warehouseData = await WorkOrderWarehouse.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (warehouseData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: warehouseData.total_quantity_in_warehouse || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (warehouseData.total_quantity_in_warehouse || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'cp':
        const cpData = await WorkOrderCP.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (cpData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: cpData.total_quantity_to_cp || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (cpData.total_quantity_to_cp || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'contractor':
        const contractorData = await WorkOrderContractor.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (contractorData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: contractorData.total_quantity_to_contractor || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (contractorData.total_quantity_to_contractor || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'farmer':
        const farmerData = await WorkOrderFarmer.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (farmerData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: farmerData.total_quantity_received || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (farmerData.total_quantity_received || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;

      case 'inspection':
        const inspectionData = await WorkOrderInspection.findOne({
          where: { work_order_id: currentWorkOrderId }
        });
        
        if (inspectionData) {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: inspectionData.total_quantity_for_inspection || 0,
            remainingUnits: (currentWorkOrder.total_quantity - (inspectionData.total_quantity_for_inspection || 0))
          };
        } else {
          summary = {
            totalUnits: currentWorkOrder.total_quantity,
            deliveredUnits: 0,
            remainingUnits: currentWorkOrder.total_quantity
          };
        }
        break;
    }

    res.status(200).json({
      success: true,
      message: `${role} role summary retrieved successfully`,
      data: {
        role,
        totalWorkOrders,
        currentWorkOrder: {
          id: currentWorkOrder.id,
          work_order_number: currentWorkOrder.work_order_number,
          title: currentWorkOrder.title,
          region: currentWorkOrder.region,
          total_quantity: currentWorkOrder.total_quantity,
          hp_3_quantity: currentWorkOrder.hp_3_quantity,
          hp_5_quantity: currentWorkOrder.hp_5_quantity,
          hp_7_5_quantity: currentWorkOrder.hp_7_5_quantity,
          status: currentWorkOrder.status,
          current_stage: currentWorkOrder.current_stage,
          created_by: {
            id: currentWorkOrder.creator?.id,
            name: currentWorkOrder.creator?.name,
            email: currentWorkOrder.creator?.email,
            role: currentWorkOrder.creator?.role
          },
          createdAt: currentWorkOrder.createdAt,
          updatedAt: currentWorkOrder.updatedAt
        },
        summary: {
          ...summary,
          workOrderNumber: currentWorkOrder.work_order_number
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving role summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get work orders by role with role-specific details
export const getWorkOrdersByRole = async (req, res) => {
  try {
    const { 
      role,
      page = 1, 
      limit = 10, 
      status, 
      search 
    } = req.query;

    // Validate role parameter
    const validRoles = ['admin', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role parameter is required. Valid roles are: admin, factory, jsr, whouse, cp, contractor, farmer, inspection'
      });
    }

    // Build where clause for work orders
    const whereClause = {
      status: {
        [Op.ne]: 'cancelled'
      }
    };
    
    if (status) {
      whereClause.status = status;
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

    // Get work orders with basic info
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

    // Get role-specific details for each work order
    const workOrdersWithRoleDetails = await Promise.all(
      workOrders.map(async (workOrder) => {
        let roleDetails = null;
        const workOrderId = workOrder.id;

        try {
          switch (role) {
            case 'factory':
              const factoryData = await WorkOrderFactory.findOne({
                where: { work_order_id: workOrderId }
              });
              if (factoryData) {
                const totalUnits = workOrder.total_quantity;
                const manufacturedUnits = factoryData.total_quantity_manufactured || 0;
                const sentToJSR = factoryData.total_quantity_to_jsr || 0;
                const remainingToManufacture = totalUnits - manufacturedUnits;
                const remainingToSendToJSR = manufacturedUnits - sentToJSR;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_manufactured: manufacturedUnits,
                  total_units_sent_to_jsr: sentToJSR,
                  remaining_units_to_manufacture: remainingToManufacture,
                  remaining_units_to_send_to_jsr: remainingToSendToJSR,
                  factory_status: factoryData.factory_status,
                  factory_notes: factoryData.factory_notes,
                  created_at: factoryData.createdAt,
                  updated_at: factoryData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_manufactured: 0,
                  total_units_sent_to_jsr: 0,
                  remaining_units_to_manufacture: workOrder.total_quantity,
                  remaining_units_to_send_to_jsr: 0,
                  factory_status: 'pending',
                  factory_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'jsr':
              const jsrData = await WorkOrderJSR.findOne({
                where: { work_order_id: workOrderId }
              });
              if (jsrData) {
                const totalUnits = workOrder.total_quantity;
                const receivedFromFactory = jsrData.total_quantity_received || 0;
                const sentToWarehouse = jsrData.total_quantity_to_warehouse || 0;
                const remainingToReceive = totalUnits - receivedFromFactory;
                const remainingToSendToWarehouse = receivedFromFactory - sentToWarehouse;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_from_factory: receivedFromFactory,
                  total_units_sent_to_warehouse: sentToWarehouse,
                  remaining_units_to_receive: remainingToReceive,
                  remaining_units_to_send_to_warehouse: remainingToSendToWarehouse,
                  jsr_status: jsrData.jsr_status,
                  jsr_notes: jsrData.jsr_notes,
                  created_at: jsrData.createdAt,
                  updated_at: jsrData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_from_factory: 0,
                  total_units_sent_to_warehouse: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  remaining_units_to_send_to_warehouse: 0,
                  jsr_status: 'pending',
                  jsr_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'whouse':
              const warehouseData = await WorkOrderWarehouse.findOne({
                where: { work_order_id: workOrderId }
              });
              if (warehouseData) {
                const totalUnits = workOrder.total_quantity;
                const receivedFromJSR = warehouseData.total_quantity_in_warehouse || 0;
                const sentToCP = warehouseData.total_quantity_to_cp || 0;
                const remainingToReceive = totalUnits - receivedFromJSR;
                const remainingToSendToCP = receivedFromJSR - sentToCP;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_from_jsr: receivedFromJSR,
                  total_units_sent_to_cp: sentToCP,
                  remaining_units_to_receive: remainingToReceive,
                  remaining_units_to_send_to_cp: remainingToSendToCP,
                  warehouse_status: warehouseData.warehouse_status,
                  warehouse_notes: warehouseData.warehouse_notes,
                  created_at: warehouseData.createdAt,
                  updated_at: warehouseData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_from_jsr: 0,
                  total_units_sent_to_cp: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  remaining_units_to_send_to_cp: 0,
                  warehouse_status: 'pending',
                  warehouse_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'cp':
              const cpData = await WorkOrderCP.findOne({
                where: { work_order_id: workOrderId }
              });
              if (cpData) {
                const totalUnits = workOrder.total_quantity;
                const receivedFromWarehouse = cpData.total_quantity_to_cp || 0;
                const assignedToContractor = cpData.total_quantity_assigned || 0;
                const remainingToReceive = totalUnits - receivedFromWarehouse;
                const remainingToAssign = receivedFromWarehouse - assignedToContractor;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_from_warehouse: receivedFromWarehouse,
                  total_units_assigned_to_contractor: assignedToContractor,
                  remaining_units_to_receive: remainingToReceive,
                  remaining_units_to_assign: remainingToAssign,
                  cp_status: cpData.cp_status,
                  cp_notes: cpData.cp_notes,
                  created_at: cpData.createdAt,
                  updated_at: cpData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_from_warehouse: 0,
                  total_units_assigned_to_contractor: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  remaining_units_to_assign: 0,
                  cp_status: 'pending',
                  cp_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'contractor':
              const contractorData = await WorkOrderContractor.findOne({
                where: { work_order_id: workOrderId }
              });
              if (contractorData) {
                const totalUnits = workOrder.total_quantity;
                const receivedFromCP = contractorData.total_quantity_to_contractor || 0;
                const assignedToFarmer = contractorData.total_quantity_assigned || 0;
                const remainingToReceive = totalUnits - receivedFromCP;
                const remainingToAssign = receivedFromCP - assignedToFarmer;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_from_cp: receivedFromCP,
                  total_units_assigned_to_farmer: assignedToFarmer,
                  remaining_units_to_receive: remainingToReceive,
                  remaining_units_to_assign: remainingToAssign,
                  contractor_status: contractorData.contractor_status,
                  contractor_notes: contractorData.contractor_notes,
                  created_at: contractorData.createdAt,
                  updated_at: contractorData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_from_cp: 0,
                  total_units_assigned_to_farmer: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  remaining_units_to_assign: 0,
                  contractor_status: 'pending',
                  contractor_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'farmer':
              const farmerData = await WorkOrderFarmer.findOne({
                where: { work_order_id: workOrderId }
              });
              if (farmerData) {
                const totalUnits = workOrder.total_quantity;
                const receivedFromContractor = farmerData.total_quantity_received || 0;
                const remainingToReceive = totalUnits - receivedFromContractor;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_from_contractor: receivedFromContractor,
                  remaining_units_to_receive: remainingToReceive,
                  farmer_status: farmerData.farmer_status,
                  farmer_notes: farmerData.farmer_notes,
                  created_at: farmerData.createdAt,
                  updated_at: farmerData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_from_contractor: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  farmer_status: 'pending',
                  farmer_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'inspection':
              const inspectionData = await WorkOrderInspection.findOne({
                where: { work_order_id: workOrderId }
              });
              if (inspectionData) {
                const totalUnits = workOrder.total_quantity;
                const receivedForInspection = inspectionData.total_quantity_for_inspection || 0;
                const remainingToReceive = totalUnits - receivedForInspection;
                
                roleDetails = {
                  total_units: totalUnits,
                  total_units_received_for_inspection: receivedForInspection,
                  remaining_units_to_receive: remainingToReceive,
                  inspection_status: inspectionData.inspection_status,
                  inspection_notes: inspectionData.inspection_notes,
                  created_at: inspectionData.createdAt,
                  updated_at: inspectionData.updatedAt
                };
              } else {
                roleDetails = {
                  total_units: workOrder.total_quantity,
                  total_units_received_for_inspection: 0,
                  remaining_units_to_receive: workOrder.total_quantity,
                  inspection_status: 'pending',
                  inspection_notes: null,
                  created_at: null,
                  updated_at: null
                };
              }
              break;

            case 'admin':
              // For admin, show work order creation details
              roleDetails = {
                total_units: workOrder.total_quantity,
                work_order_created: true,
                created_by: workOrder.created_by,
                created_at: workOrder.createdAt,
                updated_at: workOrder.updatedAt
              };
              break;
          }
        } catch (error) {
          console.error(`Error fetching ${role} details for work order ${workOrderId}:`, error);
          roleDetails = null;
        }

        // Get role-specific timeline
        let roleTimeline = null;
        switch (role) {
          case 'factory':
            roleTimeline = workOrder.factory_timeline;
            break;
          case 'jsr':
            roleTimeline = workOrder.jsr_timeline;
            break;
          case 'whouse':
            roleTimeline = workOrder.whouse_timeline;
            break;
          case 'cp':
            roleTimeline = workOrder.cp_timeline;
            break;
          case 'contractor':
            roleTimeline = workOrder.contractor_timeline;
            break;
          case 'farmer':
            roleTimeline = workOrder.farmer_timeline;
            break;
          case 'inspection':
            roleTimeline = workOrder.inspection_timeline;
            break;
          case 'admin':
            roleTimeline = null; // Admin doesn't have a specific timeline
            break;
        }

        return {
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
          // Role-specific timeline
          timeline: roleTimeline,
          created_by: {
            id: workOrder.creator?.id,
            name: workOrder.creator?.name,
            email: workOrder.creator?.email,
            role: workOrder.creator?.role
          },
          // Role-specific details
          [role + '_details']: roleDetails,
          createdAt: workOrder.createdAt,
          updatedAt: workOrder.updatedAt
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: `Work orders with ${role} details retrieved successfully`,
      data: {
        role,
        workOrders: workOrdersWithRoleDetails,
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
    console.error('Error retrieving work orders by role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
