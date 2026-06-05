

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // The Creator
  ADMIN = 'ADMIN', // School Administrator
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT', // Parent/guardian — read-only access to linked children's data
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  authToken?: string;
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
  principalName?: string;
  principalSignatureUrl?: string;
  schoolStampUrl?: string;
  themeColor?: string;
  gradingSystem?: 'nigeria' | 'british' | 'american';
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  gender: 'Male' | 'Female';
  grade: string;
  enrollmentDate: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  gpa: number;
  attendance: number; // percentage
  schoolId: string;
  accessCode: string; // Unique Student Access Code
  enrolledSubjects?: string[];
  field?: 'science' | 'arts' | 'business' | 'general';
}

export interface Subject {
  id: string;
  name: string;
  teacherId: string;
  schedule: string;
  room: string;
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
  session?: string;
  verificationToken?: string;
  position?: number;
  classPopulation?: number;
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

export interface CalendarEvent {
  id: string;
  schoolId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  createdAt: string;
  updatedAt: string;
}



export interface LiveClass {
  id: string;
  subjectId?: string;
  teacherId?: string;
  schoolClassId?: string;
  scheduledTime: string;
  meetingLink: string;
  hostMeetingLink?: string;
  videoProvider?: 'whereby' | 'jitsi';
  status: string;
  recording?: LiveClassRecording;
}

export interface SchoolClassItem {
  id: string;
  name: string;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  schoolClassId: string;
  subjectName?: string;
  className?: string;
}

export interface StaffMessage {
  id: string;
  schoolId: string;
  userId: string;
  senderName?: string;
  senderAvatar?: string;
  senderRole?: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content: string;
  mediaUrl?: string;
  createdAt: string;
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

export interface ApiResponse<T> {
  data: T;
  message?: string;
  ok: boolean;
}

export type NotificationAudience =
  | 'all'
  | 'school'
  | 'admins'
  | 'teachers'
  | 'staff'
  | 'students'
  | 'class_students'
  | 'teacher_students'
  | 'specific_users';

export interface Notification {
  id: string;
  title: string;
  message: string;
  audience: NotificationAudience;
  sourceRole: UserRole;
  schoolId?: string;
  createdAt: string;
  readAt?: string | null;
}

export interface PrivateConversation {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  subjectId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: { content: string; createdAt: string } | null;
}

export interface PrivateConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface SchoolTerm {
  id: string;
  schoolId: string;
  name: string;
  session: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface StudentFeeLedgerItem {
  id: string;
  ledgerId: string;
  templateLineId: string;
  title: string;
  key: string;
  payableAmount: number;
  totalPaid: number;
  payments: StudentFeePayment[];
}

export interface StudentFeePayment {
  id: string;
  ledgerItemId: string;
  amount: number;
  paymentRef?: string;
  method?: string;
  createdAt: string;
}

export interface StudentFeeLedger {
  id: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  term: string;
  scopeType: string;
  scopeId: string;
  templateId: string;
  createdAt: string;
  lineItems: StudentFeeLedgerItem[];
  totalPayable: number;
  totalPaid: number;
  outstanding: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}
