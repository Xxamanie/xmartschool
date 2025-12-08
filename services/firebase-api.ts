import { supabase } from '../src/services/supabaseClient';
import { Student, Subject, User, Assessment, School } from '../types';

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  message?: string;
}

const isoNow = () => new Date().toISOString();

const handle = async <T>(promise: Promise<{ data: T | null; error: any }>): Promise<ApiResponse<T>> => {
  const { data, error } = await promise;
  if (error || !data) return { ok: false, data: ([] as unknown) as T, message: error?.message || 'Request failed' };
  return { ok: true, data };
};

export const firebaseStudentsApi = {
  getAllStudents: () => handle<Student[]>(supabase.from('students').select('*')),
  addStudent: async (student: Omit<Student, 'id'>): Promise<ApiResponse<Student>> => {
    const payload = { ...student, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error || !data) return { ok: false, data: {} as Student, message: error?.message };
    return { ok: true, data };
  },
  updateStudent: async (id: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    const { data, error } = await supabase.from('students').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return { ok: false, data: {} as Student, message: error?.message };
    return { ok: true, data };
  },
  deleteStudent: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return { ok: false, data: false, message: error.message };
    return { ok: true, data: true, message: 'Student deleted successfully' };
  },
  subscribeToStudents: (callback: (students: Student[]) => void) => {
    const channel = supabase.channel('students-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, async () => {
        const { data } = await supabase.from('students').select('*');
        callback(data || []);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

export const firebaseSubjectsApi = {
  getAllSubjects: () => handle<Subject[]>(supabase.from('subjects').select('*')),
  addSubject: async (subject: Omit<Subject, 'id'>): Promise<ApiResponse<Subject>> => {
    const payload = { ...subject, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('subjects').insert(payload).select().single();
    if (error || !data) return { ok: false, data: {} as Subject, message: error?.message };
    return { ok: true, data };
  },
  getSubjectsByTeacher: async (teacherId: string): Promise<ApiResponse<Subject[]>> => {
    const { data, error } = await supabase.from('subjects').select('*').eq('teacherId', teacherId);
    if (error || !data) return { ok: false, data: [], message: error?.message };
    return { ok: true, data };
  },
};

export const firebaseUsersApi = {
  getAllUsers: () => handle<User[]>(supabase.from('users').select('*')),
  addUser: async (user: Omit<User, 'id'>): Promise<ApiResponse<User>> => {
    const payload = { ...user, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('users').insert(payload).select().single();
    if (error || !data) return { ok: false, data: {} as User, message: error?.message };
    return { ok: true, data };
  },
  updateUser: async (id: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    const { data, error } = await supabase.from('users').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return { ok: false, data: {} as User, message: error?.message };
    return { ok: true, data };
  },
  deleteUser: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return { ok: false, data: false, message: error.message };
    return { ok: true, data: true, message: 'User deleted successfully' };
  },
};

export const firebaseAssessmentsApi = {
  getAllAssessments: () => handle<Assessment[]>(supabase.from('assessments').select('*')),
  addAssessment: async (assessment: Omit<Assessment, 'id'>): Promise<ApiResponse<Assessment>> => {
    const payload = { ...assessment, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('assessments').insert(payload).select().single();
    if (error || !data) return { ok: false, data: {} as Assessment, message: error?.message };
    return { ok: true, data };
  },
  getAssessmentsByTeacher: async (teacherId: string): Promise<ApiResponse<Assessment[]>> => {
    const { data, error } = await supabase.from('assessments').select('*').eq('teacherId', teacherId);
    if (error || !data) return { ok: false, data: [], message: error?.message };
    return { ok: true, data };
  },
};

export const firebaseSchoolsApi = {
  getAllSchools: () => handle<School[]>(supabase.from('schools').select('*')),
  addSchool: async (school: Omit<School, 'id'>): Promise<ApiResponse<School>> => {
    const payload = { ...school, createdAt: isoNow(), updatedAt: isoNow() };
    const { data, error } = await supabase.from('schools').insert(payload).select().single();
    if (error || !data) return { ok: false, data: {} as School, message: error?.message };
    return { ok: true, data };
  },
  updateSchool: async (id: string, updates: Partial<School>): Promise<ApiResponse<School>> => {
    const { data, error } = await supabase.from('schools').update({ ...updates, updatedAt: isoNow() }).eq('id', id).select().single();
    if (error || !data) return { ok: false, data: {} as School, message: error?.message };
    return { ok: true, data };
  },
  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) return { ok: false, data: false, message: error.message };
    return { ok: true, data: true, message: 'School deleted successfully' };
  },
};
