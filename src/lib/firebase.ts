import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: "AIzaSyAPvM4E-fE8TqLTZ53de-DPopoLiGGSHxk",
  authDomain: "risknreward-ansh.firebaseapp.com",
  projectId: "risknreward-ansh",
  storageBucket: "risknreward-ansh.firebasestorage.app",
  messagingSenderId: "1077927126752",
  appId: "1:1077927126752:web:c898bfc8281864a9831285",
  measurementId: "G-VYD0QKCKCE"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
export const storage = getStorage(app);
export const isConfigured = true;
