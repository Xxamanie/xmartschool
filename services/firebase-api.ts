import { api } from './api';
import { Assessment, ApiResponse, School, Student, Subject, User } from '../types';

const unsupported = <T>(message: string, fallback: T): ApiResponse<T> => ({
  ok: false,
  data: fallback,
  message,
});

// Legacy compatibility layer. Firebase-specific implementations were removed.
export const firebaseStudentsApi = {
  getAllStudents: () => api.getStudents(),
  addStudent: (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> =>
    api.createStudent(student as Omit<Student, 'id' | 'enrollmentDate'>),
  updateStudent: (id: string, updates: Partial<Student>) => api.updateStudent(id, updates),
  deleteStudent: (id: string) => api.deleteStudent(id),
  subscribeToStudents: (callback: (students: Student[]) => void) => {
    let active = true;
    api.getStudents()
      .then((response) => {
        if (active && response.ok) callback(response.data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  },
};

export const firebaseSubjectsApi = {
  getAllSubjects: () => api.getSubjects(),
  addSubject: (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> =>
    api.createSubject({ name: subject.name, teacherId: subject.teacherId || undefined }),
  getSubjectsByTeacher: async (teacherId: string): Promise<ApiResponse<Subject[]>> => {
    const result = await api.getSubjects();
    if (!result.ok) return result;
    return { ok: true, data: result.data.filter((subject) => subject.teacherId === teacherId) };
  },
};

export const firebaseUsersApi = {
  getAllUsers: () => api.getAllUsers(),
  addUser: (user: Omit<User, 'id'>) => api.createTeacher(user),
  updateUser: (id: string, updates: Partial<User>) => api.updateTeacher(id, updates),
  deleteUser: (id: string) => api.deleteTeacher(id),
};

export const firebaseAssessmentsApi = {
  getAllAssessments: () => api.getAssessments(),
  addAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    const result = await api.saveAssessments([assessment as Assessment]);
    if (!result.ok) {
      return { ok: false, data: {} as Assessment, message: result.message || 'Failed to save assessment' };
    }
    return { ok: true, data: assessment as Assessment, message: result.message };
  },
  getAssessmentsByTeacher: async (_teacherId: string): Promise<ApiResponse<Assessment[]>> => {
    // Assessment objects do not currently include teacherId in the shared frontend type.
    return api.getAssessments();
  },
};

export const firebaseSchoolsApi = {
  getAllSchools: () => api.getSchools(),
  addSchool: (school: Omit<School, 'id'>) =>
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
