// Simple test to verify Firebase connection
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBYm6IcrWSFMsvgOQMbFNkBX3NEUdEiOeo",
  authDomain: "xmart-school.firebaseapp.com",
  projectId: "xmart-school",
  storageBucket: "xmart-school.firebasestorage.app",
  messagingSenderId: "117736367360",
  appId: "1:117736367360:web:5287c3e18287c1a526ffe5",
  measurementId: "G-W0ZBDHL2ZC"
};

// Test Firebase connection
async function testFirebaseConnection() {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized successfully');
    
    // Get Firestore
    const db = getFirestore(app);
    console.log('✅ Firestore initialized successfully');
    
    // Test reading from users collection
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`✅ Successfully read users collection. Found ${usersSnapshot.size} documents`);
    
    // List all users
    usersSnapshot.forEach(doc => {
      console.log(`📄 User: ${doc.id}`, doc.data());
    });
    
    console.log('🎉 Firebase connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    
    if (error.code === 'permission-denied') {
      console.log('💡 You need to set up Firestore rules in Firebase Console');
    } else if (error.code === 'unavailable') {
      console.log('💡 Firestore Database may not be enabled in Firebase Console');
    }
  }
}

// Run the test
testFirebaseConnection();
