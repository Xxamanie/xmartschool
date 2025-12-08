export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatar?: string;
  schoolId?: string;
  gender?: 'Male' | 'Female';
  phone?: string;
  bio?: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  region: string;
  adminName: string;
  status: 'Active' | 'Inactive';
  studentCount: number;
  motto: string;
  logoUrl: string;
  address: string;
  contact: string;
}

export interface Student {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  grade: string;
  enrollmentDate: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  gpa: number;
  attendance: number;
  schoolId: string;
  accessCode: string;
  enrolledSubjects?: string[];
}

export interface Subject {
  id: string;
  name: string;
  teacherId: string;
  schedule: string;
  room: string;
}

export interface SchemeSubmission {
  id: string;
  subjectId?: string;
  subjectName: string;
  term: string;
  uploadDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  fileName: string;
}

export interface Assessment {
  id: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  term: string;
  ca1: number;
  ca2: number;
  ca3: number;
  exam: number;
  [key: string]: string | number | undefined;
}

export interface ResultData {
  id: string;
  studentName: string;
  studentId: string;
  subjectName?: string;
  average: number;
  grade: string;
  status: 'Published' | 'Draft' | 'withheld';
  remarks?: string;
  details?: Record<string, number | undefined>;
}

export interface ExamQuestionInput {
  id?: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  text: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface ExamQuestion extends ExamQuestionInput {
  id: string;
}

export interface ActiveExam {
  id: string;
  title: string;
  status: 'scheduled' | 'active' | 'ended';
  duration: number;
  questions: ExamQuestion[];
  teacherId?: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  status: 'not-started' | 'in-progress' | 'submitted';
  progress: number;
  score?: number;
  startTime?: string;
  endTime?: string;
  answers?: Record<string, string>;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'teachers' | 'students';
  source: string;
  createdAt: string;
}

export interface LiveClass {
  id: string;
  subjectId?: string;
  teacherId?: string;
  scheduledTime: string;
  meetingLink: string;
  status: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  message?: string;
}
