import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderContractor = sequelize.define('WorkOrderContractor', {
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
  cp_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'work_order_cp',
      key: 'id'
    }
  },
  // Units received from CP (contractor inventory)
  total_quantity_to_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_forwarded_by_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_forwarded_by_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_forwarded_by_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Remaining units in contractor (received - dispatched to farmer)
  total_quantity_remaining_in_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_remaining_in_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_remaining_in_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_remaining_in_contractor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Units dispatched to farmer
  total_quantity_assigned: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_3_to_farmer: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_5_to_farmer: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_7_5_to_farmer: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // Farmer assignment details
  name_of_farmer: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  district: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  taluka: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  village: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  farmer_dispatch_status: {
    type: DataTypes.ENUM('pending', 'dispatched_to_farmer', 'all_units_dispatched'),
    allowNull: false,
    defaultValue: 'pending'
  },
  status: {
    type: DataTypes.ENUM('units_received', 'dispatched_to_farmer', 'all_units_dispatched'),
    allowNull: false,
    defaultValue: 'units_received'
  },
  action_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'work_order_contractor',
  timestamps: true
});

export default WorkOrderContractor;
