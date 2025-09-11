import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Specific user ID (null for role-based notifications)'
  },
  user_role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Target role for notification'
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Notification type (work_order_created, stage_completed, deadline_warning, etc.)'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Notification title'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Notification message'
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data for notification'
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Related work order ID'
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether notification has been read'
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When notification was read'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium',
    comment: 'Notification priority level'
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id', 'is_read']
    },
    {
      fields: ['user_role', 'is_read']
    },
    {
      fields: ['work_order_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['created_at']
    }
  ]
});

export default Notification;
