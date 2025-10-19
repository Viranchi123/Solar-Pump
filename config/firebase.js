import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Supports both file-based (development) and environment variable (production) configuration
 */
export const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (firebaseApp) {
      return firebaseApp;
    }

    let serviceAccount;

    // Try to load from environment variable first (Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔧 Loading Firebase credentials from environment variable');
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (parseError) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
        return null;
      }
    } 
    // Fall back to file (Local development)
    else {
      const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn('⚠️  Firebase service account file not found at:', serviceAccountPath);
        console.warn('⚠️  Push notifications will not work. Add firebase-service-account.json or set FIREBASE_SERVICE_ACCOUNT env variable');
        return null;
      }

      console.log('🔧 Loading Firebase credentials from file');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;

  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    return null;
  }
};

/**
 * Get Firebase Admin instance
 */
export const getFirebaseAdmin = () => {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
};

/**
 * Get Firebase Messaging instance
 */
export const getMessaging = () => {
  const app = getFirebaseAdmin();
  if (!app) {
    return null;
  }
  return admin.messaging();
};

export default {
  initializeFirebase,
  getFirebaseAdmin,
  getMessaging
};

