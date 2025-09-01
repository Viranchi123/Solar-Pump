import { Remark, User } from '../models/index.js';

export const addRemark = async (req, res) => {
  const { work_order_id, remark, role_no } = req.body;
  const user_id = req.user.id;

  if (!work_order_id || !Number.isInteger(work_order_id)) {
    return res.status(400).json({ message: 'Invalid or missing work_order_id' });
  }

  if (!remark || remark.trim() === '') {
    return res.status(400).json({ message: 'Remark cannot be empty' });
  }

  try {
    const newRemark = await Remark.create({
      work_order_id,
      user_id,
      remark: remark.trim(),
      role_no: role_no || null
    });

    res.status(201).json({ message: 'Remark added', remark_id: newRemark.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const editRemark = async (req, res) => {
  const { remark_id, remark } = req.body;
  const user_id = req.user.id;

  if (!remark_id || !Number.isInteger(remark_id)) {
    return res.status(400).json({ message: 'Invalid or missing remark_id' });
  }

  if (!remark || remark.trim() === '') {
    return res.status(400).json({ message: 'Remark cannot be empty' });
  }

  try {
    const existingRemark = await Remark.findByPk(remark_id);
    
    if (!existingRemark) {
      return res.status(404).json({ message: 'Remark not found' });
    }

    if (existingRemark.user_id !== user_id) {
      return res.status(403).json({ message: 'Not authorized to edit this remark' });
    }

    await existingRemark.update({
      remark: remark.trim()
    });

    res.json({ message: 'Remark updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listRemarks = async (req, res) => {
  const { work_order_id, remark_id } = req.query;

  try {
    let whereClause = {};
    let includeOptions = [{
      model: User,
      as: 'user',
      attributes: ['name', 'role']
    }];

    if (remark_id) {
      whereClause.id = remark_id;
    } else if (work_order_id) {
      whereClause.work_order_id = work_order_id;
    }

    const remarks = await Remark.findAll({
      where: whereClause,
      include: includeOptions,
      attributes: ['id', 'remark', 'created_at', 'updated_at', 'work_order_id'],
      order: [['created_at', 'DESC']]
    });

    // Transform the data to match the expected format
    const transformedRemarks = remarks.map(remark => ({
      id: remark.id,
      remark: remark.remark,
      created_at: remark.created_at,
      updated_at: remark.updated_at,
      work_order_id: remark.work_order_id,
      user_name: remark.user.name,
      role: remark.user.role
    }));

    res.json(transformedRemarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

