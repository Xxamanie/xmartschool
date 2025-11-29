# Firebase Setup for Cross-Device Data Sharing

## 🚀 Quick Setup Guide

### 1. Install Firebase Dependencies
```bash
npm install firebase
```

### 2. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name your project "smart-school"
4. Enable Firestore Database
5. Enable Authentication

### 3. Get Firebase Configuration
1. In Firebase Console → Project Settings → General
2. Copy your Firebase config object
3. Update `firebase-config.ts` with your actual config

### 4. Configure Firestore Rules
In Firebase Console → Firestore Database → Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Teachers can read their assigned subjects
    match /subjects/{subjectId} {
      allow read: if request.auth != null && 
        request.auth.token.role == 'ADMIN' || 
        request.auth.token.role == 'SUPER_ADMIN' ||
        resource.data.teacherId == request.auth.uid;
      allow write: if request.auth != null && 
        request.auth.token.role == 'ADMIN' || 
        request.auth.token.role == 'SUPER_ADMIN';
    }
    
    // Students can be read by authenticated users
    match /students/{studentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.role == 'ADMIN' || 
        request.auth.token.role == 'SUPER_ADMIN';
    }
    
    // Assessments follow teacher permissions
    match /assessments/{assessmentId} {
      allow read: if request.auth != null && 
        (request.auth.token.role == 'ADMIN' || 
         request.auth.token.role == 'SUPER_ADMIN' ||
         resource.data.teacherId == request.auth.uid);
      allow write: if request.auth != null && 
        (request.auth.token.role == 'ADMIN' || 
         request.auth.token.role == 'SUPER_ADMIN' ||
         resource.data.teacherId == request.auth.uid);
    }
  }
}
```

### 5. Update API Service
Replace mock API calls with Firebase calls in `api.ts`:

```typescript
// Import Firebase APIs
import { firebaseStudentsApi, firebaseSubjectsApi, firebaseUsersApi } from './firebase-api';

// Update the api object
export const api = {
  getStudents: firebaseStudentsApi.getAllStudents,
  createStudent: firebaseStudentsApi.addStudent,
  updateStudent: firebaseStudentsApi.updateStudent,
  deleteStudent: firebaseStudentsApi.deleteStudent,
  
  getSubjects: firebaseSubjectsApi.getAllSubjects,
  createSubject: firebaseSubjectsApi.addSubject,
  
  getAllUsers: firebaseUsersApi.getAllUsers,
  createTeacher: firebaseUsersApi.addUser,
  updateTeacher: firebaseUsersApi.updateUser,
  deleteTeacher: firebaseUsersApi.deleteUser,
  // ... other endpoints
};
```

### 6. Enable Real-time Updates
For real-time synchronization across devices, add this to your components:

```typescript
// In your component
useEffect(() => {
  const unsubscribe = firebaseStudentsApi.subscribeToStudents((students) => {
    setStudents(students);
  });
  
  return () => unsubscribe();
}, []);
```

## 🔄 Benefits

✅ **Cross-Device Sync**: Changes appear on all devices in real-time  
✅ **Data Persistence**: No data loss when clearing browser cache  
✅ **Real-time Updates**: Live collaboration between multiple users  
✅ **Scalable**: Can handle multiple schools and users  
✅ **Secure**: Built-in authentication and security rules  

## 🛠️ Alternative Solutions

If you prefer not to use Firebase:

### Supabase Alternative
```bash
npm install @supabase/supabase-js
```

### Simple JSON Server (Testing Only)
```bash
npm install json-server
```

## 📱 Testing Cross-Device Functionality

1. Open the app on multiple devices/browsers
2. Add a teacher on one device
3. Check if it appears on other devices
4. Test real-time updates by making simultaneous changes

## 🚨 Important Notes

- **Firebase costs**: Free tier includes 1GB storage, 50k reads/day
- **Security**: Always implement proper authentication
- **Offline support**: Consider adding offline persistence
- **Data migration**: You'll need to migrate existing mock data

## 🆘 Troubleshooting

**"Permission denied" errors**:
- Check Firestore rules
- Ensure user is authenticated
- Verify user roles in auth token

**Data not syncing**:
- Check network connection
- Verify Firebase config
- Check browser console for errors

**Slow performance**:
- Add indexes to Firestore
- Optimize queries
- Consider pagination for large datasets
