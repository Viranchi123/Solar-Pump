import BarcodeData from '../models/BarcodeData.js';
import User from '../models/User.js';
import { Op } from 'sequelize';

// Create barcode data entry
export const createBarcodeData = async (req, res) => {
  try {
    const {
      imei_number,
      pump_number,
      motor_number,
      controller_number,
      pump_type,
      module_barcodes
    } = req.body;

    // Validate required fields
    if (!imei_number || !pump_number || !motor_number || !controller_number || !pump_type || !module_barcodes) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate pump type
    const validPumpTypes = ['3_HP', '5_HP', '7.5_HP'];
    if (!validPumpTypes.includes(pump_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pump type. Must be 3_HP, 5_HP, or 7.5_HP'
      });
    }

    // Validate module barcodes array
    if (!Array.isArray(module_barcodes)) {
      return res.status(400).json({
        success: false,
        message: 'Module barcodes must be an array'
      });
    }

    // Validate number of panels based on pump type
    const expectedPanels = {
      '3_HP': 6,
      '5_HP': 9,
      '7.5_HP': 13
    };

    if (module_barcodes.length !== expectedPanels[pump_type]) {
      return res.status(400).json({
        success: false,
        message: `Invalid number of module barcodes. Expected ${expectedPanels[pump_type]} for ${pump_type} pump, but got ${module_barcodes.length}`
      });
    }

    // Validate each barcode format (should start with 'OS' followed by 16 digits)
    const barcodePattern = /^OS\d{16}$/;
    for (const barcode of module_barcodes) {
      if (!barcodePattern.test(barcode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid barcode format: ${barcode}. Barcodes should start with 'OS' followed by 16 digits`
        });
      }
    }



    // Check for duplicate IMEI number
    const existingBarcode = await BarcodeData.findOne({
      where: { imei_number }
    });

    if (existingBarcode) {
      return res.status(400).json({
        success: false,
        message: 'IMEI number already exists'
      });
    }

    // Create barcode data entry
    const barcodeData = await BarcodeData.create({
      imei_number,
      pump_number,
      motor_number,
      controller_number,
      pump_type,
      module_barcodes,
      uploaded_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Barcode data created successfully',
      data: {
        id: barcodeData.id,
        imei_number: barcodeData.imei_number,
        pump_number: barcodeData.pump_number,
        motor_number: barcodeData.motor_number,
        controller_number: barcodeData.controller_number,
        pump_type: barcodeData.pump_type,
        module_barcodes: barcodeData.module_barcodes,
        uploaded_by: barcodeData.uploaded_by,
        createdAt: barcodeData.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating barcode data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all barcode data with pagination
export const getBarcodeData = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      pump_type,
      search 
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    if (pump_type) {
      whereClause.pump_type = pump_type;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { imei_number: { [Op.like]: `%${search}%` } },
        { pump_number: { [Op.like]: `%${search}%` } },
        { motor_number: { [Op.like]: `%${search}%` } },
        { controller_number: { [Op.like]: `%${search}%` } }
      ];
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get barcode data
    const { count, rows: barcodeData } = await BarcodeData.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'uploader',
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
      message: 'Barcode data retrieved successfully',
      data: {
        barcodeData: barcodeData.map(bd => ({
          id: bd.id,
          imei_number: bd.imei_number,
          pump_number: bd.pump_number,
          motor_number: bd.motor_number,
          controller_number: bd.controller_number,
          pump_type: bd.pump_type,
          module_barcodes: bd.module_barcodes,
          uploaded_by: {
            id: bd.uploader?.id,
            name: bd.uploader?.name,
            email: bd.uploader?.email,
            role: bd.uploader?.role
          },
          createdAt: bd.createdAt,
          updatedAt: bd.updatedAt
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
    console.error('Error retrieving barcode data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get single barcode data entry
export const getBarcodeDataById = async (req, res) => {
  try {
    const { id } = req.params;

    const barcodeData = await BarcodeData.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    if (!barcodeData) {
      return res.status(404).json({
        success: false,
        message: 'Barcode data not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Barcode data retrieved successfully',
      data: {
        id: barcodeData.id,
        imei_number: barcodeData.imei_number,
        pump_number: barcodeData.pump_number,
        motor_number: barcodeData.motor_number,
        controller_number: barcodeData.controller_number,
        pump_type: barcodeData.pump_type,
        module_barcodes: barcodeData.module_barcodes,
        uploaded_by: {
          id: barcodeData.uploader?.id,
          name: barcodeData.uploader?.name,
          email: barcodeData.uploader?.email,
          role: barcodeData.uploader?.role
        },
        createdAt: barcodeData.createdAt,
        updatedAt: barcodeData.updatedAt
      }
    });

  } catch (error) {
    console.error('Error retrieving barcode data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
