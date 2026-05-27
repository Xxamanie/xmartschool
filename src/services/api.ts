import apiClient, { buildSchoolScopedConfig } from '../utils/api';
import { ApiResponse, Announcement, CalendarEvent, School, User, UserRole } from '../../types';


const fail = <T,>(message: string, fallback: T): ApiResponse<T> => ({ ok: false, data: fallback, message });

import { Student, Subject as SubjectType, SchoolClassItem } from '../../types';

export const api = {
  // Schools
  getSchools: async (): Promise<ApiResponse<School[]>> => {
    try {
      const res = await apiClient.get('/schools');
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load schools', [] as School[]);
    }
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const res = await apiClient.get('/users');
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load users', [] as User[]);
    }
  },

  // Students (school-scoped)
  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    try {
      const res = await apiClient.get('/students', buildSchoolScopedConfig(schoolId));
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load students', [] as Student[]);
    }
  },

  createStudent: async (payload: Omit<Student, 'id' | 'enrollmentDate'>): Promise<ApiResponse<Student>> => {
    try {
      const res = await apiClient.post('/students', payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to create student', {} as Student);
    }
  },

  updateStudent: async (studentId: string, payload: Partial<Student>): Promise<ApiResponse<Student>> => {
    try {
      const res = await apiClient.put(`/students/${studentId}`, payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to update student', {} as Student);
    }
  },

  deleteStudent: async (studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/students/${studentId}`);
      return { ok: true, data: true };
    } catch (e: any) {
      return fail('Failed to delete student', false);
    }
  },

  // Class masters / promotion helper (maps to form master assignment)
  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    try {
      const res = await apiClient.get('/students/form-masters');
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load class masters', {} as Record<string, string>);
    }
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<any>> => {
    try {
      const res = await apiClient.post('/students/form-masters', { grade, teacherId });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to assign class master', null);
    }
  },

  // Student field assignment (field + enrolledSubjects)
  setStudentField: async (studentId: string, field: string, enrolledSubjects: string[]): Promise<ApiResponse<{ field: string; enrolledSubjects: string[] }>> => {
    try {
      const res = await apiClient.put(`/students/${studentId}/field`, { field, enrolledSubjects });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to set student field', { field, enrolledSubjects });
    }
  },

  // Teachers / Users
  createTeacher: async (payload: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    try {
      const res = await apiClient.post('/users', payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to create teacher', {} as User);
    }
  },

  updateTeacher: async (teacherId: string, payload: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      const res = await apiClient.put(`/users/${teacherId}`, payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to update teacher', {} as User);
    }
  },

  deleteTeacher: async (teacherId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/users/${teacherId}`);
      return { ok: true, data: true };
    } catch (e: any) {
      return fail('Failed to delete teacher', false);
    }
  },

  // Teacher assignments
  getTeacherAssignments: async (teacherId?: string): Promise<ApiResponse<{ subjectId: string; schoolClassId: string }[]>> => {
    try {
      const params = teacherId ? { teacherId } : undefined;
      const res = await apiClient.get('/teacher-assignments', { params });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load teacher assignments', []);
    }
  },

  setTeacherAssignments: async (teacherId: string, assignments: { subjectId: string; schoolClassId: string }[]): Promise<ApiResponse<any>> => {
    try {
      const res = await apiClient.put('/teacher-assignments', { teacherId, assignments });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to set teacher assignments', null);
    }
  },

  // Subjects
  getSubjects: async (): Promise<ApiResponse<SubjectType[]>> => {
    try {
      const res = await apiClient.get('/subjects');
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load subjects', [] as SubjectType[]);
    }
  },

  // School classes
  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<SchoolClassItem[]>> => {
    try {
      const res = await apiClient.get('/schools/' + schoolId + '/classes');
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load school classes', [] as SchoolClassItem[]);
    }
  },


  createSchool: async (payload: Partial<School>): Promise<ApiResponse<School>> => {
    try {
      const res = await apiClient.post('/schools', payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to create school', {} as School);
    }
  },

  updateSchoolStatus: async (schoolId: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<School>> => {
    try {
      const res = await apiClient.patch(`/schools/${schoolId}/status`, { status });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to update school', {} as School);
    }
  },

  deleteSchool: async (schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
      await apiClient.delete(`/schools/${schoolId}`);
      return { ok: true, data: true };
    } catch (e: any) {
      return fail('Failed to delete school', false);
    }
  },

  // Announcements
  getAnnouncements: async (role?: UserRole): Promise<ApiResponse<Announcement[]>> => {
    try {
      const params = role ? { role } : undefined;
      const res = await apiClient.get('/announcements', { params });
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load announcements', [] as Announcement[]);
    }
  },

  createAnnouncement: async (payload: {
    title: string;
    message: string;
    targetAudience: Announcement['targetAudience'];
    source: string;
  }): Promise<ApiResponse<Announcement>> => {
    try {
      const res = await apiClient.post('/announcements', payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to create announcement', {} as Announcement);
    }
  },

  // Calendar events (per school)
  getCalendarEvents: async (schoolId: string): Promise<ApiResponse<CalendarEvent[]>> => {
    try {
      const res = await apiClient.get('/events', buildSchoolScopedConfig(schoolId));
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to load events', [] as CalendarEvent[]);
    }
  },

  createCalendarEvent: async (payload: {
    schoolId: string;
    title: string;
    description?: string;
    location?: string;
    startAt: string; // ISO
    endAt?: string; // ISO
  }): Promise<ApiResponse<CalendarEvent>> => {
    try {
      const res = await apiClient.post('/events', payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to create event', {} as CalendarEvent);
    }
  },

  updateCalendarEvent: async (
    id: string,
    payload: {
      schoolId: string;
      title?: string;
      description?: string;
      location?: string;
      startAt?: string;
      endAt?: string;
    },
  ): Promise<ApiResponse<CalendarEvent>> => {
    try {
      const res = await apiClient.put(`/events/${id}`, payload);
      return { ok: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return fail('Failed to update event', {} as CalendarEvent);
    }
  },

  deleteCalendarEvent: async (id: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
      const res = await apiClient.delete(`/events/${id}`, buildSchoolScopedConfig(schoolId));
      return { ok: true, data: res.data.data ?? true };
    } catch (e: any) {
      return fail('Failed to delete event', false);
    }
  },
};

