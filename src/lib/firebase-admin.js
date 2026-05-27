import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Initialize Firebase Admin SDK (server-side only).
 * Uses service account credentials from environment variables.
 */
function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const adminApp = initAdmin();
const db = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

export { db, adminAuth };
