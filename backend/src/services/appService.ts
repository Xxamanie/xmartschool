import { v4 as uuid } from 'uuid';
import {
  ActiveExam,
  ApiResponse,
  Assessment,
  AttendanceRecord,
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
import {
  MOCK_ASSESSMENTS,
  MOCK_RESULTS,
  MOCK_SCHEMES,
  MOCK_SCHOOLS,
  MOCK_STUDENTS,
  MOCK_SUBJECTS,
  MOCK_SUPER_ADMIN,
  MOCK_USER,
} from '../data/mockData';

const wait = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let studentsStore: Student[] = JSON.parse(JSON.stringify(MOCK_STUDENTS));
let resultsStore: ResultData[] = JSON.parse(JSON.stringify(MOCK_RESULTS));
let schoolsStore: School[] = JSON.parse(JSON.stringify(MOCK_SCHOOLS));
let usersStore: User[] = [JSON.parse(JSON.stringify(MOCK_USER)), JSON.parse(JSON.stringify(MOCK_SUPER_ADMIN))];
let assessmentsStore: Assessment[] = JSON.parse(JSON.stringify(MOCK_ASSESSMENTS));
let examSessionsStore: ExamSession[] = [];
let subjectsStore: Subject[] = JSON.parse(JSON.stringify(MOCK_SUBJECTS));
let attendanceStore: AttendanceRecord[] = [];
let classMastersStore: Record<string, string> = { '10th': 'u1', '11th': 't3' };

let examsStore: ActiveExam[] = [
  {
    id: 'exam_001',
    title: 'Term 1 General Knowledge',
    status: 'active',
    duration: 45,
    teacherId: 'u1',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        text: 'What is the powerhouse of the cell?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cytoplasm'],
        correctAnswer: 'Mitochondria',
        points: 5,
      },
      {
        id: 'q2',
        type: 'true-false',
        text: 'The sun revolves around the earth.',
        options: [],
        correctAnswer: 'False',
        points: 5,
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        text: 'Which element has the chemical symbol O?',
        options: ['Gold', 'Oxygen', 'Osmium', 'Olive Oil'],
        correctAnswer: 'Oxygen',
        points: 5,
      },
    ],
  },
  {
    id: 'exam_002',
    title: 'Mathematics Mid-Term',
    status: 'scheduled',
    duration: 60,
    teacherId: 'u1',
    questions: [
      {
        id: 'mq1',
        type: 'short-answer',
        text: 'What is 12 * 12?',
        correctAnswer: '144',
        points: 2,
      },
      {
        id: 'mq2',
        type: 'multiple-choice',
        text: 'Solve for x: 2x = 10',
        options: ['2', '5', '10', '20'],
        correctAnswer: '5',
        points: 2,
      },
    ],
  },
  {
    id: 'exam_003',
    title: 'Physics Pop Quiz',
    status: 'active',
    duration: 15,
    teacherId: 'u1',
    questions: [
      {
        id: 'pq1',
        type: 'true-false',
        text: 'Velocity is a vector quantity.',
        options: [],
        correctAnswer: 'True',
        points: 5,
      },
    ],
  },
];

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

export const appService = {
  health: async (): Promise<ApiResponse<{ status: string }>> => {
    await wait(100);
    return success({ status: 'healthy' });
  },

  login: async (email: string): Promise<ApiResponse<User>> => {
    await wait(100);
    if (email === 'creator@smartschool.edu') {
      return success(MOCK_SUPER_ADMIN);
    }

    if (email.includes('admin')) {
      const adminUser: User = {
        ...MOCK_USER,
        role: UserRole.ADMIN,
        name: 'School Principal',
        email,
        id: 'admin1',
      };
      if (!usersStore.find((u) => u.id === adminUser.id)) {
        usersStore.push(adminUser);
      }
      return success(adminUser);
    }

    const existing = usersStore.find((u) => u.id === 'u1');
    return success(existing || MOCK_USER);
  },

  verifyStudent: async (schoolCode: string, studentCode: string): Promise<ApiResponse<User>> => {
    await wait(100);
    const school = schoolsStore.find((s) => s.code === schoolCode);
    if (!school) {
      return failure('Invalid School Code', {} as User);
    }

    const student = studentsStore.find((s) => s.accessCode === studentCode && s.schoolId === school.id);
    if (!student) {
      return failure('Invalid Student Access Code', {} as User);
    }

    return success({
      id: student.id,
      name: student.name,
      role: UserRole.STUDENT,
      email: '',
      schoolId: school.id,
      avatar: `https://ui-avatars.com/api/?name=${student.name}&background=random`,
      gender: student.gender,
    });
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<ApiResponse<User>> => {
    await wait(100);
    const idx = usersStore.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      usersStore[idx] = { ...usersStore[idx], ...updates };
      return success(usersStore[idx], 'Profile updated successfully');
    }
    const fallback = { ...MOCK_USER, ...updates };
    return success(fallback, 'Profile updated successfully');
  },

  getSchools: async (): Promise<ApiResponse<School[]>> => {
    await wait(100);
    return success(schoolsStore);
  },

  createSchool: async (school: Partial<School>): Promise<ApiResponse<School>> => {
    await wait(100);
    const newSchool: School = {
      id: uuid(),
      name: school.name || 'New School',
      code: school.code || `SCH-${Math.floor(Math.random() * 1000)}`,
      region: school.region || 'Default Region',
      adminName: school.adminName || 'Admin',
      status: 'Active',
      studentCount: school.studentCount ?? 0,
    };
    schoolsStore.push(newSchool);
    return success(newSchool, 'School created successfully');
  },

  deleteSchool: async (id: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    schoolsStore = schoolsStore.filter((s) => s.id !== id);
    return success(true, 'School deleted successfully');
  },

  updateSchoolStatus: async (id: string, status: 'Active' | 'Inactive'): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const idx = schoolsStore.findIndex((s) => s.id === id);
    if (idx >= 0) {
      schoolsStore[idx] = { ...schoolsStore[idx], status };
    }
    return success(true);
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    await wait(100);
    const users: User[] = [
      ...usersStore,
      ...studentsStore.map((s) => ({
        id: s.id,
        name: s.name,
        role: UserRole.STUDENT,
        email: `student.${s.id}@school.edu`,
        schoolId: s.schoolId,
        avatar: `https://ui-avatars.com/api/?name=${s.name}&background=random`,
        gender: s.gender,
      })),
      {
        id: 't2',
        name: 'Sarah Connor',
        email: 'sarah@westside.edu',
        role: UserRole.ADMIN,
        schoolId: 'sch_002',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Connor&background=random',
        gender: 'Female',
      },
      {
        id: 't3',
        name: 'John Doe',
        email: 'john@westside.edu',
        role: UserRole.TEACHER,
        schoolId: 'sch_002',
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=random',
        gender: 'Male',
      },
    ];
    return success(users);
  },

  getStudents: async (schoolId?: string): Promise<ApiResponse<Student[]>> => {
    await wait(100);
    const data = schoolId ? studentsStore.filter((s) => s.schoolId === schoolId) : studentsStore;
    return success(data);
  },

  updateStudent: async (studentId: string, updates: Partial<Student>): Promise<ApiResponse<Student>> => {
    await wait(100);
    const idx = studentsStore.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      studentsStore[idx] = { ...studentsStore[idx], ...updates };
      return success(studentsStore[idx], 'Student updated successfully');
    }
    return failure('Student not found', {} as Student);
  },

  getSubjects: async (): Promise<ApiResponse<Subject[]>> => {
    await wait(100);
    return success(subjectsStore);
  },

  createSubject: async (subjectData: { name: string; teacherId?: string }): Promise<ApiResponse<Subject>> => {
    await wait(100);
    const newSubject: Subject = {
      id: uuid(),
      name: subjectData.name,
      teacherId: subjectData.teacherId || 'u1',
      schedule: 'TBD',
      room: 'TBD',
    };
    subjectsStore.push(newSubject);
    return success(newSubject, 'Subject enrolled successfully');
  },

  getSchemes: async (): Promise<ApiResponse<SchemeSubmission[]>> => {
    await wait(100);
    return success(MOCK_SCHEMES);
  },

  uploadScheme: async (fileName: string, metadata: Record<string, unknown>): Promise<ApiResponse<{ id: string }>> => {
    await wait(100);
    const id = uuid();
    const newScheme: SchemeSubmission = {
      id,
      subjectName: (metadata.subjectName as string) || 'Unknown Subject',
      term: (metadata.term as string) || 'Term 1',
      uploadDate: new Date().toISOString(),
      status: 'Pending',
      fileName: fileName || 'upload.bin',
    };
    MOCK_SCHEMES.push(newScheme);
    return success({ id }, 'Scheme uploaded successfully');
  },

  getAssessments: async (subjectId?: string, term?: string): Promise<ApiResponse<Assessment[]>> => {
    await wait(100);
    let data = assessmentsStore;
    if (subjectId) data = data.filter((a) => a.subjectId === subjectId);
    if (term) data = data.filter((a) => a.term === term);
    return success(data);
  },

  saveAssessments: async (assessments: Assessment[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
    assessments.forEach((updated) => {
      const idx = assessmentsStore.findIndex((a) => a.id === updated.id);
      if (idx >= 0) {
        assessmentsStore[idx] = updated;
      } else {
        assessmentsStore.push(updated);
      }
    });
    return success({ success: true }, 'Assessments saved successfully');
  },

  getResults: async (studentId?: string): Promise<ApiResponse<ResultData[]>> => {
    await wait(100);
    if (studentId) {
      return success(resultsStore.filter((r) => r.studentId === studentId));
    }
    return success(resultsStore);
  },

  publishResults: async (newResults: ResultData[]): Promise<ApiResponse<{ success: boolean }>> => {
    await wait(100);
    newResults.forEach((newRes) => {
      const index = resultsStore.findIndex(
        (r) => r.studentId === newRes.studentId && r.subjectName === newRes.subjectName,
      );
      if (index >= 0) {
        resultsStore[index] = { ...resultsStore[index], ...newRes };
      } else {
        resultsStore.push(newRes);
      }
    });
    return success({ success: true }, 'Results published successfully');
  },

  getExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    await wait(100);
    return success(examsStore);
  },

  getAvailableExams: async (): Promise<ApiResponse<ActiveExam[]>> => {
    await wait(100);
    return success(examsStore.filter((e) => e.status === 'active'));
  },

  updateExamQuestions: async (
    questions: ExamQuestion[],
    title: string,
    examId?: string,
    teacherId?: string,
  ): Promise<ApiResponse<ActiveExam>> => {
    await wait(100);
    if (examId) {
      const idx = examsStore.findIndex((e) => e.id === examId);
      if (idx >= 0) {
        examsStore[idx] = {
          ...examsStore[idx],
          questions,
          title,
          teacherId: teacherId || examsStore[idx].teacherId,
        };
        return success(examsStore[idx]);
      }
    }
    const newExam: ActiveExam = {
      id: uuid(),
      title,
      status: 'scheduled',
      duration: 60,
      questions,
      teacherId,
    };
    examsStore.push(newExam);
    return success(newExam);
  },

  setExamStatus: async (id: string, status: 'scheduled' | 'active' | 'ended'): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const idx = examsStore.findIndex((e) => e.id === id);
    if (idx >= 0) {
      examsStore[idx].status = status;
      return success(true);
    }
    return failure('Exam not found', false as unknown as boolean);
  },

  getExamSessions: async (examId: string): Promise<ApiResponse<ExamSession[]>> => {
    await wait(100);
    const sessions = examSessionsStore.filter((s) => s.examId === examId);
    return success(sessions);
  },

  startExamSession: async (examId: string, studentId: string): Promise<ApiResponse<ExamSession>> => {
    await wait(100);
    let session = examSessionsStore.find((s) => s.examId === examId && s.studentId === studentId);
    if (!session) {
      session = {
        id: uuid(),
        examId,
        studentId,
        status: 'in-progress',
        progress: 0,
        startTime: new Date().toISOString(),
        answers: {},
      };
      examSessionsStore.push(session);
    } else if (session.status === 'not-started') {
      session.status = 'in-progress';
      session.startTime = new Date().toISOString();
    }
    return success(session);
  },

  updateExamSessionProgress: async (
    examId: string,
    studentId: string,
    progress: number,
    answers?: Record<string, string>,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const session = examSessionsStore.find((s) => s.examId === examId && s.studentId === studentId);
    if (session && session.status !== 'submitted') {
      session.progress = progress;
      if (answers) session.answers = answers;
      return success(true);
    }
    return failure('Session not found', false as unknown as boolean);
  },

  submitExam: async (
    studentId: string,
    answers: Record<string, string>,
    score: number,
    examId?: string,
  ): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const exam = examId
      ? examsStore.find((e) => e.id === examId)
      : examsStore.find((e) => e.status === 'active');
    if (!exam) return failure('No active exam found', false as unknown as boolean);

    const session = examSessionsStore.find((s) => s.examId === exam.id && s.studentId === studentId);
    if (session) {
      session.status = 'submitted';
      session.score = score;
      session.progress = 100;
      session.endTime = new Date().toISOString();
      session.answers = answers;
    } else {
      examSessionsStore.push({
        id: uuid(),
        examId: exam.id,
        studentId,
        status: 'submitted',
        progress: 100,
        score,
        startTime: new Date().toISOString(),
        answers,
      });
    }
    return success(true);
  },

  getAttendance: async (date: string, grade?: string): Promise<ApiResponse<AttendanceRecord[]>> => {
    await wait(100);
    let records = attendanceStore.filter((r) => r.date === date);
    if (grade) {
      const ids = new Set(studentsStore.filter((s) => s.grade === grade).map((s) => s.id));
      records = records.filter((r) => ids.has(r.studentId));
    }
    return success(records);
  },

  markAttendance: async (updates: AttendanceRecord[]): Promise<ApiResponse<boolean>> => {
    await wait(100);
    updates.forEach((update) => {
      const idx = attendanceStore.findIndex(
        (r) => r.date === update.date && r.studentId === update.studentId,
      );
      if (idx >= 0) {
        attendanceStore[idx] = update;
      } else {
        attendanceStore.push(update);
      }

      if (update.status === 'Absent') {
        const studentIdx = studentsStore.findIndex((s) => s.id === update.studentId);
        if (studentIdx >= 0 && studentsStore[studentIdx].attendance > 0) {
          studentsStore[studentIdx].attendance -= 1;
        }
      }
    });
    return success(true, 'Attendance marked successfully');
  },

  getClassMasters: async (): Promise<ApiResponse<Record<string, string>>> => {
    await wait(100);
    return success(classMastersStore);
  },

  assignClassMaster: async (grade: string, teacherId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    classMastersStore[grade] = teacherId;
    return success(true);
  },

  resetStudentExam: async (examId: string, studentId: string): Promise<ApiResponse<boolean>> => {
    await wait(100);
    const idx = examSessionsStore.findIndex((s) => s.examId === examId && s.studentId === studentId);
    if (idx > -1) {
      examSessionsStore.splice(idx, 1);
      return success(true);
    }
    return failure('Session not found', false as unknown as boolean);
  },
};
