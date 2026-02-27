import {
  Prisma,
  ResultStatus,
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
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { gradeEssay } from './aiGradingService';
import { analyzeProctorFrame } from './aiProctoringService';
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
  Student,
  Subject,
  User,
  UserRole,
  Announcement,
  LiveClass,
  AIActivity,
  GraduatedStudent,
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

const getDefaultSchoolId = async (): Promise<string> => {
  const school = await prisma.school.findFirst({ orderBy: { name: 'asc' } });
  if (!school) {
    throw new Error('No school available');
  }
  return school.id;
};

const getSchoolIdForUser = async (userId?: string): Promise<string> => {
  if (!userId) return getDefaultSchoolId();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
  return user?.schoolId ?? getDefaultSchoolId();
};

const getSchoolIdForStudent = async (studentId: string): Promise<string> => {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  return student?.schoolId ?? getDefaultSchoolId();
};

const getSchoolIdForSubject = async (subjectId?: string): Promise<string> => {
  if (!subjectId) return getDefaultSchoolId();
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { schoolId: true } });
  return subject?.schoolId ?? getDefaultSchoolId();
};

const getSchoolIdForExam = async (examId: string): Promise<string> => {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { schoolId: true } });
  return exam?.schoolId ?? getDefaultSchoolId();
};

const getSchoolIdForLiveClass = async (liveClassId: string): Promise<string> => {
  const liveClass = await prisma.liveClass.findUnique({ where: { id: liveClassId }, select: { schoolId: true } });
  return liveClass?.schoolId ?? getDefaultSchoolId();
};

const clearClassMastersForTeacher = async (teacherId: string): Promise<void> => {
  const schoolId = await getSchoolIdForUser(teacherId);
  await prisma.classMaster.deleteMany({ where: { teacherId, schoolId } });
};

const clearHouseMastersForTeacher = async (teacherId: string): Promise<void> => {
  const schoolId = await getSchoolIdForUser(teacherId);
  await prisma.houseMaster.deleteMany({ where: { teacherId, schoolId } });
};

const assignTeacherSubjects = async (teacherId: string, subjectIds: string[]): Promise<void> => {
  const schoolId = await getSchoolIdForUser(teacherId);
  const existing = await prisma.subject.findMany({
    where: { schoolId, teacherId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((subject) => subject.id));
  const incomingIds = new Set(subjectIds);

  const toUnassign = [...existingIds].filter((id) => !incomingIds.has(id));
  const toAssign = subjectIds.filter((id) => !existingIds.has(id));

  await prisma.$transaction([
    ...toUnassign.map((id) =>
      prisma.subject.update({
        where: { id },
        data: { teacherId: null },
      }),
    ),
    ...toAssign.map((id) =>
      prisma.subject.update({
        where: { id },
        data: { teacherId },
      }),
    ),
  ]);
};

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
});

const mapStudentModel = (student: PrismaStudentModel): Student => ({
  id: student.id,
  name: student.name,
  gender: student.gender as Student['gender'],
  grade: student.grade,
  house: (student as any).house ?? 'Unassigned',
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
  schoolId: subject.schoolId,
});

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
  term: result.term ?? 'Term 1',
  average: result.average,
  grade: result.grade,
  status:
    result.status === 'withheld'
      ? 'withheld'
      : result.status === 'incomplete'
        ? 'Draft'
        : 'Published',
  remarks: result.remarks ?? undefined,
  details: (result.details as Record<string, number | undefined> | undefined) ?? undefined,
});

const mapExamQuestionModel = (question: PrismaExamQuestionModel): ExamQuestion => ({
  id: question.id,
  type: question.type as ExamQuestion['type'],
  text: question.text,
  options: (question.options as string[] | null) ?? undefined,
  correctAnswer: question.correctAnswer ?? '',
  points: question.points,
  isAutoGrade: question.isAutoGrade,
  rubric: question.rubric ?? undefined,
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
  status:
    session.status === 'in_progress'
      ? 'in-progress'
      : session.status === 'submitted'
        ? 'submitted'
        : 'not-started',
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
  scheduledTime: liveClass.scheduledTime?.toISOString?.() || liveClass.scheduledTime,
  meetingLink: liveClass.meetingLink,
  status: liveClass.status,
});

const mapAIActivityModel = (
  activity: any,
): AIActivity => ({
  id: activity.id,
  action: activity.action,
  scope: activity.scope as AIActivity['scope'],
  status: activity.status as AIActivity['status'],
  actorId: activity.actorId ?? undefined,
  actorRole: (activity.actorRole as UserRole | null) ?? undefined,
  actorName: activity.user?.name ?? undefined,
  schoolId: activity.schoolId ?? undefined,
  metadata: (activity.metadata as Record<string, unknown> | null) ?? undefined,
  createdAt: activity.createdAt.toISOString(),
});

const mapGraduatedStudentModel = (record: any): GraduatedStudent => ({
  id: record.id,
  schoolId: record.schoolId,
  studentId: record.studentId ?? undefined,
  name: record.name,
  gender: record.gender as GraduatedStudent['gender'],
  grade: record.grade,
  house: record.house ?? 'Unassigned',
  level: record.level,
  term: record.term,
  year: record.year,
  archivedAt: record.archivedAt?.toISOString?.() || record.archivedAt,
});

const getDateBounds = (value: string) => {
  const start = toDateOnly(value);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const PASS_MARK = 45;

const toTermKey = (term: string) => {
  const normalized = normalizeKey(term);
  if (!normalized) return '';
  if (normalized.includes('term1') || normalized.includes('first') || normalized === '1') return 'term1';
  if (normalized.includes('term2') || normalized.includes('second') || normalized === '2') return 'term2';
  if (normalized.includes('term3') || normalized.includes('third') || normalized === '3') return 'term3';
  return normalized;
};

const averageOf = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const parseGrade = (grade: string) => {
  const key = normalizeKey(grade);
  const match = key.match(/^(primary|pri|grade|jss|sss)(\d{1,2})([a-z])?$/i);
  if (!match) return null;
  const prefix = match[1].toLowerCase();
  const number = Number(match[2]);
  const arm = match[3]?.toUpperCase() || '';
  return { prefix, number, arm, raw: grade };
};

const getNextGrade = (grade: string) => {
  const parsed = parseGrade(grade);
  if (!parsed) return null;
  const { prefix, number, arm, raw } = parsed;

  const isPrimary = ['primary', 'pri', 'grade'].includes(prefix);
  const isJss = prefix === 'jss';
  const isSss = prefix === 'sss';

  if (isPrimary && number >= 6) return null;
  if (isJss && number >= 3) return null;
  if (isSss && number >= 3) return null;

  const nextNumber = number + 1;

  if (isPrimary) {
    const label = raw.toLowerCase().includes('primary')
      ? 'Primary'
      : raw.toLowerCase().includes('grade')
        ? 'Grade'
        : 'Primary';
    return `${label} ${nextNumber}${arm ? arm : ''}`.trim();
  }

  if (isJss) {
    return `JSS ${nextNumber}${arm ? arm : ''}`.trim();
  }

  if (isSss) {
    return `SSS ${nextNumber}${arm ? arm : ''}`.trim();
  }

  return null;
};

const getGraduationLevel = (grade: string) => {
  const key = normalizeKey(grade);
  if (key.startsWith('jss') || key.startsWith('junior')) return 'Junior Secondary';
  if (key.startsWith('sss') || key.startsWith('senior') || key.startsWith('ss')) return 'Senior Secondary';
  return 'Primary';
};

const isThirdTerm = (term: string) => {
  const normalized = normalizeKey(term);
  return normalized.includes('term3') || normalized.includes('third') || normalized.includes('3rd');
};

export const appService = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    await wait(100);
    return success({ status: 'healthy' });
  },

  // Email + password login using bcrypt hash stored in User.password
  login: async (email: string, password: string): Promise<ApiResponse<User>> => {
    await wait(100);
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

      return success(mapUserModel(user));
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

    return success({
      id: student.id,
      name: student.name,
      role: UserRole.STUDENT,
      email: '',
      schoolId: school.id,
      avatar: avatarFromName(student.name),
      gender: student.gender as User['gender'],
    });
  },

  updateUserProfile: async (
    userId: string,
    updates: Partial<User> & { formClass?: string; house?: string; subjectIds?: string[] },
  ): Promise<ApiResponse<User>> => {
    await wait(100);
    try {
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return failure('User not found', {} as User);
      }

      const allowedUpdates: Prisma.UserUpdateInput = {};
      const assignmentFormClass = updates.formClass;
      const assignmentHouse = updates.house;
      const assignmentSubjects = updates.subjectIds;

      if (typeof updates.name === 'string') allowedUpdates.name = updates.name;
      if (typeof updates.avatar === 'string') allowedUpdates.avatar = updates.avatar;
      if (typeof updates.phone === 'string') allowedUpdates.phone = updates.phone;
      if (typeof updates.bio === 'string') allowedUpdates.bio = updates.bio;
      if (typeof updates.gender === 'string') allowedUpdates.gender = updates.gender;

      if (Object.keys(allowedUpdates).length === 0) {
        if (assignmentFormClass !== undefined) {
          if (assignmentFormClass) {
            await appService.assignClassMaster(assignmentFormClass, userId);
          } else {
            await clearClassMastersForTeacher(userId);
          }
        }
        if (assignmentHouse !== undefined) {
          if (assignmentHouse) {
            await appService.assignHouseMaster(assignmentHouse, userId);
          } else {
            await clearHouseMastersForTeacher(userId);
          }
        }
        if (Array.isArray(assignmentSubjects)) {
          await assignTeacherSubjects(userId, assignmentSubjects);
        }
        return success(mapUserModel(existing), 'No profile changes applied');
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: allowedUpdates,
      });
      if (assignmentFormClass !== undefined) {
        if (assignmentFormClass) {
          await appService.assignClassMaster(assignmentFormClass, userId);
        } else {
          await clearClassMastersForTeacher(userId);
        }
      }
      if (assignmentHouse !== undefined) {
        if (assignmentHouse) {
          await appService.assignHouseMaster(assignmentHouse, userId);
        } else {
          await clearHouseMastersForTeacher(userId);
        }
      }
      if (Array.isArray(assignmentSubjects)) {
        await assignTeacherSubjects(userId, assignmentSubjects);
      }
      return success(mapUserModel(updated), 'Profile updated successfully');
    } catch (error) {
      return failure('Failed to update profile', {} as User);
    }
  },

  deleteUser: async (userId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      await prisma.user.delete({ where: { id: userId } });
      return success(true, 'User deleted successfully');
    } catch (error) {
      return failure('Unable to delete user', false as unknown as boolean);
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

  createTeacher: async (
    payload: Partial<User> & { formClass?: string; house?: string; subjectIds?: string[] },
  ): Promise<ApiResponse<User>> => {
    await wait(100);
    const schoolId = payload.schoolId ?? (await getDefaultSchoolId());
    const plainPassword = Math.random().toString(36).slice(-8);
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const created = await prisma.user.create({
      data: {
        name: payload.name || 'New Staff',
        email: payload.email || `staff.${Date.now()}@school.edu`,
        password: hashedPassword,
        role: payload.role || UserRole.TEACHER,
        avatar: payload.avatar ?? avatarFromName(payload.name || 'Staff'),
        gender: payload.gender ?? undefined,
        phone: payload.phone ?? undefined,
        bio: payload.bio ?? undefined,
        school: { connect: { id: schoolId } },
      },
    });

    try {
      if (payload.formClass !== undefined) {
        if (payload.formClass) {
          await appService.assignClassMaster(payload.formClass, created.id);
        } else {
          await clearClassMastersForTeacher(created.id);
        }
      }
      if (payload.house !== undefined) {
        if (payload.house) {
          await appService.assignHouseMaster(payload.house, created.id);
        } else {
          await clearHouseMastersForTeacher(created.id);
        }
      }
      if (Array.isArray(payload.subjectIds)) {
        await assignTeacherSubjects(created.id, payload.subjectIds);
      }
    } catch (error) {
      console.error('Failed to assign teacher roles', error);
    }

    return success(mapUserModel(created), `Temporary password: ${plainPassword}`);
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    await wait(100);
    const students = await prisma.student.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
    });
    return success(students.map(mapStudentModel));
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    await wait(100);
    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: {
          ...updates,
          house: updates.house,
          enrollmentDate: updates.enrollmentDate ? toDateOnly(updates.enrollmentDate) : undefined,
        },
      });
      return success(mapStudentModel(updated), 'Student updated successfully');
    } catch (error) {
      return failure('Student not found', {} as Student);
    }
  },

  deleteStudent: async (studentId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      await prisma.student.delete({ where: { id: studentId } });
      return success(true, 'Student deleted successfully');
    } catch (error) {
      return failure('Unable to delete student', false as unknown as boolean);
    }
  },

  createStudent: async (payload: Partial<Student>): Promise<ApiResponse<Student>> => {
    await wait(100);
    const schoolId = payload.schoolId ?? (await getDefaultSchoolId());
    const accessCode = `STU-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    const resultAccessCode = `RES-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const created = await prisma.student.create({
      data: {
        name: payload.name || 'New Student',
        gender: (payload.gender as any) || 'Male',
        grade: payload.grade || 'Unassigned',
        house: payload.house || 'Unassigned',
        enrollmentDate: payload.enrollmentDate ? toDateOnly(payload.enrollmentDate) : new Date(),
        status: (payload.status as any) || 'Active',
        gpa: payload.gpa ?? 0,
        attendance: payload.attendance ?? 0,
        accessCode,
        resultAccessCode,
        enrolledSubjects: payload.enrolledSubjects ?? [],
        school: { connect: { id: schoolId } },
      },
    });

    return success(mapStudentModel(created), `Access Code: ${accessCode}`);
  },

  promoteStudents: async (input: {
    schoolId?: string;
    term: string;
    year: number;
    nextGradeByCurrent?: Record<string, string>;
    graduatingGrades?: string[];
    eligibleStudentIds?: string[];
  }): Promise<ApiResponse<{ promoted: number; graduated: number; skipped: number }>> => {
    await wait(150);
    const schoolId = input.schoolId ?? (await getDefaultSchoolId());
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        ...(input.eligibleStudentIds?.length ? { id: { in: input.eligibleStudentIds } } : {}),
      },
    });

    const graduatingDefaults = ['primary5', 'jss3', 'sss3'];
    const graduatingKeys = new Set(
      [...graduatingDefaults, ...(input.graduatingGrades || [])].map((g) => normalizeKey(g)),
    );

    const promotionMap = new Map<string, string>();
    if (input.nextGradeByCurrent) {
      Object.entries(input.nextGradeByCurrent).forEach(([key, value]) => {
        promotionMap.set(normalizeKey(key), value);
      });
    }

    const graduateIds: string[] = [];
    const graduateRecords: Prisma.GraduatedStudentCreateManyInput[] = [];
    const promoteOps: Prisma.PrismaPromise<any>[] = [];
    let skipped = 0;

    for (const student of students) {
      const gradeKey = normalizeKey(student.grade);
      const shouldGraduate = isThirdTerm(input.term) && graduatingKeys.has(gradeKey);

      if (shouldGraduate) {
        graduateIds.push(student.id);
        graduateRecords.push({
          schoolId,
          studentId: student.id,
          name: student.name,
          gender: student.gender,
          grade: student.grade,
          house: (student as any).house ?? 'Unassigned',
          level: getGraduationLevel(student.grade),
          term: input.term,
          year: input.year,
        });
        continue;
      }

      const mappedNext = promotionMap.get(gradeKey);
      const computedNext = mappedNext || getNextGrade(student.grade);
      if (!computedNext) {
        skipped += 1;
        continue;
      }

      promoteOps.push(
        prisma.student.update({
          where: { id: student.id },
          data: { grade: computedNext },
        }),
      );
    }

    const tx: Prisma.PrismaPromise<any>[] = [];
    if (graduateRecords.length) {
      tx.push(prisma.graduatedStudent.createMany({ data: graduateRecords }));
    }
    if (graduateIds.length) {
      tx.push(prisma.student.deleteMany({ where: { id: { in: graduateIds } } }));
    }
    tx.push(...promoteOps);

    if (tx.length) {
      await prisma.$transaction(tx);
    }

    return success({
      promoted: promoteOps.length,
      graduated: graduateRecords.length,
      skipped,
    }, 'Promotion completed');
  },

  getGraduatedStudents: async (filters: {
    schoolId?: string;
    level?: string;
    year?: number;
    term?: string;
  }): Promise<ApiResponse<GraduatedStudent[]>> => {
    await wait(100);
    const where: Prisma.GraduatedStudentWhereInput = {};
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.level) where.level = filters.level;
    if (filters.year) where.year = filters.year;
    if (filters.term) where.term = filters.term;

    const records = await prisma.graduatedStudent.findMany({
      where,
      orderBy: { archivedAt: 'desc' },
    });
    return success(records.map(mapGraduatedStudentModel));
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    await wait(100);
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return success(subjects.map(mapSubjectModel));
  },

  getSubjectsBySchool: async (schoolId?: string): Promise<ApiResponse<Subject[]>> => {
    await wait(100);
    const subjects = await prisma.subject.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { name: 'asc' },
    });
    return success(subjects.map(mapSubjectModel));
  },

  createSubject: async (subjectData: { name: string; teacherId?: string }): Promise<ApiResponse<Subject>> => {
    await wait(100);
    const schoolId = await getSchoolIdForUser(subjectData.teacherId);
    const teacherConnect = subjectData.teacherId ? { connect: { id: subjectData.teacherId } } : undefined;
    const created = await prisma.subject.create({
      data: {
        name: subjectData.name,
        schedule: 'TBD',
        room: 'TBD',
        school: { connect: { id: schoolId } },
        ...(teacherConnect ? { teacher: teacherConnect } : {}),
      },
    });
    return success(mapSubjectModel(created), 'Subject enrolled successfully');
  },

  updateSubject: async (
    subjectId: string,
    updates: Partial<Subject> & { teacherId?: string | null },
  ): Promise<ApiResponse<Subject>> => {
    await wait(100);
    try {
      const data: Prisma.SubjectUpdateInput = {};
      if (typeof updates.name === 'string') data.name = updates.name;
      if (typeof updates.schedule === 'string') data.schedule = updates.schedule;
      if (typeof updates.room === 'string') data.room = updates.room;
      if ('teacherId' in updates) {
        data.teacherId = updates.teacherId ? updates.teacherId : null;
      }

      const updated = await prisma.subject.update({
        where: { id: subjectId },
        data,
      });
      return success(mapSubjectModel(updated), 'Subject updated successfully');
    } catch (error) {
      return failure('Failed to update subject', {} as Subject);
    }
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    await wait(100);
    const schemes = await prisma.schemeSubmission.findMany({ orderBy: { uploadDate: 'desc' } });
    return success(schemes.map(mapSchemeModel));
  },

  uploadScheme: async (
    fileName: string,
    metadata: Record<string, unknown>,
  ): Promise<ApiResponse<{ id: string }>> => {
    await wait(100);
    const subjectName = (metadata.subjectName as string) || 'Unknown Subject';
    const subject = await prisma.subject.findFirst({ where: { name: subjectName } });
    const schoolId = subject?.schoolId ?? (await getDefaultSchoolId());
    const scheme = await prisma.schemeSubmission.create({
      data: {
        school: { connect: { id: schoolId } },
        ...(subject?.id ? { subject: { connect: { id: subject.id } } } : {}),
        subjectName,
        term: (metadata.term as string) || 'Term 1',
        status: 'Pending',
        fileName: fileName || 'upload.bin',
      },
    });
    return success({ id: scheme.id }, 'Scheme uploaded successfully');
  },

  getAssessments: async (
    subjectId?: string,
    term?: string,
    studentId?: string,
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

    const where: Prisma.AssessmentWhereInput = {
      ...(term ? { term } : {}),
      ...(studentId ? { studentId } : {}),
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

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
    const studentSchoolMap = new Map<string, string>();
    await Promise.all(
      assessments.map((assessment) => {
        const resolveSchoolId = async () => {
          if (studentSchoolMap.has(assessment.studentId)) {
            return studentSchoolMap.get(assessment.studentId) as string;
          }
          const schoolId = await getSchoolIdForStudent(assessment.studentId);
          studentSchoolMap.set(assessment.studentId, schoolId);
          return schoolId;
        };
        return resolveSchoolId().then((schoolId) => {
        const updateData: Prisma.AssessmentUpdateInput = {
          ca1: assessment.ca1,
          ca2: assessment.ca2,
          ca3: assessment.ca3,
          exam: assessment.exam,
          term: assessment.term,
        };
        const createData: Prisma.AssessmentCreateInput = {
          term: assessment.term,
          ca1: assessment.ca1,
          ca2: assessment.ca2,
          ca3: assessment.ca3,
          exam: assessment.exam,
          school: { connect: { id: schoolId } },
          student: { connect: { id: assessment.studentId } },
          subject: { connect: { id: assessment.subjectId } },
        };

        if (assessment.id) {
          return prisma.assessment.upsert({
            where: { id: assessment.id },
            update: updateData,
            create: { ...createData, id: assessment.id },
          });
        }

        return prisma.assessment.create({ data: createData });
        });
      }),
    );
    return success({ success: true }, 'Assessments saved successfully');
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    await wait(100);
    const results = await prisma.result.findMany({
      where: studentId ? { studentId } : undefined,
      include: { student: true },
    });
    return success(results.map(mapResultModel));
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
    const studentSchoolMap = new Map<string, string>();
    const term3Candidates = new Set<string>();
    await Promise.all(
      newResults.map(async (result) => {
        const resolveSchoolId = async () => {
          if (studentSchoolMap.has(result.studentId)) {
            return studentSchoolMap.get(result.studentId) as string;
          }
          const schoolId = await getSchoolIdForStudent(result.studentId);
          studentSchoolMap.set(result.studentId, schoolId);
          return schoolId;
        };

        const schoolId = await resolveSchoolId();
        const subjectName = result.subjectName || 'General Studies';
        const term = result.term || 'Term 1';
        const normalizedStatus: ResultStatus =
          result.status === 'withheld'
            ? 'withheld'
            : result.status === 'Draft'
              ? 'incomplete'
              : 'passed';
        if (isThirdTerm(term) && normalizedStatus !== 'withheld' && normalizedStatus !== 'incomplete') {
          term3Candidates.add(result.studentId);
        }

        const updateData: Prisma.ResultUpdateInput = {
          average: result.average,
          grade: result.grade,
          status: normalizedStatus,
          remarks: result.remarks,
          details: (result.details as Prisma.JsonValue) ?? undefined,
        };
        const createData: Prisma.ResultCreateInput = {
          subjectName,
          term,
          average: result.average,
          grade: result.grade,
          status: normalizedStatus,
          remarks: result.remarks,
          details: (result.details as Prisma.JsonValue) ?? undefined,
          school: { connect: { id: schoolId } },
          student: { connect: { id: result.studentId } },
        };
        return prisma.result.upsert({
          where: {
            schoolId_studentId_subjectName_term: {
              schoolId,
              studentId: result.studentId,
              subjectName,
              term,
            },
          },
          update: updateData,
          create: createData,
        });
      }),
    );

    if (term3Candidates.size) {
      const promotionTerm =
        newResults.find((result) => result.term && isThirdTerm(result.term))?.term || 'Term 3';
      const eligibleBySchool = new Map<string, string[]>();
      const requiredTerms = ['term1', 'term2', 'term3'];

      for (const studentId of term3Candidates) {
        const schoolId = studentSchoolMap.get(studentId) ?? (await getSchoolIdForStudent(studentId));
        const results = await prisma.result.findMany({
          where: {
            schoolId,
            studentId,
            status: { notIn: ['withheld', 'incomplete'] },
          },
          select: { term: true, average: true },
        });

        const termBuckets = new Map<string, number[]>();
        results.forEach((entry) => {
          const key = toTermKey(entry.term ?? '');
          if (!requiredTerms.includes(key)) return;
          const bucket = termBuckets.get(key) ?? [];
          bucket.push(entry.average);
          termBuckets.set(key, bucket);
        });

        if (!requiredTerms.every((key) => (termBuckets.get(key)?.length ?? 0) > 0)) {
          continue;
        }

        const termAverages = requiredTerms.map((key) => averageOf(termBuckets.get(key) as number[]));
        const overallAverage = averageOf(termAverages);

        if (overallAverage >= PASS_MARK) {
          const list = eligibleBySchool.get(schoolId) ?? [];
          list.push(studentId);
          eligibleBySchool.set(schoolId, list);
        }
      }

      if (eligibleBySchool.size) {
        const year = new Date().getFullYear();
        await Promise.all(
          [...eligibleBySchool.entries()].map(([schoolId, studentIds]) =>
            appService.promoteStudents({
              schoolId,
              term: promotionTerm,
              year,
              eligibleStudentIds: studentIds,
            }),
          ),
        );
      }
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
    const schoolId = examId ? await getSchoolIdForExam(examId) : await getSchoolIdForUser(teacherId);
    const questionPayload = questions.map((question) => ({
      type: question.type,
      text: question.text,
      options: question.options ?? undefined,
      correctAnswer: question.correctAnswer ?? undefined,
      points: question.points,
      isAutoGrade: question.isAutoGrade ?? false,
      rubric: question.rubric ?? undefined,
      school: { connect: { id: schoolId } },
    }));

    if (examId) {
      const updated = await prisma.exam.update({
        where: { id: examId },
        data: {
          title,
          ...(teacherId ? { teacher: { connect: { id: teacherId } } } : {}),
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
        school: { connect: { id: schoolId } },
        ...(teacherId ? { teacher: { connect: { id: teacherId } } } : {}),
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
      await prisma.exam.update({ where: { id }, data: { status } });
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
    const schoolId = await getSchoolIdForExam(examId);
    let session = await prisma.examSession.findUnique({
      where: { schoolId_examId_studentId: { schoolId, examId, studentId } },
    });

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          school: { connect: { id: schoolId } },
          exam: { connect: { id: examId } },
          student: { connect: { id: studentId } },
          status: 'in_progress',
          progress: 0,
          startTime: new Date(),
          answers: toInputJson({}),
        },
      });
    } else if (session.status !== 'submitted') {
      session = await prisma.examSession.update({
        where: { schoolId_examId_studentId: { schoolId, examId, studentId } },
        data: {
          status: 'in_progress',
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
    const schoolId = await getSchoolIdForExam(examId);
    const session = await prisma.examSession.findUnique({
      where: { schoolId_examId_studentId: { schoolId, examId, studentId } },
    });

    if (!session || session.status === 'submitted') {
      return failure('Session not found', false as unknown as boolean);
    }

    const data: Prisma.ExamSessionUpdateInput = { progress };
    if (answers) {
      data.answers = toInputJson(answers);
    }

    await prisma.examSession.update({
      where: { schoolId_examId_studentId: { schoolId, examId, studentId } },
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
      ? await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } })
      : await prisma.exam.findFirst({ where: { status: 'active' }, include: { questions: true } });

    if (!exam) {
      return failure('No active exam found', false as unknown as boolean);
    }
    const schoolId = exam.schoolId;

    let calculatedScore = 0;

    for (const question of exam.questions) {
      const answer = answers[question.id];
      if (!answer) continue;

      if (question.type !== 'essay') {
        if (answer === question.correctAnswer) {
          calculatedScore += question.points;
        }
      } else if (question.isAutoGrade) {
        // Grade essay
        const { score: aiScore } = await gradeEssay(question.text, answer, question.rubric || '', question.points);
        calculatedScore += aiScore;
      }
      // For manual essays, score remains 0 or as sent, but since we're calculating, perhaps add manual later
    }

    // Use calculated score instead of passed score
    const finalScore = calculatedScore;

    await prisma.examSession.upsert({
      where: { schoolId_examId_studentId: { schoolId, examId: exam.id, studentId } },
      update: {
        status: 'submitted',
        progress: 100,
        score: finalScore,
        endTime: new Date(),
        answers: toInputJson(answers),
      },
      create: {
        school: { connect: { id: schoolId } },
        exam: { connect: { id: exam.id } },
        student: { connect: { id: studentId } },
        status: 'submitted',
        progress: 100,
        score: finalScore,
        startTime: new Date(),
        endTime: new Date(),
        answers: toInputJson(answers),
      },
    });

    return success(true);
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AppAttendanceRecord[]>> => {
    await wait(100);
    const { start, end } = getDateBounds(date);
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: start, lt: end },
        ...(grade ? { student: { grade } } : {}),
      },
      include: { student: true },
    });
    return success(records.map(mapAttendanceModel));
  },

  markAttendance: async (updates: AppAttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const studentSchoolMap = new Map<string, string>();
    await Promise.all(
      updates.map(async (update) => {
        let schoolId = studentSchoolMap.get(update.studentId);
        if (!schoolId) {
          schoolId = await getSchoolIdForStudent(update.studentId);
          studentSchoolMap.set(update.studentId, schoolId);
        }
        return prisma.attendanceRecord.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId,
              studentId: update.studentId,
              date: toDateOnly(update.date),
            },
          },
          update: { status: update.status },
          create: {
            school: { connect: { id: schoolId } },
            student: { connect: { id: update.studentId } },
            status: update.status,
            date: toDateOnly(update.date),
          },
        });
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
    const schoolId = await getDefaultSchoolId();
    const created = await prisma.announcement.create({
      data: { title, message, targetAudience, source, schoolId },
    });
    return success(mapAnnouncementModel(created), 'Announcement created');
  },

  logAIActivity: async (input: {
    action: string;
    scope?: AIActivity['scope'];
    status?: AIActivity['status'];
    actorId?: string;
    actorRole?: UserRole;
    schoolId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<AIActivity>> => {
    await wait(30);
    const prismaAny = prisma as any;
    const schoolId = input.schoolId ?? (await getDefaultSchoolId());
    const created = await prismaAny.aIActivity.create({
      data: {
        action: input.action,
        scope: input.scope ?? 'general',
        status: input.status ?? 'success',
        actorId: input.actorId,
        actorRole: input.actorRole,
        schoolId,
        metadata: input.metadata ? toInputJson(input.metadata) : undefined,
      },
      include: { user: true },
    });
    return success(mapAIActivityModel(created));
  },

  getAIActivities: async (filters: {
    limit?: number;
    actorId?: string;
    schoolId?: string;
    role?: UserRole;
    status?: AIActivity['status'];
    scope?: AIActivity['scope'];
  }): Promise<ApiResponse<AIActivity[]>> => {
    await wait(30);
    const prismaAny = prisma as any;
    const take = Math.min(Math.max(filters.limit ?? 25, 1), 200);
    const where: any = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.role) where.actorRole = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.scope) where.scope = filters.scope;

    const activities = await prismaAny.aIActivity.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return success(activities.map(mapAIActivityModel));
  },

  recordProctorFrame: async (
    examId: string,
    studentId: string,
    frameData: string,
  ): Promise<ApiResponse<{ stored: boolean }>> => {
    await wait(20);
    console.log('[proctor-frame]', examId, studentId, frameData.slice(0, 64));

    // Analyze frame for anomalies
    const analysis = await analyzeProctorFrame(frameData);
    if (analysis.anomaly) {
      const schoolId = await getSchoolIdForExam(examId);
      // Create alert
      await prisma.proctoringAlert.create({
        data: {
          school: { connect: { id: schoolId } },
          exam: { connect: { id: examId } },
          student: { connect: { id: studentId } },
          description: analysis.description,
        },
      });
      console.log('[proctor-alert]', examId, studentId, analysis.description);
    }

    return success({ stored: true });
  },

  getLiveClasses: async (): Promise<ApiResponse<LiveClass[]>> => {
    await wait(50);
    const classes = await prisma.liveClass.findMany({ orderBy: { scheduledTime: 'asc' } });
    return success(classes.map(mapLiveClassModel));
  },

  createLiveClass: async (
    subjectId: string | undefined,
    teacherId: string | undefined,
    scheduledTime: string,
    meetingLink: string,
  ): Promise<ApiResponse<LiveClass>> => {
    await wait(50);
    const schoolId = subjectId
      ? await getSchoolIdForSubject(subjectId)
      : await getSchoolIdForUser(teacherId);
    const created = await prisma.liveClass.create({
      data: {
        school: { connect: { id: schoolId } },
        ...(subjectId ? { subject: { connect: { id: subjectId } } } : {}),
        ...(teacherId ? { teacher: { connect: { id: teacherId } } } : {}),
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
    const schoolId = await getSchoolIdForUser(teacherId);
    await prisma.classMaster.upsert({
      where: { schoolId_grade: { schoolId, grade } },
      update: { teacher: { connect: { id: teacherId } } },
      create: {
        grade,
        school: { connect: { id: schoolId } },
        teacher: { connect: { id: teacherId } },
      },
    });
    return success(true);
  },

  getHouseMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    await wait(100);
    const masters = await prisma.houseMaster.findMany();
    const store = masters.reduce<Record<string, string>>((acc, item) => {
      acc[item.house] = item.teacherId;
      return acc;
    }, {} as Record<string, string>);
    return success(store);
  },

  assignHouseMaster: async (house: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const schoolId = await getSchoolIdForUser(teacherId);
    await prisma.houseMaster.upsert({
      where: { schoolId_house: { schoolId, house } },
      update: { teacher: { connect: { id: teacherId } } },
      create: {
        house,
        school: { connect: { id: schoolId } },
        teacher: { connect: { id: teacherId } },
      },
    });
    return success(true);
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    try {
      const schoolId = await getSchoolIdForExam(examId);
      await prisma.examSession.delete({
        where: { schoolId_examId_studentId: { schoolId, examId, studentId } },
      });
      return success(true);
    } catch (error) {
      return failure('Session not found', false as unknown as boolean);
    }
  },

  joinLiveClass: async (liveClassId: string, userId: string): Promise<ApiResponse<any>> => {
    await wait(50);
    try {
      const schoolId = await getSchoolIdForUser(userId);
      const participant = await prisma.liveClassParticipant.upsert({
        where: { liveClassId_userId: { liveClassId, userId } },
        update: { leftAt: null },
        create: {
          userId,
          school: { connect: { id: schoolId } },
          liveClass: { connect: { id: liveClassId } },
        },
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
    cameraOn: boolean,
    microphoneOn: boolean,
  ): Promise<ApiResponse<any>> => {
    await wait(30);
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

  raiseHand: async (liveClassId: string, userId: string, raised: boolean): Promise<ApiResponse<any>> => {
    await wait(30);
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

  sendLiveClassMessage: async (liveClassId: string, userId: string, message: string): Promise<ApiResponse<any>> => {
    await wait(30);
    if (!message.trim()) {
      return failure('Message cannot be empty', null);
    }
    try {
      const schoolId = await getSchoolIdForUser(userId);
      const created = await prisma.liveClassMessage.create({
        data: {
          userId,
          message: message.trim(),
          school: { connect: { id: schoolId } },
          liveClass: { connect: { id: liveClassId } },
        },
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
      const schoolId = await getSchoolIdForLiveClass(liveClassId);
      const recording = await prisma.liveClassRecording.create({
        data: {
          recordingUrl,
          school: { connect: { id: schoolId } },
          liveClass: { connect: { id: liveClassId } },
        },
      });
      await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { status: 'active' },
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
        data: { status: 'ended' },
      });
      return success(updated, 'Recording stopped');
    } catch (error) {
      return failure('Failed to stop recording', null);
    }
  },
};
