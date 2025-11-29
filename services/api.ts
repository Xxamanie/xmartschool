
import { Student, Subject, ApiResponse, SchemeSubmission, Assessment, ResultData, School, User, UserRole, ActiveExam, ExamQuestion, ExamSession } from '../types';
import { MOCK_STUDENTS, MOCK_SUBJECTS, MOCK_SCHEMES, MOCK_ASSESSMENTS, MOCK_RESULTS, MOCK_SCHOOLS, MOCK_USER, MOCK_SUPER_ADMIN } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Simulates network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// HTTP client
const http = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// --- Persistence Helpers ---
const STORAGE_KEYS = {
    STUDENTS: 'smartschool_students',
    RESULTS: 'smartschool_results',
    SCHOOLS: 'smartschool_schools',
    USERS: 'smartschool_users',
    ASSESSMENTS: 'smartschool_assessments',
    SESSIONS: 'smartschool_sessions',
    SUBJECTS: 'smartschool_subjects',
    ATTENDANCE: 'smartschool_attendance',
    EXAMS: 'smartschool_exams',
    MASTERS: 'smartschool_masters'
};

const loadData = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
};

const persist = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Local storage error:', e);
    }
};

// --- In-memory stores (initialized from LocalStorage or Mocks) ---
let studentsStore = loadData<Student[]>(STORAGE_KEYS.STUDENTS, [...MOCK_STUDENTS]);
let resultsStore = loadData<ResultData[]>(STORAGE_KEYS.RESULTS, [...MOCK_RESULTS]);
let schoolsStore = loadData<School[]>(STORAGE_KEYS.SCHOOLS, [...MOCK_SCHOOLS]);
let usersStore = loadData<User[]>(STORAGE_KEYS.USERS, [MOCK_USER, MOCK_SUPER_ADMIN]);
let assessmentsStore = loadData<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, [...MOCK_ASSESSMENTS]);
let examSessionsStore = loadData<ExamSession[]>(STORAGE_KEYS.SESSIONS, []);
let subjectsStore = loadData<Subject[]>(STORAGE_KEYS.SUBJECTS, [...MOCK_SUBJECTS]);
let attendanceStore = loadData<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
let classMastersStore = loadData<Record<string, string>>(STORAGE_KEYS.MASTERS, { '10th': 'u1', '11th': 't3' });

// Exam Store
let examsStore = loadData<ActiveExam[]>(STORAGE_KEYS.EXAMS, [
    {
        id: 'exam_001',
        title: 'Term 1 General Knowledge',
        status: 'active', 
        duration: 45,
        teacherId: 'u1', 
        questions: [
             { id: 'q1', type: 'multiple-choice', text: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cytoplasm'], correctAnswer: 'Mitochondria', points: 5 },
             { id: 'q2', type: 'true-false', text: 'The sun revolves around the earth.', options: [], correctAnswer: 'False', points: 5 },
             { id: 'q3', type: 'multiple-choice', text: 'Which element has the chemical symbol O?', options: ['Gold', 'Oxygen', 'Osmium', 'Olive Oil'], correctAnswer: 'Oxygen', points: 5 }
        ]
    },
    {
        id: 'exam_002',
        title: 'Mathematics Mid-Term',
        status: 'scheduled',
        duration: 60,
        teacherId: 'u1',
        questions: [
            { id: 'mq1', type: 'short-answer', text: 'What is 12 * 12?', correctAnswer: '144', points: 2 },
            { id: 'mq2', type: 'multiple-choice', text: 'Solve for x: 2x = 10', options: ['2', '5', '10', '20'], correctAnswer: '5', points: 2 }
        ]
    },
    {
        id: 'exam_003',
        title: 'Physics Pop Quiz',
        status: 'active',
        duration: 15,
        teacherId: 'u1',
        questions: [
             { id: 'pq1', type: 'true-false', text: 'Velocity is a vector quantity.', options: [], correctAnswer: 'True', points: 5 }
        ]
    }
]);

// Attendance Interface
interface AttendanceRecord {
    studentId: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    date: string;
}

export const api = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    try {
      const data = await http('/health');
      return { ok: true, data };
    } catch (error) {
      console.error('Health check failed:', error);
      return { ok: false, data: { status: 'unhealthy' }, message: 'Backend unavailable' };
    }
  },

  login: async (email: string): Promise<ApiResponse<User>> => {
    await delay(1000);
    if (email === 'creator@smartschool.edu') {
      return { ok: true, data: MOCK_SUPER_ADMIN };
    } else if (email.includes('admin')) {
      const adminUser = { ...MOCK_USER, role: UserRole.ADMIN, name: 'School Principal', email, id: 'admin1' };
      if (!usersStore.find(u => u.id === adminUser.id)) {
          usersStore.push(adminUser);
          persist(STORAGE_KEYS.USERS, usersStore);
      }
      return { ok: true, data: adminUser };
    } else {
      const existing = usersStore.find(u => u.id === 'u1');
      return { ok: true, data: existing || MOCK_USER }; 
    }
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    await delay(1200);
    const school = schoolsStore.find(s => s.code === schoolCode);
    if (!school) {
      return { ok: false, data: {} as User, message: 'Invalid School Code' };
    }

    const student = studentsStore.find(s => s.accessCode === studentCode && s.schoolId === school.id);
    if (!student) {
      return { ok: false, data: {} as User, message: 'Invalid Student Access Code' };
    }

    return {
      ok: true,
      data: {
        id: student.id,
        name: student.name,
        role: UserRole.STUDENT,
        email: '',
        schoolId: school.id,
        avatar: `https://ui-avatars.com/api/?name=${student.name}&background=random`,
        gender: student.gender
      }
    };
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
      await delay(800);
      const userIndex = usersStore.findIndex(u => u.id === userId);
      if (userIndex >= 0) {
          usersStore[userIndex] = { ...usersStore[userIndex], ...updates };
          persist(STORAGE_KEYS.USERS, usersStore);
          return { ok: true, data: usersStore[userIndex], message: 'Profile updated successfully' };
      }
      return { ok: true, data: { ...MOCK_USER, ...updates }, message: 'Profile updated successfully' };
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    await delay(800);
    return { ok: true, data: schoolsStore };
  },

  createSchool: async (school: Partial<School>): Promise<ApiResponse<School>> => {
    await delay(1000);
    const newSchool: School = {
        id: `sch_${Date.now()}`,
        name: school.name || 'New School',
        code: school.code || `SCH-${Math.floor(Math.random() * 1000)}`,
        region: school.region || 'Default Region',
        adminName: school.adminName || 'Admin',
        status: 'Active',
        studentCount: 0
    };
    schoolsStore.push(newSchool);
    persist(STORAGE_KEYS.SCHOOLS, schoolsStore);
    return { ok: true, data: newSchool, message: 'School created successfully' };
  },

  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    await delay(800);
    schoolsStore = schoolsStore.filter(s => s.id !== id);
    persist(STORAGE_KEYS.SCHOOLS, schoolsStore);
    return { ok: true, data: true, message: 'School deleted successfully' };
  },

  updateSchoolStatus: async (id: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<boolean>> => {
    await delay(500);
    const idx = schoolsStore.findIndex(s => s.id === id);
    if (idx >= 0) {
        schoolsStore[idx] = { ...schoolsStore[idx], status };
        persist(STORAGE_KEYS.SCHOOLS, schoolsStore);
    }
    return { ok: true, data: true };
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
      await delay(1000);
      const users: User[] = [
          ...usersStore,
          ...studentsStore.map(s => ({
              id: s.id,
              name: s.name,
              role: UserRole.STUDENT,
              email: `student.${s.id}@school.edu`,
              schoolId: s.schoolId,
              avatar: `https://ui-avatars.com/api/?name=${s.name}&background=random`,
              gender: s.gender
          })),
          { id: 't2', name: 'Sarah Connor', email: 'sarah@westside.edu', role: UserRole.ADMIN, schoolId: 'sch_002', avatar: 'https://ui-avatars.com/api/?name=Sarah+Connor&background=random', gender: 'Female' },
          { id: 't3', name: 'John Doe', email: 'john@westside.edu', role: UserRole.TEACHER, schoolId: 'sch_002', avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=random', gender: 'Male' }
      ];
      return { ok: true, data: users };
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    await delay(800);
    const data = schoolId ? studentsStore.filter(s => s.schoolId === schoolId) : studentsStore;
    return { ok: true, data };
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
      await delay(500);
      const idx = studentsStore.findIndex(s => s.id === studentId);
      if (idx !== -1) {
          studentsStore[idx] = { ...studentsStore[idx], ...updates };
          persist(STORAGE_KEYS.STUDENTS, studentsStore);
          return { ok: true, data: studentsStore[idx], message: 'Student updated successfully' };
      }
      return { ok: false, data: {} as Student, message: 'Student not found' };
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    await delay(600);
    return { ok: true, data: subjectsStore };
  },

  createSubject: async (subjectData: { name: string, teacherId?: string }): Promise<ApiResponse<Subject>> => {
    await delay(600);
    const newSubject: Subject = {
        id: `sub_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        name: subjectData.name,
        teacherId: subjectData.teacherId || 'u1',
        schedule: 'TBD',
        room: 'TBD'
    };
    subjectsStore.push(newSubject);
    persist(STORAGE_KEYS.SUBJECTS, subjectsStore);
    return { ok: true, data: newSubject, message: 'Subject enrolled successfully' };
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    await delay(700);
    return { ok: true, data: MOCK_SCHEMES };
  },

  uploadScheme: async (file: File, metadata: any): Promise<ApiResponse<{ id: string }>> => {
    await delay(1500);
    return {
      ok: true,
      data: { id: Math.random().toString(36).substring(7) },
      message: 'Scheme uploaded successfully',
    };
  },

  getAssessments: async (subjectId?: string, term?: string): Promise<ApiResponse<Assessment[]>> => {
    await delay(600);
    let data = assessmentsStore;
    if (subjectId) data = data.filter(a => a.subjectId === subjectId);
    if (term) data = data.filter(a => a.term === term);
    return { ok: true, data };
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    await delay(1000);
    assessments.forEach(updated => {
        const idx = assessmentsStore.findIndex(a => a.id === updated.id);
        if (idx >= 0) {
            assessmentsStore[idx] = updated;
        } else {
            assessmentsStore.push(updated);
        }
    });
    persist(STORAGE_KEYS.ASSESSMENTS, assessmentsStore);
    return { ok: true, data: { success: true }, message: 'Assessments saved successfully' };
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    await delay(600);
    if (studentId) {
        return { ok: true, data: resultsStore.filter(r => r.studentId === studentId) };
    }
    return { ok: true, data: resultsStore };
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    await delay(1000);
    newResults.forEach(newRes => {
      const index = resultsStore.findIndex(r => r.studentId === newRes.studentId && r.subjectName === newRes.subjectName);
      if (index >= 0) {
        resultsStore[index] = { ...resultsStore[index], ...newRes };
      } else {
        resultsStore.push(newRes);
      }
    });
    persist(STORAGE_KEYS.RESULTS, resultsStore);
    return { ok: true, data: { success: true }, message: 'Results published successfully' };
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    await delay(500);
    return { ok: true, data: examsStore };
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
      await delay(500);
      return { ok: true, data: examsStore.filter(e => e.status === 'active') };
  },

  updateExamQuestions: async (questions: ExamQuestion[], title: string, examId?: string, teacherId?: string): Promise<ApiResponse<ActiveExam>> => {
      await delay(800);
      if (examId) {
          const idx = examsStore.findIndex(e => e.id === examId);
          if (idx >= 0) {
              examsStore[idx] = { ...examsStore[idx], questions, title, teacherId: teacherId || examsStore[idx].teacherId };
              persist(STORAGE_KEYS.EXAMS, examsStore);
              return { ok: true, data: examsStore[idx] };
          }
      }
      const newExam: ActiveExam = {
          id: `exam_${Date.now()}`,
          title: title,
          status: 'scheduled',
          duration: 60,
          questions,
          teacherId
      };
      examsStore.push(newExam);
      persist(STORAGE_KEYS.EXAMS, examsStore);
      return { ok: true, data: newExam };
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
      await delay(500);
      const idx = examsStore.findIndex(e => e.id === id);
      if (idx >= 0) {
          examsStore[idx].status = status;
          persist(STORAGE_KEYS.EXAMS, examsStore);
          return { ok: true, data: true };
      }
      return { ok: false, data: false, message: "Exam not found" };
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
      await delay(300);
      const sessions = examSessionsStore.filter(s => s.examId === examId);
      return { ok: true, data: sessions };
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
      await delay(500);
      let session = examSessionsStore.find(s => s.examId === examId && s.studentId === studentId);
      if (!session) {
          session = {
              id: `sess_${Date.now()}`,
              examId,
              studentId,
              status: 'in-progress',
              progress: 0,
              startTime: new Date().toISOString(),
              answers: {}
          };
          examSessionsStore.push(session);
          persist(STORAGE_KEYS.SESSIONS, examSessionsStore);
      } else {
          if (session.status === 'not-started') {
              session.status = 'in-progress';
              session.startTime = new Date().toISOString();
              persist(STORAGE_KEYS.SESSIONS, examSessionsStore);
          }
      }
      return { ok: true, data: session };
  },

  updateExamSessionProgress: async (examId: string, studentId: string, progress: number, answers?: Record<string, string>): Promise<ApiResponse<boolean>> => {
      const session = examSessionsStore.find(s => s.examId === examId && s.studentId === studentId);
      if (session && session.status !== 'submitted') {
          session.progress = progress;
          if (answers) session.answers = answers;
          persist(STORAGE_KEYS.SESSIONS, examSessionsStore);
          return { ok: true, data: true };
      }
      return { ok: false, data: false };
  },

  submitExam: async (studentId: string, answers: Record<string, string>, score: number): Promise<ApiResponse<boolean>> => {
      await delay(1500);
      
      const activeExam = examsStore.find(e => e.status === 'active');
      if (!activeExam) return { ok: false, data: false, message: "No active exam found" };

      const session = examSessionsStore.find(s => s.examId === activeExam.id && s.studentId === studentId);
      if (session) {
          session.status = 'submitted';
          session.score = score;
          session.progress = 100;
          session.endTime = new Date().toISOString();
          session.answers = answers;
      } else {
          examSessionsStore.push({
              id: `sess_${Date.now()}`,
              examId: activeExam.id,
              studentId,
              status: 'submitted',
              progress: 100,
              score,
              startTime: new Date().toISOString(),
              answers
          });
      }
      persist(STORAGE_KEYS.SESSIONS, examSessionsStore);
      
      return { ok: true, data: true };
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AttendanceRecord[]>> => {
    await delay(600);
    let records = attendanceStore.filter(r => r.date === date);
    if (grade) {
        const studentIdsInGrade = new Set(studentsStore.filter(s => s.grade === grade).map(s => s.id));
        records = records.filter(r => studentIdsInGrade.has(r.studentId));
    }
    return { ok: true, data: records };
  },

  markAttendance: async (updates: AttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    await delay(800);
    updates.forEach(update => {
        const idx = attendanceStore.findIndex(r => r.date === update.date && r.studentId === update.studentId);
        if (idx >= 0) {
            attendanceStore[idx] = update;
        } else {
            attendanceStore.push(update);
        }
        
        if (update.status === 'Absent') {
             const studentIdx = studentsStore.findIndex(s => s.id === update.studentId);
             if (studentIdx >= 0 && studentsStore[studentIdx].attendance > 0) {
                 studentsStore[studentIdx].attendance -= 1;
             }
        }
    });
    persist(STORAGE_KEYS.ATTENDANCE, attendanceStore);
    persist(STORAGE_KEYS.STUDENTS, studentsStore);
    return { ok: true, data: true, message: 'Attendance marked successfully' };
  },
  
  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
      await delay(500);
      return { ok: true, data: classMastersStore };
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
      await delay(500);
      classMastersStore[grade] = teacherId;
      persist(STORAGE_KEYS.MASTERS, classMastersStore);
      return { ok: true, data: true };
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
      await delay(500);
      const sessionIndex = examSessionsStore.findIndex(s => s.examId === examId && s.studentId === studentId);
      if (sessionIndex > -1) {
          examSessionsStore.splice(sessionIndex, 1);
          persist(STORAGE_KEYS.SESSIONS, examSessionsStore);
          return { ok: true, data: true };
      }
      return { ok: false, data: false, message: 'Session not found' };
  }
};
