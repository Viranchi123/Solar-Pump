import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderStage = sequelize.define('WorkOrderStage', {
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
  stage_name: {
    type: DataTypes.ENUM('admin_created', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection'),
    allowNull: false,
    comment: 'Name of the stage'
  },
  stage_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Order of the stage in the workflow (1, 2, 3, etc.)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Current status of the stage'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the stage was started'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the stage was completed'
  },
  assigned_to: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID assigned to this stage'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes or comments for this stage'
  },
  stage_data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stage-specific data and details'
  },
  previous_stage_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Reference to the previous stage'
  },
  next_stage_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Reference to the next stage'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if stage failed'
  },
  retry_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of retry attempts for this stage'
  },
  max_retries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: 'Maximum number of retry attempts allowed'
  }
}, {
  tableName: 'work_order_stages',
  timestamps: true,
  indexes: [
    {
      fields: ['work_order_id', 'stage_name'],
      unique: true,
      name: 'unique_work_order_stage'
    },
    {
      fields: ['work_order_id', 'stage_order'],
      name: 'work_order_stage_order'
    },
    {
      fields: ['status'],
      name: 'stage_status_index'
    }
  ]
});

export default WorkOrderStage;
