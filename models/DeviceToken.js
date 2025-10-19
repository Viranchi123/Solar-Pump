import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const DeviceToken = sequelize.define('DeviceToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID associated with this device'
  },
  device_token: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true,
    comment: 'FCM device token'
  },
  platform: {
    type: DataTypes.ENUM('ios', 'android', 'web'),
    allowNull: false,
    defaultValue: 'android',
    comment: 'Device platform'
  },
  device_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Device name or model'
  },
  app_version: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'App version'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether device token is active'
  },
  last_used_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time this token was used successfully'
  }
}, {
  tableName: 'device_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['device_token'],
      unique: true
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['last_used_at']
    }
  ]
});

export default DeviceToken;

