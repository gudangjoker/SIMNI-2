import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getDatabase, Database } from 'firebase-admin/database';

let adminApp: App;
let adminAuth: Auth;
let adminDatabase: Database;

export function getFirebaseAdmin() {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://admin-kelas-3a-default-rtdb.asia-southeast1.firebasedatabase.app';

    if (serviceAccountKey) {
      const parsedKey = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        credential: cert(parsedKey),
        databaseURL
      });
    } else {
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'admin-kelas-3a',
        databaseURL
      });
    }
  } else {
    adminApp = getApps()[0]!;
  }

  adminAuth = getAuth(adminApp);
  adminDatabase = getDatabase(adminApp);

  return { adminApp, adminAuth, adminDatabase };
}
