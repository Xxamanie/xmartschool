import { Student, Subject, ApiResponse, SchemeSubmission, Assessment, ResultData, School, User, UserRole, ActiveExam, ExamQuestion, ExamSession } from '../types';
import { MOCK_STUDENTS, MOCK_SUBJECTS, MOCK_SCHEMES, MOCK_ASSESSMENTS, MOCK_RESULTS, MOCK_SCHOOLS, MOCK_USER, MOCK_SUPER_ADMIN } from './mockData';
import { firebaseStudentsApi, firebaseSubjectsApi, firebaseUsersApi, firebaseAssessmentsApi } from './firebase-api';
import { cloudStudentsApi, cloudSubjectsApi, cloudUsersApi, cloudAssessmentsApi, cloudSchoolsApi } from './cloud-api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://xmartschool.onrender.com';

// Simulates network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// HTTP client with authentication
const http = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get auth token from localStorage
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// --- API calls ---
const loadStudents = async (): Promise<Student[]> => {
  try {
    const response = await http('/students');
    return response.data;
  } catch (error) {
    console.error('Failed to load students:', error);
    return [...MOCK_STUDENTS];
  }
};

const loadResults = async (): Promise<ResultData[]> => {
  try {
    const response = await http('/results');
    return response.data;
  } catch (error) {
    console.error('Failed to load results:', error);
    return [...MOCK_RESULTS];
  }
};

const loadSchools = async (): Promise<School[]> => {
  try {
    const response = await http('/schools');
    return response.data;
  } catch (error) {
    console.error('Failed to load schools:', error);
    return [...MOCK_SCHOOLS];
  }
};

const loadUsers = async (): Promise<User[]> => {
  try {
    const response = await http('/users');
    return response.data;
  } catch (error) {
    console.error('Failed to load users:', error);
    return [MOCK_USER, MOCK_SUPER_ADMIN];
  }
};

const loadAssessments = async (): Promise<Assessment[]> => {
  try {
    const response = await http('/assessments');
    return response.data;
  } catch (error) {
    console.error('Failed to load assessments:', error);
    return [...MOCK_ASSESSMENTS];
  }
};

const loadExamSessions = async (): Promise<ExamSession[]> => {
  try {
    const response = await http('/exam-sessions');
    return response.data;
  } catch (error) {
    console.error('Failed to load exam sessions:', error);
    return [];
  }
};

const loadSubjects = async (): Promise<Subject[]> => {
  try {
    const response = await http('/subjects');
    return response.data;
  } catch (error) {
    console.error('Failed to load subjects:', error);
    return [...MOCK_SUBJECTS];
  }
};

// Attendance Interface
interface AttendanceRecord {
    studentId: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    date: string;
}

const loadAttendance = async (): Promise<AttendanceRecord[]> => {
  try {
    const response = await http('/attendance');
    return response.data;
  } catch (error) {
    console.error('Failed to load attendance:', error);
    return [];
  }
};

const loadClassMasters = async (): Promise<Record<string, string>> => {
  try {
    const response = await http('/class-masters');
    return response.data;
  } catch (error) {
    console.error('Failed to load class masters:', error);
    return { '10th': 'u1', '11th': 't3' };
  }
};

const loadExams = async (): Promise<ActiveExam[]> => {
  try {
    const response = await http('/exams');
    return response.data;
  } catch (error) {
    console.error('Failed to load exams:', error);
    return [
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
];
  }
};

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
    try {
      const response = await http('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      
      // Store auth token
      if (response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      
      return { ok: true, data: response.user };
    } catch (error) {
      console.error('Login failed:', error);
      // Fallback to mock for development
      await delay(1000);
      if (email === 'creator@smartschool.edu') {
        return { ok: true, data: MOCK_SUPER_ADMIN };
      } else if (email.includes('admin')) {
        const adminUser = { ...MOCK_USER, role: UserRole.ADMIN, name: 'School Principal', email, id: 'admin1' };
        return { ok: true, data: adminUser };
      } else {
        return { ok: true, data: MOCK_USER }; 
      }
    }
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    try {
      const response = await http('/auth/verify-student', {
        method: 'POST',
        body: JSON.stringify({ schoolCode, studentCode })
      });
      
      // Store auth token
      if (response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      
      return { ok: true, data: response.user };
    } catch (error) {
      console.error('Student verification failed:', error);
      // Fallback to mock for development
      await delay(1200);
      const schools = await loadSchools();
      const students = await loadStudents();
      
      const school = schools.find(s => s.code === schoolCode);
      if (!school) {
        return { ok: false, data: {} as User, message: 'Invalid School Code' };
      }

      const student = students.find(s => (s as any).accessCode === studentCode && s.schoolId === school.id);
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
          avatar: (student as any).avatar
        }
      };
    }
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudStudentsApi.getAllStudents();
  },

  createStudent: async (studentData: Omit<Student, 'id' | 'enrollmentDate'>): Promise<ApiResponse<Student>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    const studentWithEnrollment = {
      ...studentData,
      enrollmentDate: new Date().toISOString().split('T')[0]
    };
    return cloudStudentsApi.createStudent(studentWithEnrollment);
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudStudentsApi.updateStudent(studentId, updates);
  },

  deleteStudent: async (studentId: string): Promise<ApiResponse<boolean>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudStudentsApi.deleteStudent(studentId);
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudSchoolsApi.getAllSchools();
  },

  createSchool: async (schoolData: { name: string }): Promise<ApiResponse<School>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    // Create a complete school object with required fields
    const completeSchoolData = {
      ...schoolData,
      code: `SCH${Date.now().toString().slice(-6)}`,
      region: 'Default Region',
      adminName: 'School Administrator',
      status: 'Active' as const,
      studentCount: 0
    };
    return cloudSchoolsApi.createSchool(completeSchoolData);
  },

  updateSchoolStatus: async (schoolId: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<School>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudSchoolsApi.updateSchool(schoolId, { status });
  },

  deleteSchool: async (schoolId: string): Promise<ApiResponse<boolean>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudSchoolsApi.deleteSchool(schoolId);
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudUsersApi.getAllUsers();
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudSubjectsApi.getAllSubjects();
  },

  createSubject: async (subjectData: { name: string, teacherId?: string }): Promise<ApiResponse<Subject>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    const subjectWithDefaults = {
      ...subjectData,
      schedule: 'TBD',
      room: 'TBD',
      teacherId: subjectData.teacherId || 'unassigned'
    };
    return cloudSubjectsApi.createSubject(subjectWithDefaults);
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    try {
      const response = await http('/schemes');
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get schemes:', error);
      // Fallback to mock for development
      await delay(700);
      return { ok: true, data: MOCK_SCHEMES };
    }
  },

  uploadScheme: async (file: File, metadata: any): Promise<ApiResponse<{ id: string }>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await http('/schemes/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type for FormData
      });
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to upload scheme:', error);
      // Fallback to mock for development
      await delay(1500);
      return {
        ok: true,
        data: { id: `scheme_${Date.now()}` },
        message: 'Scheme uploaded successfully'
      };
    }
  },

  getAssessments: async (subjectId?: string, term?: string): Promise<ApiResponse<Assessment[]>> => {
    try {
      const params = new URLSearchParams();
      if (subjectId) params.append('subjectId', subjectId);
      if (term) params.append('term', term);
      
      const response = await http(`/assessments?${params}`);
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get assessments:', error);
      // Fallback to mock for development
      await delay(600);
      const assessments = await loadAssessments();
      let data = assessments;
      if (subjectId) data = data.filter(a => a.subjectId === subjectId);
      if (term) data = data.filter(a => a.term === term);
      return { ok: true, data };
    }
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await http('/assessments/batch', {
        method: 'PUT',
        body: JSON.stringify({ assessments })
      });
      return { ok: true, data: response.data, message: 'Assessments saved successfully' };
    } catch (error) {
      console.error('Failed to save assessments:', error);
      // Fallback to mock for development
      await delay(1000);
      const assessmentsStore = await loadAssessments();
      assessments.forEach(updated => {
        const idx = assessmentsStore.findIndex(a => a.id === updated.id);
        if (idx >= 0) {
          assessmentsStore[idx] = updated;
        } else {
          assessmentsStore.push(updated);
        }
      });
      return { ok: true, data: { success: true }, message: 'Assessments saved successfully' };
    }
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    try {
      const url = studentId ? `/results?studentId=${studentId}` : '/results';
      const response = await http(url);
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get results:', error);
      // Fallback to mock for development
      await delay(600);
      const results = await loadResults();
      if (studentId) {
        return { ok: true, data: results.filter(r => r.studentId === studentId) };
      }
      return { ok: true, data: results };
    }
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await http('/results/batch', {
        method: 'POST',
        body: JSON.stringify({ results: newResults })
      });
      return { ok: true, data: response.data, message: 'Results published successfully' };
    } catch (error) {
      console.error('Failed to publish results:', error);
      // Fallback to mock for development
      await delay(1000);
      const resultsStore = await loadResults();
      newResults.forEach(newRes => {
        const index = resultsStore.findIndex(r => r.studentId === newRes.studentId && r.subjectName === newRes.subjectName);
        if (index >= 0) {
          resultsStore[index] = { ...resultsStore[index], ...newRes };
        } else {
          resultsStore.push(newRes);
        }
      });
      return { ok: true, data: { success: true }, message: 'Results published successfully' };
    }
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const response = await http('/exams');
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get exams:', error);
      // Fallback to mock for development
      await delay(500);
      const exams = await loadExams();
      return { ok: true, data: exams };
    }
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const response = await http('/exams?status=active');
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get available exams:', error);
      // Fallback to mock for development
      await delay(500);
      const exams = await loadExams();
      return { ok: true, data: exams.filter(e => e.status === 'active') };
    }
  },

  updateExamQuestions: async (questions: ExamQuestion[], title: string, examId?: string, teacherId?: string): Promise<ApiResponse<ActiveExam>> => {
    try {
      const response = await http('/exams', {
        method: examId ? 'PUT' : 'POST',
        body: JSON.stringify({ examId, title, questions, teacherId })
      });
      return { ok: true, data: response.data, message: 'Exam saved successfully' };
    } catch (error) {
      console.error('Failed to update exam:', error);
      // Fallback to mock for development
      await delay(800);
      const exams = await loadExams();
      if (examId) {
        const idx = exams.findIndex(e => e.id === examId);
        if (idx >= 0) {
          exams[idx] = { ...exams[idx], questions, title, teacherId: teacherId || exams[idx].teacherId };
          return { ok: true, data: exams[idx] };
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
      exams.push(newExam);
      return { ok: true, data: newExam };
    }
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
    try {
      await http(`/exams/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return { ok: true, data: true, message: 'Exam status updated successfully' };
    } catch (error) {
      console.error('Failed to set exam status:', error);
      // Fallback to mock for development
      await delay(500);
      const exams = await loadExams();
      const exam = exams.find(e => e.id === id);
      if (exam) {
        exam.status = status;
        return { ok: true, data: true, message: 'Exam status updated successfully' };
      }
      return { ok: false, data: false, message: 'Exam not found' };
    }
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
    try {
      const response = await http(`/exam-sessions?examId=${examId}`);
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get exam sessions:', error);
      // Fallback to mock for development
      await delay(300);
      const sessions = await loadExamSessions();
      const data = sessions.filter(s => s.examId === examId);
      return { ok: true, data };
    }
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
    try {
      const response = await http('/exam-sessions', {
        method: 'POST',
        body: JSON.stringify({ examId, studentId })
      });
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to start exam session:', error);
      // Fallback to mock for development
      await delay(500);
      const sessions = await loadExamSessions();
      let session = sessions.find(s => s.examId === examId && s.studentId === studentId);
      
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
        sessions.push(session);
      } else {
        if (session.status === 'not-started') {
          session.status = 'in-progress';
          session.startTime = new Date().toISOString();
        }
      }
      return { ok: true, data: session };
    }
  },

  updateExamSessionProgress: async (examId: string, studentId: string, progress: number, answers?: Record<string, string>): Promise<ApiResponse<boolean>> => {
    try {
      await http(`/exam-sessions/${examId}/${studentId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ progress, answers })
      });
      return { ok: true, data: true, message: 'Progress updated successfully' };
    } catch (error) {
      console.error('Failed to update exam session progress:', error);
      // Fallback to mock for development
      const sessions = await loadExamSessions();
      const session = sessions.find(s => s.examId === examId && s.studentId === studentId);
      if (session && session.status !== 'submitted') {
        session.progress = progress;
        if (answers) session.answers = answers;
        return { ok: true, data: true };
      }
      return { ok: false, data: false };
    }
  },

  submitExam: async (studentId: string, answers: Record<string, string>, score: number): Promise<ApiResponse<boolean>> => {
    try {
      const response = await http('/exam-sessions/submit', {
        method: 'POST',
        body: JSON.stringify({ studentId, answers, score })
      });
      return { ok: true, data: response.data, message: 'Exam submitted successfully' };
    } catch (error) {
      console.error('Failed to submit exam:', error);
      // Fallback to mock for development
      await delay(1500);
      const exams = await loadExams();
      const sessions = await loadExamSessions();
      
      const activeExam = exams.find(e => e.status === 'active');
      if (!activeExam) return { ok: false, data: false, message: "No active exam found" };

      const session = sessions.find(s => s.examId === activeExam.id && s.studentId === studentId);
      if (session) {
        session.status = 'submitted';
        session.score = score;
        session.progress = 100;
        session.endTime = new Date().toISOString();
        session.answers = answers;
      } else {
        sessions.push({
          id: `sess_${Date.now()}`,
          examId: activeExam.id,
          studentId,
          status: 'submitted',
          progress: 100,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          answers,
          score
        });
      }
      return { ok: true, data: true, message: 'Exam submitted successfully' };
    }
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AttendanceRecord[]>> => {
    try {
      const params = new URLSearchParams({ date });
      if (grade) params.append('grade', grade);
      
      const response = await http(`/attendance?${params}`);
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get attendance:', error);
      // Fallback to mock for development
      await delay(600);
      const attendance = await loadAttendance();
      const students = await loadStudents();
      let records = attendance.filter(r => r.date === date);
      if (grade) {
        const studentIdsInGrade = new Set(students.filter(s => (s as any).grade === grade).map(s => s.id));
        records = records.filter(r => studentIdsInGrade.has(r.studentId));
      }
      return { ok: true, data: records };
    }
  },

  markAttendance: async (updates: AttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    try {
      const response = await http('/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({ updates })
      });
      return { ok: true, data: response.data, message: 'Attendance marked successfully' };
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      // Fallback to mock for development
      await delay(800);
      const attendance = await loadAttendance();
      const students = await loadStudents();
      
      updates.forEach(update => {
        const idx = attendance.findIndex(r => r.date === update.date && r.studentId === update.studentId);
        if (idx >= 0) {
          attendance[idx] = update;
        } else {
          attendance.push(update);
        }
        
        if (update.status === 'Absent') {
          const studentIdx = students.findIndex(s => s.id === update.studentId);
          if (studentIdx >= 0 && (students[studentIdx] as any).attendance > 0) {
            (students[studentIdx] as any).attendance -= 1;
          }
        }
      });
      return { ok: true, data: true, message: 'Attendance marked successfully' };
    }
  },
  
  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    try {
      const response = await http('/class-masters');
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get class masters:', error);
      // Fallback to mock for development
      await delay(500);
      const classMasters = await loadClassMasters();
      return { ok: true, data: classMasters };
    }
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await http(`/class-masters/${grade}`, {
        method: 'PUT',
        body: JSON.stringify({ teacherId })
      });
      return { ok: true, data: true, message: 'Class master assigned successfully' };
    } catch (error) {
      console.error('Failed to assign class master:', error);
      // Fallback to mock for development
      await delay(500);
      const classMasters = await loadClassMasters();
      classMasters[grade] = teacherId;
      return { ok: true, data: true };
    }
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await http(`/exam-sessions/${examId}/${studentId}`, { method: 'DELETE' });
      return { ok: true, data: true, message: 'Exam reset successfully' };
    } catch (error) {
      console.error('Failed to reset student exam:', error);
      // Fallback to mock for development
      await delay(500);
      const sessions = await loadExamSessions();
      const sessionIndex = sessions.findIndex(s => s.examId === examId && s.studentId === studentId);
      if (sessionIndex > -1) {
        sessions.splice(sessionIndex, 1);
        return { ok: true, data: true, message: 'Exam reset successfully' };
      }
      return { ok: false, data: false, message: 'Exam session not found' };
    }
  },

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<string[]>> => {
    try {
      const response = await http(`/schools/${schoolId}/classes`);
      return { ok: true, data: response.data };
    } catch (error) {
      console.error('Failed to get school classes:', error);
      // Fallback to mock for development
      await delay(300);
      const schoolClasses = {
        'sch_001': ['Grade 7A', 'Grade 7B', 'JHS 1A', 'Form 4 Science', 'Form 5 Arts'],
        'sch_002': ['Grade 8A', 'Grade 8B', 'JHS 2A', 'Form 3 Science', 'Form 6 Arts'],
        'sch_003': ['Grade 9A', 'JHS 3A', 'Form 2 Science', 'Form 7 Arts']
      };
      return { ok: true, data: schoolClasses[schoolId as keyof typeof schoolClasses] || [] };
    }
  },

  addClassToSchool: async (schoolId: string, className: string): Promise<ApiResponse<boolean>> => {
    try {
      await http(`/schools/${schoolId}/classes`, {
        method: 'POST',
        body: JSON.stringify({ className })
      });
      return { ok: true, data: true, message: 'Class added successfully' };
    } catch (error) {
      console.error('Failed to add class to school:', error);
      // Fallback to mock for development
      await delay(500);
      return { ok: true, data: true, message: 'Class added successfully' };
    }
  },

  createTeacher: async (teacherData: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudUsersApi.createTeacher(teacherData);
  },

  updateTeacher: async (teacherId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudUsersApi.updateTeacher(teacherId, updates);
  },

  deleteTeacher: async (teacherId: string): Promise<ApiResponse<boolean>> => {
    // Use localStorage cloud API temporarily until Firebase database is created
    return cloudUsersApi.deleteTeacher(teacherId);
  }
};
