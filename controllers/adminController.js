import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { Op } from 'sequelize';

// Register admin
export const registerAdmin = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      confirm_password,
      company_name
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !password || !confirm_password || !company_name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Check if admin with this email already exists
    const existingAdmin = await Admin.findOne({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'An admin with this email already exists'
      });
    }

    // Create new admin
    const admin = await Admin.create({
      full_name,
      email,
      password,
      company_name,
      role: 'admin'
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        company_name: admin.company_name,
        role: admin.role,
        token
      }
    });

  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Login admin
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({
      where: { email }
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if admin account is active
    if (!admin.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await admin.update({
      last_login: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        company_name: admin.company_name,
        role: admin.role,
        last_login: admin.last_login,
        token
      }
    });

  } catch (error) {
    console.error('Error logging in admin:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;

    const admin = await Admin.findByPk(adminId, {
      attributes: { exclude: ['password'] }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Admin profile retrieved successfully',
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        company_name: admin.company_name,
        role: admin.role,
        is_active: admin.is_active,
        last_login: admin.last_login,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    });

  } catch (error) {
    console.error('Error retrieving admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update admin profile
export const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { full_name, company_name } = req.body;

    // Validate required fields
    if (!full_name || !company_name) {
      return res.status(400).json({
        success: false,
        message: 'Full name and company name are required'
      });
    }

    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Update admin profile
    await admin.update({
      full_name,
      company_name
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        company_name: admin.company_name,
        role: admin.role,
        is_active: admin.is_active,
        last_login: admin.last_login,
        updatedAt: admin.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Google OAuth login for admins
export const loginAdminWithGoogle = async (req, res) => {
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

    // Find or create admin
    let admin = await Admin.findOne({
      where: {
        [Op.or]: [
          { email },
          { google_id: googleId }
        ]
      }
    });

    if (admin) {
      // Update existing admin with Google ID if not set
      if (!admin.google_id) {
        await admin.update({
          google_id: googleId,
          auth_method: 'google'
        });
      }
    } else {
      // Create new admin
      admin = await Admin.create({
        full_name: name,
        email,
        google_id: googleId,
        auth_method: 'google',
        company_name: 'Google Admin',
        role: 'admin'
      });
    }

    // Check if admin account is active
    if (!admin.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last login
    await admin.update({
      last_login: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        company_name: admin.company_name,
        role: admin.role,
        last_login: admin.last_login,
        auth_method: admin.auth_method,
        token
      }
    });

  } catch (error) {
    console.error('Google Admin Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
