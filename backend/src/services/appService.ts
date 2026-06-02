import {
  Prisma,
  User as PrismaUserModel,
  School as PrismaSchoolModel,
  Student as PrismaStudentModel,
  Subject as PrismaSubjectModel,
  SchemeSubmission as PrismaSchemeModel,
  Assessment as PrismaAssessmentModel,
  Result as PrismaResultModel,
  Exam as PrismaExamModel,
  ExamQuestion as PrismaExamQuestionModel,
  ExamSession as PrismaExamSessionModel,
  AttendanceRecord as PrismaAttendanceRecordModel,
  ClassMaster as PrismaClassMasterModel,
  StaffMessage as PrismaStaffMessageModel,
  TeacherAssignment as PrismaTeacherAssignmentModel,
} from '@prisma/client';
import {
  SchoolTerm,
  StudentFeeLedger,
  StudentFeeLedgerItem,
  StudentFeePayment,
} from '../types';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { createSessionToken } from '../utils/session';
import {
  ActiveExam,
  ApiResponse,
  Assessment,
  AttendanceRecord as AppAttendanceRecord,
  ExamQuestion,
  ExamQuestionInput,
  ExamSession,
  ResultData,
  SchemeSubmission,
  School,
  SchoolClassItem,
  Student,
  Subject,
  User,
  UserRole,
  Announcement,
  CalendarEvent,
  LiveClass,
  StaffMessage,
  TeacherAssignment,
} from '../types';

const wait = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const success = async <T>(data: T, message?: string): Promise<ApiResponse<T>> => ({
  ok: true,
  data,
  message,
});

const failure = async <T>(message: string, data: T): Promise<ApiResponse<T>> => ({
  ok: false,
  data,
  message,
});

const toISODate = (date: Date) => date.toISOString().split('T')[0];
const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const avatarFromName = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
const toInputJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const generateTemporaryPassword = () => crypto.randomBytes(12).toString('base64url');
const mapCalendarEventModel = (event: Prisma.CalendarEventGetPayload<object>): CalendarEvent => ({
  id: event.id,
  schoolId: event.schoolId,
  title: event.title,
  description: event.description ?? undefined,
  location: event.location ?? undefined,
  startAt: event.startAt.toISOString(),
  endAt: event.endAt?.toISOString() ?? undefined,
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
});

const mapUserModel = (user: PrismaUserModel): User => ({
  id: user.id,
  name: user.name,
  email: user.email ?? undefined,
  role: user.role as UserRole,
  avatar: user.avatar ?? undefined,
  schoolId: user.schoolId ?? undefined,
  gender: (user.gender as User['gender']) ?? undefined,
  phone: user.phone ?? undefined,
  bio: user.bio ?? undefined,
});

const withSession = (user: User): User => ({
  ...user,
  authToken: createSessionToken(user),
});

const getDemoUserByEmail = (email: string): User | null => {
  if (email === 'creator@smartschool.edu') {
    return {
      id: 'demo-super-admin',
      name: 'SmartSchool Creator',
      email,
      role: UserRole.SUPER_ADMIN,
      avatar: avatarFromName('SmartSchool Creator'),
    };
  }

  if (email.includes('admin')) {
    return {
      id: 'demo-admin',
      name: 'School Principal',
      email,
      role: UserRole.ADMIN,
      schoolId: 'school1',
      avatar: avatarFromName('School Principal'),
    };
  }

  if (email.includes('teacher') || email.includes('alex')) {
    return {
      id: 'demo-teacher',
      name: 'Alex Johnson',
      email,
      role: UserRole.TEACHER,
      schoolId: 'school1',
      avatar: avatarFromName('Alex Johnson'),
    };
  }

  return null;
};

const mapSchoolModel = (school: PrismaSchoolModel): School => ({
  id: school.id,
  name: school.name,
  code: school.code ?? '',
  region: school.region ?? '',
  adminName: school.adminName ?? '',
  status: school.status as School['status'],
  studentCount: school.studentCount,
  motto: school.motto ?? '',
  logoUrl: school.logoUrl ?? '',
  address: school.address ?? '',
  contact: school.contact ?? '',
  gradingSystem: (school as any).gradingSystem ?? 'nigeria',
  themeColor: (school as any).themeColor ?? '#059669',
  principalName: (school as any).principalName ?? '',
  principalSignatureUrl: (school as any).principalSignatureUrl ?? '',
  schoolStampUrl: (school as any).schoolStampUrl ?? '',
});

const mapSchoolTermModel = (term: any): SchoolTerm => ({
  id: term.id,
  schoolId: term.schoolId,
  name: term.name,
  session: term.session,
  term: term.term,
  startDate: term.startDate instanceof Date ? term.startDate.toISOString() : term.startDate,
  endDate: term.endDate instanceof Date ? term.endDate.toISOString() : term.endDate,
  isCurrent: term.isCurrent,
  createdAt: term.createdAt instanceof Date ? term.createdAt.toISOString() : term.createdAt,
});

const mapLedgerModel = (ledger: any): StudentFeeLedger => {
  const lineItems: StudentFeeLedgerItem[] = (ledger.lineItems ?? []).map((item: any): StudentFeeLedgerItem => {
    const payments: StudentFeePayment[] = (item.payments ?? []).map((p: any): StudentFeePayment => ({
      id: p.id,
      ledgerItemId: p.ledgerItemId,
      amount: p.amount,
      paymentRef: p.paymentRef ?? undefined,
      method: p.method ?? undefined,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      id: item.id,
      ledgerId: item.ledgerId,
      templateLineId: item.templateLineId,
      title: item.title,
      key: item.key,
      payableAmount: item.payableAmount,
      totalPaid,
      payments,
    };
  });

  const totalPayable = lineItems.reduce((sum, i) => sum + i.payableAmount, 0);
  const totalPaid = lineItems.reduce((sum, i) => sum + i.totalPaid, 0);

  return {
    id: ledger.id,
    schoolId: ledger.schoolId,
    studentId: ledger.studentId,
    studentName: ledger.student?.name ?? undefined,
    term: ledger.term,
    scopeType: ledger.scopeType,
    scopeId: ledger.scopeId,
    templateId: ledger.templateId,
    createdAt: ledger.createdAt instanceof Date ? ledger.createdAt.toISOString() : ledger.createdAt,
    lineItems,
    totalPayable,
    totalPaid,
    outstanding: Math.max(0, totalPayable - totalPaid),
  };
};

const mapStudentModel = (student: PrismaStudentModel): Student => ({
  id: student.id,
  name: student.name,
  gender: student.gender as Student['gender'],
  grade: student.grade,
  enrollmentDate: toISODate(student.enrollmentDate),
  status: student.status as Student['status'],
  gpa: student.gpa,
  attendance: student.attendance,
  schoolId: student.schoolId,
  accessCode: student.accessCode,
  enrolledSubjects: (student as any).enrolledSubjects ?? [],
});

const mapSubjectModel = (subject: PrismaSubjectModel): Subject => ({
  id: subject.id,
  name: subject.name,
  teacherId: subject.teacherId ?? '',
  schedule: subject.schedule ?? 'TBD',
  room: subject.room ?? 'TBD',
});

// ── Grade computation (Nigerian WAEC-style) ──────────────────────────────────

const computeGrade = (score: number): string => {
  if (score >= 75) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
};

const computeRemarks = (score: number): string => {
  if (score >= 75) return 'Outstanding';
  if (score >= 65) return 'Very Good';
  if (score >= 55) return 'Good';
  if (score >= 45) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Needs Improvement';
};

// ── Unique access code generator ─────────────────────────────────────────────

const generateAccessCode = async (schoolCode: string): Promise<string> => {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    const code = `${schoolCode}-${year}-${rand}`;
    const exists = await prisma.student.count({ where: { accessCode: code } });
    if (!exists) return code;
  }
  return `${schoolCode}-${year}-${Date.now().toString(36).toUpperCase()}`;
};

// ── Event-driven system notifications ────────────────────────────────────────
// Failures are swallowed — a notification error must never break the main operation.

const emitSystemNotification = async (params: {
  title: string;
  message: string;
  audience: string;
  schoolId?: string;
  userIds?: string[];
}): Promise<void> => {
  try {
    const created = await prisma.notification.create({
      data: {
        title: params.title,
        message: params.message,
        audience: params.audience as any,
        sourceRole: 'SUPER_ADMIN',
        schoolId: params.schoolId ?? null,
      },
    });

    let recipients: string[] = params.userIds ?? [];

    if (recipients.length === 0 && params.schoolId) {
      if (params.audience === 'students') {
        const students = await prisma.student.findMany({
          where: { schoolId: params.schoolId },
          select: { id: true },
        });
        recipients = students.map((s) => s.id);
      } else if (params.audience === 'school') {
        const [users, students] = await Promise.all([
          prisma.user.findMany({ where: { schoolId: params.schoolId }, select: { id: true } }),
          prisma.student.findMany({ where: { schoolId: params.schoolId }, select: { id: true } }),
        ]);
        recipients = [...users.map((u) => u.id), ...students.map((s) => s.id)];
      }
    }

    if (recipients.length > 0) {
      await prisma.notificationRecipient.createMany({
        data: recipients.map((uid) => ({ notificationId: created.id, userId: uid })),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.error('[SystemNotification] Failed to emit:', err);
  }
};

const mapSchemeModel = (scheme: PrismaSchemeModel): SchemeSubmission => ({
  id: scheme.id,
  subjectId: scheme.subjectId ?? undefined,
  subjectName: scheme.subjectName,
  term: scheme.term,
  uploadDate: scheme.uploadDate.toISOString(),
  status: scheme.status,
  fileName: scheme.fileName,
});

const mapAssessmentModel = (
  assessment: PrismaAssessmentModel & { student?: PrismaStudentModel },
): Assessment => ({
  id: assessment.id,
  studentId: assessment.studentId,
  studentName: assessment.student?.name ?? '',
  subjectId: assessment.subjectId,
  term: assessment.term,
  ca1: assessment.ca1,
  ca2: assessment.ca2,
  ca3: assessment.ca3,
  exam: assessment.exam,
});

const mapResultModel = (result: PrismaResultModel & { student?: PrismaStudentModel }): ResultData => ({
  id: result.id,
  studentName: result.student?.name ?? '',
  studentId: result.studentId,
  subjectName: result.subjectName,
  term: (result as any).term ?? 'current',
  average: result.average,
  grade: result.grade,
  status: result.status as ResultData['status'],
  remarks: result.remarks ?? undefined,
  details: (result.details as Record<string, number | undefined> | undefined) ?? undefined,
});

const mapExamQuestionModel = (question: PrismaExamQuestionModel): ExamQuestion => ({
  id: question.id,
  type: question.type as ExamQuestion['type'],
  text: question.text,
  options: (question.options as string[] | null) ?? undefined,
  correctAnswer: question.correctAnswer,
  points: question.points,
});

const mapExamModel = (exam: PrismaExamModel & { questions: PrismaExamQuestionModel[] }): ActiveExam => ({
  id: exam.id,
  title: exam.title,
  status: exam.status as ActiveExam['status'],
  duration: exam.duration,
  questions: exam.questions.map(mapExamQuestionModel),
  teacherId: exam.teacherId ?? undefined,
});

const mapExamSessionModel = (session: PrismaExamSessionModel): ExamSession => ({
  id: session.id,
  examId: session.examId,
  studentId: session.studentId,
  status: session.status as ExamSession['status'],
  progress: session.progress,
  score: session.score ?? undefined,
  startTime: session.startTime?.toISOString(),
  endTime: session.endTime?.toISOString(),
  answers: (session.answers as Record<string, string> | undefined) ?? undefined,
});

const mapAttendanceModel = (
  record: PrismaAttendanceRecordModel,
): AppAttendanceRecord => ({
  studentId: record.studentId,
  status: record.status as AppAttendanceRecord['status'],
  date: toISODate(record.date),
});

const mapAnnouncementModel = (announcement: any): Announcement => ({
  id: announcement.id,
  title: announcement.title,
  message: announcement.message,
  targetAudience: announcement.targetAudience as Announcement['targetAudience'],
  source: announcement.source,
  createdAt: announcement.createdAt?.toISOString?.() || announcement.createdAt,
});

const mapLiveClassModel = (liveClass: any): LiveClass => ({
  id: liveClass.id,
  subjectId: liveClass.subjectId ?? undefined,
  teacherId: liveClass.teacherId ?? undefined,
  schoolClassId: liveClass.schoolClassId ?? undefined,
  scheduledTime: liveClass.scheduledTime?.toISOString?.() || liveClass.scheduledTime,
  meetingLink: liveClass.meetingLink,
  status: liveClass.status,
});




const getDateBounds = (value: string) => {
  const start = toDateOnly(value);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};

/**
 * Returns a failure response if the caller is not allowed to interact with the
 * given live class, or null if access is granted.
 *
 * Rules:
 *   SUPER_ADMIN / ADMIN — always allowed
 *   TEACHER             — must be the class's assigned teacher
 *   STUDENT             — student.schoolClassId must match liveClass.schoolClassId
 */
const checkLiveClassAccess = async (
  liveClassId: string,
  userId: string,
  role: UserRole,
): Promise<ApiResponse<null> | null> => {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return null;

  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    select: { schoolClassId: true, teacherId: true },
  });

  if (!liveClass) {
    return { ok: false, data: null, message: 'Live class not found' };
  }

  if (role === UserRole.TEACHER) {
    if (liveClass.teacherId !== userId) {
      return { ok: false, data: null, message: 'You are not the teacher of this live class' };
    }
    return null;
  }

  // STUDENT
  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { schoolClassId: true },
  });

  if (!student) {
    return { ok: false, data: null, message: 'Student record not found' };
  }

  if (!student.schoolClassId || student.schoolClassId !== liveClass.schoolClassId) {
    return { ok: false, data: null, message: 'This live class is not available for your class group' };
  }

  return null;
};

export const appService = {

  health: async (): Promise<ApiResponse<{ status: string }>> => {
    await wait(100);
    return success({ status: 'healthy' });
  },

  // Email + password login using bcrypt hash stored in User.password
  login: async (email: string, password: string): Promise<ApiResponse<User>> => {
    await wait(100);
    if (!password.trim()) {
      const demoUser = getDemoUserByEmail(email.toLowerCase());
      if (demoUser) {
        return success(withSession(demoUser), 'Demo login successful');
      }
      return failure('Password is required', {} as User);
    }

    const normalized = email.toLowerCase();

    const user = await prisma.user.findFirst({ where: { email: normalized } });
    if (!user) {
      return failure('Invalid credentials', {} as User);
    }

    try {
      const bcrypt = await import('bcryptjs');
      const hash = (user as any).password as string | undefined;
      if (!hash) {
        return failure('Invalid credentials', {} as User);
      }

      let valid = false;
      if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        valid = await bcrypt.compare(password, hash);
      } else {
        // Plain text fallback for seed/demo rows if any (not recommended)
        valid = password === hash;
      }

      if (!valid) {
        return failure('Invalid credentials', {} as User);
      }

      return success(withSession(mapUserModel(user)));
    } catch {
      return failure('Password verification failed', {} as User);
    }
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    await wait(100);
    const school = await prisma.school.findUnique({ where: { code: schoolCode } });
    if (!school) {
      return failure('Invalid School Code', {} as User);
    }

    const student = await prisma.student.findFirst({
      where: { accessCode: studentCode, schoolId: school.id },
    });
    if (!student) {
      return failure('Invalid Student Access Code', {} as User);
    }

    return success(withSession({
      id: student.id,
      name: student.name,
      role: UserRole.STUDENT,
      email: '',
      schoolId: school.id,
      avatar: avatarFromName(student.name),
      gender: student.gender as User['gender'],
    }));
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    await wait(100);

    const profileUpdates: Prisma.UserUpdateInput = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
      ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
      ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
    };

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: profileUpdates,
      });
      return success(mapUserModel(updated), 'Profile updated successfully');
    } catch {
      return failure('User not found', {} as User);
    }
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    await wait(100);
    const schools = await prisma.school.findMany({ orderBy: { name: 'asc' } });
    return success(schools.map(mapSchoolModel));
  },

  createSchool: async (school: Partial<School>): Promise<ApiResponse<School>> => {
    await wait(100);
    const newSchool = await prisma.school.create({
      data: {
        name: school.name || 'New School',
        code: school.code || `SCH-${Math.floor(Math.random() * 1000)}`,
        region: school.region || 'Default Region',
        adminName: school.adminName || 'Admin',
        status: 'Active',
        studentCount: school.studentCount ?? 0,
        motto: school.motto || 'Knowledge is Power',
        logoUrl: school.logoUrl || '',
        address: school.address || '',
        contact: school.contact || '',
      },
    });
    return success(mapSchoolModel(newSchool), 'School created successfully');
  },

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<SchoolClassItem[]>> => {
    await wait(100);
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return success(classes);
  },

  addSchoolClass: async (schoolId: string, className: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const normalizedName = className.trim();
    if (!normalizedName) {
      return failure('Class name is required', false as unknown as boolean);
    }

    try {
      await prisma.schoolClass.create({
        data: {
          schoolId,
          name: normalizedName,
        },
      });
      return success(true, 'Class added successfully');
    } catch {
      return failure('Class already exists for this school', false as unknown as boolean);
    }
  },

  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      await prisma.school.delete({ where: { id } });
      return success(true, 'School deleted successfully');
    } catch (error) {
      return failure('Unable to delete school', false as unknown as boolean);
    }
  },

  updateSchoolStatus: async (id: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<boolean>> => {
    await wait(100);
    await prisma.school.update({
      where: { id },
      data: { status },
    });
    return success(true);
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    await wait(100);
    const [users, students] = await Promise.all([prisma.user.findMany(), prisma.student.findMany()]);

    const studentAsUsers: User[] = students.map((student: PrismaStudentModel) => ({
      id: student.id,
      name: student.name,
      role: UserRole.STUDENT,
      email: `student.${student.id}@school.edu`,
      schoolId: student.schoolId,
      avatar: avatarFromName(student.name),
      gender: student.gender as User['gender'],
    }));

    return success([...users.map(mapUserModel), ...studentAsUsers]);
  },

  getUsersBySchoolId: async (schoolId: string): Promise<ApiResponse<User[]>> => {
    await wait(100);
    const [users, students] = await Promise.all([
      prisma.user.findMany({ where: { schoolId } }),
      prisma.student.findMany({ where: { schoolId } }),
    ]);

    const studentAsUsers: User[] = students.map((student: PrismaStudentModel) => ({
      id: student.id,
      name: student.name,
      role: UserRole.STUDENT,
      email: `student.${student.id}@school.edu`,
      schoolId: student.schoolId,
      avatar: avatarFromName(student.name),
      gender: student.gender as User['gender'],
    }));

    return success([...users.map(mapUserModel), ...studentAsUsers]);
  },

  createUserForSchool: async (
    payload: Partial<User>,
    schoolId?: string,
  ): Promise<ApiResponse<User>> => {
    await wait(100);

    if (!payload.name?.trim()) {
      return failure('Name is required', {} as User);
    }

    if (!payload.email?.trim()) {
      return failure('Email is required', {} as User);
    }

    const role = payload.role ?? UserRole.TEACHER;
    if (![UserRole.ADMIN, UserRole.TEACHER].includes(role)) {
      return failure('Invalid role for school user', {} as User);
    }

    const targetSchoolId = schoolId ?? payload.schoolId;
    if (!targetSchoolId) {
      return failure('School context is required', {} as User);
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: payload.email.toLowerCase() },
      select: { id: true },
    });
    if (existingUser) {
      return failure('A user with this email already exists', {} as User);
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(generateTemporaryPassword(), 10);

    const createdUser = await prisma.user.create({
      data: {
        name: payload.name.trim(),
        email: payload.email.toLowerCase(),
        password: passwordHash,
        role,
        schoolId: targetSchoolId,
        gender: payload.gender,
        phone: payload.phone?.trim() || undefined,
        bio: payload.bio?.trim() || undefined,
        avatar: payload.avatar || avatarFromName(payload.name.trim()),
      },
    });

    return success(mapUserModel(createdUser), 'Teacher created successfully');
  },

  updateUserForSchool: async (
    userId: string,
    updates: Partial<User>,
    schoolId?: string,
  ): Promise<ApiResponse<User>> => {
    await wait(100);
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, role: true, email: true },
    });

    if (!existingUser) {
      return failure('User not found', {} as User);
    }

    if (schoolId && existingUser.schoolId !== schoolId) {
      return failure('Cannot update a user from another school', {} as User);
    }

    if (existingUser.role === UserRole.SUPER_ADMIN) {
      return failure('Cannot modify a super admin from this endpoint', {} as User);
    }

    if (updates.role && ![UserRole.ADMIN, UserRole.TEACHER].includes(updates.role)) {
      return failure('Invalid role for school user', {} as User);
    }

    if (updates.email && updates.email.toLowerCase() !== existingUser.email) {
      const emailInUse = await prisma.user.findFirst({
        where: { email: updates.email.toLowerCase(), NOT: { id: userId } },
        select: { id: true },
      });
      if (emailInUse) {
        return failure('A user with this email already exists', {} as User);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.email !== undefined ? { email: updates.email.toLowerCase() } : {}),
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone?.trim() || null } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio?.trim() || null } : {}),
        ...(updates.avatar !== undefined ? { avatar: updates.avatar || null } : {}),
      },
    });

    return success(mapUserModel(updatedUser), 'Teacher updated successfully');
  },

  deleteUserForSchool: async (
    userId: string,
    schoolId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, role: true },
    });

    if (!existingUser) {
      return failure('User not found', false as unknown as boolean);
    }

    if (schoolId && existingUser.schoolId !== schoolId) {
      return failure('Cannot delete a user from another school', false as unknown as boolean);
    }

    if (existingUser.role === UserRole.SUPER_ADMIN) {
      return failure('Cannot delete a super admin from this endpoint', false as unknown as boolean);
    }

    await prisma.user.delete({ where: { id: userId } });
    return success(true, 'Teacher deleted successfully');
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    await wait(100);
    const students = await prisma.student.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
    });
    return success(students.map(mapStudentModel));
  },

  getStudentById: async (studentId: string): Promise<ApiResponse<Student>> => {
    await wait(100);
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    return student
      ? success(mapStudentModel(student))
      : failure('Student not found', {} as Student);
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    await wait(100);
    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: {
          ...updates,
          enrollmentDate: updates.enrollmentDate ? toDateOnly(updates.enrollmentDate) : undefined,
        },
      });
      return success(mapStudentModel(updated), 'Student updated successfully');
    } catch (error) {
      return failure('Student not found', {} as Student);
    }
  },

  updateStudentForSchool: async (
    studentId: string,
    updates: Partial<Student>,
    schoolId?: string,
  ): Promise<ApiResponse<Student>> => {
    await wait(100);
    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });

    if (!existingStudent) {
      return failure('Student not found', {} as Student);
    }

    if (schoolId && existingStudent.schoolId !== schoolId) {
      return failure('Cannot update a student from another school', {} as Student);
    }

    return appService.updateStudent(studentId, updates);
  },

  createStudent: async (
    data: {
      name: string;
      gender: string;
      grade: string;
      status?: string;
      enrollmentDate?: string;
      gpa?: number;
      attendance?: number;
      accessCode?: string;
      enrolledSubjects?: string[];
      schoolClassId?: string;
      field?: string;
      schoolId?: string;
    },
    schoolId?: string,
  ): Promise<ApiResponse<Student>> => {
    await wait(100);

    const targetSchoolId = schoolId ?? data.schoolId;
    if (!targetSchoolId) return failure('School context is required', {} as Student);
    if (!data.name?.trim()) return failure('Name is required', {} as Student);
    if (!data.gender) return failure('Gender is required', {} as Student);
    if (!data.grade) return failure('Grade is required', {} as Student);

    const school = await prisma.school.findUnique({
      where: { id: targetSchoolId },
      select: { id: true, code: true },
    });
    if (!school) return failure('School not found', {} as Student);

    const accessCode = data.accessCode?.trim()
      || await generateAccessCode(school.code ?? 'STU');

    const existingCode = await prisma.student.findFirst({ where: { accessCode } });
    if (existingCode) return failure('Access code already in use', {} as Student);

    const created = await prisma.student.create({
      data: {
        name: data.name.trim(),
        gender: data.gender,
        grade: data.grade,
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : new Date(),
        status: (data.status as any) ?? 'Active',
        gpa: data.gpa ?? 0,
        attendance: data.attendance ?? 0,
        accessCode,
        schoolId: targetSchoolId,
        schoolClassId: data.schoolClassId ?? null,
        field: data.field ?? 'general',
        enrolledSubjects: data.enrolledSubjects ?? [],
      },
    });

    await prisma.school.update({
      where: { id: targetSchoolId },
      data: { studentCount: { increment: 1 } },
    });

    // Auto-generate fee ledger if a current-term template exists for this school
    const currentTerm = await (prisma as any).schoolTerm.findFirst({
      where: { schoolId: targetSchoolId, isCurrent: true },
    });
    if (currentTerm) {
      const template = await (prisma as any).feeTemplate.findFirst({
        where: { schoolId: targetSchoolId, term: currentTerm.name },
        include: { lines: { orderBy: { order: 'asc' } } },
      });
      if (template && template.lines.length > 0) {
        await (prisma as any).studentFeeLedger.create({
          data: {
            schoolId: targetSchoolId,
            studentId: created.id,
            term: currentTerm.name,
            scopeType: template.scopeType ?? 'school',
            scopeId: template.scopeId ?? targetSchoolId,
            templateId: template.id,
            lineItems: {
              create: template.lines.map((line: any) => ({
                templateLineId: line.id,
                title: line.title,
                key: line.key,
                payableAmount: line.defaultAmount,
              })),
            },
          },
        });
      }
    }

    await appService.writeAuditLog({
      schoolId: targetSchoolId,
      action: 'CREATE_STUDENT',
      entity: 'Student',
      entityId: created.id,
      metadata: { name: created.name, grade: created.grade, accessCode },
    });

    return success(mapStudentModel(created), 'Student enrolled successfully');
  },

  deleteStudentForSchool: async (
    studentId: string,
    schoolId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true },
    });
    if (!student) return failure('Student not found', false as unknown as boolean);
    if (schoolId && student.schoolId !== schoolId) {
      return failure('Cannot delete a student from another school', false as unknown as boolean);
    }

    await prisma.student.delete({ where: { id: studentId } });

    await prisma.school.update({
      where: { id: student.schoolId },
      data: { studentCount: { decrement: 1 } },
    });

    return success(true, 'Student deleted successfully');
  },

  getSubjects: async (schoolId?: string): Promise<ApiResponse<Subject[]>> => {
    await wait(100);
    const subjects = await prisma.subject.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
    });
    return success(subjects.map(mapSubjectModel));
  },

  createSubject: async (subjectData: { name: string; teacherId?: string; schoolId?: string }): Promise<ApiResponse<Subject>> => {
    await wait(100);
    const created = await prisma.subject.create({
      data: {
        name: subjectData.name,
        teacherId: subjectData.teacherId || undefined,
        schedule: 'TBD',
        room: 'TBD',
        schoolId: subjectData.schoolId,
      },
    });
    return success(mapSubjectModel(created), 'Subject enrolled successfully');
  },

  getSchemes: async (schoolId?: string): Promise<ApiResponse<SchemeSubmission[]>> => {
    await wait(100);
    const schemes = await prisma.schemeSubmission.findMany({
      where: schoolId ? { subject: { schoolId } } : undefined,
      orderBy: { uploadDate: 'desc' },
      include: { subject: true },
    });
    return success(schemes.map(mapSchemeModel));
  },

  uploadScheme: async (
    fileName: string,
    metadata: Record<string, unknown>,
  ): Promise<ApiResponse<{ id: string }>> => {
    await wait(100);
    const subjectName = (metadata.subjectName as string) || 'Unknown Subject';
    const subject = await prisma.subject.findFirst({ where: { name: subjectName } });
    const scheme = await prisma.schemeSubmission.create({
      data: {
        subjectId: subject?.id,
        subjectName,
        term: (metadata.term as string) || 'Term 1',
        status: 'Pending',
        fileName: fileName || 'upload.bin',
      },
    });
    return success({ id: scheme.id }, 'Scheme uploaded successfully');
  },

  getAssessments: async (
    schoolId?: string,
    subjectId?: string,
    term?: string,
    studentId?: string,
    teacherId?: string,
  ): Promise<ApiResponse<Assessment[]>> => {
    await wait(100);

    let enrolledSubjects: string[] = [];

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return failure('Student not found', [] as unknown as Assessment[]);
      }
      enrolledSubjects = (student as any).enrolledSubjects ?? [];

      if (subjectId && enrolledSubjects.length && !enrolledSubjects.includes(subjectId)) {
        return success([], 'Student not enrolled in subject');
      }
    }

    // If a teacher is requesting, restrict to students in their assigned class for this subject
    let allowedStudentIds: string[] | undefined;
    if (teacherId && subjectId) {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { teacherId, subjectId },
        select: { schoolClassId: true },
      });
      if (assignment) {
        const classStudents = await prisma.student.findMany({
          where: { schoolClassId: assignment.schoolClassId },
          select: { id: true, enrolledSubjects: true },
        });
        // Only students in that class who offer this subject
        allowedStudentIds = classStudents
          .filter((s: any) => !s.enrolledSubjects?.length || s.enrolledSubjects.includes(subjectId))
          .map((s: any) => s.id);
      } else {
        // Teacher has no assignment for this subject — return empty
        return success([], 'No class assignment found for this subject');
      }
    }

    const where: Prisma.AssessmentWhereInput = {
      ...(term ? { term } : {}),
      ...(studentId ? { studentId } : {}),
      ...(schoolId ? { student: { schoolId } } : {}),
      ...(allowedStudentIds ? { studentId: { in: allowedStudentIds } } : {}),
    };

    if (subjectId) {
      where.subjectId = subjectId;
    } else if (enrolledSubjects && enrolledSubjects.length) {
      where.subjectId = { in: enrolledSubjects };
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: { student: true },
    });
    return success(assessments.map(mapAssessmentModel));
  },

  saveAssessments: async (
    assessments: Assessment[],
    schoolId?: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
    if (schoolId) {
      const studentIds = [...new Set(assessments.map(assessment => assessment.studentId))];
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, schoolId: true },
      });
      const invalidStudent = students.find(student => student.schoolId !== schoolId);
      if (invalidStudent || students.length !== studentIds.length) {
        return failure('Cannot save assessments for students outside your school', { success: false });
      }
    }

    await Promise.all(
      assessments.map((assessment) => {
        const data = {
          studentId: assessment.studentId,
          subjectId: assessment.subjectId,
          term: assessment.term,
          ca1: assessment.ca1,
          ca2: assessment.ca2,
          ca3: assessment.ca3,
          exam: assessment.exam,
        };

        if (assessment.id) {
          return prisma.assessment.upsert({
            where: { id: assessment.id },
            update: data,
            create: { ...data, id: assessment.id },
          });
        }

        return prisma.assessment.create({ data });
      }),
    );

    // Auto-compute Draft results from the saved scores.
    // Teachers review Drafts and promote status to 'Published'.
    const subjectIds = [...new Set(assessments.map((a) => a.subjectId))];
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    await Promise.all(
      assessments.map(async (assessment) => {
        const subjectName = subjectNameMap.get(assessment.subjectId);
        if (!subjectName) return;

        const total = assessment.ca1 + assessment.ca2 + assessment.ca3 + assessment.exam;
        const average = Math.min(100, total);
        const grade = computeGrade(average);
        const remarks = computeRemarks(average);
        const term = assessment.term ?? 'current';

        await prisma.result.upsert({
          where: {
            studentId_subjectName_term: {
              studentId: assessment.studentId,
              subjectName,
              term,
            },
          },
          update: {
            average,
            grade,
            status: 'Draft',
            remarks,
            details: {
              ca1: assessment.ca1,
              ca2: assessment.ca2,
              ca3: assessment.ca3,
              exam: assessment.exam,
              total,
            } as Prisma.InputJsonValue,
          },
          create: {
            studentId: assessment.studentId,
            subjectId: assessment.subjectId,
            subjectName,
            term,
            average,
            grade,
            status: 'Draft',
            remarks,
            details: {
              ca1: assessment.ca1,
              ca2: assessment.ca2,
              ca3: assessment.ca3,
              exam: assessment.exam,
              total,
            } as Prisma.InputJsonValue,
          },
        });
      }),
    );

    return success({ success: true }, 'Assessments saved successfully');
  },

  getResults: async (schoolId?: string, studentId?: string, term?: string): Promise<ApiResponse<ResultData[]>> => {
    await wait(100);
    const results = await prisma.result.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(schoolId ? { student: { schoolId } } : {}),
        ...(term ? { term } : {}),
      },
      include: { student: true },
    });
    return success(results.map(mapResultModel));
  },

  publishResults: async (schoolId: string | undefined, newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);

    for (const result of newResults) {
      const student = await prisma.student.findUnique({ where: { id: result.studentId } });
      if (!student) {
        return failure('Student not found', { success: false });
      }
      if (schoolId && student.schoolId !== schoolId) {
        return failure('Cannot publish results for students outside your school', { success: false });
      }

      const subjectName = result.subjectName || 'General Studies';
      const term = (result as any).term ?? 'current';
      await prisma.result.upsert({
        where: {
          studentId_subjectName_term: {
            studentId: result.studentId,
            subjectName,
            term,
          },
        },
        update: {
          average: result.average,
          grade: result.grade,
          status: result.status,
          remarks: result.remarks,
          details: result.details != null
            ? (result.details as unknown as Prisma.InputJsonValue)
            : undefined,
        },
        create: {
          studentId: result.studentId,
          subjectName,
          term,
          average: result.average,
          grade: result.grade,
          status: result.status,
          remarks: result.remarks,
          details: result.details != null
            ? (result.details as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }

    // Notify each student whose results were just published
    if (schoolId) {
      const publishedIds = [
        ...new Set(
          newResults
            .filter((r) => r.status === 'Published')
            .map((r) => r.studentId),
        ),
      ];
      if (publishedIds.length > 0) {
        await emitSystemNotification({
          title: 'Results Published',
          message:
            'Your academic results have been published. Log in to view your performance.',
          audience: 'specific_users',
          schoolId,
          userIds: publishedIds,
        });
      }
    }

    // Audit
    if (schoolId) {
      await appService.writeAuditLog({
        schoolId,
        action: 'PUBLISH_RESULTS',
        entity: 'Result',
        metadata: { count: newResults.length, published: newResults.filter(r => r.status === 'Published').length },
      });
    }

    return success({ success: true }, 'Results published successfully');
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    await wait(100);
    const exams = await prisma.exam.findMany({ include: { questions: true } });
    return success(exams.map(mapExamModel));
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    await wait(100);
    const exams = await prisma.exam.findMany({
      where: { status: 'active' },
      include: { questions: true },
    });
    return success(exams.map(mapExamModel));
  },

  updateExamQuestions: async (
    questions: ExamQuestionInput[],
    title: string,
    examId?: string,
    teacherId?: string,
  ): Promise<ApiResponse<ActiveExam>> => {
    await wait(100);
    const questionPayload = questions.map((question) => ({
      type: question.type,
      text: question.text,
      options: question.options ?? undefined,
      correctAnswer: question.correctAnswer,
      points: question.points,
    }));

    if (examId) {
      const updated = await prisma.exam.update({
        where: { id: examId },
        data: {
          title,
          teacherId,
          questions: {
            deleteMany: {},
            create: questionPayload,
          },
        },
        include: { questions: true },
      });
      return success(mapExamModel(updated));
    }

    const created = await prisma.exam.create({
      data: {
        title,
        status: 'scheduled',
        duration: 60,
        teacherId,
        questions: {
          create: questionPayload,
        },
      },
      include: { questions: true },
    });
    return success(mapExamModel(created));
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      const exam = await prisma.exam.update({
        where: { id },
        data: { status },
        include: { teacher: { select: { schoolId: true } } },
      });

      if (status === 'active') {
        const schoolId = (exam as any).teacher?.schoolId;
        if (schoolId) {
          await emitSystemNotification({
            title: 'Exam Now Available',
            message: `The exam "${exam.title}" is now active. Log in to take it.`,
            audience: 'students',
            schoolId,
          });
        }
      }

      return success(true);
    } catch (error) {
      return failure('Exam not found', false as unknown as boolean);
    }
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
    await wait(100);
    const sessions = await prisma.examSession.findMany({ where: { examId } });
    return success(sessions.map(mapExamSessionModel));
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
    await wait(100);
    let session = await prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          examId,
          studentId,
          status: 'in-progress',
          progress: 0,
          startTime: new Date(),
          answers: toInputJson({}),
        },
      });
    } else if (session.status === 'not-started') {
      session = await prisma.examSession.update({
        where: { examId_studentId: { examId, studentId } },
        data: {
          status: 'in-progress',
          startTime: new Date(),
        },
      });
    }

    return success(mapExamSessionModel(session));
  },

  updateExamSessionProgress: async (
    examId: string,
    studentId: string,
    progress: number,
    answers?: Record<string, string>,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const session = await prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });

    if (!session || session.status === 'submitted') {
      return failure('Session not found', false as unknown as boolean);
    }

    const data: Prisma.ExamSessionUpdateInput = { progress };
    if (answers) {
      data.answers = toInputJson(answers);
    }

    await prisma.examSession.update({
      where: { examId_studentId: { examId, studentId } },
      data,
    });

    return success(true);
  },

  submitExam: async (
    studentId: string,
    answers: Record<string, string>,
    score: number,
    examId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const exam = examId
      ? await prisma.exam.findUnique({ where: { id: examId } })
      : await prisma.exam.findFirst({ where: { status: 'active' } });

    if (!exam) {
      return failure('No active exam found', false as unknown as boolean);
    }

    await prisma.examSession.upsert({
      where: { examId_studentId: { examId: exam.id, studentId } },
      update: {
        status: 'submitted',
        progress: 100,
        score,
        endTime: new Date(),
        answers: toInputJson(answers),
      },
      create: {
        examId: exam.id,
        studentId,
        status: 'submitted',
        progress: 100,
        score,
        startTime: new Date(),
        endTime: new Date(),
        answers: toInputJson(answers),
      },
    });

    return success(true);
  },

  getAttendance: async (date: string, grade?: string, schoolId?: string): Promise<ApiResponse<AppAttendanceRecord[]>> => {
    await wait(100);
    const { start, end } = getDateBounds(date);
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: start, lt: end },
        ...(grade ? { student: { grade } } : {}),
        ...(schoolId ? { student: { schoolId } } : {}),
      },
      include: { student: true },
    });
    return success(records.map(mapAttendanceModel));
  },

  markAttendance: async (
    updates: AppAttendanceRecord[],
    schoolId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    if (schoolId) {
      const studentIds = [...new Set(updates.map(update => update.studentId))];
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, schoolId: true },
      });
      const invalidStudent = students.find(student => student.schoolId !== schoolId);
      if (invalidStudent || students.length !== studentIds.length) {
        return failure('Cannot mark attendance for students outside your school', false as unknown as boolean);
      }
    }

    await Promise.all(
      updates.map((update) =>
        prisma.attendanceRecord.upsert({
          where: {
            studentId_date: {
              studentId: update.studentId,
              date: toDateOnly(update.date),
            },
          },
          update: { status: update.status },
          create: {
            studentId: update.studentId,
            status: update.status,
            date: toDateOnly(update.date),
          },
        }),
      ),
    );

    // Recompute attendance percentage for every affected student
    const uniqueStudentIds = [...new Set(updates.map((u) => u.studentId))];
    await Promise.all(
      uniqueStudentIds.map(async (studentId) => {
        const [total, present] = await Promise.all([
          prisma.attendanceRecord.count({ where: { studentId } }),
          prisma.attendanceRecord.count({
            where: { studentId, status: { in: ['Present', 'Late'] } },
          }),
        ]);
        if (total > 0) {
          await prisma.student.update({
            where: { id: studentId },
            data: { attendance: Math.round((present / total) * 100) },
          });
        }
      }),
    );

    return success(true, 'Attendance marked successfully');
  },

  getAnnouncements: async (role?: UserRole): Promise<ApiResponse<Announcement[]>> => {
    await wait(50);
    const where: Prisma.AnnouncementWhereInput = {};

    if (role === UserRole.TEACHER) {
      (where as any).targetAudience = { in: ['all', 'teachers'] };
    } else if (role === UserRole.STUDENT) {
      (where as any).targetAudience = { in: ['all', 'students'] };
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return success(announcements.map(mapAnnouncementModel));
  },

  createAnnouncement: async (
    title: string,
    message: string,
    targetAudience: Announcement['targetAudience'],
    source: string,
  ): Promise<ApiResponse<Announcement>> => {
    await wait(50);
    const created = await prisma.announcement.create({
      data: { title, message, targetAudience, source },
    });
    return success(mapAnnouncementModel(created), 'Announcement created');
  },

  // ── Calendar Events (per school) ────────────────────────────────────────

  listCalendarEvents: async (schoolId: string): Promise<ApiResponse<CalendarEvent[]>> => {
    await wait(50);
    const events = await prisma.calendarEvent.findMany({
      where: { schoolId },
      orderBy: { startAt: 'asc' },
    });

    return success(events.map(mapCalendarEventModel), 'Events loaded');
  },

  createCalendarEvent: async (payload: {
    schoolId: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: Date;
    endAt?: Date | null;
  }): Promise<ApiResponse<CalendarEvent>> => {
    await wait(50);
    const created = await prisma.calendarEvent.create({
      data: {
        schoolId: payload.schoolId,
        title: payload.title,
        description: payload.description ?? null,
        location: payload.location ?? null,
        startAt: payload.startAt,
        endAt: payload.endAt ?? null,
      },
    });

    return success(mapCalendarEventModel(created), 'Event created');
  },

  updateCalendarEvent: async (
    id: string,
    payload: {
      schoolId: string;
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: Date;
      endAt?: Date | null;
    },
  ): Promise<ApiResponse<CalendarEvent>> => {
    await wait(50);

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return failure('Event not found', {} as CalendarEvent);
    }
    if (existing.schoolId !== payload.schoolId) {
      return failure('Cannot update an event from another school', {} as CalendarEvent);
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        ...(payload.startAt !== undefined ? { startAt: payload.startAt } : {}),
        ...(payload.endAt !== undefined ? { endAt: payload.endAt } : {}),
      },
    });

    return success(mapCalendarEventModel(updated), 'Event updated');
  },

  deleteCalendarEvent: async (id: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    await wait(50);

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return failure('Event not found', false);
    }
    if (existing.schoolId !== schoolId) {
      return failure('Cannot delete an event from another school', false);
    }

    await prisma.calendarEvent.delete({ where: { id } });
    return success(true, 'Event deleted');
  },

  // ── Private Notifications ─────────────────────────────────────────────


  listNotifications: async (userId?: string, role?: UserRole): Promise<ApiResponse<any[]>> => {
    await wait(50);

    if (!userId || !role) return success([] as any[], 'No user context');

    // Return notifications scoped to this user (read/unread can be derived from NotificationRecipient.readAt)
    const rows = await prisma.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const mapped = rows.map((r) => ({
      id: r.notification.id,
      title: r.notification.title,
      message: r.notification.message,
      audience: r.notification.audience,
      sourceRole: r.notification.sourceRole,
      schoolId: r.notification.schoolId ?? undefined,
      createdAt: r.notification.createdAt.toISOString?.() || (r.notification as any).createdAt,
      readAt: r.readAt ?? null,
    }));

    return success(mapped, 'Notifications loaded');
  },

  createNotification: async (params: {
    title: string;
    message: string;
    audience: any; // NotificationAudience (keep loose for now to avoid TS mismatch)
    userIds?: string[];
    schoolId?: string;
    source: string;
    senderId: string;
    senderRole: UserRole;
  }): Promise<ApiResponse<any>> => {
    await wait(50);

    const { title, message, audience, userIds, schoolId, source, senderId, senderRole } = params;

    // Create notification record
    const created = await prisma.notification.create({
      data: {
        title,
        message,
        audience,
        sourceRole: senderRole,
        schoolId: schoolId ?? null,
      },
    });

    // Resolve recipients based on audience.
    // NOTE: This is minimal server-side targeting scaffolding. It should be expanded
    // to follow the exact flow rules once teacher/student mappings are finalized.
    let recipients: string[] = [];

    if (audience === 'specific_users') {
      recipients = (userIds ?? []).filter(Boolean);
    } else if (audience === 'all') {
      // all admins/teachers/students in the system (for now)
      const users = await prisma.user.findMany({ select: { id: true, role: true } });
      const students = await prisma.student.findMany({ select: { id: true } });
      recipients = [
        ...users.map((u) => u.id),
        ...students.map((s) => s.id),
      ];
    } else if (audience === 'school' && schoolId) {
      const users = await prisma.user.findMany({
        where: { schoolId },
        select: { id: true, role: true },
      });
      const students = await prisma.student.findMany({
        where: { schoolId },
        select: { id: true },
      });
      recipients = [...users.map((u) => u.id), ...students.map((s) => s.id)];
    } else if (audience === 'admins' && schoolId) {
      const users = await prisma.user.findMany({
        where: { schoolId, role: 'ADMIN' },
        select: { id: true },
      });
      recipients = users.map((u) => u.id);
    } else if (audience === 'admins' && !schoolId) {
      // SUPER_ADMIN broadcasting to all admins across all schools
      const users = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      recipients = users.map((u) => u.id);
    } else if (audience === 'teachers' && schoolId) {
      const users = await prisma.user.findMany({
        where: { schoolId, role: 'TEACHER' },
        select: { id: true },
      });
      recipients = users.map((u) => u.id);
    } else if (audience === 'staff' && schoolId) {
      // Staff concept not implemented separately in current schema; treat as all school users (admins/teachers)
      const users = await prisma.user.findMany({
        where: { schoolId },
        select: { id: true },
      });
      recipients = users.map((u) => u.id);
    } else if (audience === 'students' && schoolId) {
      const students = await prisma.student.findMany({
        where: { schoolId },
        select: { id: true },
      });
      recipients = students.map((s) => s.id);
    } else if (audience === 'class_students' && schoolId) {
      // Target students in a specific class (schoolClassId passed via userIds[0] as a workaround,
      // or via a dedicated classId param stored in schoolId field when audience=class_students)
      const classId = (userIds ?? [])[0];
      if (classId) {
        const students = await prisma.student.findMany({
          where: { schoolClassId: classId },
          select: { id: true },
        });
        recipients = students.map((s) => s.id);
      }
    } else if (audience === 'teacher_students' && schoolId) {
      // Restrict to students enrolled in subjects taught by this teacher (via TeacherAssignment + enrolledSubjects)
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: senderId },
        select: { subjectId: true },
      });
      const subjectIds = assignments.map((a) => a.subjectId);
      if (subjectIds.length > 0) {
        const students = await prisma.student.findMany({
          where: {
            schoolId,
            enrolledSubjects: { hasSome: subjectIds },
          },
          select: { id: true },
        });
        recipients = students.map((s) => s.id);
      } else {
        // Teacher has no assignments yet — fall back to all school students
        const students = await prisma.student.findMany({
          where: { schoolId },
          select: { id: true },
        });
        recipients = students.map((s) => s.id);
      }
    }

    recipients = [...new Set(recipients)];

    // Create recipient rows
    await prisma.notificationRecipient.createMany({
      data: recipients.map((uid) => ({
        notificationId: created.id,
        userId: uid,
        readAt: null,
      })),
      skipDuplicates: true,
    });

    return success(
      {
        id: created.id,
        title: created.title,
        message: created.message,
        audience: created.audience,
        sourceRole: created.sourceRole,
        schoolId: created.schoolId ?? undefined,
        createdAt: created.createdAt?.toISOString?.() || (created as any).createdAt,
        senderId,
        source,
        recipientCount: recipients.length,
      },
      'Notification created',
    );
  },

  previewNotificationRecipients: async (params: {
    audience: string;
    schoolId?: string;
    senderId: string;
  }): Promise<ApiResponse<{ count: number; breakdown: Record<string, number> }>> => {
    await wait(30);
    const { audience, schoolId, senderId } = params;

    const breakdown: Record<string, number> = {};
    let total = 0;

    if (audience === 'admins' && schoolId) {
      const n = await prisma.user.count({ where: { schoolId, role: 'ADMIN' } });
      breakdown['Admins'] = n; total = n;
    } else if (audience === 'admins' && !schoolId) {
      const n = await prisma.user.count({ where: { role: 'ADMIN' } });
      breakdown['All Admins (system-wide)'] = n; total = n;
    } else if (audience === 'school' && schoolId) {
      const [u, s] = await Promise.all([
        prisma.user.count({ where: { schoolId } }),
        prisma.student.count({ where: { schoolId } }),
      ]);
      breakdown['Staff & Teachers'] = u; breakdown['Students'] = s; total = u + s;
    } else if (audience === 'teachers' && schoolId) {
      const n = await prisma.user.count({ where: { schoolId, role: 'TEACHER' } });
      breakdown['Teachers'] = n; total = n;
    } else if (audience === 'staff' && schoolId) {
      const n = await prisma.user.count({ where: { schoolId } });
      breakdown['Staff'] = n; total = n;
    } else if (audience === 'students' && schoolId) {
      const n = await prisma.student.count({ where: { schoolId } });
      breakdown['Students'] = n; total = n;
    } else if (audience === 'class_students' && schoolId) {
      // schoolId here is actually the classId for preview purposes
      const n = await prisma.student.count({ where: { schoolClassId: schoolId } });
      const cls = await prisma.schoolClass.findUnique({ where: { id: schoolId }, select: { name: true } });
      breakdown[`${cls?.name ?? 'Class'} Students`] = n; total = n;
    } else if (audience === 'teacher_students' && schoolId) {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: senderId }, select: { subjectId: true },
      });
      const subjectIds = assignments.map((a) => a.subjectId);
      const n = subjectIds.length > 0
        ? await prisma.student.count({ where: { schoolId, enrolledSubjects: { hasSome: subjectIds } } })
        : await prisma.student.count({ where: { schoolId } });
      breakdown['My Students'] = n; total = n;
    } else if (audience === 'all') {
      const [u, s] = await Promise.all([
        prisma.user.count(),
        prisma.student.count(),
      ]);
      breakdown['All Users'] = u; breakdown['All Students'] = s; total = u + s;
    }

    return success({ count: total, breakdown });
  },

  markNotificationRead: async (notificationId: string, userId: string): Promise<ApiResponse<boolean>> => {
    await wait(30);
    await prisma.notificationRecipient.updateMany({
      where: { notificationId, userId },
      data: { readAt: new Date() },
    });
    return success(true, 'Marked as read');
  },

  // ── Private Conversations (student ↔ teacher) ────────────────────────────

  listConversations: async (userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any[]>> => {
    await wait(50);
    const where = role === UserRole.TEACHER
      ? { teacherId: userId, ...(schoolId ? { schoolId } : {}) }
      : role === UserRole.STUDENT
      ? { studentId: userId }
      : {};
    const rows = await prisma.privateConversation.findMany({
      where,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Resolve names for display
    const teacherIds = [...new Set(rows.map((r: any) => r.teacherId))];
    const studentIds = [...new Set(rows.map((r: any) => r.studentId))];
    const [teacherUsers, studentRecords] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }),
      prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }),
    ]);
    const teacherMap = Object.fromEntries(teacherUsers.map((u) => [u.id, u.name]));
    const studentMap = Object.fromEntries(studentRecords.map((s) => [s.id, s.name]));

    return success(rows.map((r: any) => ({
      id: r.id,
      schoolId: r.schoolId,
      studentId: r.studentId,
      studentName: studentMap[r.studentId] ?? 'Student',
      teacherId: r.teacherId,
      teacherName: teacherMap[r.teacherId] ?? 'Teacher',
      subjectId: r.subjectId ?? undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lastMessage: r.messages[0]
        ? { content: r.messages[0].content, createdAt: r.messages[0].createdAt.toISOString() }
        : null,
    })));
  },

  getOrCreateConversation: async (params: {
    schoolId: string;
    studentId: string;
    teacherId: string;
    subjectId?: string;
  }): Promise<ApiResponse<any>> => {
    await wait(50);
    const { schoolId, studentId, teacherId, subjectId } = params;
    const existing = await prisma.privateConversation.findFirst({
      where: { studentId, teacherId, subjectId: subjectId ?? null },
    });
    if (existing) return success({ id: existing.id, schoolId: existing.schoolId, studentId: existing.studentId, teacherId: existing.teacherId, subjectId: existing.subjectId ?? undefined, createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString() });
    const created = await prisma.privateConversation.create({
      data: { schoolId, studentId, teacherId, subjectId: subjectId ?? null },
    });
    return success({ id: created.id, schoolId: created.schoolId, studentId: created.studentId, teacherId: created.teacherId, subjectId: created.subjectId ?? undefined, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() }, 'Conversation started');
  },

  getConversationMessages: async (conversationId: string, requesterId: string, role: UserRole): Promise<ApiResponse<any[]>> => {
    await wait(50);
    const conv = await prisma.privateConversation.findUnique({ where: { id: conversationId } });
    if (!conv) return failure('Conversation not found', []);
    const allowed = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || conv.studentId === requesterId || conv.teacherId === requesterId;
    if (!allowed) return failure('Access denied', []);
    const messages = await prisma.privateConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return success(messages.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })));
  },

  sendConversationMessage: async (conversationId: string, senderId: string, role: UserRole, content: string): Promise<ApiResponse<any>> => {
    await wait(30);
    if (!content.trim()) return failure('Message cannot be empty', null);
    const conv = await prisma.privateConversation.findUnique({ where: { id: conversationId } });
    if (!conv) return failure('Conversation not found', null);
    const allowed = conv.studentId === senderId || conv.teacherId === senderId;
    if (!allowed) return failure('Access denied', null);
    const msg = await prisma.privateConversationMessage.create({
      data: { conversationId, senderId, content: content.trim() },
    });
    await prisma.privateConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return success({ id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId, content: msg.content, createdAt: msg.createdAt.toISOString() }, 'Message sent');
  },

  recordProctorFrame: async (
    examId: string,
    studentId: string,
    frameData: string,
  ): Promise<ApiResponse<{ stored: boolean }>> => {
    await wait(20);
    console.log('[proctor-frame]', examId, studentId, frameData.slice(0, 64));
    return success({ stored: true });
  },

  getLiveClasses: async (schoolId?: string, userId?: string, role?: UserRole, studentId?: string): Promise<ApiResponse<LiveClass[]>> => {
    await wait(50);

    let schoolClassIdFilter: string | undefined;

    if (role === UserRole.STUDENT && studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolClassId: true } });
      schoolClassIdFilter = student?.schoolClassId ?? undefined;
    } else if (role === UserRole.TEACHER && userId) {
      // Teachers see classes they own
      const classes = await prisma.liveClass.findMany({
        where: { teacherId: userId, ...(schoolId ? { schoolClass: { schoolId } } : {}) },
        orderBy: { scheduledTime: 'asc' },
        include: { schoolClass: true },
      });
      return success(classes.map(mapLiveClassModel));
    }

    const classes = await prisma.liveClass.findMany({
      where: {
        ...(schoolId ? { schoolClass: { schoolId } } : {}),
        ...(schoolClassIdFilter ? { schoolClassId: schoolClassIdFilter } : {}),
      },
      orderBy: { scheduledTime: 'asc' },
      include: { schoolClass: true },
    });
    return success(classes.map(mapLiveClassModel));
  },




  createLiveClass: async (
    subjectId: string | undefined,
    teacherId: string | undefined,
    schoolClassId: string,
    scheduledTime: string,
    meetingLink: string,
  ): Promise<ApiResponse<LiveClass>> => {
    await wait(50);
    const created = await prisma.liveClass.create({
      data: {
        subjectId: subjectId || undefined,
        teacherId: teacherId || undefined,
        schoolClassId: schoolClassId,
        scheduledTime: toDateOnly(scheduledTime),
        meetingLink,
      },
    });
    return success(mapLiveClassModel(created), 'Live class scheduled');
  },


  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    await wait(100);
    const masters: PrismaClassMasterModel[] = await prisma.classMaster.findMany();
    const store = masters.reduce<Record<string, string>>((acc, item) => {
      acc[item.grade] = item.teacherId;
      return acc;
    }, {} as Record<string, string>);
    return success(store);
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    await prisma.classMaster.upsert({
      where: { grade },
      update: { teacherId },
      create: { grade, teacherId },
    });
    return success(true);
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      await prisma.examSession.delete({
        where: { examId_studentId: { examId, studentId } },
      });
      return success(true);
    } catch (error) {
      return failure('Session not found', false as unknown as boolean);
    }
  },

  joinLiveClass: async (liveClassId: string, userId: string, role: UserRole): Promise<ApiResponse<any>> => {
    await wait(50);
    const denied = await checkLiveClassAccess(liveClassId, userId, role);
    if (denied) return denied;
    try {
      const participant = await prisma.liveClassParticipant.upsert({
        where: { liveClassId_userId: { liveClassId, userId } },
        update: { leftAt: null },
        create: { liveClassId, userId },
      });
      return success(participant, 'Joined live class');
    } catch (error) {
      return failure('Failed to join live class', null);
    }
  },

  leaveLiveClass: async (liveClassId: string, userId: string): Promise<ApiResponse<boolean>> => {
    await wait(50);
    try {
      await prisma.liveClassParticipant.update({
        where: { liveClassId_userId: { liveClassId, userId } },
        data: { leftAt: new Date() },
      });
      return success(true, 'Left live class');
    } catch (error) {
      return failure('Failed to leave live class', false as unknown as boolean);
    }
  },

  updateParticipantStatus: async (
    liveClassId: string,
    userId: string,
    role: UserRole,
    cameraOn: boolean,
    microphoneOn: boolean,
  ): Promise<ApiResponse<any>> => {
    await wait(30);
    const denied = await checkLiveClassAccess(liveClassId, userId, role);
    if (denied) return denied;
    try {
      const updated = await prisma.liveClassParticipant.update({
        where: { liveClassId_userId: { liveClassId, userId } },
        data: { cameraOn, microphoneOn },
      });
      return success(updated);
    } catch (error) {
      return failure('Failed to update participant status', null);
    }
  },

  raiseHand: async (liveClassId: string, userId: string, role: UserRole, raised: boolean): Promise<ApiResponse<any>> => {
    await wait(30);
    const denied = await checkLiveClassAccess(liveClassId, userId, role);
    if (denied) return denied;
    try {
      const updated = await prisma.liveClassParticipant.update({
        where: { liveClassId_userId: { liveClassId, userId } },
        data: { handRaised: raised },
      });
      return success(updated);
    } catch (error) {
      return failure('Failed to update hand status', null);
    }
  },

  sendLiveClassMessage: async (liveClassId: string, userId: string, role: UserRole, message: string): Promise<ApiResponse<any>> => {
    await wait(30);
    if (!message.trim()) {
      return failure('Message cannot be empty', null);
    }
    const denied = await checkLiveClassAccess(liveClassId, userId, role);
    if (denied) return denied;
    try {
      const created = await prisma.liveClassMessage.create({
        data: { liveClassId, userId, message: message.trim() },
      });
      return success(created, 'Message sent');
    } catch (error) {
      return failure('Failed to send message', null);
    }
  },

  getLiveClassMessages: async (liveClassId: string): Promise<ApiResponse<any[]>> => {
    await wait(50);
    try {
      const messages = await prisma.liveClassMessage.findMany({
        where: { liveClassId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      return success(messages);
    } catch (error) {
      return failure('Failed to fetch messages', []);
    }
  },

  getLiveClassParticipants: async (liveClassId: string): Promise<ApiResponse<any[]>> => {
    await wait(50);
    try {
      const participants = await prisma.liveClassParticipant.findMany({
        where: { liveClassId, leftAt: null },
      });
      return success(participants);
    } catch (error) {
      return failure('Failed to fetch participants', []);
    }
  },

  startLiveClassRecording: async (liveClassId: string, recordingUrl: string): Promise<ApiResponse<any>> => {
    await wait(50);
    try {
      const recording = await prisma.liveClassRecording.create({
        data: { liveClassId, recordingUrl },
      });
      await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { status: 'recording' },
      });
      return success(recording, 'Recording started');
    } catch (error) {
      return failure('Failed to start recording', null);
    }
  },

  stopLiveClassRecording: async (liveClassId: string, duration: number): Promise<ApiResponse<any>> => {
    await wait(50);
    try {
      const updated = await prisma.liveClassRecording.update({
        where: { liveClassId },
        data: { duration },
      });
      await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { status: 'completed' },
      });
      return success(updated, 'Recording stopped');
    } catch (error) {
      return failure('Failed to stop recording', null);
    }
  },

  getStaffMessages: async (schoolId: string): Promise<ApiResponse<StaffMessage[]>> => {
    await wait(50);
    const messages = await prisma.staffMessage.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return success(messages.map((m: PrismaStaffMessageModel) => ({
      id: m.id,
      schoolId: m.schoolId,
      userId: m.userId,
      type: m.type as StaffMessage['type'],
      content: m.content,
      mediaUrl: m.mediaUrl ?? undefined,
      createdAt: m.createdAt.toISOString(),
    })));
  },

  sendStaffMessage: async (
    schoolId: string,
    userId: string,
    type: StaffMessage['type'],
    content: string,
    mediaUrl?: string,
  ): Promise<ApiResponse<StaffMessage>> => {
    await wait(30);
    if (!content.trim() && !mediaUrl) {
      return failure('Message content is required', {} as StaffMessage);
    }
    const created = await prisma.staffMessage.create({
      data: { schoolId, userId, type, content: content.trim(), mediaUrl: mediaUrl || null },
    });
    return success({
      id: created.id,
      schoolId: created.schoolId,
      userId: created.userId,
      type: created.type as StaffMessage['type'],
      content: created.content,
      mediaUrl: created.mediaUrl ?? undefined,
      createdAt: created.createdAt.toISOString(),
    }, 'Message sent');
  },

  // ── Teacher Assignments ──────────────────────────────────────────────────

  getTeacherAssignments: async (teacherId: string): Promise<ApiResponse<TeacherAssignment[]>> => {
    await wait(50);
    const rows = await prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: { subject: { select: { name: true } }, schoolClass: { select: { name: true } } },
    });
    return success(rows.map((r: any) => ({
      id: r.id,
      teacherId: r.teacherId,
      subjectId: r.subjectId,
      schoolClassId: r.schoolClassId,
      subjectName: r.subject?.name,
      className: r.schoolClass?.name,
    })));
  },

  setTeacherAssignments: async (
    teacherId: string,
    assignments: { subjectId: string; schoolClassId: string }[],
  ): Promise<ApiResponse<TeacherAssignment[]>> => {
    await wait(50);
    // Replace all assignments for this teacher
    await prisma.teacherAssignment.deleteMany({ where: { teacherId } });
    if (assignments.length > 0) {
      await prisma.teacherAssignment.createMany({
        data: assignments.map(a => ({ teacherId, subjectId: a.subjectId, schoolClassId: a.schoolClassId })),
        skipDuplicates: true,
      });
    }
    return appService.getTeacherAssignments(teacherId);
  },

  // ── Student field assignment ─────────────────────────────────────────────

  setStudentField: async (
    studentId: string,
    field: string,
    enrolledSubjects: string[],
  ): Promise<ApiResponse<Student>> => {
    await wait(50);
    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: { field, enrolledSubjects },
      });
      return success(mapStudentModel(updated), 'Student field updated');
    } catch {
      return failure('Student not found', {} as Student);
    }
  },

  // ── Attendance Summary ───────────────────────────────────────────────────

  getStudentAttendanceSummary: async (studentId: string): Promise<ApiResponse<{ present: number; absent: number; late: number; excused: number; total: number }>> => {
    await wait(30);
    const groups = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { id: true },
    });
    const result = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const g of groups) {
      const count = g._count.id;
      result.total += count;
      if (g.status === 'Present') result.present += count;
      else if (g.status === 'Absent') result.absent += count;
      else if (g.status === 'Late') result.late += count;
      else if (g.status === 'Excused') result.excused += count;
    }
    return success(result);
  },

  getStudentsAttendanceSummaries: async (
    studentIds: string[],
  ): Promise<ApiResponse<Record<string, { present: number; total: number }>>> => {
    await wait(30);
    if (studentIds.length === 0) return success({});
    const groups = await prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { studentId: { in: studentIds } },
      _count: { id: true },
    });
    const map: Record<string, { present: number; total: number }> = {};
    for (const g of groups) {
      if (!map[g.studentId]) map[g.studentId] = { present: 0, total: 0 };
      map[g.studentId].total += g._count.id;
      if (g.status === 'Present' || g.status === 'Late') {
        map[g.studentId].present += g._count.id;
      }
    }
    return success(map);
  },

  // ── School Terms ─────────────────────────────────────────────────────────

  getSchoolTerms: async (schoolId: string): Promise<ApiResponse<SchoolTerm[]>> => {
    await wait(50);
    const terms = await (prisma as any).schoolTerm.findMany({
      where: { schoolId },
      orderBy: [{ session: 'desc' }, { term: 'asc' }],
    });
    return success(terms.map(mapSchoolTermModel));
  },

  getCurrentTerm: async (schoolId: string): Promise<ApiResponse<SchoolTerm | null>> => {
    await wait(30);
    const term = await (prisma as any).schoolTerm.findFirst({
      where: { schoolId, isCurrent: true },
    });
    return success(term ? mapSchoolTermModel(term) : null);
  },

  createSchoolTerm: async (
    schoolId: string,
    data: {
      name: string;
      session: string;
      term: string;
      startDate: string;
      endDate: string;
      isCurrent?: boolean;
    },
  ): Promise<ApiResponse<SchoolTerm>> => {
    await wait(50);
    if (data.isCurrent) {
      await (prisma as any).schoolTerm.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const created = await (prisma as any).schoolTerm.create({
      data: {
        schoolId,
        name: data.name.trim(),
        session: data.session.trim(),
        term: data.term.trim(),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent ?? false,
      },
    });
    return success(mapSchoolTermModel(created), 'Term created');
  },

  setCurrentTerm: async (termId: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    await wait(50);
    const term = await (prisma as any).schoolTerm.findUnique({ where: { id: termId } });
    if (!term) return failure('Term not found', false as unknown as boolean);
    if (term.schoolId !== schoolId) return failure('Access denied', false as unknown as boolean);
    await (prisma as any).schoolTerm.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });
    await (prisma as any).schoolTerm.update({
      where: { id: termId },
      data: { isCurrent: true },
    });
    return success(true, 'Current term updated');
  },

  deleteSchoolTerm: async (termId: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    await wait(50);
    const term = await (prisma as any).schoolTerm.findUnique({ where: { id: termId } });
    if (!term) return failure('Term not found', false as unknown as boolean);
    if (term.schoolId !== schoolId) return failure('Access denied', false as unknown as boolean);
    await (prisma as any).schoolTerm.delete({ where: { id: termId } });
    return success(true, 'Term deleted');
  },

  // ── Finance ──────────────────────────────────────────────────────────────

  generateLedger: async (params: {
    schoolId: string;
    templateId: string;
    studentIds: string[];
    term: string;
    scopeType: string;
    scopeId: string;
  }): Promise<ApiResponse<{ created: number; skipped: number }>> => {
    await wait(100);
    const template = await (prisma as any).feeTemplate.findUnique({
      where: { id: params.templateId },
      include: { lines: { orderBy: { order: 'asc' } } },
    });
    if (!template) return failure('Fee template not found', { created: 0, skipped: 0 });
    if (template.schoolId !== params.schoolId) return failure('Template does not belong to this school', { created: 0, skipped: 0 });

    let created = 0;
    let skipped = 0;

    for (const studentId of params.studentIds) {
      const exists = await (prisma as any).studentFeeLedger.findFirst({
        where: {
          schoolId: params.schoolId,
          studentId,
          term: params.term,
          scopeType: params.scopeType,
          scopeId: params.scopeId,
        },
      });
      if (exists) { skipped++; continue; }

      await (prisma as any).studentFeeLedger.create({
        data: {
          schoolId: params.schoolId,
          studentId,
          term: params.term,
          scopeType: params.scopeType,
          scopeId: params.scopeId,
          templateId: params.templateId,
          lineItems: {
            create: template.lines.map((line: any) => ({
              templateLineId: line.id,
              title: line.title,
              key: line.key,
              payableAmount: line.defaultAmount,
            })),
          },
        },
      });
      created++;
    }
    return success({ created, skipped }, `${created} ledger(s) generated, ${skipped} skipped`);
  },

  getLedgers: async (params: {
    schoolId: string;
    term?: string;
    scopeType?: string;
    scopeId?: string;
    studentId?: string;
  }): Promise<ApiResponse<StudentFeeLedger[]>> => {
    await wait(100);
    const ledgers = await (prisma as any).studentFeeLedger.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.term ? { term: params.term } : {}),
        ...(params.scopeType ? { scopeType: params.scopeType } : {}),
        ...(params.scopeId ? { scopeId: params.scopeId } : {}),
        ...(params.studentId ? { studentId: params.studentId } : {}),
      },
      include: {
        student: { select: { name: true } },
        lineItems: {
          include: {
            payments: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return success(ledgers.map(mapLedgerModel));
  },

  recordPayment: async (params: {
    ledgerItemId: string;
    amount: number;
    method?: string;
    paymentRef?: string;
    schoolId: string;
  }): Promise<ApiResponse<StudentFeePayment>> => {
    await wait(50);
    if (params.amount <= 0) return failure('Payment amount must be positive', {} as StudentFeePayment);

    const item = await (prisma as any).studentFeeLedgerItem.findUnique({
      where: { id: params.ledgerItemId },
      include: { ledger: { select: { schoolId: true } } },
    });
    if (!item) return failure('Ledger item not found', {} as StudentFeePayment);
    if (item.ledger.schoolId !== params.schoolId) return failure('Access denied', {} as StudentFeePayment);

    const payment = await (prisma as any).studentFeePayment.create({
      data: {
        ledgerItemId: params.ledgerItemId,
        amount: params.amount,
        method: params.method ?? null,
        paymentRef: params.paymentRef ?? null,
      },
    });

    return success({
      id: payment.id,
      ledgerItemId: payment.ledgerItemId,
      amount: payment.amount,
      paymentRef: payment.paymentRef ?? undefined,
      method: payment.method ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    } as StudentFeePayment, 'Payment recorded');
  },

  getSchoolFinanceSummary: async (schoolId: string, term?: string): Promise<ApiResponse<{
    totalPayable: number;
    totalCollected: number;
    outstanding: number;
    studentCount: number;
    fullyPaidCount: number;
  }>> => {
    await wait(50);
    const ledgers = await (prisma as any).studentFeeLedger.findMany({
      where: { schoolId, ...(term ? { term } : {}) },
      include: {
        lineItems: {
          include: { payments: true },
        },
      },
    });

    let totalPayable = 0;
    let totalCollected = 0;
    let fullyPaidCount = 0;
    const studentsSeen = new Set<string>();

    for (const ledger of ledgers) {
      studentsSeen.add(ledger.studentId);
      let ledgerPayable = 0;
      let ledgerPaid = 0;
      for (const item of ledger.lineItems) {
        ledgerPayable += item.payableAmount;
        ledgerPaid += item.payments.reduce((s: number, p: any) => s + p.amount, 0);
      }
      totalPayable += ledgerPayable;
      totalCollected += ledgerPaid;
      if (ledgerPaid >= ledgerPayable && ledgerPayable > 0) fullyPaidCount++;
    }

    return success({
      totalPayable,
      totalCollected,
      outstanding: Math.max(0, totalPayable - totalCollected),
      studentCount: studentsSeen.size,
      fullyPaidCount,
    });
  },

  // ── Audit Log ────────────────────────────────────────────────────────────

  writeAuditLog: async (params: {
    schoolId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> => {
    try {
      await (prisma as any).auditLog.create({
        data: {
          schoolId: params.schoolId ?? null,
          userId: params.userId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          metadata: params.metadata ?? null,
        },
      });
    } catch (err) {
      console.error('[AuditLog] Failed to write:', err);
    }
  },

  getAuditLogs: async (schoolId: string, limit = 100): Promise<ApiResponse<any[]>> => {
    await wait(50);
    const logs = await (prisma as any).auditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return success(logs.map((l: any) => ({
      id: l.id,
      schoolId: l.schoolId ?? undefined,
      userId: l.userId ?? undefined,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId ?? undefined,
      metadata: l.metadata ?? undefined,
      createdAt: l.createdAt.toISOString(),
    })));
  },
};
