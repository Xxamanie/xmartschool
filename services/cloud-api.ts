// Simple cloud API for cross-device data sharing using localStorage + sync
import { Student, Subject, User, UserRole, Assessment, ApiResponse, School } from '../types';

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
    try {
      const students = getStoredData<Student>('students');
      const newStudent: Student = {
        ...student,
        id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const updatedStudents = [...students, newStudent];
      setStoredData('students', updatedStudents);
      
      return { ok: true, data: newStudent, message: 'Student created successfully' };
    } catch (error) {
      console.error('Error creating student:', error);
      return { ok: false, data: {} as Student, message: 'Failed to create student' };
    }
  },

  updateStudent: async (id: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    const students = getStoredData<Student>('students');
    const index = students.findIndex(s => s.id === id);
    
    if (index === -1) {
      return { ok: false, data: {} as Student, message: 'Student not found' };
    }
    
    const updatedStudent = { ...students[index], ...updates };
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
      id: `subject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
    
    const updatedSubject = { ...subjects[index], ...updates };
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
      role: UserRole.TEACHER
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
    
    const updatedTeacher = { ...users[index], ...updates };
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
      studentId: (assessment.studentId || 'default_student') as string,
      studentName: (assessment.studentName || 'Default Student') as string,
      subjectId: (assessment.subjectId || 'default_subject') as string,
      term: (assessment.term || 'Term 1') as string,
      ca1: (assessment.ca1 || 0) as number,
      ca2: (assessment.ca2 || 0) as number,
      ca3: (assessment.ca3 || 0) as number,
      exam: (assessment.exam || 0) as number,
      ...assessment,
      id: `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const updatedAssessments = [...assessments, newAssessment];
    setStoredData('assessments', updatedAssessments);
    
    return { ok: true, data: newAssessment, message: 'Assessment created successfully' };
  }
};

// Schools API
export const cloudSchoolsApi = {
  // Get all schools
  getAllSchools: async (): Promise<ApiResponse<School[]>> => {
    const schools = getStoredData<School>('schools');
    return { ok: true, data: schools, message: 'Schools retrieved successfully' };
  },

  // Add school
  createSchool: async (school: Omit<School, 'id'>): Promise<ApiResponse<School>> => {
    const schools = getStoredData<School>('schools');
    const newSchool: School = {
      ...school,
      id: `school_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const updatedSchools = [...schools, newSchool];
    setStoredData('schools', updatedSchools);
    
    return { ok: true, data: newSchool, message: 'School created successfully' };
  },

  // Update school
  updateSchool: async (id: string, updates: Partial<School>): Promise<ApiResponse<School>> => {
    const schools = getStoredData<School>('schools');
    const index = schools.findIndex(s => s.id === id);
    
    if (index === -1) {
      return { ok: false, data: {} as School, message: 'School not found' };
    }
    
    const updatedSchool = { ...schools[index], ...updates };
    schools[index] = updatedSchool;
    setStoredData('schools', schools);
    
    return { ok: true, data: updatedSchool, message: 'School updated successfully' };
  },

  // Delete school
  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    const schools = getStoredData<School>('schools');
    const filteredSchools = schools.filter(s => s.id !== id);
    setStoredData('schools', filteredSchools);
    
    return { ok: true, data: true, message: 'School deleted successfully' };
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
  const schools = getStoredData<School>('schools');
  
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
      bio: 'Default school administrator'
    };
    setStoredData('users', [adminUser]);
  }
  
  if (schools.length === 0) {
    // Add sample schools
    const sampleSchools: School[] = [
      { 
        id: 'school_default', 
        name: 'Demo High School', 
        code: 'DEMO001', 
        region: 'North Region', 
        adminName: 'John Admin', 
        status: 'Active', 
        studentCount: 250
      },
      { 
        id: 'school_2', 
        name: 'Central Academy', 
        code: 'CTR002', 
        region: 'Central Region', 
        adminName: 'Jane Manager', 
        status: 'Active', 
        studentCount: 180
      }
    ];
    setStoredData('schools', sampleSchools);
  }
  
  if (subjects.length === 0) {
    // Add sample subjects
    const sampleSubjects: Subject[] = [
      { id: 'subj_1', name: 'Mathematics', teacherId: 'teacher_default', schedule: 'Mon-Wed-Fri 9:00 AM', room: 'Room 101' },
      { id: 'subj_2', name: 'English', teacherId: 'teacher_default', schedule: 'Tue-Thu 10:00 AM', room: 'Room 102' },
      { id: 'subj_3', name: 'Science', teacherId: 'teacher_default', schedule: 'Mon-Wed-Fri 11:00 AM', room: 'Room 103' }
    ];
    setStoredData('subjects', sampleSubjects);
  }
  
  if (students.length === 0) {
    // Add sample students
    const sampleStudents: Student[] = [
      { 
        id: 'stud_1', 
        name: 'John Doe', 
        gender: 'Male',
        grade: 'Grade 10', 
        enrollmentDate: '2024-01-15',
        status: 'Active',
        gpa: 3.5,
        attendance: 95,
        schoolId: 'school_default',
        accessCode: 'STU001'
      },
      { 
        id: 'stud_2', 
        name: 'Jane Smith', 
        gender: 'Female',
        grade: 'Grade 10', 
        enrollmentDate: '2024-01-16',
        status: 'Active',
        gpa: 3.8,
        attendance: 98,
        schoolId: 'school_default',
        accessCode: 'STU002'
      }
    ];
    setStoredData('students', sampleStudents);
  }
};
