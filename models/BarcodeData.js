import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const BarcodeData = sequelize.define('BarcodeData', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  imei_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'IMEI Number (15-digit identifier)'
  },
  pump_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Pump Number (8-digit identifier)'
  },
  motor_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Motor Number (8-digit identifier)'
  },
  controller_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Controller Number (8-digit identifier)'
  },
  pump_type: {
    type: DataTypes.ENUM('3_HP', '5_HP', '7.5_HP'),
    allowNull: false,
    comment: 'Type of pump (3 HP, 5 HP, or 7.5 HP)'
  },
  module_barcodes: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of module barcodes (6 for 3HP, 9 for 5HP, 13 for 7.5HP)'
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID who uploaded this barcode data'
  }
}, {
  tableName: 'barcode_data',
  timestamps: true
});

export default BarcodeData;
