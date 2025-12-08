import { supabase } from '../src/services/supabaseClient';
import { Student, Subject, User, UserRole, Assessment, ApiResponse, School } from '../types';

const isoNow = () => new Date().toISOString();

const ok = <T>(data: T, message?: string): ApiResponse<T> => ({ ok: true, data, message });
const fail = <T>(message: string): ApiResponse<T> => ({ ok: false, data: ([] as unknown) as T, message });

// Students
export const cloudStudentsApi = {
  getAllStudents: async (): Promise<ApiResponse<Student[]>> => {
    const { data, error } = await supabase.from('students').select('*');
    if (error || !data) return fail('Failed to fetch students');
    return ok(data);
  },
  createStudent: async (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> => {
    const payload = { ...student, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error || !data) return fail('Failed to create student');
    return ok(data, 'Student created successfully');
  },
  updateStudent: async (id: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    const { data, error } = await supabase.from('students').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return fail('Student not found');
    return ok(data, 'Student updated successfully');
  },
  deleteStudent: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return fail('Student deletion failed');
    return ok(true, 'Student deleted successfully');
  }
};

// Subjects
export const cloudSubjectsApi = {
  getAllSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    const { data, error } = await supabase.from('subjects').select('*');
    if (error || !data) return fail('Failed to fetch subjects');
    return ok(data);
  },
  createSubject: async (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> => {
    const payload = { ...subject, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('subjects').insert(payload).select().single();
    if (error || !data) return fail('Failed to create subject');
    return ok(data, 'Subject created successfully');
  },
  updateSubject: async (id: string, updates: Partial<Subject>): Promise<ApiResponse<Subject>> => {
    const { data, error } = await supabase.from('subjects').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return fail('Subject not found');
    return ok(data, 'Subject updated successfully');
  }
};

// Users
export const cloudUsersApi = {
  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error || !data) return fail('Failed to fetch users');
    return ok(data);
  },
  createTeacher: async (teacher: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    const payload = { ...teacher, role: teacher.role || UserRole.TEACHER, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('users').insert(payload).select().single();
    if (error || !data) return fail('Failed to create teacher');
    return ok(data, 'Teacher created successfully');
  },
  updateTeacher: async (id: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    const { data, error } = await supabase.from('users').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return fail('Teacher not found');
    return ok(data, 'Teacher updated successfully');
  },
  deleteTeacher: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return fail('Teacher deletion failed');
    return ok(true, 'Teacher deleted successfully');
  }
};

// Assessments
export const cloudAssessmentsApi = {
  getAllAssessments: async (): Promise<ApiResponse<Assessment[]>> => {
    const { data, error } = await supabase.from('assessments').select('*');
    if (error || !data) return fail('Failed to fetch assessments');
    return ok(data);
  },
  createAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    const payload = { ...assessment, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('assessments').insert(payload).select().single();
    if (error || !data) return fail('Failed to create assessment');
    return ok(data, 'Assessment created successfully');
  }
};

// Schools
export const cloudSchoolsApi = {
  getAllSchools: async (): Promise<ApiResponse<School[]>> => {
    const { data, error } = await supabase.from('schools').select('*');
    if (error || !data) return fail('Failed to fetch schools');
    return ok(data);
  },
  createSchool: async (school: Omit<School, 'id'>): Promise<ApiResponse<School>> => {
    const payload = { ...school, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('schools').insert(payload).select().single();
    if (error || !data) return fail('Failed to create school');
    return ok(data, 'School created successfully');
  },
  updateSchool: async (id: string, updates: Partial<School>): Promise<ApiResponse<School>> => {
    const { data, error } = await supabase.from('schools').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return fail('School not found');
    return ok(data, 'School updated successfully');
  },
  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) return fail('School deletion failed');
    return ok(true, 'School deleted successfully');
  }
};

export const setupSyncListener = (callback: (type: string, data: any) => void) => {
  // Supabase realtime listeners per table
  const channels = ['students', 'subjects', 'users', 'assessments', 'schools'].map((table) =>
    supabase.channel(`${table}-sync`).on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      callback(table, payload.new || payload.old);
    }).subscribe()
  );
  return () => channels.forEach((ch) => supabase.removeChannel(ch));
};

export const initializeCloudData = async () => {
  // No-op: Supabase should be seeded server-side. This placeholder keeps API compatibility.
  return true;
};
