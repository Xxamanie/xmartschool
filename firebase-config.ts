import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBYm6IcrWSFMsvgOQMbFNkBX3NEUdEiOeo",
  authDomain: "xmart-school.firebaseapp.com",
  projectId: "xmart-school",
  storageBucket: "xmart-school.firebasestorage.app",
  messagingSenderId: "117736367360",
  appId: "1:117736367360:web:5287c3e18287c1a526ffe5",
  measurementId: "G-W0ZBDHL2ZC",
  databaseURL: "https://xmart-school-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export default app;
