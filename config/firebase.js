import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Place your firebase service account JSON file in config/firebase-service-account.json
 */
export const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (firebaseApp) {
      return firebaseApp;
    }

    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    
    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️  Firebase service account file not found at:', serviceAccountPath);
      console.warn('⚠️  Push notifications will not work. Please add firebase-service-account.json');
      return null;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

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

