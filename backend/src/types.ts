export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
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
  code: string;
  region: string;
  adminName: string;
  status: 'Active' | 'Inactive';
  studentCount: number;
  motto: string;
  logoUrl: string;
  address: string;
  contact: string;
  gradingSystem?: string;
  themeColor?: string;
  principalName?: string;
  principalSignatureUrl?: string;
  schoolStampUrl?: string;
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
  avatar?: string;
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
  term?: string;
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

export type NotificationAudience =
  | 'all'
  | 'school'
  | 'admins'
  | 'teachers'
  | 'staff'
  | 'students'
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
}

export interface PrivateConversation {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  subjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
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

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  message?: string;
}

