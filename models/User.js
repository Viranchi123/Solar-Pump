import { DataTypes } from 'sequelize';
import { sequelize } from '../config/dbConnection.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    unique: true,
    validate: {
      len: [10, 15]
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  google_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  auth_method: {
    type: DataTypes.ENUM('password', 'google'),
    defaultValue: 'password',
    allowNull: false
  },
  company_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'admin'),
    allowNull: false
  },
  // Location fields - now support multiple values as JSON arrays
  state: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of states, e.g., ["State1", "State2"]'
  },
  district: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of districts, e.g., ["District1", "District2"]'
  },
  taluka: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of talukas, e.g., ["Taluka1", "Taluka2"]'
  },
  village: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of villages, e.g., ["Village1", "Village2"]'
  },
  warehouse_location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  photo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: true
  },
  otp_expiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  beneficiaryId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      is: {
        args: /^[a-zA-Z0-9]*$/,
        msg: 'Beneficiary ID must contain only alphanumeric characters'
      }
    },
    comment: 'Beneficiary ID for farmer role (alphanumeric only)'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && user.auth_method === 'password') {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.auth_method === 'password') {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate OTP
User.prototype.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Instance method to check if OTP is expired
User.prototype.isOTPExpired = function() {
  if (!this.otp_expiry) return true;
  return new Date() > this.otp_expiry;
};

export default User;
