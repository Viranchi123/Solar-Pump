import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { Op } from 'sequelize';
import { User, Admin } from '../models/index.js';

// Google OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.USER_URL}/auth/google/callback`
);

// Generate Google OAuth URL for users
export const getGoogleAuthUrl = async (req, res) => {
  try {
    const { userType = 'user' } = req.query; // 'user' or 'admin'
    
    // Set the redirect URI based on user type
    const redirectUri = userType === 'admin' 
      ? `${process.env.ADMIN_URL}/auth/google/callback`
      : `${process.env.USER_URL}/auth/google/callback`;

    oauth2Client.redirectUri = redirectUri;

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userType // Pass user type in state
    });

    res.status(200).json({
      success: true,
      authUrl,
      userType
    });

  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Handle Google OAuth callback for users
export const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userType = state || 'user';

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    // Set the correct redirect URI based on user type
    const redirectUri = userType === 'admin' 
      ? `${process.env.ADMIN_URL}/auth/google/callback`
      : `${process.env.USER_URL}/auth/google/callback`;

    oauth2Client.redirectUri = redirectUri;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const { id: googleId, email, name, picture } = data;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not provided by Google'
      });
    }

    let user, token;

    if (userType === 'admin') {
      // Handle admin authentication
      user = await Admin.findOne({
        where: {
          [Op.or]: [
            { email },
            { google_id: googleId }
          ]
        }
      });

      if (user) {
        // Update existing admin with Google ID if not set
        if (!user.google_id) {
          await user.update({
            google_id: googleId,
            auth_method: 'google'
          });
        }
      } else {
        // Create new admin
        user = await Admin.create({
          full_name: name,
          email,
          google_id: googleId,
          auth_method: 'google',
          company_name: 'Google User', // Default company name
          role: 'admin'
        });
      }

      // Generate JWT token for admin
      token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update last login
      await user.update({
        last_login: new Date()
      });

      // Redirect to admin dashboard with token
      const redirectUrl = `${process.env.ADMIN_URL}/dashboard?token=${token}&userType=admin`;
      return res.redirect(redirectUrl);

    } else {
      // Handle regular user authentication
      user = await User.findOne({
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
        // For new users, we need to determine their role
        // Since we don't have role information from Google, we'll create with a default role
        // The user can update their profile later
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

      // Generate JWT token for user
      token = jwt.sign(
        { 
          id: user.id, 
          role: user.role,
          phone: user.phone 
        },
        process.env.JWT_SECRET,
        { expiresIn: '3d' }
      );

      // Redirect to user dashboard with token
      const redirectUrl = `${process.env.USER_URL}/dashboard?token=${token}&userType=user`;
      return res.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('Error handling Google callback:', error);
    
    // Redirect to error page
    const errorUrl = userType === 'admin' 
      ? `${process.env.ADMIN_URL}/login?error=google_auth_failed`
      : `${process.env.USER_URL}/login?error=google_auth_failed`;
    
    return res.redirect(errorUrl);
  }
};

// Get user info from Google token (for frontend verification)
export const getGoogleUserInfo = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }

    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    res.status(200).json({
      success: true,
      userInfo: data
    });

  } catch (error) {
    console.error('Error getting Google user info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Link Google account to existing user
export const linkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const { id: googleId, email } = data;

    // Check if Google account is already linked to another user
    const existingUser = await User.findOne({
      where: { google_id: googleId }
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        success: false,
        message: 'This Google account is already linked to another user'
      });
    }

    // Update current user with Google ID
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({
      google_id: googleId,
      auth_method: 'google'
    });

    res.status(200).json({
      success: true,
      message: 'Google account linked successfully'
    });

  } catch (error) {
    console.error('Error linking Google account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Unlink Google account from user
export const unlinkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.google_id) {
      return res.status(400).json({
        success: false,
        message: 'No Google account linked to this user'
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink Google account. Please set a password first.'
      });
    }

    await user.update({
      google_id: null,
      auth_method: 'password'
    });

    res.status(200).json({
      success: true,
      message: 'Google account unlinked successfully'
    });

  } catch (error) {
    console.error('Error unlinking Google account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
