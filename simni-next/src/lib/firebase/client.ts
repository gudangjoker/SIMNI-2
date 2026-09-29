import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let database: Database;
let auth: Auth;

export function getFirebaseClient() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      void setPersistence(auth, browserLocalPersistence);
    }
  } else {
    app = getApp();
    database = getDatabase(app);
    auth = getAuth(app);
  }

  return { app, database, auth };
}
