import { Student, Subject, ApiResponse, SchemeSubmission, Assessment, ResultData, School, User, UserRole, ActiveExam, ExamQuestion, ExamSession, Announcement, LiveClass, SchoolClassItem, StaffMessage, TeacherAssignment, Notification, NotificationAudience, PrivateConversation, PrivateConversationMessage, CalendarEvent, SchoolTerm, StudentFeeLedger, StudentFeePayment, AttendanceSummary } from '../types';
import apiClient, { buildSchoolScopedConfig } from '../src/utils/api';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDemoForced = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true';

const demoAuthEnabled = isDemoForced || !(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-ref.supabase.co');

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

const normalizeApiResponse = <T>(response: any, fallbackMessage?: string): ApiResponse<T> => {
  if (response?.data && typeof response.data.ok === 'boolean') {
    return response.data as ApiResponse<T>;
  }

  const data = extractData(response);
  return wrapResponse(data, fallbackMessage);
};

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

  getCalendarEvents: async (schoolId: string): Promise<ApiResponse<CalendarEvent[]>> => {
    try {
      const response = await apiClient.get('/events', buildSchoolScopedConfig(schoolId));
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return wrapError(error, [], 'Failed to load calendar events');
    }
  },

  createCalendarEvent: async (payload: {
    schoolId: string;
    title: string;
    description?: string;
    location?: string;
    startAt: string;
    endAt?: string;
  }): Promise<ApiResponse<CalendarEvent>> => {
    try {
      const response = await apiClient.post('/events', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Event created successfully');
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return wrapError(error, {} as CalendarEvent, 'Failed to create calendar event');
    }
  },

  updateCalendarEvent: async (
    id: string,
    payload: {
      schoolId: string;
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: string;
      endAt?: string | null;
    },
  ): Promise<ApiResponse<CalendarEvent>> => {
    try {
      const response = await apiClient.put(`/events/${id}`, payload);
      const data = extractData(response);
      return wrapResponse(data, 'Event updated successfully');
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return wrapError(error, {} as CalendarEvent, 'Failed to update calendar event');
    }
  },

  deleteCalendarEvent: async (id: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.delete(`/events/${id}`, buildSchoolScopedConfig(schoolId));
      const data = extractData(response);
      return wrapResponse(typeof data === 'boolean' ? data : true, 'Event deleted successfully');
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return wrapError(error, false, 'Failed to delete calendar event');
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

  createLiveClass: async (
    payload: {
      subjectId?: string;
      schoolClassId: string;
      scheduledTime: string;
      meetingLink: string;
      teacherId?: string;
    },
  ): Promise<ApiResponse<LiveClass>> => {
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

  login: async (email: string, password?: string): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const normalized = normalizeApiResponse<User>(response);
      if (normalized.ok) {
        return {
          ...normalized,
          message: normalized.message || 'Login successful',
        };
      }
      throw new Error(normalized.message || 'Login failed');
    } catch (error) {
      if (!demoAuthEnabled) {
        return wrapError(error, {} as User, 'Login failed');
      }

      console.warn('Backend login failed, using demo fallback:', error);
      
      // Demo/fallback authentication with better error handling
      await delay(800); // Simulate network delay
      
      if (email === 'creator@smartschool.edu') {
        return wrapResponse({ id: 'sa_001', name: 'SmartSchool Creator', email, role: UserRole.SUPER_ADMIN, avatar: `https://ui-avatars.com/api/?name=Creator&background=0F172A&color=fff` } as User, 'Demo login successful');
      } else if (email.includes('admin')) {
        return wrapResponse({ id: 'admin1', name: 'School Principal', email, role: UserRole.ADMIN, avatar: `https://ui-avatars.com/api/?name=School+Principal&background=random` } as User, 'Demo login successful');
      } else if (email.includes('teacher') || email.includes('alex')) {
        return wrapResponse({ id: 'teacher1', name: 'Alex Johnson', email, role: UserRole.TEACHER, avatar: `https://ui-avatars.com/api/?name=Alex+Johnson&background=random` } as User, 'Demo login successful');
      } else {
        return wrapError(error, {} as User, 'Invalid credentials. Try: creator@smartschool.edu, admin@school.edu, or teacher@school.edu');
      }
    }
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.post('/auth/verify-student', { schoolCode, studentCode });
      const normalized = normalizeApiResponse<User>(response);
      if (normalized.ok) {
        return {
          ...normalized,
          message: normalized.message || 'Student verification successful',
        };
      }
      throw new Error(normalized.message || 'Verification failed');
    } catch (error) {
      if (!demoAuthEnabled) {
        return wrapError(error, {} as User, 'Student verification failed');
      }

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

  updateUserProfile: async (userId: string, updates: Pick<User, 'name' | 'phone' | 'bio'> & Partial<Pick<User, 'gender' | 'avatar'>>): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.put('/auth/profile', { userId, updates });
      return normalizeApiResponse<User>(response, 'Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      return wrapError(error, {} as User, 'Failed to update profile');
    }
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      return normalizeApiResponse<boolean>(response, 'Password changed successfully');
    } catch (error) {
      console.error('Failed to change password:', error);
      return wrapError(error, false, 'Failed to change password');
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

  updateResultStatus: async (resultId: string, status: 'Published' | 'Draft' | 'withheld'): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.patch(`/results/${resultId}/status`, { status });
      return normalizeApiResponse<boolean>(response);
    } catch (error) {
      console.error('Failed to update result status:', error);
      return wrapError(error, false, 'Failed to update result status');
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

  updateSchoolBranding: async (schoolId: string, updates: Partial<School>): Promise<ApiResponse<School>> => {
    try {
      const response = await apiClient.patch(`/schools/${schoolId}/branding`, updates);
      const data = extractData(response);
      return wrapResponse(data, 'School updated successfully');
    } catch (error) {
      console.error('Failed to update school branding:', error);
      return wrapError(error, {} as School, 'Failed to update school');
    }
  },

  updateSchoolStatus: async (schoolId: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<School>> => {
    try {
      const response = await apiClient.patch(`/schools/${schoolId}/status`, { status });
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
      return wrapResponse([], 'Using empty scheme list');
    }
  },

  uploadScheme: async (file: File, metadata: any): Promise<ApiResponse<{ id: string }>> => {
    try {
      // Upload file to Supabase Storage if configured, then record metadata via backend
      const { getSupabaseClient } = await import('../src/services/supabaseClient');
      const supabase = getSupabaseClient();
      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'schemes';

      let fileUrl = '';
      if (supabase) {
        const path = `schemes/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
        fileUrl = urlData.publicUrl;
      }

      // Record the submission in the backend
      const response = await apiClient.post('/schemes/upload', {
        fileName: file.name,
        fileUrl,
        term: metadata.term,
        subject: metadata.subject,
        year: metadata.year,
      });
      const data = extractData(response);
      return wrapResponse(data, 'Scheme uploaded successfully');
    } catch (error) {
      console.error('Failed to upload scheme:', error);
      return wrapError(error, { id: '' }, 'Upload failed. Check your Supabase storage configuration.');
    }
  },

  getAssessments: async (subjectId?: string, term?: string, studentId?: string, classId?: string): Promise<ApiResponse<Assessment[]>> => {
    try {
      const params = new URLSearchParams();
      if (subjectId) params.append('subjectId', subjectId);
      if (term) params.append('term', term);
      if (studentId) params.append('studentId', studentId);
      if (classId) params.append('classId', classId);

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

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<SchoolClassItem[]>> => {
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
  },

  getStaffMessages: async (): Promise<ApiResponse<StaffMessage[]>> => {
    try {
      const response = await apiClient.get('/staff-room');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get staff messages:', error);
      return wrapError(error, [], 'Failed to load staff messages');
    }
  },

  sendStaffMessage: async (payload: { type: StaffMessage['type']; content: string; mediaUrl?: string }): Promise<ApiResponse<StaffMessage>> => {
    try {
      const response = await apiClient.post('/staff-room', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Message sent');
    } catch (error) {
      console.error('Failed to send staff message:', error);
      return wrapError(error, {} as StaffMessage, 'Failed to send message');
    }
  },

  getClassAssignments: async (classId: string): Promise<ApiResponse<(TeacherAssignment & { teacherName?: string })[]>> => {
    try {
      const response = await apiClient.get(`/teacher-assignments?classId=${classId}`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get class assignments:', error);
      return wrapError(error, [], 'Failed to load class assignments');
    }
  },

  getTeacherAssignments: async (teacherId: string): Promise<ApiResponse<TeacherAssignment[]>> => {
    try {
      const response = await apiClient.get(`/teacher-assignments?teacherId=${teacherId}`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get teacher assignments:', error);
      return wrapError(error, [], 'Failed to load assignments');
    }
  },

  setTeacherAssignments: async (teacherId: string, assignments: { subjectId: string; schoolClassId: string }[]): Promise<ApiResponse<TeacherAssignment[]>> => {
    try {
      const response = await apiClient.put('/teacher-assignments', { teacherId, assignments });
      const data = extractData(response) || [];
      return wrapResponse(data, 'Assignments saved');
    } catch (error) {
      console.error('Failed to set teacher assignments:', error);
      return wrapError(error, [], 'Failed to save assignments');
    }
  },

  setStudentField: async (studentId: string, field: string, enrolledSubjects: string[]): Promise<ApiResponse<Student>> => {
    try {
      const response = await apiClient.put(`/students/${studentId}/field`, { field, enrolledSubjects });
      const data = extractData(response);
      return wrapResponse(data, 'Student field updated');
    } catch (error) {
      console.error('Failed to set student field:', error);
      return wrapError(error, {} as Student, 'Failed to update student field');
    }
  },

  // ── Notifications ────────────────────────────────────────────────────────

  getNotifications: async (): Promise<ApiResponse<Notification[]>> => {
    try {
      const response = await apiClient.get('/notifications');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return wrapError(error, [], 'Failed to load notifications');
    }
  },

  previewNotificationRecipients: async (audience: NotificationAudience, schoolId?: string, classId?: string): Promise<ApiResponse<{ count: number; breakdown: Record<string, number> }>> => {
    try {
      const params = new URLSearchParams({ audience });
      if (schoolId) params.append('schoolId', schoolId);
      if (classId) params.append('classId', classId);
      const response = await apiClient.get(`/notifications/preview?${params}`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to preview recipients:', error);
      return wrapError(error, { count: 0, breakdown: {} }, 'Preview failed');
    }
  },

  createNotification: async (payload: {
    title: string;
    message: string;
    audience: NotificationAudience;
    schoolId?: string;
    classId?: string;
    userIds?: string[];
    source: string;
  }): Promise<ApiResponse<Notification>> => {
    try {
      const response = await apiClient.post('/notifications', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Notification sent');
    } catch (error) {
      console.error('Failed to create notification:', error);
      return wrapError(error, {} as Notification, 'Failed to send notification');
    }
  },

  markNotificationRead: async (notificationId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.patch(`/notifications/${notificationId}/read`, {});
      return wrapResponse(true);
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      return wrapError(error, false, 'Failed to mark as read');
    }
  },

  // ── Private Conversations ────────────────────────────────────────────────

  getConversations: async (): Promise<ApiResponse<PrivateConversation[]>> => {
    try {
      const response = await apiClient.get('/conversations');
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return wrapError(error, [], 'Failed to load conversations');
    }
  },

  getOrCreateConversation: async (payload: {
    schoolId: string;
    studentId: string;
    teacherId: string;
    subjectId?: string;
  }): Promise<ApiResponse<PrivateConversation>> => {
    try {
      const response = await apiClient.post('/conversations', payload);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get/create conversation:', error);
      return wrapError(error, {} as PrivateConversation, 'Failed to start conversation');
    }
  },

  getConversationMessages: async (conversationId: string): Promise<ApiResponse<PrivateConversationMessage[]>> => {
    try {
      const response = await apiClient.get(`/conversations/${conversationId}/messages`);
      const data = extractData(response) || [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get messages:', error);
      return wrapError(error, [], 'Failed to load messages');
    }
  },

  sendConversationMessage: async (conversationId: string, content: string): Promise<ApiResponse<PrivateConversationMessage>> => {
    try {
      const response = await apiClient.post(`/conversations/${conversationId}/messages`, { content });
      const data = extractData(response);
      return wrapResponse(data, 'Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      return wrapError(error, {} as PrivateConversationMessage, 'Failed to send message');
    }
  },

  // ── Attendance Summaries ──────────────────────────────────────────────────

  getAttendanceSummaries: async (studentIds: string[]): Promise<ApiResponse<Record<string, { present: number; absent: number; late: number; excused: number; total: number }>>> => {
    try {
      const response = await apiClient.get(`/attendance/summaries?ids=${studentIds.join(',')}`);
      const data = extractData(response) ?? {};
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get attendance summaries:', error);
      return wrapError(error, {}, 'Failed to load attendance');
    }
  },

  getStudentAttendanceSummary: async (studentId: string): Promise<ApiResponse<AttendanceSummary>> => {
    try {
      const response = await apiClient.get(`/attendance/student-summary?studentId=${studentId}`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get attendance summary:', error);
      return wrapError(error, { present: 0, absent: 0, late: 0, excused: 0, total: 0 }, 'Failed');
    }
  },

  // ── School Terms ──────────────────────────────────────────────────────────

  getTerms: async (schoolId: string): Promise<ApiResponse<SchoolTerm[]>> => {
    try {
      const response = await apiClient.get(`/terms?schoolId=${schoolId}`);
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get terms:', error);
      return wrapError(error, [], 'Failed to load terms');
    }
  },

  getCurrentTerm: async (schoolId: string): Promise<ApiResponse<SchoolTerm | null>> => {
    try {
      const response = await apiClient.get(`/terms/current?schoolId=${schoolId}`);
      const data = extractData(response);
      return wrapResponse(data ?? null);
    } catch (error) {
      console.error('Failed to get current term:', error);
      return wrapError(error, null, 'Failed to load current term');
    }
  },

  createTerm: async (payload: {
    schoolId: string;
    name: string;
    session: string;
    term: 'first' | 'second' | 'third';
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }): Promise<ApiResponse<SchoolTerm>> => {
    try {
      const response = await apiClient.post('/terms', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Term created');
    } catch (error) {
      console.error('Failed to create term:', error);
      return wrapError(error, {} as SchoolTerm, 'Failed to create term');
    }
  },

  setCurrentTerm: async (termId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.put(`/terms/${termId}/current`, {});
      const data = extractData(response);
      return wrapResponse(typeof data === 'boolean' ? data : true, 'Current term updated');
    } catch (error) {
      console.error('Failed to set current term:', error);
      return wrapError(error, false, 'Failed to update term');
    }
  },

  deleteTerm: async (termId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/terms/${termId}`);
      return wrapResponse(true, 'Term deleted');
    } catch (error) {
      console.error('Failed to delete term:', error);
      return wrapError(error, false, 'Failed to delete term');
    }
  },

  // ── Finance ───────────────────────────────────────────────────────────────

  getFeeTemplates: async (schoolId: string, term?: string): Promise<ApiResponse<any[]>> => {
    try {
      const qs = new URLSearchParams({ schoolId });
      if (term) qs.set('term', term);
      const response = await apiClient.get(`/finance/templates?${qs}`);
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get fee templates:', error);
      return wrapError(error, [], 'Failed to load templates');
    }
  },

  createFeeTemplate: async (payload: {
    schoolId: string;
    term: string;
    name: string;
    scopeType?: string;
    scopeId?: string;
    lines?: { title: string; key: string; defaultAmount?: number }[];
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await apiClient.post('/finance/templates', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Template created');
    } catch (error) {
      console.error('Failed to create fee template:', error);
      return wrapError(error, null, 'Failed to create template');
    }
  },

  generateLedger: async (payload: {
    schoolId: string;
    templateId: string;
    studentIds: string[];
    term: string;
    scopeType: string;
    scopeId: string;
  }): Promise<ApiResponse<{ created: number; skipped: number }>> => {
    try {
      const response = await apiClient.post('/finance/ledgers/generate', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Ledger generated');
    } catch (error) {
      console.error('Failed to generate ledger:', error);
      return wrapError(error, { created: 0, skipped: 0 }, 'Failed to generate ledger');
    }
  },

  getLedgers: async (params: {
    schoolId: string;
    term?: string;
    scopeType?: string;
    scopeId?: string;
    studentId?: string;
  }): Promise<ApiResponse<StudentFeeLedger[]>> => {
    try {
      const qs = new URLSearchParams({ schoolId: params.schoolId });
      if (params.term) qs.set('term', params.term);
      if (params.scopeType) qs.set('scopeType', params.scopeType);
      if (params.scopeId) qs.set('scopeId', params.scopeId);
      if (params.studentId) qs.set('studentId', params.studentId);
      const response = await apiClient.get(`/finance/ledgers?${qs}`);
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get ledgers:', error);
      return wrapError(error, [], 'Failed to load ledgers');
    }
  },

  recordPayment: async (payload: {
    ledgerItemId: string;
    amount: number;
    method?: string;
    paymentRef?: string;
    schoolId: string;
  }): Promise<ApiResponse<StudentFeePayment>> => {
    try {
      // Generate a one-time idempotency key so retries don't create duplicate records
      const clientRef = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const response = await apiClient.post('/finance/payments', { ...payload, clientRef });
      const data = extractData(response);
      return wrapResponse(data, 'Payment recorded');
    } catch (error) {
      console.error('Failed to record payment:', error);
      return wrapError(error, {} as StudentFeePayment, 'Failed to record payment');
    }
  },

  getFinanceSummary: async (schoolId: string, term?: string): Promise<ApiResponse<{
    totalPayable: number;
    totalCollected: number;
    outstanding: number;
    studentCount: number;
    fullyPaidCount: number;
  }>> => {
    try {
      const qs = new URLSearchParams({ schoolId });
      if (term) qs.set('term', term);
      const response = await apiClient.get(`/finance/summary?${qs}`);
      const data = extractData(response);
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get finance summary:', error);
      return wrapError(error, { totalPayable: 0, totalCollected: 0, outstanding: 0, studentCount: 0, fullyPaidCount: 0 }, 'Failed');
    }
  },

  // ── Audit Logs ────────────────────────────────────────────────────────────

  getAuditLogs: async (schoolId: string, limit = 100): Promise<ApiResponse<any[]>> => {
    try {
      const response = await apiClient.get(`/audit?schoolId=${schoolId}&limit=${limit}`);
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return wrapError(error, [], 'Failed to load audit logs');
    }
  },

  // ── Parent Portal ─────────────────────────────────────────────────────────

  getSchoolParents: async (schoolId: string): Promise<ApiResponse<(User & { childCount: number })[]>> => {
    try {
      const response = await apiClient.get(`/parents?schoolId=${schoolId}`);
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      return wrapError(error, [], 'Failed to load parents');
    }
  },

  createParent: async (payload: {
    name: string; email: string; phone?: string; schoolId: string; studentIds: string[];
  }): Promise<ApiResponse<User & { authToken?: string }>> => {
    try {
      const response = await apiClient.post('/parents', payload);
      const data = extractData(response);
      return wrapResponse(data, 'Parent account created');
    } catch (error) {
      return wrapError(error, {} as User, 'Failed to create parent');
    }
  },

  linkParentToStudent: async (parentId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await apiClient.post(`/parents/${parentId}/link`, { studentId });
      return wrapResponse(true);
    } catch (error) {
      return wrapError(error, false, 'Failed to link student');
    }
  },

  unlinkParentFromStudent: async (parentId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/parents/${parentId}/link/${studentId}`);
      return wrapResponse(true);
    } catch (error) {
      return wrapError(error, false, 'Failed to unlink student');
    }
  },

  getParentChildren: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await apiClient.get('/parents/my-children');
      const data = extractData(response) ?? [];
      return wrapResponse(data);
    } catch (error) {
      return wrapError(error, [], 'Failed to load children data');
    }
  },
};
