// Simple test to verify Firebase connection
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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
    
    // Try to read from users collection
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
      console.log('💡 Permission denied. This could mean:');
      console.log('   1. Firestore database is not created yet');
      console.log('   2. Security rules need to be deployed');
      console.log('   3. User needs to be authenticated');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('   1. Go to Firebase Console → Firestore Database');
      console.log('   2. Click "Create database"');
      console.log('   3. Choose "Start in test mode" for now');
      console.log('   4. Select a location (us-central recommended)');
      console.log('   5. Click "Create database"');
      console.log('');
      console.log('📋 After creating database, run this test again.');
    } else if (error.code === 'unavailable') {
      console.log('💡 Firestore Database may not be enabled in Firebase Console');
      console.log('   Go to Firebase Console → Firestore Database → Create database');
    } else {
      console.log('💡 Check your Firebase configuration and network connection');
    }
  }
}

// Run the test
testFirebaseConnection();
