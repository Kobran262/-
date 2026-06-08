import Constants from 'expo-constants';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY ?? 'demo-api-key',
  projectId: extra.FIREBASE_PROJECT_ID ?? 'srecha-wms-demo',
  authDomain: `${extra.FIREBASE_PROJECT_ID ?? 'srecha-wms-demo'}.firebaseapp.com`,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export const COMPANY_ID = 'srecha';

export function isFirebaseConfigured(): boolean {
  const apiKey = extra.FIREBASE_API_KEY;
  const projectId = extra.FIREBASE_PROJECT_ID;
  return Boolean(
    apiKey &&
      projectId &&
      apiKey !== 'demo-api-key' &&
      projectId !== 'srecha-wms-demo'
  );
}
