// Firebase API service for cross-device data sharing
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { Student, Subject, User, UserRole, Assessment, School } from '../types';

// Collections
const STUDENTS_COLLECTION = 'students';
const SUBJECTS_COLLECTION = 'subjects';
const USERS_COLLECTION = 'users';
const ASSESSMENTS_COLLECTION = 'assessments';
const SCHOOLS_COLLECTION = 'schools';

// Generic API response type
interface ApiResponse<T> {
  ok: boolean;
  data: T;
  message: string;
}

// Students API
export const firebaseStudentsApi = {
  // Get all students
  getAllStudents: async (): Promise<ApiResponse<Student[]>> => {
    try {
      const snapshot = await getDocs(collection(db, STUDENTS_COLLECTION));
      const students = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      return { ok: true, data: students, message: 'Students retrieved successfully' };
    } catch (error) {
      console.error('Error fetching students:', error);
      return { ok: false, data: [], message: 'Failed to fetch students' };
    }
  },

  // Add student
  addStudent: async (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> => {
    try {
      const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), {
        ...student,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newStudent = { id: docRef.id, ...student };
      return { ok: true, data: newStudent, message: 'Student added successfully' };
    } catch (error) {
      console.error('Error adding student:', error);
      return { ok: false, data: {} as Student, message: 'Failed to add student' };
    }
  },

  // Update student
  updateStudent: async (id: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    try {
      await updateDoc(doc(db, STUDENTS_COLLECTION, id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { ok: true, data: { id, ...updates } as Student, message: 'Student updated successfully' };
    } catch (error) {
      console.error('Error updating student:', error);
      return { ok: false, data: {} as Student, message: 'Failed to update student' };
    }
  },

  // Delete student
  deleteStudent: async (id: string): Promise<ApiResponse<boolean>> => {
    try {
      await deleteDoc(doc(db, STUDENTS_COLLECTION, id));
      return { ok: true, data: true, message: 'Student deleted successfully' };
    } catch (error) {
      console.error('Error deleting student:', error);
      return { ok: false, data: false, message: 'Failed to delete student' };
    }
  },

  // Real-time updates
  subscribeToStudents: (callback: (students: Student[]) => void) => {
    const q = collection(db, STUDENTS_COLLECTION);
    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      callback(students);
    });
  }
};

// Subjects API
export const firebaseSubjectsApi = {
  // Get all subjects
  getAllSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    try {
      const snapshot = await getDocs(collection(db, SUBJECTS_COLLECTION));
      const subjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
      return { ok: true, data: subjects, message: 'Subjects retrieved successfully' };
    } catch (error) {
      console.error('Error fetching subjects:', error);
      return { ok: false, data: [], message: 'Failed to fetch subjects' };
    }
  },

  // Add subject
  addSubject: async (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> => {
    try {
      const docRef = await addDoc(collection(db, SUBJECTS_COLLECTION), {
        ...subject,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newSubject = { id: docRef.id, ...subject };
      return { ok: true, data: newSubject, message: 'Subject added successfully' };
    } catch (error) {
      console.error('Error adding subject:', error);
      return { ok: false, data: {} as Subject, message: 'Failed to add subject' };
    }
  },

  // Get subjects for specific teacher
  getSubjectsByTeacher: async (teacherId: string): Promise<ApiResponse<Subject[]>> => {
    try {
      const q = query(collection(db, SUBJECTS_COLLECTION), where('teacherId', '==', teacherId));
      const snapshot = await getDocs(q);
      const subjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
      return { ok: true, data: subjects, message: 'Teacher subjects retrieved successfully' };
    } catch (error) {
      console.error('Error fetching teacher subjects:', error);
      return { ok: false, data: [], message: 'Failed to fetch teacher subjects' };
    }
  }
};

// Users API
export const firebaseUsersApi = {
  // Get all users
  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      return { ok: true, data: users, message: 'Users retrieved successfully' };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { ok: false, data: [], message: 'Failed to fetch users' };
    }
  },

  // Add user (teacher/admin)
  addUser: async (user: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    try {
      const docRef = await addDoc(collection(db, USERS_COLLECTION), {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newUser = { id: docRef.id, ...user };
      return { ok: true, data: newUser, message: 'User added successfully' };
    } catch (error) {
      console.error('Error adding user:', error);
      return { ok: false, data: {} as User, message: 'Failed to add user' };
    }
  },

  // Update user
  updateUser: async (id: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      await updateDoc(doc(db, USERS_COLLECTION, id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { ok: true, data: { id, ...updates } as User, message: 'User updated successfully' };
    } catch (error) {
      console.error('Error updating user:', error);
      return { ok: false, data: {} as User, message: 'Failed to update user' };
    }
  },

  // Delete user
  deleteUser: async (id: string): Promise<ApiResponse<boolean>> => {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, id));
      return { ok: true, data: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { ok: false, data: false, message: 'Failed to delete user' };
    }
  }
};

// Assessments API
export const firebaseAssessmentsApi = {
  // Get all assessments
  getAllAssessments: async (): Promise<ApiResponse<Assessment[]>> => {
    try {
      const snapshot = await getDocs(collection(db, ASSESSMENTS_COLLECTION));
      const assessments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assessment[];
      return { ok: true, data: assessments, message: 'Assessments retrieved successfully' };
    } catch (error) {
      console.error('Error fetching assessments:', error);
      return { ok: false, data: [], message: 'Failed to fetch assessments' };
    }
  },

  // Add assessment
  addAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    try {
      const docRef = await addDoc(collection(db, ASSESSMENTS_COLLECTION), {
        ...assessment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newAssessment = { id: docRef.id, ...assessment };
      return { ok: true, data: newAssessment, message: 'Assessment added successfully' };
    } catch (error) {
      console.error('Error adding assessment:', error);
      return { ok: false, data: {} as Assessment, message: 'Failed to add assessment' };
    }
  },

  // Get assessments by teacher
  getAssessmentsByTeacher: async (teacherId: string): Promise<ApiResponse<Assessment[]>> => {
    try {
      const q = query(collection(db, ASSESSMENTS_COLLECTION), where('teacherId', '==', teacherId));
      const snapshot = await getDocs(q);
      const assessments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assessment[];
      return { ok: true, data: assessments, message: 'Teacher assessments retrieved successfully' };
    } catch (error) {
      console.error('Error fetching teacher assessments:', error);
      return { ok: false, data: [], message: 'Failed to fetch teacher assessments' };
    }
  }
};
