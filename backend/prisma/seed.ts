import { config } from 'dotenv';
import { prisma } from '../src/lib/prisma';
import {
  MOCK_ASSESSMENTS,
  MOCK_RESULTS,
  MOCK_SCHEMES,
  MOCK_SCHOOLS,
  MOCK_STUDENTS,
  MOCK_SUBJECTS,
  MOCK_SUPER_ADMIN,
  MOCK_USER,
} from '../src/data/mockData';

config();

const seedSchools = async () => {
  await prisma.school.createMany({
    data: MOCK_SCHOOLS.map((school) => ({
      id: school.id,
      name: school.name,
      code: school.code,
      region: school.region,
      adminName: school.adminName,
      status: school.status,
      studentCount: school.studentCount,
    })),
  });
};

const seedUsers = async () => {
  await prisma.user.createMany({
    data: [MOCK_USER, MOCK_SUPER_ADMIN].map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      schoolId: user.schoolId,
      gender: user.gender,
      phone: user.phone,
      bio: user.bio,
    })),
  });
};

const seedStudents = async () => {
  await prisma.student.createMany({
    data: MOCK_STUDENTS.map((student) => ({
      id: student.id,
      name: student.name,
      gender: student.gender,
      grade: student.grade,
      enrollmentDate: new Date(student.enrollmentDate),
      status: student.status,
      gpa: student.gpa,
      attendance: student.attendance,
      schoolId: student.schoolId,
      accessCode: student.accessCode,
    })),
  });
};

const seedSubjects = async () => {
  await prisma.subject.createMany({
    data: MOCK_SUBJECTS.map((subject) => ({
      id: subject.id,
      name: subject.name,
      teacherId: subject.teacherId,
      schedule: subject.schedule,
      room: subject.room,
      schoolId: subject.teacherId ? MOCK_USER.schoolId : null,
    })),
  });
};

const seedAssessments = async () => {
  await prisma.assessment.createMany({
    data: MOCK_ASSESSMENTS.map(({ studentName, ...assessment }) => ({
      ...assessment,
    })),
  });
};

const seedResults = async () => {
  await prisma.result.createMany({
    data: MOCK_RESULTS.map(({ studentName, ...result }) => ({
      ...result,
    })),
  });
};

const seedSchemes = async () => {
  await prisma.schemeSubmission.createMany({
    data: MOCK_SCHEMES.map((scheme) => ({
      id: scheme.id,
      subjectId: MOCK_SUBJECTS.find((subject) => subject.name === scheme.subjectName)?.id,
      subjectName: scheme.subjectName,
      term: scheme.term,
      uploadDate: new Date(scheme.uploadDate),
      status: scheme.status,
      fileName: scheme.fileName,
    })),
  });
};

const main = async () => {
  await prisma.examSession.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.schemeSubmission.deleteMany();
  await prisma.result.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  await seedSchools();
  await seedUsers();
  await seedStudents();
  await seedSubjects();
  await seedAssessments();
  await seedResults();
  await seedSchemes();
};

main()
  .then(async () => {
    console.log('Database seeded successfully');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to seed database', error);
    await prisma.$disconnect();
    process.exit(1);
  });
