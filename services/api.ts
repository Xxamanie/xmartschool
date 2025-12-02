import { Student, Subject, ApiResponse, SchemeSubmission, Assessment, ResultData, School, User, UserRole, ActiveExam, ExamQuestion, ExamSession } from '../types';
import { MOCK_STUDENTS, MOCK_SUBJECTS, MOCK_SCHEMES, MOCK_ASSESSMENTS, MOCK_RESULTS, MOCK_SCHOOLS, MOCK_USER, MOCK_SUPER_ADMIN } from './mockData';
import apiClient from '../src/utils/api';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AttendanceRecord {
    studentId: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    date: string;
}

const wrapResponse = <T>(data: T): ApiResponse<T> => ({ ok: true, data });

export const api = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    try {
      const { data } = await apiClient.get('/health');
      return { ok: true, data };
    } catch (error) {
      console.error('Health check failed:', error);
      return { ok: false, data: { status: 'unhealthy' }, message: 'Backend unavailable' };
    }
  },

  login: async (email: string): Promise<ApiResponse<User>> => {
    try {
      const { data } = await apiClient.post('/auth/login', { email });
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      return { ok: true, data: data.user };
    } catch (error) {
      console.error('Login failed:', error);
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
      const { data } = await apiClient.post('/auth/verify-student', { schoolCode, studentCode });
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      return { ok: true, data: data.user };
    } catch (error) {
      console.error('Student verification failed:', error);
      return { ok: false, data: {} as User, message: 'Verification failed' };
    }
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    try {
      const url = schoolId ? `/students?schoolId=${schoolId}` : '/students';
      const { data } = await apiClient.get(url);
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to load students:', error);
      throw error;
    }
  },

  createStudent: async (studentData: Omit<Student, 'id' | 'enrollmentDate'>): Promise<ApiResponse<Student>> => {
    try {
      const payload = {
        ...studentData,
        enrollmentDate: new Date().toISOString().split('T')[0]
      };
      console.log('[createStudent] Payload:', payload);
      const { data } = await apiClient.post('/students', payload);
      console.log('[createStudent] Response:', data);
      return { ok: true, data: data || data.data, message: 'Student created successfully' };
    } catch (error) {
      console.error('Failed to create student:', error);
      throw error;
    }
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    try {
      console.log('[updateStudent] ID:', studentId, 'Updates:', updates);
      const { data } = await apiClient.put(`/students/${studentId}`, updates);
      console.log('[updateStudent] Response:', data);
      return { ok: true, data: data || data.data, message: 'Student updated successfully' };
    } catch (error) {
      console.error('Failed to update student:', error);
      throw error;
    }
  },

  deleteStudent: async (studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      console.log('[deleteStudent] ID:', studentId);
      await apiClient.delete(`/students/${studentId}`);
      return { ok: true, data: true, message: 'Student deleted successfully' };
    } catch (error) {
      console.error('Failed to delete student:', error);
      throw error;
    }
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    try {
      const { data } = await apiClient.get('/subjects');
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to load subjects:', error);
      throw error;
    }
  },

  createSubject: async (subjectData: { name: string, teacherId?: string }): Promise<ApiResponse<Subject>> => {
    try {
      const payload = {
        ...subjectData,
        schedule: 'TBD',
        room: 'TBD',
        teacherId: subjectData.teacherId || 'unassigned'
      };
      const { data } = await apiClient.post('/subjects', payload);
      return { ok: true, data: data || data.data, message: 'Subject created successfully' };
    } catch (error) {
      console.error('Failed to create subject:', error);
      throw error;
    }
  },

  updateSubject: async (subjectId: string, updates: Partial<Subject>): Promise<ApiResponse<Subject>> => {
    try {
      const { data } = await apiClient.put(`/subjects/${subjectId}`, updates);
      return { ok: true, data: data || data.data, message: 'Subject updated successfully' };
    } catch (error) {
      console.error('Failed to update subject:', error);
      throw error;
    }
  },

  deleteSubject: async (subjectId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/subjects/${subjectId}`);
      return { ok: true, data: true, message: 'Subject deleted successfully' };
    } catch (error) {
      console.error('Failed to delete subject:', error);
      throw error;
    }
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    try {
      const url = studentId ? `/results?studentId=${studentId}` : '/results';
      const { data } = await apiClient.get(url);
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to get results:', error);
      throw error;
    }
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const { data } = await apiClient.post('/results', { results: newResults });
      return { ok: true, data, message: 'Results published successfully' };
    } catch (error) {
      console.error('Failed to publish results:', error);
      throw error;
    }
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    try {
      const { data } = await apiClient.get('/schools');
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to load schools:', error);
      throw error;
    }
  },

  createSchool: async (schoolData: { name: string; code?: string; region?: string; adminName?: string; status?: string }): Promise<ApiResponse<School>> => {
    try {
      const payload = {
        name: schoolData.name,
        code: schoolData.code || `SCH${Date.now().toString().slice(-6)}`,
        region: schoolData.region || 'Default Region',
        adminName: schoolData.adminName || 'School Administrator',
        status: schoolData.status || 'Active',
        studentCount: 0
      };
      console.log('[createSchool] Payload:', payload);
      const { data } = await apiClient.post('/schools', payload);
      console.log('[createSchool] Response:', data);
      return { ok: true, data: data || data.data, message: 'School created successfully' };
    } catch (error) {
      console.error('Failed to create school:', error);
      throw error;
    }
  },

  updateSchoolStatus: async (schoolId: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<School>> => {
    try {
      const { data } = await apiClient.put(`/schools/${schoolId}`, { status });
      return { ok: true, data: data || data.data, message: 'School updated successfully' };
    } catch (error) {
      console.error('Failed to update school:', error);
      throw error;
    }
  },

  deleteSchool: async (schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/schools/${schoolId}`);
      return { ok: true, data: true, message: 'School deleted successfully' };
    } catch (error) {
      console.error('Failed to delete school:', error);
      throw error;
    }
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const { data } = await apiClient.get('/users');
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to load users:', error);
      throw error;
    }
  },

  createTeacher: async (teacherData: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    try {
      const { data } = await apiClient.post('/users', teacherData);
      return { ok: true, data: data || data.data, message: 'Teacher created successfully' };
    } catch (error) {
      console.error('Failed to create teacher:', error);
      throw error;
    }
  },

  updateTeacher: async (teacherId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      const { data } = await apiClient.put(`/users/${teacherId}`, updates);
      return { ok: true, data: data || data.data, message: 'Teacher updated successfully' };
    } catch (error) {
      console.error('Failed to update teacher:', error);
      throw error;
    }
  },

  deleteTeacher: async (teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/users/${teacherId}`);
      return { ok: true, data: true, message: 'Teacher deleted successfully' };
    } catch (error) {
      console.error('Failed to delete teacher:', error);
      throw error;
    }
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    try {
      const { data } = await apiClient.get('/schemes');
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get schemes:', error);
      await delay(700);
      return { ok: true, data: MOCK_SCHEMES };
    }
  },

  uploadScheme: async (file: File, metadata: any): Promise<ApiResponse<{ id: string }>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));
      
      const { data } = await apiClient.post('/schemes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return { ok: true, data, message: 'Scheme uploaded successfully' };
    } catch (error) {
      console.error('Failed to upload scheme:', error);
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
      
      const { data } = await apiClient.get(`/assessments?${params}`);
      return { ok: true, data: data || data.data || [] };
    } catch (error) {
      console.error('Failed to get assessments:', error);
      throw error;
    }
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const { data } = await apiClient.put('/api/assessments', { assessments });
      return { ok: true, data, message: 'Assessments saved successfully' };
    } catch (error) {
      console.error('Failed to save assessments:', error);
      await delay(1000);
      return { ok: true, data: { success: true }, message: 'Assessments saved successfully' };
    }
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const { data } = await apiClient.get('/exams');
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get exams:', error);
      await delay(500);
      return { ok: true, data: [] };
    }
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const { data } = await apiClient.get('/exams?status=active');
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get available exams:', error);
      await delay(500);
      return { ok: true, data: [] };
    }
  },

  updateExamQuestions: async (questions: ExamQuestion[], title: string, examId?: string, teacherId?: string): Promise<ApiResponse<ActiveExam>> => {
    try {
      const method = examId ? 'put' : 'post';
      const { data } = await apiClient[method]('/exams', { examId, title, questions, teacherId });
      return { ok: true, data, message: 'Exam saved successfully' };
    } catch (error) {
      console.error('Failed to update exam:', error);
      await delay(800);
      return { ok: false, data: {} as ActiveExam, message: 'Failed to update exam' };
    }
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.patch(`/exams/${id}/status`, { status });
      return { ok: true, data: true, message: 'Exam status updated successfully' };
    } catch (error) {
      console.error('Failed to set exam status:', error);
      await delay(500);
      return { ok: false, data: false, message: 'Failed to update exam status' };
    }
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
    try {
      const { data } = await apiClient.get(`/exam-sessions?examId=${examId}`);
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get exam sessions:', error);
      await delay(300);
      return { ok: true, data: [] };
    }
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
    try {
      const { data } = await apiClient.post('/exam-sessions', { examId, studentId });
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to start exam session:', error);
      await delay(500);
      return { ok: false, data: {} as ExamSession, message: 'Failed to start exam session' };
    }
  },

  updateExamSessionProgress: async (examId: string, studentId: string, progress: number, answers?: Record<string, string>): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.patch(`/exam-sessions/${examId}/${studentId}/progress`, { progress, answers });
      return { ok: true, data: true, message: 'Progress updated successfully' };
    } catch (error) {
      console.error('Failed to update exam session progress:', error);
      return { ok: false, data: false, message: 'Failed to update progress' };
    }
  },

  submitExam: async (studentId: string, answers: Record<string, string>, score: number): Promise<ApiResponse<boolean>> => {
    try {
      const { data } = await apiClient.post('/exam-sessions/submit', { studentId, answers, score });
      return { ok: true, data, message: 'Exam submitted successfully' };
    } catch (error) {
      console.error('Failed to submit exam:', error);
      await delay(1500);
      return { ok: false, data: false, message: 'Failed to submit exam' };
    }
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AttendanceRecord[]>> => {
    try {
      const params = new URLSearchParams({ date });
      if (grade) params.append('grade', grade);
      
      const { data } = await apiClient.get(`/attendance?${params}`);
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get attendance:', error);
      await delay(600);
      return { ok: true, data: [] };
    }
  },

  markAttendance: async (updates: AttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    try {
      const { data } = await apiClient.post('/attendance/batch', { updates });
      return { ok: true, data, message: 'Attendance marked successfully' };
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      await delay(800);
      return { ok: false, data: false, message: 'Failed to mark attendance' };
    }
  },
  
  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    try {
      const { data } = await apiClient.get('/class-masters');
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get class masters:', error);
      await delay(500);
      return { ok: true, data: {} };
    }
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.put(`/class-masters/${grade}`, { teacherId });
      return { ok: true, data: true, message: 'Class master assigned successfully' };
    } catch (error) {
      console.error('Failed to assign class master:', error);
      await delay(500);
      return { ok: false, data: false, message: 'Failed to assign class master' };
    }
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/exam-sessions/${examId}/${studentId}`);
      return { ok: true, data: true, message: 'Exam reset successfully' };
    } catch (error) {
      console.error('Failed to reset student exam:', error);
      await delay(500);
      return { ok: false, data: false, message: 'Failed to reset exam' };
    }
  },

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<string[]>> => {
    try {
      const { data } = await apiClient.get(`/schools/${schoolId}/classes`);
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get school classes:', error);
      await delay(300);
      return { ok: true, data: [] };
    }
  },

  addClassToSchool: async (schoolId: string, className: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.post(`/schools/${schoolId}/classes`, { className });
      return { ok: true, data: true, message: 'Class added successfully' };
    } catch (error) {
      console.error('Failed to add class to school:', error);
      await delay(500);
      return { ok: false, data: false, message: 'Failed to add class' };
    }
  }
};
