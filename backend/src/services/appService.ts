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
  StaffMessage as PrismaStaffMessageModel,
} from '@prisma/client';
import {
  SchoolTerm,
  StudentFeeLedger,
  StudentFeeLedgerItem,
  StudentFeePayment,
} from '../types';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { createSessionToken, createImpersonationToken } from '../utils/session';
import { verifyTransaction } from './paystackService';
import { sendSMS, sendWhatsApp } from './messagingService';
import { env } from '../config/env';
import { insertPayment } from './paymentService';
import { fromKobo, toKobo } from '../utils/money';
import { emailRecipients } from './emailService';
import { createNotificationRecipients, resolveNotificationRecipients, resolveNotificationAudience, saveNotificationRecipients } from './notificationRecipients';
import { publishMessageEvent } from './eventBus';
import { withProvisionedIdentity, updateProviderAccount } from './identityService';
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
  AuditLogEntry,
} from '../types';


const success = async <T>(data: T, message?: string): Promise<ApiResponse<T>> => ({
  ok: true,
  data,
  message,
});

const normalizeExamAnswer = (answer: string) => answer.normalize('NFKC').trim().toLocaleLowerCase();

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
type GroupOwnerResult = { userId: string; groupId: string; groupName: string; ownerEmail: string; tempPassword: string; linkedSchoolIds: string[] };
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
  groupId: user.groupId ?? undefined,
  gender: (user.gender as User['gender']) ?? undefined,
  phone: user.phone ?? undefined,
  bio: user.bio ?? undefined,
  active: user.active,
  sessionVersion: user.sessionVersion,
  notificationPreferences: (user.notificationPreferences as Record<string, boolean> | null) ?? undefined,
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

const isSeededDemoAccount = (email: string) =>
  email === 'creator@smartschool.edu' || email.endsWith('.demo');

const mapSchoolModel = (school: PrismaSchoolModel): School => ({
  id: school.id,
  groupId: school.groupId ?? undefined,
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
  gradingSystem: school.gradingSystem ?? 'nigeria',
  themeColor: school.themeColor ?? '#059669',
  principalName: school.principalName ?? '',
  principalSignatureUrl: school.principalSignatureUrl ?? '',
  schoolStampUrl: school.schoolStampUrl ?? '',
});

const mapSchoolTermModel = (term: Prisma.SchoolTermGetPayload<object>): SchoolTerm => ({
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

type LedgerWithPayments = Prisma.StudentFeeLedgerGetPayload<{
  include: { lineItems: { include: { payments: true } } };
}> & { student?: { name: string } };

const mapLedgerModel = (ledger: LedgerWithPayments): StudentFeeLedger => {
  const lineItems: StudentFeeLedgerItem[] = ledger.lineItems.map((item): StudentFeeLedgerItem => {
    const payments: StudentFeePayment[] = item.payments.map((p): StudentFeePayment => ({
      id: p.id,
      ledgerItemId: p.ledgerItemId,
      amount: fromKobo(toKobo(p.amount)),
      paymentRef: p.paymentRef ?? undefined,
      method: p.method ?? undefined,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));
    const totalPaid = fromKobo(payments.reduce((sum, payment) => sum + toKobo(payment.amount), 0));
    return {
      id: item.id,
      ledgerId: item.ledgerId,
      templateLineId: item.templateLineId,
      title: item.title,
      key: item.key,
      payableAmount: fromKobo(toKobo(item.payableAmount)),
      totalPaid,
      payments,
    };
  });

  const totalPayable = fromKobo(lineItems.reduce((sum, item) => sum + toKobo(item.payableAmount), 0));
  const totalPaid = fromKobo(lineItems.reduce((sum, item) => sum + toKobo(item.totalPaid), 0));

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

const mapStudentModel = (student: PrismaStudentModel, includeCredentials = false): Student => ({
  id: student.id,
  name: student.name ?? '',
  email: student.email ?? undefined,
  gender: student.gender as Student['gender'],
  grade: student.grade,
  enrollmentDate: toISODate(student.enrollmentDate),
  status: student.status as Student['status'],
  gpa: student.gpa ?? 0,
  attendance: student.attendance ?? 0,
  schoolId: student.schoolId,
  ...(includeCredentials ? { accessCode: student.accessCode, resultPin: student.resultPin ?? undefined, resultPinTerm: student.resultPinTerm ?? undefined } : {}),
  schoolClassId: student.schoolClassId ?? undefined,
  avatar: student.avatar || undefined,
  enrolledSubjects: student.enrolledSubjects ?? [],
});

export const mapSubjectModel = (subject: PrismaSubjectModel): Subject => ({
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

// 8-char alphanumeric PIN (uppercase letters + digits, ambiguous chars excluded)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateResultPin = (): string =>
  Array.from(crypto.randomBytes(8), b => CHARSET[b % CHARSET.length]).join('');

const generateAccessCode = async (schoolCode: string): Promise<string> => {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const rand = crypto.randomInt(1000, 10000).toString();
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
  audience: Prisma.NotificationGetPayload<object>['audience'];
  schoolId?: string;
  userIds?: string[];
}): Promise<void> => {
  try {
    let recipients = params.userIds ?? [];
    if (!recipients.length && params.schoolId) {
      if (params.audience === 'students') {
        const students = await prisma.student.findMany({ where: { schoolId: params.schoolId }, select: { id: true } });
        recipients = students.map(student => student.id);
      } else if (params.audience === 'school') {
        const [users, students] = await Promise.all([
          prisma.user.findMany({ where: { schoolId: params.schoolId }, select: { id: true } }),
          prisma.student.findMany({ where: { schoolId: params.schoolId }, select: { id: true } }),
        ]);
        recipients = [...users.map(user => user.id), ...students.map(student => student.id)];
      }
    }
    const targets = await resolveNotificationRecipients(recipients, params.schoolId);
    if (!targets.length) return;
    const created = await prisma.$transaction(async tx => {
      const notification = await tx.notification.create({ data: {
        title: params.title, message: params.message, audience: params.audience,
        sourceRole: 'SUPER_ADMIN', schoolId: params.schoolId ?? null,
      } });
      await saveNotificationRecipients(notification.id, targets, tx);
      return notification;
    });
    void emailRecipients(targets.map(target => target.id), created.title, created.message, targets).catch(() => console.error('[Email] Recipient lookup failed'));
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
  term: result.term ?? 'current',
  average: result.average ?? 0,
  grade: result.grade ?? '',
  status: result.status as ResultData['status'],
  remarks: result.remarks ?? undefined,
  details: (result.details as Record<string, number | undefined> | undefined) ?? undefined,
});

const mapExamQuestionModel = (question: PrismaExamQuestionModel, includeAnswer = false): ExamQuestion => ({
  id: question.id,
  type: question.type as ExamQuestion['type'],
  text: question.text,
  options: (question.options as string[] | null) ?? undefined,
  correctAnswer: includeAnswer ? question.correctAnswer : undefined,
  points: question.points,
});

const mapExamModel = (exam: PrismaExamModel & { questions: PrismaExamQuestionModel[] }, includeAnswers = false): ActiveExam => ({
  id: exam.id,
  title: exam.title,
  status: exam.status as ActiveExam['status'],
  duration: exam.duration,
  questions: exam.questions.map(q => mapExamQuestionModel(q, includeAnswers)),
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

const mapAnnouncementModel = (announcement: Prisma.AnnouncementGetPayload<object>): Announcement => ({
  id: announcement.id,
  title: announcement.title,
  message: announcement.message,
  targetAudience: announcement.targetAudience as Announcement['targetAudience'],
  source: announcement.source,
  createdAt: announcement.createdAt.toISOString(),
});

const mapLiveClassModel = (liveClass: Prisma.LiveClassGetPayload<object>, exposeHostLink = false): LiveClass => ({
  id: liveClass.id,
  subjectId: liveClass.subjectId ?? undefined,
  teacherId: liveClass.teacherId ?? undefined,
  schoolClassId: liveClass.schoolClassId ?? undefined,
  scheduledTime: liveClass.scheduledTime.toISOString(),
  meetingLink: liveClass.meetingLink,
  hostMeetingLink: exposeHostLink ? liveClass.hostMeetingLink ?? undefined : undefined,
  videoProvider: liveClass.videoProvider === 'whereby' ? 'whereby' : liveClass.videoProvider === 'jitsi' ? 'jitsi' : undefined,
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
 *   SUPER_ADMIN         — allowed in the selected school, or globally
 *   ADMIN               — must belong to the live class's school
 *   TEACHER             — must be the class's assigned teacher
 *   STUDENT             — student.schoolClassId must match liveClass.schoolClassId
 */
const checkLiveClassAccess = async (
  liveClassId: string,
  userId: string,
  role: UserRole,
  schoolId?: string,
  hostingOnly = false,
): Promise<ApiResponse<null> | null> => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    select: { schoolClassId: true, teacherId: true, schoolClass: { select: { schoolId: true } } },
  });

  if (!liveClass) {
    return { ok: false, data: null, message: 'Live class not found' };
  }

  if (!liveClass.schoolClass || (role !== UserRole.SUPER_ADMIN && !schoolId)
    || (schoolId && liveClass.schoolClass.schoolId !== schoolId)) {
    return { ok: false, data: null, message: 'Live class is not accessible in your school' };
  }
  if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return null;

  if (role === UserRole.TEACHER) {
    if (liveClass.teacherId !== userId) {
      return { ok: false, data: null, message: 'You are not the teacher of this live class' };
    }
    return null;
  }

  if (role !== UserRole.STUDENT || hostingOnly) {
    return { ok: false, data: null, message: 'You cannot host this live class' };
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { schoolClassId: true, schoolId: true },
  });

  if (!student) {
    return { ok: false, data: null, message: 'Student record not found' };
  }

  if (student.schoolId !== schoolId || !student.schoolClassId || student.schoolClassId !== liveClass.schoolClassId) {
    return { ok: false, data: null, message: 'This live class is not available for your class group' };
  }

  return null;
};

export const appService = {
  resetUserPassword: async (userId: string, schoolId: string | undefined, actorUserId: string) => {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || (schoolId && (target.schoolId !== schoolId || !['TEACHER', 'ADMIN'].includes(target.role)))) {
      return failure('User is not accessible', { temporaryPassword: '' });
    }
    const temporaryPassword = generateTemporaryPassword();
    if (!target.supabaseUserId && !env.enableDemoAuth) return failure('Account must be provisioned before its password can be reset', { temporaryPassword: '' });
    await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(temporaryPassword, 12), sessionVersion: { increment: 1 } } });
    await updateProviderAccount(target.supabaseUserId, { password: temporaryPassword, app_metadata: { sessionVersion: target.sessionVersion + 1 } });
    await appService.writeAuditLog({ schoolId: target.schoolId ?? undefined, userId: actorUserId, action: 'RESET_PASSWORD', entity: 'User', entityId: userId });
    return success({ temporaryPassword });
  },

  getAuthenticatedProfile: async (userId: string, role: UserRole): Promise<ApiResponse<User>> => {
    if (role === UserRole.STUDENT) {
      const student = await prisma.student.findUnique({ where: { id: userId } });
      if (!student || student.status !== 'Active') return failure('Account unavailable', {} as User);
      return success({ id: student.id, name: student.name, email: student.email ?? undefined, role,
        schoolId: student.schoolId, avatar: student.avatar || avatarFromName(student.name), gender: student.gender as User['gender'],
        notificationPreferences: (student.notificationPreferences as Record<string, boolean> | null) ?? undefined });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user?.active ? success(mapUserModel(user)) : failure('Account unavailable', {} as User);
  },

  health: async (): Promise<ApiResponse<{ status: string }>> => {
    return success({ status: 'healthy' });
  },

  // Email + password login using bcrypt hash stored in User.password
  login: async (email: string, password: string): Promise<ApiResponse<User>> => {
    const normalized = email.trim().toLowerCase();
    if (!env.enableDemoAuth && !isSeededDemoAccount(normalized)) {
      return failure('Use the configured authentication provider to sign in', {} as User);
    }

    if (!password.trim()) {
      if (env.enableDemoAuth) {
        const demoUser = getDemoUserByEmail(normalized);
        if (demoUser) {
          return success(withSession(demoUser), 'Demo login successful');
        }
      }
      return failure('Password is required', {} as User);
    }

    const user = await prisma.user.findFirst({ where: { email: normalized }, include: { school: true } });
    if (!user) {
      return failure('Invalid credentials', {} as User);
    }
    if (!user.active || (user.school && (user.school.status !== 'Active' || user.school.deletedAt))) return failure('Account unavailable', {} as User);

    try {
      const hash = user.password as string | undefined;
      if (!hash) {
        return failure('Invalid credentials', {} as User);
      }

      let valid = false;
      if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        valid = await bcrypt.compare(password, hash);
      } else if (env.enableDemoAuth) {
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
    const school = await prisma.school.findUnique({ where: { code: schoolCode } });
    if (!school || school.status !== 'Active' || school.deletedAt) {
      return failure('Invalid School Code', {} as User);
    }

    const student = await prisma.student.findFirst({
      where: { accessCode: studentCode, schoolId: school.id },
    });
    if (!student || student.status !== 'Active') {
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
      sessionVersion: student.sessionVersion,
    }));
  },

  // Mint a real, short-lived, attributable session for a school's admin so a
  // SUPER_ADMIN can act inside that school. The returned token carries an
  // `impersonatedBy` claim and the action is written to the audit log — unlike
  // a purely client-side role swap, the backend authorises as the admin.
  impersonateSchoolAdmin: async (
    schoolId: string,
    impersonatorId: string,
    actor?: { role?: UserRole; groupId?: string },
  ): Promise<ApiResponse<User>> => {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, groupId: true, status: true, deletedAt: true },
    });
    if (!school || school.status !== 'Active' || school.deletedAt) return failure('School unavailable', {} as User);

    // A Group Owner may only impersonate within their own group.
    if (actor?.role === UserRole.GROUP_OWNER && school.groupId !== actor.groupId) {
      return failure('This school is not part of your group', {} as User);
    }

    const admin = await prisma.user.findFirst({
      where: { schoolId, role: UserRole.ADMIN, active: true },
      orderBy: { name: 'asc' },
    });
    if (!admin) return failure('No administrator account found for this school', {} as User);

    await appService.writeAuditLog({
      schoolId,
      userId: impersonatorId,
      action: 'IMPERSONATE_SCHOOL',
      entity: 'School',
      entityId: schoolId,
      metadata: { impersonatedUserId: admin.id, impersonatedUserName: admin.name },
    });

    const mapped = mapUserModel(admin);
    const impersonator = await prisma.user.findUnique({ where: { id: impersonatorId }, select: { sessionVersion: true, active: true } });
    if (!impersonator?.active) return failure('Impersonator is unavailable', {} as User);
    return success(
      { ...mapped, authToken: createImpersonationToken(mapped, impersonatorId, impersonator.sessionVersion) },
      'Impersonation session started',
    );
  },

  // ── School Groups (multi-branch owners) ───────────────────────────────────

  // Creator registers a school group and its owner login in one step.
  createGroupOwner: async (payload: { groupName: string; ownerName: string; ownerEmail: string; schoolIds?: string[] }, actorUserId?: string): Promise<ApiResponse<GroupOwnerResult>> => {
    const email = payload.ownerEmail.trim().toLowerCase();
    if (!payload.groupName.trim() || !payload.ownerName.trim() || !email) return failure('Group, owner and email are required', {} as GroupOwnerResult);
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return failure('An account with this email already exists', {} as GroupOwnerResult);
    const linkedSchoolIds = [...new Set((payload.schoolIds ?? []).filter(Boolean))];
    if (linkedSchoolIds.length && await prisma.school.count({ where: { id: { in: linkedSchoolIds }, deletedAt: null } }) !== linkedSchoolIds.length) return failure('One or more schools are unavailable', {} as GroupOwnerResult);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const { group, owner, credentials } = await withProvisionedIdentity(email, temporaryPassword, async identity => {
      const records = await prisma.$transaction(async tx => {
        const group = await tx.schoolGroup.create({ data: { name: payload.groupName.trim() } });
        const owner = await tx.user.create({ data: { name: payload.ownerName.trim(), email, password: passwordHash,
          role: UserRole.GROUP_OWNER, groupId: group.id, supabaseUserId: identity.providerId, avatar: avatarFromName(payload.ownerName.trim()) } });
        await tx.schoolGroup.update({ where: { id: group.id }, data: { ownerId: owner.id } });
        if (linkedSchoolIds.length) await tx.school.updateMany({ where: { id: { in: linkedSchoolIds } }, data: { groupId: group.id } });
        return { group, owner };
      });
      return { ...records, credentials: identity };
    });
    await appService.writeAuditLog({ userId: actorUserId, action: 'CREATE_GROUP_OWNER', entity: 'SchoolGroup', entityId: group.id,
      metadata: { groupName: group.name, ownerEmail: email, linkedSchoolIds } });
    return success({ userId: owner.id, groupId: group.id, groupName: group.name, ownerEmail: email,
      tempPassword: credentials.temporaryPassword ?? '', linkedSchoolIds }, credentials.existingProviderAccount
      ? 'Account linked; use the existing provider password or email recovery' : 'Group owner created; share the temporary password securely');
  },

  // List all school groups with their branch counts (Creator view).
  getGroups: async (): Promise<ApiResponse<Array<{ id: string; name: string; ownerId?: string; schoolCount: number }>>> => {
    const groups = await prisma.schoolGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { schools: true } } },
    });
    return success(groups.map((g) => ({
      id: g.id, name: g.name, ownerId: g.ownerId ?? undefined, schoolCount: g._count?.schools ?? 0,
    })));
  },

  // The signed-in Group Owner's own group (for their portfolio header).
  getMyGroup: async (groupId?: string): Promise<ApiResponse<{ id: string; name: string } | null>> => {
    if (!groupId) return success(null);
    const g = await prisma.schoolGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    return success(g ?? null);
  },

  // Assign (or clear) the group a school belongs to.
  assignSchoolToGroup: async (
    schoolId: string,
    groupId: string | null,
    actorUserId?: string,
  ): Promise<ApiResponse<boolean>> => {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } });
    if (!school) return failure('School not found', false as unknown as boolean);

    if (groupId) {
      const group = await prisma.schoolGroup.findUnique({ where: { id: groupId }, select: { id: true } });
      if (!group) return failure('Group not found', false as unknown as boolean);
    }

    await prisma.school.update({ where: { id: schoolId }, data: { groupId } });

    await appService.writeAuditLog({
      schoolId,
      userId: actorUserId,
      action: groupId ? 'ASSIGN_SCHOOL_GROUP' : 'UNASSIGN_SCHOOL_GROUP',
      entity: 'School',
      entityId: schoolId,
      metadata: { schoolName: school.name, groupId },
    });

    return success(true, 'School group updated');
  },

  updateUserProfile: async (userId: string, updates: Partial<User>, actorSchoolId?: string): Promise<ApiResponse<User>> => {

    if (actorSchoolId) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
      if (!target) return failure('User not found', {} as User);
      if (target.schoolId !== actorSchoolId) {
        return failure('Cannot update a user from another school', {} as User);
      }
    }

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

  changePassword: async (userId: string, currentPassword: string, newPassword: string): Promise<ApiResponse<boolean>> => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true } });
    if (!user) return failure('User not found', false as unknown as boolean);
    if (!user.password) return failure('Password authentication not available for this account. Use your Supabase account settings to change your password.', false as unknown as boolean);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return failure('Current password is incorrect', false as unknown as boolean);
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hash, sessionVersion: { increment: 1 } } });
    await updateProviderAccount(user.supabaseUserId, { password: newPassword, app_metadata: { sessionVersion: user.sessionVersion + 1 } });
    return success(true, 'Password changed successfully');
  },

  getSchools: async (groupId?: string): Promise<ApiResponse<School[]>> => {
    // Exclude soft-deleted schools (deletedAt set). When groupId is provided
    // (a Group Owner), restrict to that group's branches.
    const schools = await prisma.school.findMany({
      where: { deletedAt: null, ...(groupId ? { groupId } : {}) },
      orderBy: { name: 'asc' },
    });
    return success(schools.map(mapSchoolModel));
  },

  createSchool: async (
    school: Partial<School> & { adminEmail?: string },
    actorUserId?: string,
  ): Promise<ApiResponse<School & { tempAdminPassword?: string; adminEmail?: string }>> => {
    // ── Generate a unique readable school code ────────────────────────────
    const resolveCode = async (requested?: string): Promise<string> => {
      if (requested?.trim()) {
        const conflict = await prisma.school.findUnique({ where: { code: requested.trim().toUpperCase() } });
        if (conflict) throw new Error(`School code "${requested.trim().toUpperCase()}" is already taken`);
        return requested.trim().toUpperCase();
      }
      const initials = (school.name || 'SCH')
        .split(/\s+/).filter(Boolean)
        .map((w: string) => w[0].toUpperCase()).slice(0, 4).join('');
      const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let i = 0; i < 20; i++) {
        const suffix = Array.from(crypto.randomBytes(4), b => CHARSET[b % CHARSET.length]).join('');
        const candidate = `${initials}-${suffix}`;
        const conflict = await prisma.school.findUnique({ where: { code: candidate } });
        if (!conflict) return candidate;
      }
      throw new Error('Could not generate a unique school code — please supply one manually');
    };

    const code = await resolveCode(school.code);

    const adminEmail = school.adminEmail?.trim().toLowerCase();
    if (adminEmail && await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } })) return failure('An account with this email already exists', {} as School);
    const generatedPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    const persistSchool = async (identity: { providerId?: string; temporaryPassword?: string }) => prisma.$transaction(async tx => {
      const newSchool = await tx.school.create({ data: { name: school.name || 'New School', code,
        region: school.region || '', adminName: school.adminName || '', status: 'Active', studentCount: 0,
        motto: '', logoUrl: '', address: '', contact: '' } });
      if (adminEmail) await tx.user.create({ data: { name: school.adminName?.trim() || 'School Admin', email: adminEmail,
        password: passwordHash, role: UserRole.ADMIN, schoolId: newSchool.id, supabaseUserId: identity.providerId,
        avatar: avatarFromName(school.adminName?.trim() || 'School Admin') } });
      return { newSchool, tempAdminPassword: identity.temporaryPassword };
    });
    const { newSchool, tempAdminPassword } = adminEmail
      ? await withProvisionedIdentity(adminEmail, generatedPassword, persistSchool) : await persistSchool({});

    await appService.writeAuditLog({
      schoolId: newSchool.id,
      userId: actorUserId,
      action: 'CREATE_SCHOOL',
      entity: 'School',
      entityId: newSchool.id,
      metadata: { name: newSchool.name, code, adminEmail: school.adminEmail ?? null },
    });

    const result: School & { tempAdminPassword?: string; adminEmail?: string } = {
      ...mapSchoolModel(newSchool),
      ...(tempAdminPassword ? { tempAdminPassword, adminEmail: school.adminEmail } : {}),
    };
    return success(result, 'School created successfully');
  },

  getSchoolClasses: async (schoolId: string): Promise<ApiResponse<SchoolClassItem[]>> => {
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return success(classes);
  },

  addSchoolClass: async (schoolId: string, className: string): Promise<ApiResponse<boolean>> => {
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

  // Soft-delete: mark the school as deleted rather than physically removing it
  // (and cascading every student/teacher/record). Soft-deleted schools are
  // hidden from getSchools. Requires the `deletedAt` column migration.
  deleteSchool: async (id: string, actorUserId?: string): Promise<ApiResponse<boolean>> => {
    try {
      const existing = await prisma.school.findUnique({
        where: { id },
        select: { id: true, name: true, code: true },
      });
      if (!existing) return failure('School not found', false as unknown as boolean);

      await prisma.school.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'Inactive' },
      });

      await appService.writeAuditLog({
        schoolId: id,
        userId: actorUserId,
        action: 'DELETE_SCHOOL',
        entity: 'School',
        entityId: id,
        metadata: { name: existing.name, code: existing.code, soft: true },
      });

      return success(true, 'School deleted successfully');
    } catch (error) {
      return failure('Unable to delete school', false as unknown as boolean);
    }
  },

  updateSchoolStatus: async (
    id: string,
    status: 'Active' | 'Inactive',
    actorUserId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await prisma.school.update({
      where: { id },
      data: { status },
    });

    await appService.writeAuditLog({
      schoolId: id,
      userId: actorUserId,
      action: 'UPDATE_SCHOOL_STATUS',
      entity: 'School',
      entityId: id,
      metadata: { status },
    });

    return success(true);
  },

  updateSchoolBranding: async (
    id: string,
    updates: Partial<School>,
    schoolId?: string,
  ): Promise<ApiResponse<School>> => {
    if (schoolId && id !== schoolId) {
      return failure('Cannot update another school', {} as School);
    }
    const exists = await prisma.school.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return failure('School not found', {} as School);

    const updated = await prisma.school.update({
      where: { id },
      data: {
        ...(updates.gradingSystem !== undefined ? { gradingSystem: updates.gradingSystem } : {}),
        ...(updates.themeColor !== undefined ? { themeColor: updates.themeColor } : {}),
        ...(updates.principalName !== undefined ? { principalName: updates.principalName } : {}),
        ...(updates.principalSignatureUrl !== undefined ? { principalSignatureUrl: updates.principalSignatureUrl } : {}),
        ...(updates.schoolStampUrl !== undefined ? { schoolStampUrl: updates.schoolStampUrl } : {}),
        ...(updates.motto !== undefined ? { motto: updates.motto } : {}),
        ...(updates.logoUrl !== undefined ? { logoUrl: updates.logoUrl } : {}),
        ...(updates.address !== undefined ? { address: updates.address } : {}),
        ...(updates.contact !== undefined ? { contact: updates.contact } : {}),
        ...(updates.adminName !== undefined ? { adminName: updates.adminName } : {}),
      },
    });
    return success(mapSchoolModel(updated), 'School updated successfully');
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    const [users, students] = await Promise.all([
      prisma.user.findMany({ take: 2000, orderBy: { name: 'asc' } }),
      prisma.student.findMany({ take: 2000, orderBy: { name: 'asc' } }),
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

  getUsersBySchoolId: async (schoolId: string): Promise<ApiResponse<User[]>> => {
    const [users, students] = await Promise.all([
      prisma.user.findMany({ where: { schoolId }, take: 2000, orderBy: { name: 'asc' } }),
      prisma.student.findMany({ where: { schoolId }, take: 2000, orderBy: { name: 'asc' } }),
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

  // Server-side searchable, paginated user listing. Replaces shipping the
  // entire (capped) user+student set to the browser and filtering client-side.
  // `schoolId` scopes to one school (for ADMINs); omit for SUPER_ADMIN.
  listUsers: async (params: {
    schoolId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<{ users: User[]; total: number; page: number; pageSize: number }>> => {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const term = (params.search ?? '').trim();
    const upperBound = page * pageSize;

    const userWhere: Prisma.UserWhereInput = {
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const studentWhere: Prisma.StudentWhereInput = {
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
      ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}),
    };

    const [users, students, userCount, studentCount] = await Promise.all([
      prisma.user.findMany({ where: userWhere, orderBy: { name: 'asc' }, take: upperBound }),
      prisma.student.findMany({ where: studentWhere, orderBy: { name: 'asc' }, take: upperBound }),
      prisma.user.count({ where: userWhere }),
      prisma.student.count({ where: studentWhere }),
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

    const merged = [...users.map(mapUserModel), ...studentAsUsers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice((page - 1) * pageSize, upperBound);

    return success({ users: merged, total: userCount + studentCount, page, pageSize });
  },

  createUserForSchool: async (payload: Partial<User>, schoolId?: string, actorUserId?: string): Promise<ApiResponse<User>> => {
    if (!payload.name?.trim() || !payload.email?.trim()) return failure('Name and email are required', {} as User);
    const role = payload.role ?? UserRole.TEACHER;
    if (![UserRole.ADMIN, UserRole.TEACHER].includes(role)) return failure('Invalid role for school user', {} as User);
    const targetSchoolId = schoolId ?? payload.schoolId;
    if (!targetSchoolId || !await prisma.school.findFirst({ where: { id: targetSchoolId, status: 'Active', deletedAt: null }, select: { id: true } })) return failure('School unavailable', {} as User);
    const email = payload.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return failure('An account with this email already exists', {} as User);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const { createdUser, credentials } = await withProvisionedIdentity(email, temporaryPassword, async identity => ({
      createdUser: await prisma.user.create({ data: { name: payload.name!.trim(), email, password: passwordHash, role,
        schoolId: targetSchoolId, gender: payload.gender, phone: payload.phone?.trim() || undefined, bio: payload.bio?.trim() || undefined,
        avatar: payload.avatar || avatarFromName(payload.name!.trim()), supabaseUserId: identity.providerId } }),
      credentials: identity,
    }));
    await appService.writeAuditLog({ schoolId: targetSchoolId, userId: actorUserId, action: 'CREATE_USER', entity: 'User', entityId: createdUser.id,
      metadata: { name: createdUser.name, role: createdUser.role, email: createdUser.email } });
    return success({ ...mapUserModel(createdUser), temporaryPassword: credentials.temporaryPassword, existingProviderAccount: credentials.existingProviderAccount },
      credentials.existingProviderAccount ? 'Account linked; use the existing password or email recovery' : 'Account created; share the temporary password securely');
  },

  updateUserForSchool: async (
    userId: string,
    updates: Partial<User>,
    schoolId?: string,
  ): Promise<ApiResponse<User>> => {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, role: true, email: true, supabaseUserId: true, active: true, sessionVersion: true },
    });

    if (!existingUser) {
      return failure('User not found', {} as User);
    }

    if (schoolId && existingUser.schoolId !== schoolId) {
      return failure('Cannot update a user from another school', {} as User);
    }

    if (![UserRole.ADMIN, UserRole.TEACHER].includes(existingUser.role as UserRole)) {
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
        ...(updates.active !== undefined ? { active: updates.active } : {}),
        ...((updates.role !== undefined || updates.email !== undefined || updates.active !== undefined) ? { sessionVersion: { increment: 1 } } : {}),
        ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone?.trim() || null } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio?.trim() || null } : {}),
        ...(updates.avatar !== undefined ? { avatar: updates.avatar || null } : {}),
      },
    });

    if (updates.role !== undefined || updates.email !== undefined || updates.active !== undefined) await updateProviderAccount(existingUser.supabaseUserId,
      { ...(updates.email ? { email: updates.email.toLowerCase() } : {}), app_metadata: { sessionVersion: updatedUser.sessionVersion } });
    return success(mapUserModel(updatedUser), 'Teacher updated successfully');
  },

  deleteUserForSchool: async (
    userId: string,
    schoolId?: string,
    actorUserId?: string,
  ): Promise<ApiResponse<boolean>> => {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true, schoolId: true },
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

    await appService.writeAuditLog({
      schoolId: existingUser.schoolId ?? schoolId,
      userId: actorUserId,
      action: 'DELETE_USER',
      entity: 'User',
      entityId: userId,
      metadata: { name: existingUser.name, role: existingUser.role, email: existingUser.email },
    });

    return success(true, 'Teacher deleted successfully');
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    const students = await prisma.student.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
      take: 5000,
    });
    return success(students.map(mapStudentModel));
  },

  getStudentById: async (studentId: string, schoolId?: string): Promise<ApiResponse<Student>> => {
    const where = schoolId ? { id: studentId, schoolId } : { id: studentId };
    const student = await prisma.student.findFirst({ where });
    return student
      ? success(mapStudentModel(student))
      : failure('Student not found', {} as Student);
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    try {
      const { avatar, enrollmentDate, email, ...rest } = updates;
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: {
          ...rest,
          ...(email !== undefined ? { email: email.trim().toLowerCase() || null } : {}),
          ...(enrollmentDate ? { enrollmentDate: toDateOnly(enrollmentDate) } : {}),
          ...(avatar !== undefined ? { avatar: avatar?.trim() || '' } : {}),
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

  // Bulk-create students from a parsed CSV. Auto-creates any missing class by
  // name, then reuses createStudent per row (access code, fee ledger, audit).
  bulkCreateStudents: async (
    schoolId: string,
    rows: Array<{ name: string; gender?: string; className?: string; field?: string }>,
    actorUserId?: string,
  ): Promise<ApiResponse<{ created: number; total: number; errors: Array<{ row: number; reason: string }> }>> => {
    const classCache = new Map<string, string>();
    const errors: Array<{ row: number; reason: string }> = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const name = (r.name || '').trim();
        if (!name) { errors.push({ row: i + 1, reason: 'Missing name' }); continue; }
        const g = (r.gender || '').trim();
        const gender = /^f/i.test(g) ? 'Female' : /^m/i.test(g) ? 'Male' : '';
        if (!gender) { errors.push({ row: i + 1, reason: 'Gender must be Male or Female' }); continue; }

        let schoolClassId: string | undefined;
        const cname = (r.className || '').trim();
        if (cname) {
          if (classCache.has(cname)) {
            schoolClassId = classCache.get(cname);
          } else {
            let cls = await prisma.schoolClass.findFirst({ where: { schoolId, name: cname }, select: { id: true } });
            if (!cls) cls = await prisma.schoolClass.create({ data: { schoolId, name: cname } });
            classCache.set(cname, cls.id);
            schoolClassId = cls.id;
          }
        }

        const res = await appService.createStudent(
          { name, gender, grade: cname || 'Unassigned', schoolClassId, field: (r.field || 'general').trim() || 'general' },
          schoolId,
          actorUserId,
        );
        if (res.ok) created++;
        else errors.push({ row: i + 1, reason: res.message || 'Failed to create' });
      } catch (e: any) {
        errors.push({ row: i + 1, reason: e?.message || 'Error' });
      }
    }

    await appService.writeAuditLog({
      schoolId, userId: actorUserId,
      action: 'BULK_IMPORT_STUDENTS', entity: 'Student',
      metadata: { created, total: rows.length, failed: errors.length },
    });

    return success({ created, total: rows.length, errors }, `Imported ${created} of ${rows.length} students.`);
  },

  createStudent: async (
    data: {
      name: string;
      email?: string;
      avatar?: string;
      gender: string;
      grade: string;
      status?: Student['status'];
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
    actorUserId?: string,
  ): Promise<ApiResponse<Student>> => {

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

    const [created] = await prisma.$transaction([
      prisma.student.create({
        data: {
          name: data.name.trim(),
          email: data.email?.trim().toLowerCase() || null,
          gender: data.gender,
          grade: data.grade,
          enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : new Date(),
          status: data.status ?? 'Active',
          gpa: data.gpa ?? 0,
          attendance: data.attendance ?? 0,
          accessCode,
          avatar: data.avatar?.trim() || '',
          schoolId: targetSchoolId,
          schoolClassId: data.schoolClassId ?? null,
          field: data.field ?? 'general',
          enrolledSubjects: data.enrolledSubjects ?? [],
        },
      }),
      prisma.school.update({
        where: { id: targetSchoolId },
        data: { studentCount: { increment: 1 } },
      }),
    ]);

    // Auto-generate fee ledger if a current-term template exists for this school
    const currentTerm = await prisma.schoolTerm.findFirst({
      where: { schoolId: targetSchoolId, isCurrent: true },
    });
    if (currentTerm) {
      const template = await prisma.feeTemplate.findFirst({
        where: { schoolId: targetSchoolId, term: currentTerm.name },
        include: { lines: { orderBy: { order: 'asc' } } },
      });
      if (template && template.lines.length > 0) {
        await prisma.studentFeeLedger.create({
          data: {
            schoolId: targetSchoolId,
            studentId: created.id,
            term: currentTerm.name,
            scopeType: template.scopeType ?? 'school',
            scopeId: template.scopeId ?? targetSchoolId,
            templateId: template.id,
            lineItems: {
              create: template.lines.map((line) => ({
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
      userId: actorUserId,
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
    actorUserId?: string,
  ): Promise<ApiResponse<boolean>> => {

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, grade: true, schoolId: true },
    });
    if (!student) return failure('Student not found', false as unknown as boolean);
    if (schoolId && student.schoolId !== schoolId) {
      return failure('Cannot delete a student from another school', false as unknown as boolean);
    }

    // Delete the student and decrement the school's counter atomically so the
    // cached studentCount can never drift if one operation fails.
    await prisma.$transaction([
      prisma.student.delete({ where: { id: studentId } }),
      prisma.school.update({
        where: { id: student.schoolId },
        data: { studentCount: { decrement: 1 } },
      }),
    ]);

    await appService.writeAuditLog({
      schoolId: student.schoolId,
      userId: actorUserId,
      action: 'DELETE_STUDENT',
      entity: 'Student',
      entityId: studentId,
      metadata: { name: student.name, grade: student.grade },
    });

    return success(true, 'Student deleted successfully');
  },

  getSubjects: async (schoolId?: string): Promise<ApiResponse<Subject[]>> => {
    const subjects = await prisma.subject.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
    });
    return success(subjects.map(mapSubjectModel));
  },

  createSubject: async (subjectData: { name: string; teacherId?: string; schoolId?: string }): Promise<ApiResponse<Subject>> => {
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
    const schemes = await prisma.schemeSubmission.findMany({
      where: schoolId ? { subject: { schoolId } } : undefined,
      orderBy: { uploadDate: 'desc' },
      include: { subject: true },
      take: 500,
    });
    return success(schemes.map(mapSchemeModel));
  },

  uploadScheme: async (
    fileName: string,
    metadata: Record<string, unknown>,
    schoolId: string,
  ): Promise<ApiResponse<{ id: string }>> => {
    const subjectKey = typeof metadata.subject === 'string' ? metadata.subject : '';
    const subject = await prisma.subject.findFirst({ where: { schoolId, OR: [{ id: subjectKey }, { name: subjectKey }] } });
    if (!subject) return failure('Subject not found in your school', { id: '' });
    const storedFileName = typeof metadata.fileUrl === 'string' ? metadata.fileUrl : '';
    if (!/^https?:\/\//i.test(storedFileName)) return failure('Upload a file to storage before submitting', { id: '' });
    const scheme = await prisma.schemeSubmission.create({
      data: {
        subjectId: subject.id,
        subjectName: subject.name,
        term: (metadata.term as string) || 'Term 1',
        status: 'Pending',
        fileName: storedFileName,
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
    classId?: string,    // SchoolClass.id selected by the teacher on the frontend
  ): Promise<ApiResponse<Assessment[]>> => {

    let enrolledSubjects: string[] = [];

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return failure('Student not found', [] as unknown as Assessment[]);
      }
      enrolledSubjects = student.enrolledSubjects ?? [];

      if (subjectId && enrolledSubjects.length && !enrolledSubjects.includes(subjectId)) {
        return success([], 'Student not enrolled in subject');
      }
    }

    // Build the permitted student ID set as a UNION of all roles the teacher holds.
    // A teacher may simultaneously be a form master (sees every subject for their class)
    // AND a subject teacher (sees their specific subject in potentially different classes).
    // Both access paths must co-exist without one overriding the other.
    let allowedStudentIds: string[] | undefined;

    if (teacherId) {
      const permitted = new Set<string>();

      // ── Path A: Form master access ──────────────────────────────────────────
      // Form masters see ALL subjects for every student in their assigned grade.
      const masterEntry = await prisma.classMaster.findFirst({
        where: { teacherId, ...(schoolId ? { schoolId } : {}) },
      });

      if (masterEntry) {
        // Build a class-scoped filter: if the teacher selected a class that matches
        // their form-master grade, include those students.
        const formClassRecord = await prisma.schoolClass.findFirst({
          where: {
            name: masterEntry.grade,
            ...(schoolId ? { schoolId } : {}),
          },
          select: { id: true },
        });

        // Include students if: no class filter selected, OR the selected class IS their form class
        const formClassId = formClassRecord?.id;
        if (!classId || classId === formClassId) {
          const query: any = { ...(schoolId ? { schoolId } : {}) };
          if (classId && formClassId) {
            query.schoolClassId = formClassId;
          } else {
            query.grade = masterEntry.grade;
          }
          const gradeStudents = await prisma.student.findMany({
            where: query,
            select: { id: true },
          });
          gradeStudents.forEach((s: { id: string }) => permitted.add(s.id));
        }
      }

      // ── Path B: Subject teacher access ──────────────────────────────────────
      // Subject teachers see their specific subject's students in their assigned class(es).
      if (subjectId) {
        // Find ALL classes this teacher is assigned to teach this subject in.
        const assignments = await prisma.teacherAssignment.findMany({
          where: {
            teacherId,
            subjectId,
            // If a class was selected, only look at assignments for that class.
            ...(classId ? { schoolClassId: classId } : {}),
          },
          select: { schoolClassId: true },
        });

        for (const assignment of assignments) {
          const classStudents = await prisma.student.findMany({
            where: {
              schoolClassId: assignment.schoolClassId,
              ...(schoolId ? { schoolId } : {}),
            },
            select: { id: true, enrolledSubjects: true },
          });
          classStudents
            .filter((s) => !(s.enrolledSubjects as string[])?.length || (s.enrolledSubjects as string[]).includes(subjectId))
            .forEach((s) => permitted.add(s.id));
        }
      }

      // ── No access ────────────────────────────────────────────────────────────
      if (permitted.size === 0) {
        // If neither role grants access, return empty (not an error — just nothing to show)
        return success([], 'No accessible students for the selected class/subject');
      }

      allowedStudentIds = [...permitted];
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
    teacherId?: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {

    // School membership check
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

    // Authorise each student/subject pair, including its class and form-master grade.
    if (teacherId) {
      const students = await prisma.student.findMany({
        where: { id: { in: [...new Set(assessments.map(a => a.studentId))] } },
        select: { id: true, schoolId: true, grade: true, schoolClassId: true },
      });
      const masters = await prisma.classMaster.findMany({
        where: { teacherId, ...(schoolId ? { schoolId } : {}) },
        select: { grade: true, schoolId: true },
      });
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId, ...(schoolId ? { schoolClass: { schoolId } } : {}) },
        select: { subjectId: true, schoolClassId: true },
      });
      for (const assessment of assessments) {
        const student = students.find(s => s.id === assessment.studentId);
        const allowed = student && (
          masters.some(m => m.schoolId === student.schoolId && m.grade === student.grade) ||
          assignments.some(a => a.subjectId === assessment.subjectId && a.schoolClassId === student.schoolClassId)
        );
        if (!allowed) return failure('Not authorised to save assessments for this student and subject', { success: false });
      }
    }

    // A supplied ID must not retarget another student's existing assessment.
    const existing = await prisma.assessment.findMany({
      where: { id: { in: assessments.flatMap(a => a.id ? [a.id] : []) } },
      select: { id: true, studentId: true, subjectId: true, term: true },
    });
    if (existing.some(row => assessments.some(a => a.id === row.id &&
      (a.studentId !== row.studentId || a.subjectId !== row.subjectId || a.term !== row.term)))) {
      return failure('Cannot change assessment ownership', { success: false });
    }
    const subjectIdsToCheck = [...new Set(assessments.map(a => a.subjectId))];
    if (schoolId && await prisma.subject.count({ where: { id: { in: subjectIdsToCheck }, schoolId } }) !== subjectIdsToCheck.length) {
      return failure('Cannot save assessments for subjects outside your school', { success: false });
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

  // Assemble everything needed for a full Nigerian report card: results, term
  // summary, class position, attendance, school branding, and affective /
  // psychomotor domains.
  getReportCard: async (studentId: string, term?: string): Promise<ApiResponse<any>> => {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return failure('Student not found', null);
    const school = await prisma.school.findUnique({ where: { id: student.schoolId } });

    let useTerm = term;
    if (!useTerm) {
      const ct = await prisma.schoolTerm.findFirst({ where: { schoolId: student.schoolId, isCurrent: true } });
      useTerm = ct?.name ?? student.resultPinTerm ?? 'current';
    }

    const results = await prisma.result.findMany({
      where: { studentId, term: useTerm },
      orderBy: { subjectName: 'asc' },
    });
    const totalObtained = results.reduce((s, r) => s + (r.average || 0), 0);
    const average = results.length ? Math.round((totalObtained / results.length) * 100) / 100 : 0;

    // Class position: rank classmates by their term average.
    let position = 0, classSize = 0;
    if (student.schoolClassId) {
      const classmates = await prisma.student.findMany({ where: { schoolClassId: student.schoolClassId }, select: { id: true } });
      classSize = classmates.length;
      const ids = classmates.map((c) => c.id);
      const allResults = await prisma.result.findMany({ where: { studentId: { in: ids }, term: useTerm }, select: { studentId: true, average: true } });
      const byStudent = new Map<string, { sum: number; n: number }>();
      for (const r of allResults) {
        const e = byStudent.get(r.studentId) || { sum: 0, n: 0 };
        e.sum += r.average || 0; e.n++; byStudent.set(r.studentId, e);
      }
      const ranked = ids
        .map((id) => { const e = byStudent.get(id); return { id, avg: e && e.n ? e.sum / e.n : 0 }; })
        .sort((a, b) => b.avg - a.avg);
      position = ranked.findIndex((r) => r.id === studentId) + 1;
    }

    const att = student.attendance ?? 0;
    const punctuality = att >= 95 ? 5 : att >= 85 ? 4 : att >= 70 ? 3 : 2;
    const affective = [
      { trait: 'Punctuality', rating: punctuality },
      { trait: 'Attentiveness', rating: 4 },
      { trait: 'Politeness', rating: 4 },
      { trait: 'Neatness', rating: 4 },
      { trait: 'Honesty', rating: 5 },
      { trait: 'Cooperation', rating: 4 },
    ];
    const psychomotor = [
      { trait: 'Handwriting', rating: 4 },
      { trait: 'Sports', rating: 4 },
      { trait: 'Drawing / Art', rating: 3 },
      { trait: 'Music', rating: 3 },
      { trait: 'Handling Tools', rating: 4 },
    ];

    const className = student.schoolClassId
      ? (await prisma.schoolClass.findUnique({ where: { id: student.schoolClassId }, select: { name: true } }))?.name
      : student.grade;

    // Rule-based principal's comment (used as-is, or as a fallback for the AI one).
    const ord = (n: number) => { if (!n) return ''; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
    const perf = average >= 75 ? 'an outstanding' : average >= 65 ? 'a very good' : average >= 55 ? 'a good' : average >= 45 ? 'a fair' : 'a below-average';
    const comment = `${student.name} produced ${perf} result this term with an average of ${average}%${position && classSize ? `, ranking ${ord(position)} of ${classSize} in class` : ''}. ${average >= 55 ? 'Keep up the good work and aim even higher next term.' : 'More consistent effort and focused study will lift these results; the school is here to support you.'}`;

    return success({
      comment,
      student: {
        id: student.id, name: student.name, gender: student.gender,
        className: className ?? student.grade, attendance: att, accessCode: student.accessCode,
      },
      school: {
        name: school?.name ?? '', motto: school?.motto ?? '', address: school?.address ?? '',
        contact: school?.contact ?? '', logoUrl: school?.logoUrl ?? '',
        principalName: school?.principalName ?? '', principalSignatureUrl: school?.principalSignatureUrl ?? '',
        schoolStampUrl: school?.schoolStampUrl ?? '', themeColor: school?.themeColor ?? '#059669',
      },
      term: useTerm,
      results: results.map((r) => ({
        subjectName: r.subjectName, grade: r.grade, average: r.average, remarks: r.remarks,
        details: r.details ?? null,
      })),
      summary: { subjects: results.length, totalObtained, average, grade: computeGrade(average), position, classSize },
      affective, psychomotor,
    });
  },

  publishResults: async (schoolId: string | undefined, newResults: ResultData[], actorUserId?: string): Promise<ApiResponse<{ success: boolean }>> => {

    const uniqueStudentIds = [...new Set(newResults.map(r => r.studentId))];
    const studentsById = await prisma.student.findMany({
      where: { id: { in: uniqueStudentIds } },
      select: { id: true, schoolId: true },
    }).then(rows => new Map(rows.map(s => [s.id, s])));

    for (const result of newResults) {
      const student = studentsById.get(result.studentId);
      if (!student) {
        return failure('Student not found', { success: false });
      }
      if (schoolId && student.schoolId !== schoolId) {
        return failure('Cannot publish results for students outside your school', { success: false });
      }

      const subjectName = result.subjectName || 'General Studies';
      const term = result.term ?? 'current';
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

    // Notify students and their parents when results are published
    if (schoolId) {
      const publishedStudentIds = [
        ...new Set(
          newResults
            .filter((r) => r.status === 'Published')
            .map((r) => r.studentId),
        ),
      ];

      if (publishedStudentIds.length > 0) {
        // Notify students directly
        await emitSystemNotification({
          title: 'Results Published',
          message: 'Your academic results have been published. Log in and enter your Result Access PIN to view your performance.',
          audience: 'specific_users',
          schoolId,
          userIds: publishedStudentIds,
        });

        // Notify each student's parent(s) individually
        try {
          const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
          for (const studentId of publishedStudentIds) {
            const student = await prisma.student.findUnique({
              where: { id: studentId },
              select: { name: true, resultPin: true, resultPinTerm: true },
            });
            if (!student) continue;

            const parentLinks = await prisma.parentStudent.findMany({
              where: { studentId },
              include: { parent: { select: { id: true } } },
            });
            if (parentLinks.length === 0) continue;

            const termLabel = student.resultPinTerm ?? 'current term';
            const notification = await prisma.notification.create({
              data: {
                title: `Results published — ${student.name}`,
                message: `${student.name}'s academic results for ${termLabel} have been published by ${school?.name ?? 'your school'}. The student can log in and use their Result Access PIN to view their results.`,
                audience: 'specific_users',
                sourceRole: 'ADMIN',
                schoolId,
              },
            });

            const parentTargets = await createNotificationRecipients(notification.id, parentLinks.map(link => link.parent.id), schoolId);
            void emailRecipients(parentLinks.map(link => link.parent.id), notification.title, notification.message, parentTargets).catch(() => console.error('[Email] Result notice failed'));

            // Best-effort SMS/WhatsApp to parents (no-op if messaging unconfigured).
            try {
              await appService.messageStudentParents(
                studentId,
                `${student.name}'s results for ${termLabel} are published at ${school?.name ?? 'your school'}. Use the Result Access PIN to view them. - SmartSchool`,
                'sms',
              );
            } catch { /* best-effort */ }
          }
        } catch (err) {
          console.error('[PublishResults] Parent notification failed:', err);
        }
      }
    }

    // Audit
    if (schoolId) {
      await appService.writeAuditLog({
        schoolId,
        userId: actorUserId,
        action: 'PUBLISH_RESULTS',
        entity: 'Result',
        metadata: { count: newResults.length, published: newResults.filter(r => r.status === 'Published').length },
      });
    }

    return success({ success: true }, 'Results published successfully');
  },

  getExams: async (includeAnswers = false): Promise<ApiResponse<ActiveExam[]>> => {
    const exams = await prisma.exam.findMany({ include: { questions: true } });
    return success(exams.map(e => mapExamModel(e, includeAnswers)));
  },

  getAvailableExams: async (includeAnswers = false): Promise<ApiResponse<ActiveExam[]>> => {
    const exams = await prisma.exam.findMany({
      where: { status: 'active' },
      include: { questions: true },
    });
    return success(exams.map(e => mapExamModel(e, includeAnswers)));
  },

  updateExamQuestions: async (
    questions: ExamQuestionInput[],
    title: string,
    examId?: string,
    teacherId?: string,
    callerSchoolId?: string,
  ): Promise<ApiResponse<ActiveExam>> => {
    if (examId && callerSchoolId) {
      const existing = await prisma.exam.findUnique({
        where: { id: examId },
        include: { teacher: { select: { schoolId: true } } },
      });
      if (!existing) return failure('Exam not found', {} as ActiveExam);
      const examSchoolId = existing.teacher?.schoolId;
      if (examSchoolId && examSchoolId !== callerSchoolId) {
        return failure('Cannot modify an exam belonging to another school', {} as ActiveExam);
      }
    }

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
      return success(mapExamModel(updated, true));
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
    return success(mapExamModel(created, true));
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended', callerSchoolId?: string): Promise<ApiResponse<boolean>> => {
    try {
      if (callerSchoolId) {
        const existing = await prisma.exam.findUnique({
          where: { id },
          include: { teacher: { select: { schoolId: true } } },
        });
        if (!existing) return failure('Exam not found', false as unknown as boolean);
        const examSchoolId = existing.teacher?.schoolId;
        if (examSchoolId && examSchoolId !== callerSchoolId) {
          return failure('Cannot modify an exam belonging to another school', false as unknown as boolean);
        }
      }

      const exam = await prisma.exam.update({
        where: { id },
        data: { status },
        include: { teacher: { select: { schoolId: true } } },
      });

      if (status === 'active') {
        const schoolId = exam.teacher?.schoolId;
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
    const sessions = await prisma.examSession.findMany({ where: { examId } });
    return success(sessions.map(mapExamSessionModel));
  },

  startExamSession: async (examId: string, studentId: string, callerSchoolId?: string): Promise<ApiResponse<ExamSession>> => {
    if (callerSchoolId) {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { teacher: { select: { schoolId: true } } },
      });
      if (!exam) return failure('Exam not found', {} as ExamSession);
      const examSchoolId = exam.teacher?.schoolId;
      if (examSchoolId && examSchoolId !== callerSchoolId) {
        return failure('Exam does not belong to your school', {} as ExamSession);
      }
    }

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
    examId?: string,
  ): Promise<ApiResponse<boolean>> => {
    const exam = examId
      ? await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } })
      : await prisma.exam.findFirst({ where: { status: 'active' }, include: { questions: true } });

    if (!exam) {
      return failure('No active exam found', false as unknown as boolean);
    }

    const questions = exam.questions as Array<{ id: string; correctAnswer: string | null; points: number }>;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints = questions.reduce((sum, q) => {
      const studentAnswer = answers[q.id];
      return sum + (studentAnswer !== undefined && q.correctAnswer !== null &&
        normalizeExamAnswer(studentAnswer) === normalizeExamAnswer(q.correctAnswer) ? q.points : 0);
    }, 0);
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

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
    const where: Prisma.AnnouncementWhereInput = {};

    if (role === UserRole.TEACHER) {
      where.targetAudience = { in: ['all', 'teachers'] };
    } else if (role === UserRole.STUDENT) {
      where.targetAudience = { in: ['all', 'students'] };
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
    const created = await prisma.announcement.create({
      data: { title, message, targetAudience, source },
    });
    return success(mapAnnouncementModel(created), 'Announcement created');
  },

  // ── Calendar Events (per school) ────────────────────────────────────────

  listCalendarEvents: async (schoolId: string): Promise<ApiResponse<CalendarEvent[]>> => {
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

    if (!userId || !role) return success([], 'No user context');

    // Return notifications scoped to this user (read/unread can be derived from NotificationRecipient.readAt)
    const rows = await prisma.notificationRecipient.findMany({
      where: { OR: [{ userId }, { studentId: userId }] },
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
      createdAt: r.notification.createdAt.toISOString?.() || r.notification.createdAt,
      readAt: r.readAt ?? null,
    }));

    return success(mapped, 'Notifications loaded');
  },

  createNotification: async (params: {
    title: string;
    message: string;
    audience: Prisma.NotificationGetPayload<object>['audience'];
    userIds?: string[];
    schoolId?: string;
    classId?: string;
    source: string;
    senderId: string;
    senderRole: UserRole;
  }): Promise<ApiResponse<any>> => {
    const { title, message, audience, schoolId, source, senderId, senderRole } = params;
    let targets;
    try {
      targets = await resolveNotificationAudience({
        ...params,
        classId: params.classId ?? (audience === 'class_students' ? params.userIds?.[0] : undefined),
      });
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Invalid notification recipients', null);
    }
    const created = await prisma.$transaction(async tx => {
      const notification = await tx.notification.create({ data: { title, message, audience, sourceRole: senderRole, schoolId: schoolId ?? null } });
      await saveNotificationRecipients(notification.id, targets, tx);
      return notification;
    });
    // Delivery starts only after authorization and successful recipient persistence.
    void emailRecipients(targets.map(target => target.id), title, message, targets).catch(() => console.error('[Email] Recipient lookup failed'));
    return success({
      id: created.id, title: created.title, message: created.message, audience: created.audience,
      sourceRole: created.sourceRole, schoolId: created.schoolId ?? undefined,
      createdAt: created.createdAt.toISOString(), senderId, source, recipientCount: targets.length,
    }, 'Notification created');
  },

  previewNotificationRecipients: async (params: {
    audience: string;
    schoolId?: string;
    classId?: string;
    senderId: string;
    senderRole: UserRole;
  }): Promise<ApiResponse<{ count: number; breakdown: Record<string, number> }>> => {
    try {
      const targets = await resolveNotificationAudience({ ...params, audience: params.audience as Prisma.NotificationGetPayload<object>['audience'] });
      const users = targets.filter(target => target.kind === 'user').length;
      const students = targets.filter(target => target.kind === 'student').length;
      const breakdown: Record<string, number> = {};
      if (users) breakdown[params.audience === 'admins' ? 'Admins' : params.audience === 'teachers' ? 'Teachers' : 'Staff & Parents'] = users;
      if (students) breakdown[params.audience === 'teacher_students' ? 'My Students' : 'Students'] = students;
      return success({ count: targets.length, breakdown });
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Invalid notification audience', { count: 0, breakdown: {} });
    }
  },

  markNotificationRead: async (notificationId: string, userId: string): Promise<ApiResponse<boolean>> => {
    await prisma.notificationRecipient.updateMany({
      where: { notificationId, OR: [{ userId }, { studentId: userId }] },
      data: { readAt: new Date() },
    });
    return success(true, 'Marked as read');
  },

  // ── Private Conversations (student ↔ teacher) ────────────────────────────

  listConversations: async (userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any[]>> => {
    const where =
      role === UserRole.SUPER_ADMIN
        ? {}
        : role === UserRole.TEACHER
        ? { teacherId: userId, ...(schoolId ? { schoolId } : {}) }
        : role === UserRole.STUDENT
        ? { studentId: userId }
        : role === UserRole.ADMIN && schoolId
        ? { schoolId }
        : { id: 'no-match' };
    const rows = await prisma.privateConversation.findMany({
      where,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Resolve names for display
    const teacherIds = [...new Set(rows.map((r) => r.teacherId))];
    const studentIds = [...new Set(rows.map((r) => r.studentId))];
    const [teacherUsers, studentRecords] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }),
      prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }),
    ]);
    const teacherMap = Object.fromEntries(teacherUsers.map((u) => [u.id, u.name]));
    const studentMap = Object.fromEntries(studentRecords.map((s) => [s.id, s.name]));

    return success(rows.map((r) => ({
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
    actorId?: string;
    actorRole?: UserRole;
  }): Promise<ApiResponse<any>> => {
    const { schoolId, studentId, teacherId, subjectId, actorId, actorRole } = params;

    if (actorRole !== UserRole.SUPER_ADMIN) {
      const [teacher, student] = await Promise.all([
        prisma.user.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } }),
        prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } }),
      ]);
      if (!teacher) return failure('Teacher not found in your school', null);
      if (!student) return failure('Student not found in your school', null);
      if (actorRole === UserRole.TEACHER && actorId !== teacherId) {
        return failure('Teachers can only create conversations for themselves', null);
      }
      if (actorRole === UserRole.STUDENT) {
        if (actorId !== studentId) return failure('Students can only create their own conversations', null);
        const enrolledStudent = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolClassId: true, enrolledSubjects: true } });
        const assignment = enrolledStudent?.schoolClassId && await prisma.teacherAssignment.findFirst({
          where: { teacherId, schoolClassId: enrolledStudent.schoolClassId, ...(subjectId ? { subjectId } : {}) },
        });
        if (!assignment || (subjectId && enrolledStudent!.enrolledSubjects.length && !enrolledStudent!.enrolledSubjects.includes(subjectId))) {
          return failure('Choose a teacher assigned to your class and subject', null);
        }
      }
    }

    const existing = await prisma.privateConversation.findFirst({
      where: { studentId, teacherId, subjectId: subjectId ?? null },
    });
    if (existing) return success({ id: existing.id, schoolId: existing.schoolId, studentId: existing.studentId, teacherId: existing.teacherId, subjectId: existing.subjectId ?? undefined, createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString() });
    const created = await prisma.privateConversation.create({
      data: { schoolId, studentId, teacherId, subjectId: subjectId ?? null },
    });
    return success({ id: created.id, schoolId: created.schoolId, studentId: created.studentId, teacherId: created.teacherId, subjectId: created.subjectId ?? undefined, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() }, 'Conversation started');
  },

  getConversationMessages: async (conversationId: string, requesterId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any[]>> => {
    const conv = await prisma.privateConversation.findUnique({ where: { id: conversationId } });
    if (!conv) return failure('Conversation not found', []);
    const allowed = role === UserRole.SUPER_ADMIN || (role === UserRole.ADMIN && conv.schoolId === schoolId) || conv.studentId === requesterId || conv.teacherId === requesterId;
    if (!allowed) return failure('Access denied', []);
    const messages = await prisma.privateConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return success(messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })));
  },

  sendConversationMessage: async (conversationId: string, senderId: string, _role: UserRole, content: string): Promise<ApiResponse<any>> => {
    if (!content.trim()) return failure('Message cannot be empty', null);
    const conv = await prisma.privateConversation.findUnique({ where: { id: conversationId } });
    if (!conv) return failure('Conversation not found', null);
    const allowed = conv.studentId === senderId || conv.teacherId === senderId;
    if (!allowed) return failure('Access denied', null);
    const msg = await prisma.privateConversationMessage.create({
      data: { conversationId, senderId, content: content.trim() },
    });
    await prisma.privateConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    publishMessageEvent({ type: 'private-message', schoolId: conv.schoolId, userIds: [conv.studentId, conv.teacherId], conversationId });
    return success({ id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId, content: msg.content, createdAt: msg.createdAt.toISOString() }, 'Message sent');
  },

  recordProctorFrame: async (
    examId: string,
    studentId: string,
    frameData: string,
  ): Promise<ApiResponse<{ stored: boolean }>> => {
    console.log('[proctor-frame]', examId, studentId, frameData.slice(0, 64));
    return success({ stored: true });
  },

  getLiveClasses: async (schoolId?: string, userId?: string, role?: UserRole, studentId?: string): Promise<ApiResponse<LiveClass[]>> => {
    if (!role || ![UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT].includes(role)
      || (role !== UserRole.SUPER_ADMIN && !schoolId)) {
      return failure('School context and live-class access are required', []);
    }
    let schoolClassIdFilter: string | undefined;
    if (role === UserRole.STUDENT) {
      if (!studentId || studentId !== userId) return success([]);
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolClassId: true, schoolId: true } });
      if (!student || student.schoolId !== schoolId || !student.schoolClassId) return success([]);
      schoolClassIdFilter = student.schoolClassId;
    }
    if (role === UserRole.TEACHER && !userId) return success([]);

    const classes = await prisma.liveClass.findMany({
      where: {
        ...(schoolId ? { schoolClass: { schoolId } } : {}),
        ...(schoolClassIdFilter ? { schoolClassId: schoolClassIdFilter } : {}),
        ...(role === UserRole.TEACHER ? { teacherId: userId } : {}),
      },
      orderBy: { scheduledTime: 'asc' },
      include: { schoolClass: true },
    });
    return success(classes.map(liveClass => mapLiveClassModel(liveClass,
      role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN
      || (role === UserRole.TEACHER && liveClass.teacherId === userId),
    )));
  },




  createLiveClass: async (
    subjectId: string | undefined,
    teacherId: string | undefined,
    schoolClassId: string,
    scheduledTime: string,
    meetingLink: string,
    actor: { userId: string; role: UserRole; schoolId?: string },
  ): Promise<ApiResponse<LiveClass>> => {
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER].includes(actor.role)) {
      return failure('You cannot schedule a live class', {} as LiveClass);
    }
    const schoolClass = await prisma.schoolClass.findUnique({ where: { id: schoolClassId }, select: { schoolId: true } });
    if (!schoolClass || (actor.role !== UserRole.SUPER_ADMIN && !actor.schoolId)
      || (actor.schoolId && schoolClass.schoolId !== actor.schoolId)) {
      return failure('Class not found in your school', {} as LiveClass);
    }
    const schoolId = schoolClass.schoolId;
    if (subjectId && !await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } })) {
      return failure('Subject not found in your school', {} as LiveClass);
    }
    const resolvedTeacherId = actor.role === UserRole.TEACHER ? actor.userId : teacherId;
    if (resolvedTeacherId && !await prisma.user.findFirst({
      where: { id: resolvedTeacherId, schoolId, role: { in: [UserRole.TEACHER, UserRole.ADMIN] } }, select: { id: true },
    })) {
      return failure('Teacher not found in your school', {} as LiveClass);
    }
    if (actor.role === UserRole.TEACHER && !await prisma.teacherAssignment.findFirst({
      where: { teacherId: actor.userId, schoolClassId, ...(subjectId ? { subjectId } : {}) }, select: { id: true },
    })) {
      return failure('You are not assigned to teach this subject in this class', {} as LiveClass);
    }
    const scheduledDate = new Date(scheduledTime);
    if (!Number.isFinite(scheduledDate.getTime())) return failure('Invalid scheduled time', {} as LiveClass);

    let resolvedLink = meetingLink?.trim() || '';
    let hostLink: string | undefined;
    let provider: 'whereby' | 'jitsi' | 'external' = 'jitsi';

    if (!resolvedLink) {
      const wherebyKey = env.wherebyApiKey;

      if (wherebyKey) {
        // ── Whereby: create a room via their REST API ──────────────────────
        // Whereby docs: https://docs.whereby.com/reference/whereby-rest-api-reference
        try {
          const endDate = new Date(scheduledTime);
          endDate.setHours(endDate.getHours() + 3); // 3-hour window

          const resp = await fetch('https://api.whereby.dev/v1/meetings', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${wherebyKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              endDate: endDate.toISOString(),
              fields: ['hostRoomUrl'],
            }),
          });

          if (resp.ok) {
            const data = await resp.json() as { roomUrl: string; hostRoomUrl: string };
            resolvedLink = data.roomUrl;
            hostLink = data.hostRoomUrl;
            provider = 'whereby';
          } else {
            console.warn('[LiveClass] Whereby API error:', resp.status, await resp.text());
          }
        } catch (err) {
          console.warn('[LiveClass] Whereby fetch failed, falling back to Jitsi:', err);
        }
      }

      // ── Jitsi fallback: zero-config, no API key needed ───────────────────
      if (!resolvedLink) {
        const slug = `xmartschool-${schoolClassId.slice(-8)}-${Date.now().toString(36)}`;
        resolvedLink = `https://meet.jit.si/${slug}`;
        provider = 'jitsi';
      }
    } else {
      const linkUrl = new URL(resolvedLink);
      if (linkUrl.hostname === 'whereby.com' || linkUrl.hostname.endsWith('.whereby.com')) {
        provider = 'whereby';
        if (linkUrl.searchParams.has('roomKey')) {
          hostLink = resolvedLink;
          linkUrl.searchParams.delete('roomKey');
          resolvedLink = linkUrl.toString();
        }
      } else if (linkUrl.hostname === 'meet.jit.si') provider = 'jitsi';
      else provider = 'external';
    }

    const created = await prisma.liveClass.create({
      data: {
        subjectId: subjectId || undefined,
        teacherId: resolvedTeacherId || undefined,
        schoolClassId,
        scheduledTime: scheduledDate,
        meetingLink: resolvedLink,
        hostMeetingLink: hostLink || null,
        videoProvider: provider,
      },
    });
    return success(mapLiveClassModel(created, actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN
      || (actor.role === UserRole.TEACHER && created.teacherId === actor.userId)), 'Live class scheduled');
  },


  getClassMasters: async (schoolId: string): Promise<ApiResponse<Record<string, string>>> => {
    const masters = await prisma.classMaster.findMany({ where: { schoolId } });
    const store = masters.reduce<Record<string, string>>((acc, item) => {
      acc[item.grade] = item.teacherId;
      return acc;
    }, {} as Record<string, string>);
    return success(store);
  },

  assignClassMaster: async (grade: string, teacherId: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId, role: { in: ['TEACHER', 'ADMIN'] } }, select: { id: true } });
    if (!teacher) return failure('Teacher not found in your school', false);
    await prisma.classMaster.upsert({
      where: { schoolId_grade: { schoolId, grade } },
      update: { teacherId },
      create: { grade, teacherId, schoolId },
    });
    return success(true);
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    try {
      await prisma.examSession.delete({
        where: { examId_studentId: { examId, studentId } },
      });
      return success(true);
    } catch (error) {
      return failure('Session not found', false as unknown as boolean);
    }
  },

  joinLiveClass: async (liveClassId: string, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
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

  leaveLiveClass: async (liveClassId: string, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<boolean>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
    if (denied) return { ...denied, data: false };
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
    schoolId?: string,
  ): Promise<ApiResponse<any>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
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

  raiseHand: async (liveClassId: string, userId: string, role: UserRole, raised: boolean, schoolId?: string): Promise<ApiResponse<any>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
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

  sendLiveClassMessage: async (liveClassId: string, userId: string, role: UserRole, message: string, schoolId?: string): Promise<ApiResponse<any>> => {
    if (!message.trim()) {
      return failure('Message cannot be empty', null);
    }
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
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

  getLiveClassMessages: async (liveClassId: string, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any[]>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
    if (denied) return { ...denied, data: [] };
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

  getLiveClassParticipants: async (liveClassId: string, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any[]>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId);
    if (denied) return { ...denied, data: [] };
    try {
      const participants = await prisma.liveClassParticipant.findMany({
        where: { liveClassId, leftAt: null },
      });
      return success(participants);
    } catch (error) {
      return failure('Failed to fetch participants', []);
    }
  },

  startLiveClassRecording: async (liveClassId: string, recordingUrl: string, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId, true);
    if (denied) return denied;
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

  stopLiveClassRecording: async (liveClassId: string, duration: number, userId: string, role: UserRole, schoolId?: string): Promise<ApiResponse<any>> => {
    const denied = await checkLiveClassAccess(liveClassId, userId, role, schoolId, true);
    if (denied) return denied;
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
    const messages = await prisma.staffMessage.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Batch-resolve sender names + avatars
    const senderIds = [...new Set(messages.map((m: PrismaStaffMessageModel) => m.userId))];
    const senders = senderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, avatar: true, role: true },
        })
      : [];
    const senderMap = Object.fromEntries(senders.map((u: { id: string; name: string; avatar: string | null; role: string }) => [u.id, u]));

    return success(messages.map((m: PrismaStaffMessageModel) => ({
      id: m.id,
      schoolId: m.schoolId,
      userId: m.userId,
      senderName: senderMap[m.userId]?.name ?? 'Staff Member',
      senderAvatar: senderMap[m.userId]?.avatar ?? undefined,
      senderRole: senderMap[m.userId]?.role ?? undefined,
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
    if (!content.trim() && !mediaUrl) {
      return failure('Message content is required', {} as StaffMessage);
    }
    const created = await prisma.staffMessage.create({
      data: { schoolId, userId, type, content: content.trim(), mediaUrl: mediaUrl || null },
    });
    publishMessageEvent({ type: 'staff-message', schoolId });

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, avatar: true, role: true },
    });

    return success({
      id: created.id,
      schoolId: created.schoolId,
      userId: created.userId,
      senderName: sender?.name ?? 'Staff Member',
      senderAvatar: sender?.avatar ?? undefined,
      senderRole: sender?.role ?? undefined,
      type: created.type as StaffMessage['type'],
      content: created.content,
      mediaUrl: created.mediaUrl ?? undefined,
      createdAt: created.createdAt.toISOString(),
    }, 'Message sent');
  },

  // ── Teacher Assignments ──────────────────────────────────────────────────

  getTeacherAssignments: async (teacherId: string): Promise<ApiResponse<TeacherAssignment[]>> => {
    const rows = await prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: { subject: { select: { name: true } }, schoolClass: { select: { name: true } } },
    });
    return success(rows.map((r) => ({
      id: r.id,
      teacherId: r.teacherId,
      subjectId: r.subjectId,
      schoolClassId: r.schoolClassId,
      subjectName: r.subject?.name,
      className: r.schoolClass?.name,
    })));
  },

  getClassAssignments: async (schoolClassId: string): Promise<ApiResponse<(TeacherAssignment & { teacherName?: string })[]>> => {
    const rows = await prisma.teacherAssignment.findMany({
      where: { schoolClassId },
      include: {
        subject: { select: { name: true } },
        schoolClass: { select: { name: true } },
        teacher: { select: { name: true } },
      },
    });
    return success(rows.map((r) => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher?.name,
      subjectId: r.subjectId,
      schoolClassId: r.schoolClassId,
      subjectName: r.subject?.name,
      className: r.schoolClass?.name,
    })));
  },

  setTeacherAssignments: async (
    teacherId: string,
    assignments: { subjectId: string; schoolClassId: string }[],
    schoolId?: string,
  ): Promise<ApiResponse<TeacherAssignment[]>> => {
    if (schoolId) {
      const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } });
      if (!teacher) return failure('Teacher not found in your school', []);
    }
    await prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.deleteMany({ where: { teacherId } });
      if (assignments.length > 0) {
        await tx.teacherAssignment.createMany({
          data: assignments.map(a => ({ teacherId, subjectId: a.subjectId, schoolClassId: a.schoolClassId })),
          skipDuplicates: true,
        });
      }
    });
    return appService.getTeacherAssignments(teacherId);
  },

  // ── Student field assignment ─────────────────────────────────────────────

  setStudentField: async (
    studentId: string,
    field: string,
    enrolledSubjects: string[],
    schoolId?: string,
  ): Promise<ApiResponse<Student>> => {
    if (schoolId) {
      const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!student) return failure('Student not found in your school', {} as Student);
    }
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

  getStudentAttendanceSummary: async (studentId: string, schoolId?: string): Promise<ApiResponse<{ present: number; absent: number; late: number; excused: number; total: number }>> => {
    if (schoolId) {
      const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!student) return failure('Student not found', { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
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
    schoolId?: string,
    currentTermOnly = false,
  ): Promise<ApiResponse<Record<string, { present: number; absent: number; late: number; excused: number; total: number }>>> => {
    if (studentIds.length === 0) return success({});
    const validIds = schoolId
      ? (await prisma.student.findMany({
          where: { id: { in: studentIds }, schoolId },
          select: { id: true },
        })).map((s) => s.id)
      : studentIds;
    if (validIds.length === 0) return success({});
    const currentTerm = currentTermOnly && schoolId
      ? await prisma.schoolTerm.findFirst({ where: { schoolId, isCurrent: true } }) : null;
    if (currentTermOnly && !currentTerm) return failure('Configure a current school term to view the termly report', {});
    const groups = await prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { studentId: { in: validIds }, ...(currentTerm ? { date: { gte: currentTerm.startDate, lte: currentTerm.endDate } } : {}) },
      _count: { id: true },
    });
    const map: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};
    for (const g of groups) {
      if (!map[g.studentId]) map[g.studentId] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      const count = g._count.id;
      map[g.studentId].total += count;
      if (g.status === 'Present') map[g.studentId].present += count;
      else if (g.status === 'Absent') map[g.studentId].absent += count;
      else if (g.status === 'Late') map[g.studentId].late += count;
      else if (g.status === 'Excused') map[g.studentId].excused += count;
    }
    return success(map);
  },

  // ── School Terms ─────────────────────────────────────────────────────────

  getSchoolTerms: async (schoolId: string): Promise<ApiResponse<SchoolTerm[]>> => {
    const terms = await prisma.schoolTerm.findMany({
      where: { schoolId },
      orderBy: [{ session: 'desc' }, { term: 'asc' }],
    });
    return success(terms.map(mapSchoolTermModel));
  },

  getCurrentTerm: async (schoolId: string): Promise<ApiResponse<SchoolTerm | null>> => {
    const term = await prisma.schoolTerm.findFirst({
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
    if (data.isCurrent) {
      await prisma.schoolTerm.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const created = await prisma.schoolTerm.create({
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
    const term = await prisma.schoolTerm.findUnique({ where: { id: termId } });
    if (!term) return failure('Term not found', false as unknown as boolean);
    if (term.schoolId !== schoolId) return failure('Access denied', false as unknown as boolean);
    await prisma.schoolTerm.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });
    await prisma.schoolTerm.update({
      where: { id: termId },
      data: { isCurrent: true },
    });
    return success(true, 'Current term updated');
  },

  deleteSchoolTerm: async (termId: string, schoolId: string): Promise<ApiResponse<boolean>> => {
    const term = await prisma.schoolTerm.findUnique({ where: { id: termId } });
    if (!term) return failure('Term not found', false as unknown as boolean);
    if (term.schoolId !== schoolId) return failure('Access denied', false as unknown as boolean);
    await prisma.schoolTerm.delete({ where: { id: termId } });
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
    const template = await prisma.feeTemplate.findUnique({
      where: { id: params.templateId },
      include: { lines: { orderBy: { order: 'asc' } } },
    });
    if (!template) return failure('Fee template not found', { created: 0, skipped: 0 });
    if (template.schoolId !== params.schoolId) return failure('Template does not belong to this school', { created: 0, skipped: 0 });

    // Validate that all requested students actually belong to this school
    const validStudents = await prisma.student.findMany({
      where: { id: { in: params.studentIds }, schoolId: params.schoolId },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map(s => s.id));
    const invalidCount = params.studentIds.length - validStudentIds.size;
    if (invalidCount > 0) {
      return failure(`${invalidCount} student(s) do not belong to this school`, { created: 0, skipped: 0 });
    }

    // Batch-query existing ledgers to avoid N+1
    const existingLedgers = await prisma.studentFeeLedger.findMany({
      where: {
        schoolId: params.schoolId,
        studentId: { in: params.studentIds },
        term: params.term,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
      },
      select: { studentId: true },
    });
    const alreadyHasLedger = new Set(existingLedgers.map((l) => l.studentId));

    let created = 0;
    let skipped = 0;

    for (const studentId of params.studentIds) {
      if (alreadyHasLedger.has(studentId)) { skipped++; continue; }

      await prisma.studentFeeLedger.create({
        data: {
          schoolId: params.schoolId,
          studentId,
          term: params.term,
          scopeType: params.scopeType,
          scopeId: params.scopeId,
          templateId: params.templateId,
          lineItems: {
            create: template.lines.map((line) => ({
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
    const ledgers = await prisma.studentFeeLedger.findMany({
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
    clientRef?: string;
    schoolId: string;
    actorUserId?: string;
  }): Promise<ApiResponse<StudentFeePayment>> => {
    if (params.amount <= 0) return failure('Payment amount must be positive', {} as StudentFeePayment);

    const item = await prisma.studentFeeLedgerItem.findUnique({
      where: { id: params.ledgerItemId },
      include: {
        ledger: { select: { id: true, schoolId: true, studentId: true, term: true } },
        payments: { select: { amount: true } },
      },
    });
    if (!item) return failure('Ledger item not found', {} as StudentFeePayment);
    if (item.ledger.schoolId !== params.schoolId) return failure('Access denied', {} as StudentFeePayment);

    const { payment, replayed } = await insertPayment(params);
    if (replayed) return success({
      id: payment.id, ledgerItemId: payment.ledgerItemId, amount: fromKobo(toKobo(payment.amount)),
      paymentRef: payment.paymentRef ?? undefined, method: payment.method ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    }, 'Payment already recorded');

    await appService.writeAuditLog({
      schoolId: params.schoolId,
      userId: params.actorUserId,
      action: 'RECORD_PAYMENT',
      entity: 'StudentFeePayment',
      entityId: payment.id,
      metadata: {
        amount: params.amount,
        method: params.method,
        ledgerItemId: params.ledgerItemId,
        studentId: item.ledger.studentId,
      },
    });

    // ── Post-payment: check full clearance, generate PIN, notify parents ──
    try {
      const studentId = item.ledger.studentId;

      // Load the full ledger to check if every item is now paid
      const fullLedger = await prisma.studentFeeLedger.findUnique({
        where: { id: item.ledger.id },
        include: {
          lineItems: {
            include: { payments: { select: { amount: true } } },
          },
          student: {
            select: { id: true, name: true, resultPin: true, resultPinTerm: true, schoolId: true },
          },
        },
      });

      if (fullLedger) {
        const emailParents = await prisma.parentStudent.findMany({ where: { studentId }, select: { parentId: true } });
        const emailTargets = await resolveNotificationRecipients([studentId, ...emailParents.map(link => link.parentId)], params.schoolId);
        void emailRecipients(emailTargets.map(target => target.id), `Payment received for ${fullLedger.student.name}`,
          `Payment of ${params.amount} received for ${item.title}, ${item.ledger.term}. Reference: ${payment.paymentRef ?? payment.id}.`, emailTargets).catch(() => console.error('[Email] Receipt notice failed'));
        const totalPayableKobo = fullLedger.lineItems.reduce((sum: number, item: any) => sum + toKobo(item.payableAmount), 0);
        const totalPaidKobo = fullLedger.lineItems.reduce(
          (sum: number, item: any) => sum + item.payments.reduce(
            (paid: number, payment: { amount: number | string | { toString(): string } }) => paid + toKobo(payment.amount),
            0,
          ),
          0,
        );
        const totalPayable = fromKobo(totalPayableKobo);
        const totalPaid = fromKobo(totalPaidKobo);
        const outstanding = fromKobo(Math.max(0, totalPayableKobo - totalPaidKobo));
        const fullyCleared = totalPayableKobo > 0 && totalPaidKobo >= totalPayableKobo;

        // Generate result PIN on first clearance for this term (regenerate if term changed)
        const ledgerTerm: string = fullLedger.term ?? 'current';
        let resultPin: string = fullLedger.student.resultPin ?? '';
        const currentPinTerm: string = fullLedger.student.resultPinTerm ?? '';
        if (fullyCleared && (!resultPin || currentPinTerm !== ledgerTerm)) {
          resultPin = generateResultPin();
          await prisma.student.update({
            where: { id: studentId },
            data: { resultPin, resultPinTerm: ledgerTerm },
          });
        }

        // Notify only the student's linked parents/guardians
        const parentLinks = await prisma.parentStudent.findMany({
          where: { studentId },
          include: { parent: { select: { id: true, name: true } } },
        });

        if (parentLinks.length > 0) {
          const school = await prisma.school.findUnique({
            where: { id: params.schoolId },
            select: { name: true },
          });

          const receiptPayload = {
            type: 'payment_receipt',
            studentName: fullLedger.student.name,
            schoolName: school?.name ?? 'Your School',
            paymentDate: payment.createdAt.toISOString(),
            paymentRef: payment.paymentRef ?? undefined,
            method: payment.method ?? undefined,
            itemTitle: item.title,
            amountPaid: params.amount,
            totalPayable,
            totalPaid,
            outstanding,
            ledgerFully: fullyCleared,
          };

          const notification = await prisma.notification.create({
            data: {
              title: `Payment received – ${fullLedger.student.name}`,
              message: JSON.stringify(receiptPayload),
              audience: 'specific_users',
              sourceRole: 'ADMIN',
              schoolId: params.schoolId,
            },
          });

          await createNotificationRecipients(notification.id, parentLinks.map(link => link.parent.id), params.schoolId);
        }
      }
    } catch (err) {
      console.error('[PostPayment] PIN/notification step failed:', err);
    }

    return success({
      id: payment.id,
      ledgerItemId: payment.ledgerItemId,
      amount: fromKobo(toKobo(payment.amount)),
      paymentRef: payment.paymentRef ?? undefined,
      method: payment.method ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    } as StudentFeePayment, 'Payment recorded');
  },

  // Verify a Paystack reference and post it to the student's fee ledger.
  // Idempotent: both the webhook and the browser callback can call this safely
  // (clientRef = reference dedupes inside recordPayment).
  recordOnlinePayment: async (reference: string): Promise<ApiResponse<{ recorded: boolean; reference: string }>> => {
    const verified = await verifyTransaction(reference);
    if (verified.status !== 'success') {
      return failure(`Payment not successful (status: ${verified.status})`, { recorded: false, reference });
    }
    if (verified.currency !== 'NGN' || !Number.isSafeInteger(verified.amountKobo) || verified.amountKobo <= 0) {
      return failure('Payment currency or amount does not match the fee ledger', { recorded: false, reference });
    }
    const meta = (verified.metadata || {}) as Record<string, any>;
    const ledgerItemId = meta.ledgerItemId as string | undefined;
    const schoolId = meta.schoolId as string | undefined;
    if (!ledgerItemId || !schoolId) {
      return failure('Payment is missing ledger metadata', { recorded: false, reference });
    }
    const amount = Math.round(verified.amountKobo) / 100; // kobo → naira

    try {
      const res = await appService.recordPayment({
        ledgerItemId,
        amount,
        method: 'online',
        paymentRef: reference,
        clientRef: reference,
        schoolId,
        actorUserId: (meta.actorUserId as string) || undefined,
      });
      return success({ recorded: res.ok, reference }, res.message || 'Payment recorded');
    } catch (e: any) {
      // The money was captured at Paystack; acknowledge so the webhook stops
      // retrying. Any mismatch surfaces in reconciliation rather than looping.
      return success({ recorded: false, reference }, e?.message || 'Payment received; posting deferred');
    }
  },

  // Send a message to every parent linked to a student (SMS or WhatsApp).
  messageStudentParents: async (studentId: string, text: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<number> => {
    const links = await prisma.parentStudent.findMany({
      where: { studentId },
      include: { parent: { select: { phone: true } } },
    });
    let sent = 0;
    for (const l of links) {
      const phone = l.parent?.phone as string | undefined;
      if (!phone) continue;
      const ok = channel === 'whatsapp' ? await sendWhatsApp(phone, text) : await sendSMS(phone, text);
      if (ok) sent++;
    }
    return sent;
  },

  // Bulk fee reminders: message the parents of every student with an outstanding balance.
  sendFeeReminders: async (
    schoolId: string,
    term?: string,
    channel: 'sms' | 'whatsapp' = 'sms',
    actorUserId?: string,
  ): Promise<ApiResponse<{ owing: number; messaged: number }>> => {
    const [ledgers, school] = await Promise.all([
      prisma.studentFeeLedger.findMany({
        where: { schoolId, ...(term ? { term } : {}) },
        include: {
          lineItems: { include: { payments: { select: { amount: true } } } },
          student: { select: { id: true, name: true } },
        },
      }),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    ]);

    let owing = 0;
    let messaged = 0;
    for (const led of ledgers) {
      let payableKobo = 0, paidKobo = 0;
      for (const it of led.lineItems) {
        payableKobo += toKobo(it.payableAmount);
        paidKobo += it.payments.reduce((sum: number, payment: { amount: number | string | { toString(): string } }) => sum + toKobo(payment.amount), 0);
      }
      const outstandingKobo = Math.max(0, payableKobo - paidKobo);
      if (outstandingKobo <= 0 || !led.student) continue;
      owing++;
      const outstanding = fromKobo(outstandingKobo);
      const text = `Dear Parent, ${led.student.name} has an outstanding fee balance of N${outstanding.toLocaleString()} for ${led.term} at ${school?.name ?? 'school'}. Kindly arrange payment. Thank you.`;
      messaged += await appService.messageStudentParents(led.student.id, text, channel);
    }

    await appService.writeAuditLog({
      schoolId, userId: actorUserId,
      action: 'SEND_FEE_REMINDERS', entity: 'School', entityId: schoolId,
      metadata: { owing, messaged, channel, term: term ?? null },
    });

    return success({ owing, messaged }, `Reminders sent to ${messaged} parent contact(s) across ${owing} owing student(s).`);
  },

  getSchoolFinanceSummary: async (schoolId: string, term?: string): Promise<ApiResponse<{
    totalPayable: number;
    totalCollected: number;
    outstanding: number;
    studentCount: number;
    fullyPaidCount: number;
  }>> => {
    const ledgers = await prisma.studentFeeLedger.findMany({
      where: { schoolId, ...(term ? { term } : {}) },
      include: {
        lineItems: {
          include: { payments: true },
        },
      },
    });

    let totalPayableKobo = 0;
    let totalCollectedKobo = 0;
    let fullyPaidCount = 0;
    const studentsSeen = new Set<string>();

    for (const ledger of ledgers) {
      studentsSeen.add(ledger.studentId);
      let ledgerPayableKobo = 0;
      let ledgerPaidKobo = 0;
      for (const item of ledger.lineItems) {
        ledgerPayableKobo += toKobo(item.payableAmount);
        ledgerPaidKobo += item.payments.reduce((sum: number, payment: { amount: number | string | { toString(): string } }) => sum + toKobo(payment.amount), 0);
      }
      totalPayableKobo += ledgerPayableKobo;
      totalCollectedKobo += ledgerPaidKobo;
      if (ledgerPaidKobo >= ledgerPayableKobo && ledgerPayableKobo > 0) fullyPaidCount++;
    }

    const totalPayable = fromKobo(totalPayableKobo);
    const totalCollected = fromKobo(totalCollectedKobo);
    return success({
      totalPayable,
      totalCollected,
      outstanding: fromKobo(Math.max(0, totalPayableKobo - totalCollectedKobo)),
      studentCount: studentsSeen.size,
      fullyPaidCount,
    });
  },

  // Consolidated earnings across every branch in a group, plus a per-branch
  // breakdown — the multi-school owner's financial bird's-eye view.
  getGroupFinanceSummary: async (groupId: string, term?: string): Promise<ApiResponse<{
    totals: { totalPayable: number; totalCollected: number; outstanding: number; studentCount: number; collectionRate: number };
    branches: Array<{ schoolId: string; schoolName: string; totalPayable: number; totalCollected: number; outstanding: number; studentCount: number; fullyPaidCount: number; collectionRate: number }>;
  }>> => {
    const schools = await prisma.school.findMany({
      where: { groupId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const branches = [] as Array<{ schoolId: string; schoolName: string; totalPayable: number; totalCollected: number; outstanding: number; studentCount: number; fullyPaidCount: number; collectionRate: number }>;
    const totals = { totalPayable: 0, totalCollected: 0, outstanding: 0, studentCount: 0, collectionRate: 0 };

    for (const s of schools) {
      const ledgers = await prisma.studentFeeLedger.findMany({
        where: { schoolId: s.id, ...(term ? { term } : {}) },
        include: { lineItems: { include: { payments: true } } },
      });
      let payableKobo = 0, collectedKobo = 0, fullyPaid = 0;
      const seen = new Set<string>();
      for (const ledger of ledgers) {
        seen.add(ledger.studentId);
        let lpKobo = 0, lpaidKobo = 0;
        for (const item of ledger.lineItems) {
          lpKobo += toKobo(item.payableAmount);
          lpaidKobo += item.payments.reduce((sum: number, payment: { amount: number | string | { toString(): string } }) => sum + toKobo(payment.amount), 0);
        }
        payableKobo += lpKobo; collectedKobo += lpaidKobo;
        if (lpaidKobo >= lpKobo && lpKobo > 0) fullyPaid++;
      }
      branches.push({
        schoolId: s.id, schoolName: s.name,
        totalPayable: fromKobo(payableKobo), totalCollected: fromKobo(collectedKobo),
        outstanding: fromKobo(Math.max(0, payableKobo - collectedKobo)),
        studentCount: seen.size, fullyPaidCount: fullyPaid,
        collectionRate: payableKobo > 0 ? Math.round((collectedKobo / payableKobo) * 100) : 0,
      });
      totals.totalPayable += payableKobo;
      totals.totalCollected += collectedKobo;
      totals.outstanding += Math.max(0, payableKobo - collectedKobo);
      totals.studentCount += seen.size;
    }
    totals.collectionRate = totals.totalPayable > 0 ? Math.round((totals.totalCollected / totals.totalPayable) * 100) : 0;

    return success({
      totals: {
        ...totals,
        totalPayable: fromKobo(totals.totalPayable),
        totalCollected: fromKobo(totals.totalCollected),
        outstanding: fromKobo(totals.outstanding),
      },
      branches,
    });
  },

  // Cross-branch analytics for a group owner: benchmarking + at-risk detection.
  getGroupAnalytics: async (groupId: string): Promise<ApiResponse<{
    totals: { schools: number; students: number; avgAttendance: number; avgCollectionRate: number; atRisk: number };
    branches: Array<{ schoolId: string; schoolName: string; students: number; avgAttendance: number; avgGpa: number; collectionRate: number; outstanding: number; atRisk: number }>;
    topAtRisk: Array<{ studentId: string; name: string; schoolName: string; grade: string; attendance: number; gpa: number }>;
  }>> => {
    const schools = await prisma.school.findMany({
      where: { groupId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const branches: any[] = [];
    const topAtRisk: any[] = [];
    let totalStudents = 0, attWeighted = 0, attCount = 0, atRiskTotal = 0, payableTotalKobo = 0, collectedTotalKobo = 0;

    // A student is "at risk" academically: poor attendance or low GPA.
    const atRiskWhere = (schoolId: string) => ({
      schoolId,
      OR: [{ attendance: { lt: 75 } }, { gpa: { lt: 2.5 } }],
    });

    for (const s of schools) {
      const agg = await prisma.student.aggregate({
        where: { schoolId: s.id },
        _count: { id: true },
        _avg: { attendance: true, gpa: true },
      });
      const studentsN = agg._count.id;
      const avgAttendance = Math.round(agg._avg.attendance ?? 0);
      const avgGpa = Math.round((agg._avg.gpa ?? 0) * 100) / 100;
      const atRisk = await prisma.student.count({ where: atRiskWhere(s.id) });

      const ledgers = await prisma.studentFeeLedger.findMany({
        where: { schoolId: s.id },
        include: { lineItems: { include: { payments: { select: { amount: true } } } } },
      });
      let payableKobo = 0, collectedKobo = 0;
      for (const led of ledgers) {
        for (const it of led.lineItems) {
          payableKobo += toKobo(it.payableAmount);
          collectedKobo += it.payments.reduce((sum: number, payment: { amount: number | string | { toString(): string } }) => sum + toKobo(payment.amount), 0);
        }
      }
      const collectionRate = payableKobo > 0 ? Math.round((collectedKobo / payableKobo) * 100) : 0;

      branches.push({
        schoolId: s.id, schoolName: s.name, students: studentsN,
        avgAttendance, avgGpa, collectionRate,
        outstanding: fromKobo(Math.max(0, payableKobo - collectedKobo)), atRisk,
      });

      totalStudents += studentsN;
      if (studentsN) { attWeighted += avgAttendance * studentsN; attCount += studentsN; }
      atRiskTotal += atRisk; payableTotalKobo += payableKobo; collectedTotalKobo += collectedKobo;

      const risky = await prisma.student.findMany({
        where: atRiskWhere(s.id),
        select: { id: true, name: true, grade: true, attendance: true, gpa: true },
        orderBy: { attendance: 'asc' },
        take: 6,
      });
      risky.forEach((r) => topAtRisk.push({
        studentId: r.id, name: r.name, schoolName: s.name, grade: r.grade,
        attendance: r.attendance, gpa: r.gpa,
      }));
    }

    topAtRisk.sort((a, b) => a.attendance - b.attendance);

    return success({
      totals: {
        schools: schools.length,
        students: totalStudents,
        avgAttendance: attCount ? Math.round(attWeighted / attCount) : 0,
        avgCollectionRate: payableTotalKobo > 0 ? Math.round((collectedTotalKobo / payableTotalKobo) * 100) : 0,
        atRisk: atRiskTotal,
      },
      branches,
      topAtRisk: topAtRisk.slice(0, 12),
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
      await prisma.auditLog.create({
        data: {
          schoolId: params.schoolId ?? null,
          userId: params.userId ?? null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          metadata: params.metadata ? toInputJson(params.metadata) : Prisma.JsonNull,
        },
      });
    } catch (err) {
      console.error('[AuditLog] Failed to write:', err);
    }
  },

  getAuditLogs: async (schoolId: string, limit = 100): Promise<ApiResponse<AuditLogEntry[]>> => {
    const logs = await prisma.auditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return success(logs.map((l: any): AuditLogEntry => ({
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

  // Platform-wide audit feed across every school (Creator governance view).
  getGlobalAuditLogs: async (limit = 100): Promise<ApiResponse<AuditLogEntry[]>> => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return success(logs.map((l: any): AuditLogEntry => ({
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

  // ── Parent Portal ────────────────────────────────────────────────────────

  createParent: async (payload: { name: string; email: string; phone?: string; schoolId: string; studentIds: string[] }): Promise<ApiResponse<User>> => {
    const email = payload.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return failure('A user with this email already exists', {} as User);
    if (!await prisma.school.findFirst({ where: { id: payload.schoolId, status: 'Active', deletedAt: null }, select: { id: true } })) return failure('School unavailable', {} as User);
    const studentIds = [...new Set(payload.studentIds)];
    if (studentIds.length && await prisma.student.count({ where: { id: { in: studentIds }, schoolId: payload.schoolId } }) !== studentIds.length) return failure('One or more students do not belong to this school', {} as User);
    const temporaryPassword = generateTemporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 12);
    const { parent, credentials } = await withProvisionedIdentity(email, temporaryPassword, async identity => ({
      parent: await prisma.$transaction(async tx => {
        if (studentIds.length && await tx.student.count({ where: { id: { in: studentIds }, schoolId: payload.schoolId } }) !== studentIds.length) throw new Error('Student enrollment changed; retry account creation');
        const parent = await tx.user.create({ data: { name: payload.name.trim(), email, password, role: UserRole.PARENT,
          schoolId: payload.schoolId, phone: payload.phone?.trim() || undefined, avatar: avatarFromName(payload.name.trim()), supabaseUserId: identity.providerId } });
        if (studentIds.length) await tx.parentStudent.createMany({ data: studentIds.map(studentId => ({ parentId: parent.id, studentId })) });
        return parent;
      }), credentials: identity,
    }));
    return success({ ...mapUserModel(parent), temporaryPassword: credentials.temporaryPassword, existingProviderAccount: credentials.existingProviderAccount },
      credentials.existingProviderAccount ? 'Parent linked; use the existing password or email recovery' : 'Parent account created; share the temporary password securely');
  },

  getParentChildren: async (parentId: string): Promise<ApiResponse<{
    student: Student;
    results: ResultData[];
    attendance: { present: number; absent: number; late: number; excused: number; total: number };
    ledgers: StudentFeeLedger[];
  }[]>> => {
    const links = await prisma.parentStudent.findMany({
      where: { parentId },
      include: { student: true },
    });

    const children = await Promise.all(links.map(async (link) => {
      const s = link.student;

      const [resultsRaw, attendanceGroups, ledgersRaw] = await Promise.all([
        prisma.result.findMany({ where: { studentId: s.id, status: 'Published' }, orderBy: { subjectName: 'asc' } }),
        prisma.attendanceRecord.groupBy({
          by: ['status'],
          where: { studentId: s.id },
          _count: { id: true },
        }),
        prisma.studentFeeLedger.findMany({
          where: { studentId: s.id },
          include: { lineItems: { include: { payments: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      const attendance = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      for (const g of attendanceGroups) {
        const count = g._count.id;
        attendance.total += count;
        if (g.status === 'Present') attendance.present += count;
        else if (g.status === 'Absent') attendance.absent += count;
        else if (g.status === 'Late') attendance.late += count;
        else if (g.status === 'Excused') attendance.excused += count;
      }

      return {
        student: mapStudentModel(s),
        results: resultsRaw.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: s.name,
          subjectName: r.subjectName,
          average: r.average,
          grade: r.grade,
          status: r.status,
          term: r.term,
          remarks: r.remarks ?? undefined,
        })) as ResultData[],
        attendance,
        ledgers: ledgersRaw.map(mapLedgerModel) as StudentFeeLedger[],
      };
    }));

    return success(children);
  },

  linkParentToStudent: async (parentId: string, studentId: string, schoolId?: string): Promise<ApiResponse<boolean>> => {
    return prisma.$transaction(async tx => {
      const [parent, student] = await Promise.all([
        tx.user.findFirst({ where: { id: parentId, role: UserRole.PARENT, active: true, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true } }),
        tx.student.findFirst({ where: { id: studentId, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true } }),
      ]);
      if (!parent || !student || parent.schoolId !== student.schoolId) return failure('Parent and student must belong to the same school', false);
      await tx.parentStudent.upsert({ where: { parentId_studentId: { parentId, studentId } }, update: {}, create: { parentId, studentId } });
      return success(true);
    });
  },

  unlinkParentFromStudent: async (parentId: string, studentId: string, schoolId?: string): Promise<ApiResponse<boolean>> => {
    return prisma.$transaction(async tx => {
      const [parent, student] = await Promise.all([
        tx.user.findFirst({ where: { id: parentId, role: UserRole.PARENT, active: true, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true } }),
        tx.student.findFirst({ where: { id: studentId, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true } }),
      ]);
      if (!parent || !student || parent.schoolId !== student.schoolId) return failure('Parent and student must belong to the same school', false);
      await tx.parentStudent.deleteMany({ where: { parentId, studentId } });
      return success(true);
    });
  },

  getSchoolParents: async (schoolId: string): Promise<ApiResponse<(User & { childCount: number })[]>> => {
    const parents = await prisma.user.findMany({
      where: { schoolId, role: UserRole.PARENT },
      include: { parentLinks: { select: { id: true } } },
      orderBy: { name: 'asc' },
      take: 2000,
    });
    return success(parents.map(p => ({
      ...mapUserModel(p),
      childCount: p.parentLinks.length,
    })));
  },
};
