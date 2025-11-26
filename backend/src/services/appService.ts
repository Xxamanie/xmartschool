import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  ActiveExam,
  ApiResponse,
  Assessment,
  AttendanceRecord as AppAttendanceRecord,
  ExamQuestion,
  ExamSession,
  ResultData,
  SchemeSubmission,
  School,
  Student,
  Subject,
  User,
  UserRole,
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

type PrismaUserModel = Prisma.User;
type PrismaSchoolModel = Prisma.School;
type PrismaStudentModel = Prisma.Student;
type PrismaSubjectModel = Prisma.Subject;
type PrismaSchemeModel = Prisma.SchemeSubmission;
type PrismaAssessment = Prisma.Assessment;
type PrismaResultModel = Prisma.Result;
type PrismaExam = Prisma.Exam;
type PrismaExamQuestionModel = Prisma.ExamQuestion;
type PrismaExamSessionModel = Prisma.ExamSession;
type PrismaAttendanceRecord = Prisma.AttendanceRecord;
type PrismaClassMaster = Prisma.ClassMaster;

const toISODate = (date: Date) => date.toISOString().split('T')[0];
const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const avatarFromName = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
const toInputJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

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
  code: school.code,
  region: school.region,
  adminName: school.adminName,
  status: school.status as School['status'],
  studentCount: school.studentCount,
});

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
});

const mapSubjectModel = (subject: PrismaSubjectModel): Subject => ({
  id: subject.id,
  name: subject.name,
  teacherId: subject.teacherId ?? '',
  schedule: subject.schedule ?? 'TBD',
  room: subject.room ?? 'TBD',
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
  assessment: PrismaAssessment & { student?: PrismaStudentModel },
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

const mapExamModel = (exam: PrismaExam & { questions: PrismaExamQuestionModel[] }): ActiveExam => ({
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
  record: PrismaAttendanceRecord,
): AppAttendanceRecord => ({
  studentId: record.studentId,
  status: record.status as AppAttendanceRecord['status'],
  date: toISODate(record.date),
});

const getDateBounds = (value: string) => {
  const start = toDateOnly(value);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};

export const appService = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    await wait(100);
    return success({ status: 'healthy' });
  },

  login: async (email: string): Promise<ApiResponse<User>> => {
    await wait(100);
    const normalized = email.toLowerCase();

    if (normalized === 'creator@smartschool.edu') {
      const creator = await prisma.user.findUnique({ where: { email: normalized } });
      if (creator) {
        return success(mapUserModel(creator));
      }
    }

    if (email.includes('admin')) {
      const admin = await prisma.user.upsert({
        where: { id: 'admin1' },
        update: { email },
        create: {
          id: 'admin1',
          name: 'School Principal',
          email,
          role: 'ADMIN',
          schoolId: 'sch_001',
        },
      });
      return success(mapUserModel(admin));
    }

    const existing = await prisma.user.findFirst({ where: { email: normalized } });
    if (existing) {
      return success(mapUserModel(existing));
    }

    const fallback = await prisma.user.findUnique({ where: { id: 'u1' } });
    if (fallback) {
      return success(mapUserModel(fallback));
    }

    return success({
      id: 'temp-user',
      name: 'Smart School User',
      role: UserRole.TEACHER,
    });
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

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    await wait(100);
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
      return success(mapUserModel(updated), 'Profile updated successfully');
    } catch (error) {
      const created = await prisma.user.create({
        data: {
          id: userId,
          name: updates.name || 'Smart School User',
          role: updates.role || UserRole.TEACHER,
          email: updates.email,
          avatar: updates.avatar,
          gender: updates.gender,
          bio: updates.bio,
          phone: updates.phone,
          schoolId: updates.schoolId,
        },
      });
      return success(mapUserModel(created), 'Profile updated successfully');
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

    const studentAsUsers: User[] = students.map((student) => ({
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
          enrollmentDate: updates.enrollmentDate ? toDateOnly(updates.enrollmentDate) : undefined,
        },
      });
      return success(mapStudentModel(updated), 'Student updated successfully');
    } catch (error) {
      return failure('Student not found', {} as Student);
    }
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    await wait(100);
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return success(subjects.map(mapSubjectModel));
  },

  createSubject: async (subjectData: { name: string; teacherId?: string }): Promise<ApiResponse<Subject>> => {
    await wait(100);
    const created = await prisma.subject.create({
      data: {
        name: subjectData.name,
        teacherId: subjectData.teacherId || 'u1',
        schedule: 'TBD',
        room: 'TBD',
      },
    });
    return success(mapSubjectModel(created), 'Subject enrolled successfully');
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

  getAssessments: async (subjectId?: string, term?: string): Promise<ApiResponse<Assessment[]>> => {
    await wait(100);
    const assessments = await prisma.assessment.findMany({
      where: {
        ...(subjectId ? { subjectId } : {}),
        ...(term ? { term } : {}),
      },
      include: { student: true },
    });
    return success(assessments.map(mapAssessmentModel));
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
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
    await Promise.all(
      newResults.map((result) => {
        const subjectName = result.subjectName || 'General Studies';
        return prisma.result.upsert({
          where: {
            studentId_subjectName: {
              studentId: result.studentId,
              subjectName,
            },
          },
          update: {
            average: result.average,
            grade: result.grade,
            status: result.status,
            remarks: result.remarks,
            details: (result.details as Prisma.JsonValue) ?? undefined,
          },
          create: {
            studentId: result.studentId,
            subjectName,
            average: result.average,
            grade: result.grade,
            status: result.status,
            remarks: result.remarks,
            details: (result.details as Prisma.JsonValue) ?? undefined,
          },
        });
      }),
    );
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
    questions: ExamQuestion[],
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
    return success(true, 'Attendance marked successfully');
  },

  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    await wait(100);
    const masters: PrismaClassMaster[] = await prisma.classMaster.findMany();
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
};
