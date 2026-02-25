import { api } from './api';
import { Assessment, ApiResponse, School, Student, Subject, User } from '../types';

const unsupported = <T>(message: string, fallback: T): ApiResponse<T> => ({
  ok: false,
  data: fallback,
  message,
});

// Legacy compatibility layer. Cloud/Supabase direct CRUD paths were consolidated into services/api.ts.
export const cloudStudentsApi = {
  getAllStudents: () => api.getStudents(),
  createStudent: (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> =>
    api.createStudent(student as Omit<Student, 'id' | 'enrollmentDate'>),
  updateStudent: (id: string, updates: Partial<Student>) => api.updateStudent(id, updates),
  deleteStudent: (id: string) => api.deleteStudent(id),
};

export const cloudSubjectsApi = {
  getAllSubjects: () => api.getSubjects(),
  createSubject: (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> =>
    api.createSubject({ name: subject.name, teacherId: subject.teacherId || undefined }),
  updateSubject: async (_id: string, _updates: Partial<Subject>): Promise<ApiResponse<Subject>> =>
    unsupported('Subject update endpoint is not exposed by the current backend API.', {} as Subject),
};

export const cloudUsersApi = {
  getAllUsers: () => api.getAllUsers(),
  createTeacher: (teacher: Omit<User, 'id'>) => api.createTeacher(teacher),
  updateTeacher: (id: string, updates: Partial<User>) => api.updateTeacher(id, updates),
  deleteTeacher: (id: string) => api.deleteTeacher(id),
};

export const cloudAssessmentsApi = {
  getAllAssessments: () => api.getAssessments(),
  createAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    const result = await api.saveAssessments([assessment as Assessment]);
    if (!result.ok) {
      return { ok: false, data: {} as Assessment, message: result.message || 'Failed to save assessment' };
    }
    return { ok: true, data: assessment as Assessment, message: result.message };
  },
};

export const cloudSchoolsApi = {
  getAllSchools: () => api.getSchools(),
  createSchool: (school: Omit<School, 'id'>) =>
    api.createSchool({
      name: school.name,
      code: school.code,
      region: school.region,
      adminName: school.adminName,
      status: school.status,
    }),
  updateSchool: async (id: string, updates: Partial<School>): Promise<ApiResponse<School>> => {
    if (updates.status) {
      return api.updateSchoolStatus(id, updates.status);
    }
    return unsupported('Only status updates are supported by the current backend API.', {} as School);
  },
  deleteSchool: (id: string) => api.deleteSchool(id),
};

export const setupSyncListener = (callback: (type: string, data: unknown) => void) => {
  let active = true;
  api.getStudents()
    .then((result) => {
      if (active && result.ok) callback('students', result.data);
    })
    .catch(() => undefined);
  return () => {
    active = false;
  };
};

export const initializeCloudData = async () => true;
