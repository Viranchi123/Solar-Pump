import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';
import bcrypt from 'bcryptjs';

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Full name of the admin'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    comment: 'Email address of the admin'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Hashed password'
  },
  google_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    comment: 'Google OAuth ID'
  },
  auth_method: {
    type: DataTypes.ENUM('password', 'google'),
    defaultValue: 'password',
    allowNull: false,
    comment: 'Authentication method used'
  },
  company_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Company name'
  },
  role: {
    type: DataTypes.ENUM('admin'),
    defaultValue: 'admin',
    allowNull: false,
    comment: 'Role of the user (always admin)'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the admin account is active'
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last login timestamp'
  },
  photo: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Profile photo path'
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: true,
    comment: 'OTP for password reset'
  },
  otp_expiry: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'OTP expiry timestamp'
  }
}, {
  tableName: 'admins',
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password && admin.auth_method === 'password') {
        admin.password = await bcrypt.hash(admin.password, 12);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password') && admin.auth_method === 'password') {
        admin.password = await bcrypt.hash(admin.password, 12);
      }
    }
  }
});

// Instance method to compare password
Admin.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if OTP is expired
Admin.prototype.isOTPExpired = function() {
  if (!this.otp_expiry) return true;
  return new Date() > this.otp_expiry;
};

export default Admin;
