import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { Op } from 'sequelize';
import { User, WorkOrder, WorkOrderFactory, WorkOrderJSR, WorkOrderWarehouse, WorkOrderCP, WorkOrderContractor, WorkOrderFarmer, WorkOrderInspection } from '../models/index.js';
import { sequelize } from '../config/dbConnection.js';
import { google } from 'googleapis';

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP via email
const sendOTPEmail = async (email, otp, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text
    });
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Login with phone and password
export const loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number'
      });
    }

    // Find user by phone number
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number'
      });
    }

    // Check if password matches using the model's password comparison method
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role,
        phone: user.phone 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '3d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        company_name: user.company_name,
        role: user.role,
        photo: user.photo,
        state: user.state,
        district: user.district,
        taluka: user.taluka,
        village: user.village,
        warehouse_location: user.warehouse_location,
        location: user.location
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Send Forgot Password OTP
export const sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate OTP and set expiry (10 minutes)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update user with OTP
    await user.update({
      otp,
      otp_expiry: otpExpiry
    });

    // Send OTP via email
    const emailSent = await sendOTPEmail(
      email,
      otp,
      'Password Reset OTP',
      `Your password reset OTP is: ${otp}. It is valid for 10 minutes.`
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully'
    });

  } catch (error) {
    console.error('Send Forgot Password OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify Forgot Password OTP (Step 2)
export const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (user.isOTPExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Mark OTP as verified (optional: you can add a field like otp_verified: true)
    // For now, we'll just return success and let the frontend proceed

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      email: email
    });

  } catch (error) {
    console.error('Verify Forgot Password OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reset Password (Step 3 - after OTP verification)
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (user.isOTPExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Update password and clear OTP
    await user.update({
      password: newPassword,
      otp: null,
      otp_expiry: null
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get User Profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'phone', 'email', 'company_name', 'role', 'photo', 'createdAt', 'state', 'district', 'taluka', 'village', 'warehouse_location', 'location']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get User Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update User Photo
export const updateUserPhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update photo path
    const photoPath = req.file.path;
    await user.update({ photo: photoPath });

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      photo: photoPath
    });

  } catch (error) {
    console.error('Update User Photo Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get User Profile Photo
export const getUserProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'photo']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.photo) {
      return res.status(404).json({
        success: false,
        message: 'Profile photo not found'
      });
    }

    // Set appropriate headers for image response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="profile-photo.jpg"');
    
    // Send the image file
    res.sendFile(user.photo, { root: '.' });

  } catch (error) {
    console.error('Get User Profile Photo Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to normalize location fields (convert single values to arrays)
const normalizeLocationField = (field) => {
  if (!field) return null;
  if (Array.isArray(field)) {
    // Filter out empty strings and return array
    return field.filter(item => item && item.trim() !== '');
  }
  // Convert single string to array
  if (typeof field === 'string' && field.trim() !== '') {
    return [field.trim()];
  }
  return null;
};

// Register User
export const registerUser = async (req, res) => {
  try {
    const { role } = req.query;
    const { name, phone, email, password, confirmPassword, company_name, state, district, taluka, village, warehouse_location, location, beneficiaryId } = req.body;

    // Check if role is provided in query params
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required in query parameters'
      });
    }

    // Validate role
    const allowedRoles = ['factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'admin'];
    if (!allowedRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Normalize location fields to arrays (support both single values and arrays)
    const normalizedState = normalizeLocationField(state);
    const normalizedDistrict = normalizeLocationField(district);
    const normalizedTaluka = normalizeLocationField(taluka);
    const normalizedVillage = normalizeLocationField(village);

    // Role-based field validation
    const roleValidation = validateRoleFields(role.toLowerCase(), {
      name, phone, email, password, confirmPassword, company_name,
      state: normalizedState, district: normalizedDistrict, 
      taluka: normalizedTaluka, village: normalizedVillage, 
      warehouse_location, location, beneficiaryId
    });

    if (!roleValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: roleValidation.message
      });
    }

    // Basic validation
    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { phone },
          ...(email ? [{ email }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this phone number or email already exists'
      });
    }

    // Prepare user data based on role
    const userData = {
      name,
      phone,
      email,
      password,
      role: role.toLowerCase()
    };

    // Add role-specific fields (now storing as arrays)
    if (company_name) userData.company_name = company_name;
    if (normalizedState && normalizedState.length > 0) userData.state = normalizedState;
    if (normalizedDistrict && normalizedDistrict.length > 0) userData.district = normalizedDistrict;
    if (normalizedTaluka && normalizedTaluka.length > 0) userData.taluka = normalizedTaluka;
    if (normalizedVillage && normalizedVillage.length > 0) userData.village = normalizedVillage;
    if (warehouse_location) userData.warehouse_location = warehouse_location;
    if (location) userData.location = location;
    if (beneficiaryId) userData.beneficiaryId = beneficiaryId;

    // Create user
    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        company_name: user.company_name,
        role: user.role,
        state: user.state,
        district: user.district,
        taluka: user.taluka,
        village: user.village,
        warehouse_location: user.warehouse_location,
        location: user.location,
        beneficiaryId: user.beneficiaryId
      }
    });

  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to validate fields based on role
const validateRoleFields = (role, fields) => {
  const { name, phone, email, password, confirmPassword } = fields;
  
  // Common required fields for all roles
  if (!name || !phone || !email || !password || !confirmPassword) {
    return {
      isValid: false,
      message: 'Name, mobile, email, password, and confirm password are required for all roles'
    };
  }

  // Helper to check if location field is valid (array with at least one element)
  const isValidLocationField = (field) => {
    return field && Array.isArray(field) && field.length > 0;
  };

  switch (role) {
    case 'factory':
      if (!fields.company_name) {
        return {
          isValid: false,
          message: 'Company name is required for Factory role'
        };
      }
      // Check for extra fields
      if (fields.state || fields.district || fields.taluka || fields.village || 
          fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'Factory role should only have: name, mobile, email, password, confirm password, company name'
        };
      }
      break;

    case 'jsr':
      if (!fields.company_name || !isValidLocationField(fields.state) || 
          !isValidLocationField(fields.district) || !isValidLocationField(fields.taluka) || 
          !isValidLocationField(fields.village)) {
        return {
          isValid: false,
          message: 'JSR role requires: name, mobile, email, password, confirm password, company name, state (array), district (array), taluka (array), village (array). You can provide multiple values for each location field.'
        };
      }
      // Check for extra fields
      if (fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'JSR role should only have: name, mobile, email, password, confirm password, company name, state, district, taluka, village'
        };
      }
      break;

    case 'whouse':
      if (!fields.company_name || !fields.warehouse_location) {
        return {
          isValid: false,
          message: 'Whouse role requires: name, mobile, email, password, confirm password, company name, warehouse location'
        };
      }
      // Check for extra fields
      if (fields.state || fields.district || fields.taluka || fields.village || fields.location) {
        return {
          isValid: false,
          message: 'Whouse role should only have: name, mobile, email, password, confirm password, company name, warehouse location'
        };
      }
      break;

    case 'cp':
      if (!fields.company_name || !fields.location) {
        return {
          isValid: false,
          message: 'CP role requires: name, mobile, email, password, confirm password, company name, location'
        };
      }
      // Check for extra fields
      if (fields.state || fields.district || fields.taluka || fields.village || fields.warehouse_location) {
        return {
          isValid: false,
          message: 'CP role should only have: name, mobile, email, password, confirm password, company name, location'
        };
      }
      break;

    case 'contractor':
      if (!fields.company_name || !isValidLocationField(fields.state) || 
          !isValidLocationField(fields.district) || !isValidLocationField(fields.taluka) || 
          !isValidLocationField(fields.village)) {
        return {
          isValid: false,
          message: 'Contractor role requires: name, mobile, email, password, confirm password, company name, state (array), district (array), taluka (array), village (array). You can provide multiple values for each location field.'
        };
      }
      // Check for extra fields
      if (fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'Contractor role should only have: name, mobile, email, password, confirm password, company name, state, district, taluka, village'
        };
      }
      break;

    case 'farmer':
      if (!fields.beneficiaryId) {
        return {
          isValid: false,
          message: 'Beneficiary ID is required for Farmer role'
        };
      }
      // Validate beneficiaryId is alphanumeric
      if (!/^[a-zA-Z0-9]+$/.test(fields.beneficiaryId)) {
        return {
          isValid: false,
          message: 'Beneficiary ID must contain only alphanumeric characters'
        };
      }
      if (!isValidLocationField(fields.state) || !isValidLocationField(fields.district) || 
          !isValidLocationField(fields.taluka) || !isValidLocationField(fields.village)) {
        return {
          isValid: false,
          message: 'Farmer role requires: name, mobile, email, password, confirm password, beneficiaryId, state (array), district (array), taluka (array), village (array). You can provide multiple values for each location field.'
        };
      }
      // Check for extra fields
      if (fields.company_name || fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'Farmer role should only have: name, mobile, email, password, confirm password, beneficiaryId, state, district, taluka, village'
        };
      }
      break;

    case 'inspection':
      if (!fields.company_name || !isValidLocationField(fields.state) || 
          !isValidLocationField(fields.district) || !isValidLocationField(fields.taluka) || 
          !isValidLocationField(fields.village)) {
        return {
          isValid: false,
          message: 'Inspection role requires: name, mobile, email, password, confirm password, company name, state (array), district (array), taluka (array), village (array). You can provide multiple values for each location field.'
        };
      }
      // Check for extra fields
      if (fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'Inspection role should only have: name, mobile, email, password, confirm password, company name, state, district, taluka, village'
        };
      }
      break;

    case 'admin':
      if (!fields.company_name) {
        return {
          isValid: false,
          message: 'Admin role requires: name, email, password, confirm password, company name'
        };
      }
      // Check for extra fields - admin should not have location fields
      if (fields.state || fields.district || fields.taluka || fields.village || 
          fields.warehouse_location || fields.location) {
        return {
          isValid: false,
          message: 'Admin role should only have: name, email, password, confirm password, company name'
        };
      }
      break;

    default:
      return {
        isValid: false,
        message: 'Invalid role'
      };
  }

  return { isValid: true };
};
// Get all users by role
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required in query parameters'
      });
    }

    const allowedRoles = ['factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'admin'];
    if (!allowedRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const users = await User.findAll({
      where: { role: role.toLowerCase() },
      attributes: [
        'id',
        'name',
        'phone',
        'email',
        'company_name',
        'role',
        'state',
        'district',
        'taluka',
        'village',
        'warehouse_location',
        'location',
        'photo'
      ]
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('Get Users By Role Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get required fields for a specific role
export const getRoleFields = async (req, res) => {
  try {
    const { role } = req.params;

    const roleFields = {
      factory: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name'],
        optional: [],
        description: 'Factory registration fields'
      },
      jsr: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name', 'state', 'district', 'taluka', 'village'],
        optional: [],
        description: 'JSR registration fields'
      },
      whouse: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name', 'warehouse_location'],
        optional: [],
        description: 'Warehouse registration fields'
      },
      cp: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name', 'location'],
        optional: [],
        description: 'CP registration fields'
      },
      contractor: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name', 'state', 'district', 'taluka', 'village'],
        optional: [],
        description: 'Contractor registration fields'
      },
      farmer: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'beneficiaryId', 'state', 'district', 'taluka', 'village'],
        optional: [],
        description: 'Farmer registration fields'
      },
      inspection: {
        required: ['name', 'phone', 'email', 'password', 'confirmPassword', 'company_name', 'state', 'district', 'taluka', 'village'],
        optional: [],
        description: 'Inspection registration fields'
      },
      admin: {
        required: ['name', 'email', 'password', 'confirmPassword', 'company_name'],
        optional: [],
        description: 'Admin registration fields'
      }
    };

    if (!roleFields[role.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    res.status(200).json({
      success: true,
      role: role.toLowerCase(),
      fields: roleFields[role.toLowerCase()]
    });

  } catch (error) {
    console.error('Get Role Fields Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Google OAuth login for users
export const loginWithGoogle = async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: 'Google token is required'
      });
    }

    // Verify Google token and get user info
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: googleToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const { id: googleId, email, name, picture } = data;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not provided by Google'
      });
    }

    // Find or create user
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { google_id: googleId }
        ]
      }
    });

    if (user) {
      // Update existing user with Google ID if not set
      if (!user.google_id) {
        await user.update({
          google_id: googleId,
          auth_method: 'google'
        });
      }
    } else {
      // Create new user
      user = await User.create({
        name: name,
        email,
        phone: '0000000000', // Default phone, user should update
        google_id: googleId,
        auth_method: 'google',
        role: 'farmer', // Default role, user can change
        company_name: 'Google User'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role,
        phone: user.phone 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '3d' }
    );

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        company_name: user.company_name,
        role: user.role,
        photo: user.photo,
        state: user.state,
        district: user.district,
        taluka: user.taluka,
        village: user.village,
        warehouse_location: user.warehouse_location,
        location: user.location,
        auth_method: user.auth_method
      }
    });

  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all users from both User and Admin tables
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      search,
      is_active 
    } = req.query;

    // Build where clause for User table
    const userWhereClause = {};
    const adminWhereClause = {};

    // Apply role filter
    if (role) {
      if (role === 'admin') {
        // Only fetch from Admin table
        adminWhereClause.role = 'admin';
        userWhereClause.id = { [Op.eq]: null }; // This will return no results
      } else {
        // Only fetch from User table with specific role
        userWhereClause.role = role;
        adminWhereClause.id = { [Op.eq]: null }; // This will return no results
      }
    }

    // Apply search filter
    if (search) {
      const userSearchCondition = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } }
        ]
      };
      
      const adminSearchCondition = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { company_name: { [Op.like]: `%${search}%` } }
        ]
      };
      
      if (role === 'admin') {
        adminWhereClause[Op.and] = adminSearchCondition;
      } else if (role && role !== 'admin') {
        userWhereClause[Op.and] = userSearchCondition;
      } else {
        // Search in both tables with appropriate fields
        userWhereClause[Op.and] = userSearchCondition;
        adminWhereClause[Op.and] = adminSearchCondition;
      }
    }

    // Apply active status filter
    if (is_active !== undefined) {
      const activeStatus = is_active === 'true' || is_active === true;
      userWhereClause.is_active = activeStatus;
      adminWhereClause.is_active = activeStatus;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch users and admins in parallel
    const [users, admins, userCount, adminCount] = await Promise.all([
      // Regular users
      User.findAll({
        where: userWhereClause,
        attributes: ['id', 'name', 'email', 'phone', 'role', 'is_active', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      }),
      
      // Admin users
      Admin.findAll({
        where: adminWhereClause,
        attributes: ['id', 'full_name', 'email', 'role', 'company_name', 'is_active', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      }),
      
      // Count users
      User.count({ where: userWhereClause }),
      
      // Count admins
      Admin.count({ where: adminWhereClause })
    ]);

    // Transform users to consistent format
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      company_name: user.company_name,
      user_type: 'user',
      is_active: user.is_active,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    }));

    // Transform admins to consistent format
    const transformedAdmins = admins.map(admin => ({
      id: admin.id,
      name: admin.full_name,
      email: admin.email,
      phone: null, // Admin doesn't have phone field
      role: admin.role,
      company_name: admin.company_name,
      user_type: 'admin',
      is_active: admin.is_active,
      created_at: admin.createdAt,
      updated_at: admin.updatedAt
    }));

    // Group users by role
    const usersByRole = {};
    
    // Group regular users by role
    transformedUsers.forEach(user => {
      if (!usersByRole[user.role]) {
        usersByRole[user.role] = [];
      }
      usersByRole[user.role].push(user);
    });

    // Group admins by role
    transformedAdmins.forEach(admin => {
      if (!usersByRole[admin.role]) {
        usersByRole[admin.role] = [];
      }
      usersByRole[admin.role].push(admin);
    });

    // Calculate pagination info
    const totalCount = userCount + adminCount;
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: 'All users retrieved successfully',
      data: {
        users_by_role: usersByRole,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        summary: {
          total_users: userCount,
          total_admins: adminCount,
          total_all_users: totalCount,
          roles: Object.keys(usersByRole)
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving all users:', error);
  }
}  
export const getAdminDashboard = async (req, res) => {
  try {

    // Get Factory statistics - total units assigned to factory (from all work orders)
    const factoryStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['admin_created', 'factory', 'jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

const warehouseStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['whouse', 'cp', 'contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

    // Get JSR statistics
    const jsrStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['jsr', 'whouse', 'cp', 'contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

    // Get CP statistics
    const cpStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['cp', 'contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });
    const farmerStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

    // Get Farmer installed count (completed status)
    const farmerInstalledStats = await WorkOrderFarmer.findAll({
      where: {
        farmer_status: 'completed'
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('total_quantity_received')), 'installed_units']
      ],
      raw: true
    });

    // Get Inspection statistics
    const inspectionStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

    // Get Contractor statistics
    const contractorStats = await WorkOrder.findAll({
      where: {
        current_stage: {
          [Op.in]: ['contractor', 'farmer', 'inspection', 'farmer_inspection', 'defect_reported']
        }
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('WorkOrder.total_quantity')), 'total_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_3_quantity')), 'hp_3_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_5_quantity')), 'hp_5_units'],
        [sequelize.fn('SUM', sequelize.col('WorkOrder.hp_7_5_quantity')), 'hp_7_5_units']
      ],
      raw: true
    });

const inspectionRejectedStats = await WorkOrderInspection.findAll({
      where: {
        inspection_status: 'rejected'
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('total_quantity_for_inspection')), 'rejected_units']
      ],
      raw: true
    });

    // Prepare dashboard data
    const dashboardData = {
      factory: {
        title: "Factory",
        units: parseInt(factoryStats[0]?.total_units || 0),
        icon: "factory",
        color: "light-blue"
      },
      warehouse: {
        title: "Warehouse",
        units: parseInt(warehouseStats[0]?.total_units || 0),
        icon: "warehouse",
        color: "light-yellow"
      },
      jsr: {
        title: "JSR",
        units: parseInt(jsrStats[0]?.total_units || 0),
        icon: "document",
        color: "light-pink"
      },
      cp: {
        title: "CP",
        units: parseInt(cpStats[0]?.total_units || 0),
        icon: "person",
        color: "light-blue"
      },
      contractor: {
        title: "Contractor",
        units: parseInt(contractorStats[0]?.total_units || 0),
        icon: "hammer",
        color: "light-orange"
      },
      farmer: {
        title: "Farmer",
        units: parseInt(farmerStats[0]?.total_units || 0),
        icon: "tractor",
        color: "light-green",
        additional_info: {
          installed: parseInt(farmerInstalledStats[0]?.installed_units || 0)
        }
      },
      inspection: {
        title: "Inspection",
        units: parseInt(inspectionStats[0]?.total_units || 0),
        icon: "magnifying-glass",
        color: "light-green",
        additional_info: {
          rejected: parseInt(inspectionRejectedStats[0]?.rejected_units || 0)
        }
      }
    };

    res.status(200).json({
      success: true,
      message: 'Admin dashboard data retrieved successfully',
      data: dashboardData
    });

  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
