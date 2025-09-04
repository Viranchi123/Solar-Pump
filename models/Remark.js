import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';

const Remark = sequelize.define('Remark', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  role_no: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  access: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Access control: "everyone" or array of roles that can see this remark'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who created this remark - allows creator to see their own remarks'
  }
}, {
  tableName: 'remarks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Remark;
