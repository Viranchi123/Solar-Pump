import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrder = sequelize.define('WorkOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  work_order_number: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  farmer_list_file: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Path to uploaded Excel file (.xlsx, .xls) - Required'
  },
  farmer_list_original_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Original filename of the uploaded Excel file - Required'
  },
  total_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Total quantity of all HP types combined'
  },
  hp_3_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 3 HP pumps'
  },
  hp_5_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 5 HP pumps'
  },
  hp_7_5_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP pumps'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // Timeline fields for all roles
  factory_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for factory stage'
  },
  jsr_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for JSR stage'
  },
  whouse_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for warehouse stage'
  },
  cp_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for channel partner stage'
  },
  contractor_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for contractor stage'
  },
  farmer_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for farmer stage'
  },
  inspection_timeline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Timeline in days for inspection stage'
  },
  status: {
    type: DataTypes.ENUM('created', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'created'
  },
  current_stage: {
    type: DataTypes.ENUM('admin_created', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported', 'rejected_by_jsr', 'rejected_by_inspection'),
    defaultValue: 'admin_created'
  },
  // Approval status fields
  jsr_approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    comment: 'JSR approval status for the work order'
  },
  inspection_approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    comment: 'Inspection approval status for the work order'
  },
  jsr_approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID who approved/rejected in JSR stage'
  },
  inspection_approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID who approved/rejected in Inspection stage'
  },
  jsr_approval_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when JSR approval/rejection was made'
  },
  inspection_approval_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when Inspection approval/rejection was made'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'work_orders',
  timestamps: true
});

export default WorkOrder;
