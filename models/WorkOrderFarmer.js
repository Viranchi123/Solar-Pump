import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderFarmer = sequelize.define('WorkOrderFarmer', {
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
  // Step 1: Units received from contractor
  total_quantity_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Step 2: Defect reporting
  farmer_status: {
    type: DataTypes.ENUM('units_received', 'defect_reported', 'completed'),
    allowNull: false,
    defaultValue: 'units_received'
  },
  issue_title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Photo uploads for defect report
  photo_1: {
    type: DataTypes.STRING,
    allowNull: true
  },
  photo_2: {
    type: DataTypes.STRING,
    allowNull: true
  },
  photo_3: {
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
  tableName: 'work_order_farmer',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default WorkOrderFarmer;
