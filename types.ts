

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // The Creator
  ADMIN = 'ADMIN', // School Administrator
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
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
  code: string; // Unique School Code
  region: string;
  adminName: string;
  status: 'Active' | 'Inactive';
  studentCount: number;
  motto?: string;
  logoUrl?: string;
  address?: string;
  contact?: string;
}

export interface Student {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  grade: string;
  house: string;
  enrollmentDate: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  gpa: number;
  attendance: number; // percentage
  schoolId: string;
  accessCode: string; // Unique Student Access Code
  enrolledSubjects?: string[];
}

export interface GraduatedStudent {
  id: string;
  schoolId: string;
  studentId?: string;
  name: string;
  gender: 'Male' | 'Female';
  grade: string;
  house: string;
  level: string;
  term: string;
  year: number;
  archivedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  teacherId: string;
  schedule: string;
  room: string;
  schoolId?: string;
}

export interface SchemeOfWork {
  id: string;
  subjectId: string;
  term: string;
  week: number;
  topic: string;
  objectives: string;
  resources: string;
}

export interface SchemeSubmission {
  id: string;
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
  ca1: number; // Max 10
  ca2: number; // Max 10
  ca3: number; // Max 10
  exam: number; // Max 70
  [key: string]: string | number | undefined; // Allow dynamic CA columns
}

export interface ResultData {
  id: string;
  studentName: string;
  studentId: string;
  subjectName?: string; // Added to support multi-subject reports
  average: number;
  grade: string;
  status: 'Published' | 'Draft' | 'withheld';
  remarks?: string;
  term?: string;
  details?: {
    ca1?: number;
    ca2?: number;
    ca3?: number;
    exam?: number;
    [key: string]: number | undefined;
  };
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
  recording?: LiveClassRecording;
}

export interface LiveClassParticipant {
  id: string;
  liveClassId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  cameraOn: boolean;
  microphoneOn: boolean;
  handRaised: boolean;
}

export interface LiveClassMessage {
  id: string;
  liveClassId: string;
  userId: string;
  message: string;
  createdAt: string;
}

export interface LiveClassRecording {
  id: string;
  liveClassId: string;
  recordingUrl: string;
  duration: number;
  createdAt: string;
}

export interface ExamQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  text: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface ActiveExam {
  id: string;
  title: string;
  status: 'scheduled' | 'active' | 'ended';
  duration: number; // minutes
  questions: ExamQuestion[];
  teacherId?: string; // Owner of the exam
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  status: 'not-started' | 'in-progress' | 'submitted';
  progress: number; // 0 to 100
  score?: number;
  startTime?: string;
  endTime?: string;
  answers?: Record<string, string>; // Persist draft answers
}

export interface AIActivity {
  id: string;
  action: string;
  scope: 'assessments' | 'results' | 'proctoring' | 'live_classes' | 'general';
  status: 'success' | 'failed' | 'fallback';
  actorId?: string;
  actorRole?: UserRole;
  actorName?: string;
  schoolId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  ok: boolean;
}

export interface Library {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  schoolId: string;
  uploadedBy: string;
  createdAt: string;
}
