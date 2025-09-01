import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderJSR = sequelize.define('WorkOrderJSR', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to the work order'
  },
  factory_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to the factory entry'
  },
  // JSR verification details
  total_quantity_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Total quantity of units received from factory'
  },
  hp_3_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 3 HP units received'
  },
  hp_5_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 5 HP units received'
  },
  hp_7_5_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP units received'
  },
  // JSR approval/rejection
  jsr_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'JSR approval status'
  },
  jsr_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes from JSR verification'
  },
  // Location details
  farmer_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Name of the farmer'
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'State of the location'
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'District of the location'
  },
  taluka: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Taluka of the location'
  },
  village: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Village of the location'
  },
  // Photo uploads
  installation_site_photo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Path to installation site photo'
  },
  lineman_installation_set_photo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Path to lineman + installation set photo'
  },
  set_close_up_photo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Path to set close up photo'
  },
  // Warehouse dispatch details
  warehouse_location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Location of warehouse'
  },
  total_quantity_to_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total quantity assigned to warehouse'
  },
  hp_3_to_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 3 HP units to warehouse'
  },
  hp_5_to_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 5 HP units to warehouse'
  },
  hp_7_5_to_warehouse: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP units to warehouse'
  },
  warehouse_dispatch_status: {
    type: DataTypes.ENUM('pending', 'dispatched'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Status of warehouse dispatch'
  },
  action_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID who performed the action'
  }
}, {
  tableName: 'work_order_jsr',
  timestamps: true
});

export default WorkOrderJSR;
