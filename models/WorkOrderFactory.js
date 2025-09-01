import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const WorkOrderFactory = sequelize.define('WorkOrderFactory', {
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
  total_quantity_manufactured: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Total quantity of units manufactured'
  },
  hp_3_manufactured: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 3 HP units manufactured'
  },
  hp_5_manufactured: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 5 HP units manufactured'
  },
  hp_7_5_manufactured: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP units manufactured'
  },
  // Remaining units to manufacture (admin total - manufactured)
  total_quantity_remaining_to_manufacture: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Total quantity remaining to manufacture (admin total - manufactured)'
  },
  hp_3_remaining_to_manufacture: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '3 HP units remaining to manufacture'
  },
  hp_5_remaining_to_manufacture: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '5 HP units remaining to manufacture'
  },
  hp_7_5_remaining_to_manufacture: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '7.5 HP units remaining to manufacture'
  },
  total_quantity_to_jsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total quantity to be sent to JSR for verification'
  },
  hp_3_to_jsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 3 HP units to be sent to JSR'
  },
  hp_5_to_jsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 5 HP units to be sent to JSR'
  },
  hp_7_5_to_jsr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP units to be sent to JSR'
  },
  // Remaining manufactured units (manufactured - dispatched to JSR)
  total_quantity_remaining: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Total quantity remaining after dispatch to JSR'
  },
  hp_3_remaining: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 3 HP units remaining after dispatch to JSR'
  },
  hp_5_remaining: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 5 HP units remaining after dispatch to JSR'
  },
  hp_7_5_remaining: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Quantity of 7.5 HP units remaining after dispatch to JSR'
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'State for JSR dispatch'
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'District of JSR'
  },
  taluka: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Taluka of JSR'
  },
  village: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Village of JSR'
  },
  status: {
    type: DataTypes.ENUM('units_entered', 'dispatched_to_jsr', 'all_units_dispatched'),
    defaultValue: 'units_entered'
  },
  action_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID who performed the action'
  }
}, {
  tableName: 'work_order_factory',
  timestamps: true
});

export default WorkOrderFactory;
