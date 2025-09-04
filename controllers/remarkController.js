import { Remark, User, WorkOrder } from '../models/index.js';

export const addRemark = async (req, res) => {
  const { work_order_id, remark, access } = req.body;
  
  // Check if user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  const user_id = req.user.id;

  if (!work_order_id || !Number.isInteger(work_order_id)) {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid or missing work_order_id' 
    });
  }

  if (!remark || remark.trim() === '') {
    return res.status(400).json({ 
      success: false,
      message: 'Remark cannot be empty' 
    });
  }

  // Validate access parameter
  if (!access || (access !== 'everyone' && !Array.isArray(access))) {
    return res.status(400).json({ 
      success: false,
      message: 'Access must be "everyone" or an array of roles' 
    });
  }

  // If access is an array, validate that all roles are valid
  if (Array.isArray(access)) {
    const validRoles = ['admin', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection'];
    const invalidRoles = access.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}` 
      });
    }
  }

  try {
    // Check if work order exists and get work order details
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder) {
      return res.status(404).json({ 
        success: false,
        message: `Work order with ID ${work_order_id} not found` 
      });
    }

    // Get user details
    const user = await User.findByPk(user_id);

    const newRemark = await Remark.create({
      work_order_id,
      user_id,
      remark: remark.trim(),
      role_no: null,
      access: access,
      created_by: user_id
    });

    res.status(201).json({ 
      success: true,
      message: 'Remark added successfully',
      data: {
        remark_id: newRemark.id,
        work_order_number: workOrder.work_order_number,
        user_role: user.role
      }
    });
  } catch (err) {
    console.error('Error adding remark:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

export const editRemark = async (req, res) => {
  const { remark_id, remark, access } = req.body;
  
  // Check if user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }
  
  const user_id = req.user.id;

  if (!remark_id || !Number.isInteger(remark_id)) {
    return res.status(400).json({ message: 'Invalid or missing remark_id' });
  }

  if (!remark || remark.trim() === '') {
    return res.status(400).json({ 
      success: false,
      message: 'Remark cannot be empty' 
    });
  }

  // Validate access parameter if provided
  if (access !== undefined) {
    if (access !== 'everyone' && !Array.isArray(access)) {
      return res.status(400).json({ 
        success: false,
        message: 'Access must be "everyone" or an array of roles' 
      });
    }

    // If access is an array, validate that all roles are valid
    if (Array.isArray(access)) {
      const validRoles = ['admin', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection'];
      const invalidRoles = access.filter(role => !validRoles.includes(role));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}` 
        });
      }
    }
  }

  try {
    const existingRemark = await Remark.findByPk(remark_id);
    
    if (!existingRemark) {
      return res.status(404).json({ 
        success: false,
        message: 'Remark not found' 
      });
    }

    if (existingRemark.user_id !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to edit this remark' 
      });
    }

    const updateData = {
      remark: remark.trim()
    };
    
    // Update access if provided
    if (access !== undefined) {
      updateData.access = access;
    }
    
    await existingRemark.update(updateData);

    res.json({ 
      success: true,
      message: 'Remark updated successfully' 
    });
  } catch (err) {
    console.error('Error updating remark:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

export const listRemarks = async (req, res) => {
  const { work_order_id, remark_id } = req.query;
  
  // Check if user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  try {
    // Get user role for access control
    const user = await User.findByPk(req.user.id);
    const userRole = user.role;

    let whereClause = {};
    let includeOptions = [{
      model: User,
      as: 'user',
      attributes: ['name', 'role']
    }];

    if (remark_id) {
      whereClause.id = remark_id;
    } else if (work_order_id) {
      // Check if work order exists when filtering by work_order_id
      const workOrder = await WorkOrder.findByPk(work_order_id);
      if (!workOrder) {
        return res.status(404).json({ 
          success: false,
          message: `Work order with ID ${work_order_id} not found` 
        });
      }
      whereClause.work_order_id = work_order_id;
    }

    const remarks = await Remark.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'role']
        },
        {
          model: WorkOrder,
          as: 'workOrder',
          attributes: ['work_order_number']
        }
      ],
      attributes: ['id', 'remark', 'created_at', 'updated_at', 'work_order_id', 'access', 'created_by'],
      order: [['created_at', 'DESC']]
    });

    // Filter remarks based on access control
    const accessibleRemarks = remarks.filter(remark => {
      const access = remark.access;
      
      // If user created this remark, they can always see it
      if (remark.created_by === req.user.id) {
        return true;
      }
      
      // If access is "everyone", all users can see it
      if (access === 'everyone') {
        return true;
      }
      
      // If access is an array of roles, check if user's role is in the array
      if (Array.isArray(access)) {
        return access.includes(userRole);
      }
      
      // If access is neither "everyone" nor an array, deny access
      return false;
    });

    // Transform the data to match the expected format
    const transformedRemarks = accessibleRemarks.map(remark => ({
      id: remark.id,
      remark: remark.remark,
      created_at: remark.created_at,
      updated_at: remark.updated_at,
      work_order_id: remark.work_order_id,
      work_order_number: remark.workOrder?.work_order_number,
      user_name: remark.user.name,
      user_role: remark.user.role,
      access: remark.access,
      is_own_remark: remark.created_by === req.user.id
    }));

    // Separate remarks into own and other
    const ownRemarks = transformedRemarks.filter(remark => remark.is_own_remark);
    const otherRemarks = transformedRemarks.filter(remark => !remark.is_own_remark);

    // Remove the is_own_remark field from the final response
    const cleanOwnRemarks = ownRemarks.map(({ is_own_remark, ...remark }) => remark);
    const cleanOtherRemarks = otherRemarks.map(({ is_own_remark, ...remark }) => remark);

    res.json({
      success: true,
      message: 'Remarks retrieved successfully',
      data: {
        own_remarks: cleanOwnRemarks,
        other_remarks: cleanOtherRemarks,
        total_own_remarks: cleanOwnRemarks.length,
        total_other_remarks: cleanOtherRemarks.length,
        total_remarks: transformedRemarks.length
      }
    });
  } catch (err) {
    console.error('Error retrieving remarks:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

