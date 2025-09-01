import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderInspection = sequelize.define('WorkOrderInspection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'work_orders',
      key: 'id'
    }
  },
  contractor_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'work_order_contractor',
      key: 'id'
    }
  },
  // Step 1: Units received for inspection
  total_quantity_for_inspection: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_for_inspection: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_for_inspection: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_for_inspection: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Step 2: Inspection decision
  inspection_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  // Farmer details (for approved inspections)
  farmer_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  district: {
    type: DataTypes.STRING,
    allowNull: true
  },
  taluka: {
    type: DataTypes.STRING,
    allowNull: true
  },
  village: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Photo uploads (for approved inspections)
  installation_site_photo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lineman_installation_set_photo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  set_close_up_photo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Audit fields
  action_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'work_order_inspection',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default WorkOrderInspection;
