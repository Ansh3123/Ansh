import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: config.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: config.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: config.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: config.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

const dbId = config.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID;

export const db = (dbId && dbId !== '(default)')
  ? getFirestore(app, dbId)
  : getFirestore(app);

export const storage = getStorage(app);
export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

