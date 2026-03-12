import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { Op } from 'sequelize';
import nodemailer from 'nodemailer';

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
    const adminData = {
      full_name,
      email,
      password,
      company_name,
      role: 'admin'
    };

    // Add photo if uploaded
    if (req.file) {
      adminData.photo = req.file.path;
    }

    const admin = await Admin.create(adminData);

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
        photo: admin.photo,
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
        photo: admin.photo,
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
        photo: admin.photo,
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
        photo: admin.photo,
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
        photo: admin.photo,
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

// Update Admin Photo
export const updateAdminPhoto = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Get admin
    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Update photo path
    const photoPath = req.file.path;
    await admin.update({ photo: photoPath });

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      photo: photoPath
    });

  } catch (error) {
    console.error('Update Admin Photo Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Admin Profile Photo
export const getAdminProfilePhoto = async (req, res) => {
  try {
    const adminId = req.user.id;

    const admin = await Admin.findByPk(adminId, {
      attributes: ['id', 'photo']
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (!admin.photo) {
      return res.status(404).json({
        success: false,
        message: 'Profile photo not found'
      });
    }

    // Set appropriate headers for image response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="profile-photo.jpg"');
    
    // Send the image file
    res.sendFile(admin.photo, { root: '.' });

  } catch (error) {
    console.error('Get Admin Profile Photo Error:', error);
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

    // Find admin by email
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found with this email'
      });
    }

    // Generate OTP and set expiry (10 minutes)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update admin with OTP
    await admin.update({
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

    // Find admin by email
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if OTP matches
    if (admin.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (admin.isOTPExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

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

    // Find admin by email
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if OTP matches
    if (admin.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (admin.isOTPExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Update password and clear OTP
    await admin.update({
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
