import multer from 'multer';
import fs from 'fs';

// Ensure upload directories exist
const createUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Farmer list upload configuration
const farmerListStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/farmer-lists';
    createUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'farmer-list-' + uniqueSuffix + '-' + file.originalname);
  }
});

export const farmerListUpload = multer({ 
  storage: farmerListStorage,
  fileFilter: function (req, file, cb) {
    // Check file extension
    if (file.mimetype === 'application/vnd.ms-excel' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel.sheet.macroEnabled.12') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// General photo upload configuration (for user profiles, etc.)
const generalPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/photos';
    createUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + '-' + file.originalname);
  }
});

export const generalPhotoUpload = multer({ 
  storage: generalPhotoStorage,
  fileFilter: function (req, file, cb) {
    // Check if uploaded file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// JSR photo upload configuration
const jsrPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/jsr-photos';
    createUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'jsr-photo-' + uniqueSuffix + '-' + file.originalname);
  }
});

export const jsrPhotoUpload = multer({ 
  storage: jsrPhotoStorage,
  fileFilter: function (req, file, cb) {
    // Check if uploaded file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Farmer defect photo upload configuration
const farmerPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/farmer-photos';
    createUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'farmer-photo-' + uniqueSuffix + '-' + file.originalname);
  }
});

export const farmerPhotoUpload = multer({ 
  storage: farmerPhotoStorage,
  fileFilter: function (req, file, cb) {
    // Check if uploaded file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// General upload configuration for multiple files (inspection)
export const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads/inspection-photos';
      createUploadDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'inspection-photo-' + uniqueSuffix + '-' + file.originalname);
    }
  }),
  fileFilter: function (req, file, cb) {
    // Check if uploaded file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware for multer
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  } else if (error.message === 'Only Excel files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only Excel files (.xls, .xlsx) are allowed for farmer list'
    });
  } else if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for photo uploads'
    });
  }
  next(error);
};
