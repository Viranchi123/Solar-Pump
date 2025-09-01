import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderCP = sequelize.define('WorkOrderCP', {
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
  warehouse_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'work_order_warehouse',
      key: 'id'
    }
  },
  // Units received from warehouse (CP inventory)
  total_quantity_to_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_forwarded_by_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_forwarded_by_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_forwarded_by_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Remaining units in CP (received - dispatched to contractor)
  total_quantity_remaining_in_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_3_remaining_in_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_5_remaining_in_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  hp_7_5_remaining_in_cp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Units dispatched to contractor
  total_quantity_assigned: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_3_to_contractor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_5_to_contractor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  hp_7_5_to_contractor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // Contractor assignment details
  contractor_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  village: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  contractor_dispatch_status: {
    type: DataTypes.ENUM('pending', 'dispatched_to_contractor', 'all_units_dispatched'),
    allowNull: false,
    defaultValue: 'pending'
  },
  status: {
    type: DataTypes.ENUM('units_received', 'dispatched_to_contractor', 'all_units_dispatched'),
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
  tableName: 'work_order_cp',
  timestamps: true
});

export default WorkOrderCP;
