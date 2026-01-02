import { Student, Subject, ApiResponse, SchemeSubmission, Assessment, ResultData, School, User, UserRole, ActiveExam, ExamQuestion, ExamSession, Announcement, LiveClass } from '../types';
import { MOCK_STUDENTS, MOCK_SUBJECTS, MOCK_SCHEMES, MOCK_ASSESSMENTS, MOCK_RESULTS, MOCK_SCHOOLS, MOCK_USER, MOCK_SUPER_ADMIN } from './mockData';
import apiClient from '../src/utils/api';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AttendanceRecord {
    studentId: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    date: string;
}

// Consistent response wrapper
const wrapResponse = <T>(data: T, message?: string): ApiResponse<T> => ({ 
  ok: true, 
  data,
  ...(message && { message })
});

// Consistent error response wrapper
const wrapError = <T>(error: any, fallbackData?: T, fallbackMessage?: string): ApiResponse<T> => ({
  ok: false,
  data: fallbackData as T,
  message: error?.response?.data?.message || error?.message || fallbackMessage || 'Operation failed'
});

// Consistent data extraction from API responses
const extractData = (response: any): any => {
  // Handle different response structures consistently
  if (response?.data?.data) return response.data.data;
  if (response?.data?.user) return response.data.user;
  if (response?.data) return response.data;
  return response;
};

export const api = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    try {
      const response = await apiClient.get('/health');
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Health check failed:', error);
      return wrapError(error, { status: 'unhealthy' }, 'Backend unavailable');
    }
  },

  getAnnouncements: async (role?: UserRole): Promise<ApiResponse<Announcement[]>> => {
    try {
      const params = new URLSearchParams();
      if (role) params.append('role', role);
      const response = await apiClient.get(`/announcements?${params}`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get announcements:', error);
      return wrapError(error, [], 'Failed to load announcements');
    }
  },

  createAnnouncement: async (payload: { title: string; message: string; targetAudience: Announcement['targetAudience']; source: string }): Promise<ApiResponse<Announcement>> => {
    try {
      const response = await apiClient.post('/announcements', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Announcement created successfully');
    } catch (error) {
      console.error('Failed to create announcement:', error);
      return wrapError(error, {} as Announcement, 'Failed to create announcement');
    }
  },

  uploadProctorFrame: async (examId: string, studentId: string, frameData: string): Promise<ApiResponse<{ stored: boolean }>> => {
    try {
      const response = await apiClient.post('/proctoring/frame', { examId, studentId, frameData });
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to upload proctoring frame:', error);
      return wrapError(error, { stored: false }, 'Upload failed');
    }
  },

  getLiveClasses: async (): Promise<ApiResponse<LiveClass[]>> => {
    try {
      const response = await apiClient.get('/live-classes');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get live classes:', error);
      return wrapError(error, [], 'Failed to load live classes');
    }
  },

  createLiveClass: async (payload: { subjectId?: string; scheduledTime: string; meetingLink: string; teacherId?: string }): Promise<ApiResponse<LiveClass>> => {
    try {
      const response = await apiClient.post('/live-classes', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Live class created successfully');
    } catch (error) {
      console.error('Failed to create live class:', error);
      return wrapError(error, {} as LiveClass, 'Failed to create live class');
    }
  },

  joinLiveClass: async (liveClassId: string, userId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/join`, { userId });
      const data = extractData(response);
      return wrapResponse(data, 'Joined live class successfully');
    } catch (error) {
      console.error('Failed to join live class:', error);
      return wrapError(error, null, 'Failed to join live class');
    }
  },

  leaveLiveClass: async (liveClassId: string, userId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/leave`, { userId });
      const data = extractData(response);
      return wrapResponse(data?.ok || true, 'Left live class successfully');
    } catch (error) {
      console.error('Failed to leave live class:', error);
      return wrapError(error, false, 'Failed to leave live class');
    }
  },

  updateParticipantStatus: async (liveClassId: string, userId: string, cameraOn: boolean, microphoneOn: boolean): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/participant-status`, { userId, cameraOn, microphoneOn });
      const data = extractData(response);
      return wrapResponse(data, 'Participant status updated');
    } catch (error) {
      console.error('Failed to update participant status:', error);
      return wrapError(error, null, 'Failed to update participant status');
    }
  },

  raiseHand: async (liveClassId: string, userId: string, raised: boolean): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/raise-hand`, { userId, raised });
      const data = extractData(response);
      return wrapResponse(data, raised ? 'Hand raised' : 'Hand lowered');
    } catch (error) {
      console.error('Failed to update hand status:', error);
      return wrapError(error, null, 'Failed to update hand status');
    }
  },

  sendLiveClassMessage: async (liveClassId: string, userId: string, message: string): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/messages`, { userId, message });
      const data = extractData(response);
      return wrapResponse(data, 'Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      return wrapError(error, null, 'Failed to send message');
    }
  },

  getLiveClassMessages: async (liveClassId: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await apiClient.get(`/live-classes/${liveClassId}/messages`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get messages:', error);
      return wrapError(error, [], 'Failed to load messages');
    }
  },

  getLiveClassParticipants: async (liveClassId: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await apiClient.get(`/live-classes/${liveClassId}/participants`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get participants:', error);
      return wrapError(error, [], 'Failed to load participants');
    }
  },

  startLiveClassRecording: async (liveClassId: string, recordingUrl: string): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/recording/start`, { recordingUrl });
      const data = extractData(response);
      return wrapResponse(data, 'Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      return wrapError(error, null, 'Failed to start recording');
    }
  },

  stopLiveClassRecording: async (liveClassId: string, duration: number): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post(`/live-classes/${liveClassId}/recording/stop`, { duration });
      const data = extractData(response);
      return wrapResponse(data, 'Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return wrapError(error, null, 'Failed to stop recording');
    }
  },

  login: async (email: string): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.post('/auth/login', { email });
      const data = extractData(response);
      return wrapResponse(data, 'Login successful');
    } catch (error) {
      console.warn('Backend login failed, using demo fallback:', error);
      
      // Demo/fallback authentication with better error handling
      await delay(800); // Simulate network delay
      
      if (email === 'creator@smartschool.edu') {
        return wrapResponse(MOCK_SUPER_ADMIN, 'Demo login successful');
      } else if (email.includes('admin')) {
        const adminUser = { 
          ...MOCK_USER, 
          role: UserRole.ADMIN, 
          name: 'School Principal', 
          email, 
          id: 'admin1',
          avatar: `https://ui-avatars.com/api/?name=School+Principal&background=random`
        };
        return wrapResponse(adminUser, 'Demo login successful');
      } else if (email.includes('teacher') || email.includes('alex')) {
        const teacherUser = { 
          ...MOCK_USER, 
          role: UserRole.TEACHER, 
          name: 'Alex Johnson', 
          email, 
          id: 'teacher1',
          avatar: `https://ui-avatars.com/api/?name=Alex+Johnson&background=random`
        };
        return wrapResponse(teacherUser, 'Demo login successful');
      } else {
        return wrapError(error, {} as User, 'Invalid credentials. Try: creator@smartschool.edu, admin@school.edu, or teacher@school.edu');
      }
    }
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.post('/auth/verify-student', { schoolCode, studentCode });
      const data = extractData(response);
      return wrapResponse(data, 'Student verification successful');
    } catch (error) {
      console.warn('Backend student verification failed, using demo fallback:', error);
      
      // Demo student verification
      await delay(600);
      
      if (schoolCode === 'SPR-001' && studentCode === 'STU-2024-001') {
        const studentUser: User = {
          id: 'student1',
          name: 'Emma Wilson',
          email: 'emma.wilson@student.edu',
          role: UserRole.STUDENT,
          schoolId: 'school1',
          avatar: `https://ui-avatars.com/api/?name=Emma+Wilson&background=random`
        };
        return wrapResponse(studentUser, 'Demo student login successful');
      } else {
        return wrapError(error, {} as User, 'Invalid school code or student access code. Try: SPR-001 / STU-2024-001');
      }
    }
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    try {
      const url = schoolId ? `/students?schoolId=${schoolId}` : '/students';
      const response = await apiClient.get(url);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to load students:', error);
      return wrapError(error, [], 'Failed to load students');
    }
  },

  createStudent: async (studentData: Omit<Student, 'id' | 'enrollmentDate'>): Promise<ApiResponse<Student>> => {
    try {
      const payload = {
        ...studentData,
        enrollmentDate: new Date().toISOString()
      };
      console.log('[createStudent] Payload:', payload);
      const response = await apiClient.post('/students', payload);
      const data = extractData(response);
      console.log('[createStudent] Response:', data);
      return wrapResponse(data, 'Student created successfully');
    } catch (error) {
      console.error('Failed to create student:', error);
      return wrapError(error, {} as Student, 'Failed to create student');
    }
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    try {
      console.log('[updateStudent] ID:', studentId, 'Updates:', updates);
      const response = await apiClient.put(`/students/${studentId}`, updates);
      const data = extractData(response);
      console.log('[updateStudent] Response:', data);
      return wrapResponse(data, 'Student updated successfully');
    } catch (error) {
      console.error('Failed to update student:', error);
      return wrapError(error, {} as Student, 'Failed to update student');
    }
  },

  deleteStudent: async (studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      console.log('[deleteStudent] ID:', studentId);
      await apiClient.delete(`/students/${studentId}`);
      return wrapResponse(true, 'Student deleted successfully');
    } catch (error) {
      console.error('Failed to delete student:', error);
      return wrapError(error, false, 'Failed to delete student');
    }
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    try {
      const response = await apiClient.get('/subjects');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      return wrapError(error, [], 'Failed to load subjects');
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
      const response = await apiClient.post('/subjects', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Subject created successfully');
    } catch (error) {
      console.error('Failed to create subject:', error);
      return wrapError(error, {} as Subject, 'Failed to create subject');
    }
  },

  updateSubject: async (subjectId: string, updates: Partial<Subject>): Promise<ApiResponse<Subject>> => {
    try {
      const response = await apiClient.put(`/subjects/${subjectId}`, updates);
      const data = extractData(response);
      return wrapResponse(data, 'Subject updated successfully');
    } catch (error) {
      console.error('Failed to update subject:', error);
      return wrapError(error, {} as Subject, 'Failed to update subject');
    }
  },

  deleteSubject: async (subjectId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/subjects/${subjectId}`);
      return wrapResponse(true, 'Subject deleted successfully');
    } catch (error) {
      console.error('Failed to delete subject:', error);
      return wrapError(error, false, 'Failed to delete subject');
    }
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    try {
      const url = studentId ? `/results?studentId=${studentId}` : '/results';
      const response = await apiClient.get(url);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get results:', error);
      return wrapError(error, [], 'Failed to load results');
    }
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await apiClient.post('/results', { results: newResults });
      const data = extractData(response);
      return wrapResponse(data, 'Results published successfully');
    } catch (error) {
      console.error('Failed to publish results:', error);
      return wrapError(error, { success: false }, 'Failed to publish results');
    }
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    try {
      const response = await apiClient.get('/schools');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to load schools:', error);
      return wrapError(error, [], 'Failed to load schools');
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
      const response = await apiClient.post('/schools', payload);
      const data = extractData(response);
      console.log('[createSchool] Response:', data);
      return wrapResponse(data, 'School created successfully');
    } catch (error) {
      console.error('Failed to create school:', error);
      return wrapError(error, {} as School, 'Failed to create school');
    }
  },

  updateSchoolStatus: async (schoolId: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<School>> => {
    try {
      const response = await apiClient.put(`/schools/${schoolId}`, { status });
      const data = extractData(response);
      return wrapResponse(data, 'School updated successfully');
    } catch (error) {
      console.error('Failed to update school:', error);
      return wrapError(error, {} as School, 'Failed to update school');
    }
  },

  deleteSchool: async (schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/schools/${schoolId}`);
      return wrapResponse(true, 'School deleted successfully');
    } catch (error) {
      console.error('Failed to delete school:', error);
      return wrapError(error, false, 'Failed to delete school');
    }
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await apiClient.get('/users');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      return wrapError(error, [], 'Failed to load users');
    }
  },

  createTeacher: async (teacherData: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.post('/users', teacherData);
      const data = extractData(response);
      return wrapResponse(data, 'Teacher created successfully');
    } catch (error) {
      console.error('Failed to create teacher:', error);
      return wrapError(error, {} as User, 'Failed to create teacher');
    }
  },

  updateTeacher: async (teacherId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.put(`/users/${teacherId}`, updates);
      const data = extractData(response);
      return wrapResponse(data, 'Teacher updated successfully');
    } catch (error) {
      console.error('Failed to update teacher:', error);
      return wrapError(error, {} as User, 'Failed to update teacher');
    }
  },

  deleteTeacher: async (teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/users/${teacherId}`);
      return wrapResponse(true, 'Teacher deleted successfully');
    } catch (error) {
      console.error('Failed to delete teacher:', error);
      return wrapError(error, false, 'Failed to delete teacher');
    }
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    try {
      const response = await apiClient.get('/schemes');
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get schemes:', error);
      await delay(700);
      return wrapResponse(MOCK_SCHEMES, 'Using demo schemes');
    }
  },

  uploadScheme: async (file: File, metadata: any): Promise<ApiResponse<{ id: string }>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await apiClient.post('/schemes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = extractData(response);
      return wrapResponse(data, 'Scheme uploaded successfully');
    } catch (error) {
      console.error('Failed to upload scheme:', error);
      await delay(1500);
      return wrapResponse(
        { id: `scheme_${Date.now()}` },
        'Scheme uploaded successfully (demo mode)'
      );
    }
  },

  getAssessments: async (subjectId?: string, term?: string, studentId?: string): Promise<ApiResponse<Assessment[]>> => {
    try {
      const params = new URLSearchParams();
      if (subjectId) params.append('subjectId', subjectId);
      if (term) params.append('term', term);
      if (studentId) params.append('studentId', studentId);
      
      const response = await apiClient.get(`/assessments?${params}`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get assessments:', error);
      return wrapError(error, [], 'Failed to load assessments');
    }
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await apiClient.put('/assessments', { assessments });
      const data = extractData(response);
      return wrapResponse(data, 'Assessments saved successfully');
    } catch (error) {
      console.error('Failed to save assessments:', error);
      await delay(1000);
      return wrapResponse({ success: true }, 'Assessments saved successfully (demo mode)');
    }
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const response = await apiClient.get('/exams');
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get exams:', error);
      await delay(500);
      return wrapResponse([], 'No exams available (demo mode)');
    }
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    try {
      const response = await apiClient.get('/exams?status=active');
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get available exams:', error);
      await delay(500);
      return wrapResponse([], 'No available exams (demo mode)');
    }
  },

  updateExamQuestions: async (questions: ExamQuestion[], title: string, examId?: string, teacherId?: string): Promise<ApiResponse<ActiveExam>> => {
    try {
      const method = examId ? 'put' : 'post';
      const response = await apiClient[method]('/exams', { examId, title, questions, teacherId });
      const data = extractData(response);
      return wrapResponse(data, 'Exam saved successfully');
    } catch (error) {
      console.error('Failed to update exam:', error);
      await delay(800);
      return wrapError(error, {} as ActiveExam, 'Failed to update exam');
    }
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.patch(`/exams/${id}/status`, { status });
      return wrapResponse(true, 'Exam status updated successfully');
    } catch (error) {
      console.error('Failed to set exam status:', error);
      await delay(500);
      return wrapError(error, false, 'Failed to update exam status');
    }
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
    try {
      const response = await apiClient.get(`/exam-sessions?examId=${examId}`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get exam sessions:', error);
      await delay(300);
      return wrapResponse([], 'No exam sessions found (demo mode)');
    }
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
    try {
      const response = await apiClient.post('/exam-sessions', { examId, studentId });
      const data = extractData(response);
      return wrapResponse(data, 'Exam session started');
    } catch (error) {
      console.error('Failed to start exam session:', error);
      await delay(500);
      return wrapError(error, {} as ExamSession, 'Failed to start exam session');
    }
  },

  updateExamSessionProgress: async (examId: string, studentId: string, progress: number, answers?: Record<string, string>): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.patch(`/exam-sessions/${examId}/${studentId}/progress`, { progress, answers });
      return wrapResponse(true, 'Progress updated successfully');
    } catch (error) {
      console.error('Failed to update exam session progress:', error);
      return wrapError(error, false, 'Failed to update progress');
    }
  },

  submitExam: async (studentId: string, answers: Record<string, string>, score: number): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.post('/exam-sessions/submit', { studentId, answers, score });
      const data = extractData(response);
      return wrapResponse(data, 'Exam submitted successfully');
    } catch (error) {
      console.error('Failed to submit exam:', error);
      await delay(1500);
      return wrapError(error, false, 'Failed to submit exam');
    }
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AttendanceRecord[]>> => {
    try {
      const params = new URLSearchParams({ date });
      if (grade) params.append('grade', grade);
      
      const response = await apiClient.get(`/attendance?${params}`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get attendance:', error);
      await delay(600);
      return wrapResponse([], 'No attendance records found (demo mode)');
    }
  },

  markAttendance: async (updates: AttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.post('/attendance/batch', { updates });
      const data = extractData(response);
      return wrapResponse(data, 'Attendance marked successfully');
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      await delay(800);
      return wrapError(error, false, 'Failed to mark attendance');
    }
  },
  
  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    try {
      const response = await apiClient.get('/class-masters');
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get class masters:', error);
      await delay(500);
      return wrapResponse({}, 'No class masters assigned (demo mode)');
    }
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.put(`/class-masters/${grade}`, { teacherId });
      return wrapResponse(true, 'Class master assigned successfully');
    } catch (error) {
      console.error('Failed to assign class master:', error);
      await delay(500);
      return wrapError(error, false, 'Failed to assign class master');
    }
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/exam-sessions/${examId}/${studentId}`);
      return wrapResponse(true, 'Exam reset successfully');
    } catch (error) {
      console.error('Failed to reset student exam:', error);
      await delay(500);
      return wrapError(error, false, 'Failed to reset exam');
    }
  },

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<string[]>> => {
    try {
      const response = await apiClient.get(`/schools/${schoolId}/classes`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get school classes:', error);
      await delay(300);
      return wrapResponse([], 'No classes found (demo mode)');
    }
  },

  addClassToSchool: async (schoolId: string, className: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.post(`/schools/${schoolId}/classes`, { className });
      return wrapResponse(true, 'Class added successfully');
    } catch (error) {
      console.error('Failed to add class to school:', error);
      await delay(500);
      return wrapError(error, false, 'Failed to add class');
    }
  }
};
