// Firebase configuration for cross-device data sharing
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBYm6IcrWSFMsvgOQMbFNkBX3NEUdEiOeo",
  authDomain: "xmart-school.firebaseapp.com",
  projectId: "xmart-school",
  storageBucket: "xmart-school.firebasestorage.app",
  messagingSenderId: "117736367360",
  appId: "1:117736367360:web:5287c3e18287c1a526ffe5",
  measurementId: "G-W0ZBDHL2ZC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
