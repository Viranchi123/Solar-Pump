import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderWarehouse = sequelize.define('WorkOrderWarehouse', {
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
  jsr_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'work_order_jsr',
      key: 'id'
    }
  },
  // Units received from JSR (warehouse inventory)
  total_quantity_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Remaining units in warehouse (inventory - dispatched)
  total_quantity_remaining_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_remaining_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_remaining_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_remaining_in_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Units dispatched to CP
  total_quantity_to_cp: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_3_to_cp: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_5_to_cp: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_7_5_to_cp: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // CP dispatch details
  region_of_cp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cp_dispatch_status: {
    type: DataTypes.ENUM('pending', 'dispatched_to_cp', 'all_units_dispatched'),
    allowNull: false,
    defaultValue: 'pending'
  },
  status: {
    type: DataTypes.ENUM('units_received', 'dispatched_to_cp', 'all_units_dispatched'),
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
  tableName: 'work_order_warehouse',
  timestamps: true
});

export default WorkOrderWarehouse;
