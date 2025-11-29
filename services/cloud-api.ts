// Simple cloud API for cross-device data sharing using localStorage + sync
import { Student, Subject, User, UserRole, Assessment, ApiResponse } from '../types';

// This is a temporary solution for testing cross-device functionality
// In production, replace this with Firebase or Supabase

const STORAGE_PREFIX = 'smart_school_';
const SYNC_EVENT = 'smart_school_sync';

// Helper functions
const getStorageKey = (type: string) => `${STORAGE_PREFIX}${type}`;
const getCurrentTimestamp = () => new Date().toISOString();

// Sync event system for cross-tab communication
const broadcastSync = (type: string, data: any) => {
  const event = new CustomEvent(SYNC_EVENT, { detail: { type, data } });
  window.dispatchEvent(event);
  
  // Also use localStorage for cross-window sync
  localStorage.setItem(`${STORAGE_PREFIX}sync_${type}`, JSON.stringify({
    data,
    timestamp: getCurrentTimestamp()
  }));
};

// Generic storage operations
const getStoredData = <T>(type: string): T[] => {
  try {
    const stored = localStorage.getItem(getStorageKey(type));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error(`Error reading ${type} from storage:`, error);
    return [];
  }
};

const setStoredData = <T>(type: string, data: T[]): void => {
  try {
    localStorage.setItem(getStorageKey(type), JSON.stringify(data));
    broadcastSync(type, data);
  } catch (error) {
    console.error(`Error writing ${type} to storage:`, error);
  }
};

// Students API
export const cloudStudentsApi = {
  getAllStudents: async (): Promise<ApiResponse<Student[]>> => {
    const students = getStoredData<Student>('students');
    return { ok: true, data: students, message: 'Students retrieved successfully' };
  },

  createStudent: async (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> => {
    const students = getStoredData<Student>('students');
    const newStudent: Student = {
      ...student,
      id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };
    
    const updatedStudents = [...students, newStudent];
    setStoredData('students', updatedStudents);
    
    return { ok: true, data: newStudent, message: 'Student created successfully' };
  },

  updateStudent: async (id: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    const students = getStoredData<Student>('students');
    const index = students.findIndex(s => s.id === id);
    
    if (index === -1) {
      return { ok: false, data: {} as Student, message: 'Student not found' };
    }
    
    const updatedStudent = { ...students[index], ...updates, updatedAt: getCurrentTimestamp() };
    students[index] = updatedStudent;
    setStoredData('students', students);
    
    return { ok: true, data: updatedStudent, message: 'Student updated successfully' };
  },

  deleteStudent: async (id: string): Promise<ApiResponse<boolean>> => {
    const students = getStoredData<Student>('students');
    const filteredStudents = students.filter(s => s.id !== id);
    setStoredData('students', filteredStudents);
    
    return { ok: true, data: true, message: 'Student deleted successfully' };
  }
};

// Subjects API
export const cloudSubjectsApi = {
  getAllSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    const subjects = getStoredData<Subject>('subjects');
    return { ok: true, data: subjects, message: 'Subjects retrieved successfully' };
  },

  createSubject: async (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> => {
    const subjects = getStoredData<Subject>('subjects');
    const newSubject: Subject = {
      ...subject,
      id: `subject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };
    
    const updatedSubjects = [...subjects, newSubject];
    setStoredData('subjects', updatedSubjects);
    
    return { ok: true, data: newSubject, message: 'Subject created successfully' };
  },

  updateSubject: async (id: string, updates: Partial<Subject>): Promise<ApiResponse<Subject>> => {
    const subjects = getStoredData<Subject>('subjects');
    const index = subjects.findIndex(s => s.id === id);
    
    if (index === -1) {
      return { ok: false, data: {} as Subject, message: 'Subject not found' };
    }
    
    const updatedSubject = { ...subjects[index], ...updates, updatedAt: getCurrentTimestamp() };
    subjects[index] = updatedSubject;
    setStoredData('subjects', subjects);
    
    return { ok: true, data: updatedSubject, message: 'Subject updated successfully' };
  }
};

// Users API
export const cloudUsersApi = {
  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    const users = getStoredData<User>('users');
    return { ok: true, data: users, message: 'Users retrieved successfully' };
  },

  createTeacher: async (teacher: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    const users = getStoredData<User>('users');
    const newTeacher: User = {
      ...teacher,
      id: `teacher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: UserRole.TEACHER,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };
    
    const updatedUsers = [...users, newTeacher];
    setStoredData('users', updatedUsers);
    
    return { ok: true, data: newTeacher, message: 'Teacher created successfully' };
  },

  updateTeacher: async (id: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    const users = getStoredData<User>('users');
    const index = users.findIndex(u => u.id === id);
    
    if (index === -1) {
      return { ok: false, data: {} as User, message: 'Teacher not found' };
    }
    
    const updatedTeacher = { ...users[index], ...updates, updatedAt: getCurrentTimestamp() };
    users[index] = updatedTeacher;
    setStoredData('users', users);
    
    return { ok: true, data: updatedTeacher, message: 'Teacher updated successfully' };
  },

  deleteTeacher: async (id: string): Promise<ApiResponse<boolean>> => {
    const users = getStoredData<User>('users');
    const filteredUsers = users.filter(u => u.id !== id);
    setStoredData('users', filteredUsers);
    
    return { ok: true, data: true, message: 'Teacher deleted successfully' };
  }
};

// Assessments API
export const cloudAssessmentsApi = {
  getAllAssessments: async (): Promise<ApiResponse<Assessment[]>> => {
    const assessments = getStoredData<Assessment>('assessments');
    return { ok: true, data: assessments, message: 'Assessments retrieved successfully' };
  },

  createAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    const assessments = getStoredData<Assessment>('assessments');
    const newAssessment: Assessment = {
      ...assessment,
      id: `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };
    
    const updatedAssessments = [...assessments, newAssessment];
    setStoredData('assessments', updatedAssessments);
    
    return { ok: true, data: newAssessment, message: 'Assessment created successfully' };
  }
};

// Sync event listener for real-time updates
export const setupSyncListener = (callback: (type: string, data: any) => void) => {
  // Listen for custom events
  window.addEventListener(SYNC_EVENT, (event: any) => {
    callback(event.detail.type, event.detail.data);
  });
  
  // Listen for localStorage changes (cross-tab)
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith(STORAGE_PREFIX + 'sync_')) {
      try {
        const syncData = JSON.parse(event.newValue || '{}');
        const type = event.key.replace(STORAGE_PREFIX + 'sync_', '');
        callback(type, syncData.data);
      } catch (error) {
        console.error('Error parsing sync data:', error);
      }
    }
  });
};

// Initialize with some sample data if empty
export const initializeCloudData = () => {
  const users = getStoredData<User>('users');
  const students = getStoredData<Student>('students');
  const subjects = getStoredData<Subject>('subjects');
  
  if (users.length === 0) {
    // Add sample admin user
    const adminUser: User = {
      id: 'admin_default',
      name: 'School Administrator',
      email: 'admin@school.edu',
      role: UserRole.ADMIN,
      schoolId: 'school_default',
      gender: 'Male',
      phone: '+1234567890',
      bio: 'Default school administrator',
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };
    setStoredData('users', [adminUser]);
  }
  
  if (subjects.length === 0) {
    // Add sample subjects
    const sampleSubjects: Subject[] = [
      { id: 'subj_1', name: 'Mathematics', teacherId: 'teacher_default', createdAt: getCurrentTimestamp(), updatedAt: getCurrentTimestamp() },
      { id: 'subj_2', name: 'English', teacherId: 'teacher_default', createdAt: getCurrentTimestamp(), updatedAt: getCurrentTimestamp() },
      { id: 'subj_3', name: 'Science', teacherId: 'teacher_default', createdAt: getCurrentTimestamp(), updatedAt: getCurrentTimestamp() }
    ];
    setStoredData('subjects', sampleSubjects);
  }
  
  if (students.length === 0) {
    // Add sample students
    const sampleStudents: Student[] = [
      { id: 'stud_1', name: 'John Doe', grade: 'Grade 10', schoolId: 'school_default', createdAt: getCurrentTimestamp(), updatedAt: getCurrentTimestamp() },
      { id: 'stud_2', name: 'Jane Smith', grade: 'Grade 10', schoolId: 'school_default', createdAt: getCurrentTimestamp(), updatedAt: getCurrentTimestamp() }
    ];
    setStoredData('students', sampleStudents);
  }
};
