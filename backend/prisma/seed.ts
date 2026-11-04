/**
 * DEMO SEED — remove before production deployment.
 *
 * Creates three schools with teachers, students, classes, subjects,
 * assessments, results, fee templates, ledgers, and an active term
 * so every UI screen has real data to display.
 *
 * Run: cd backend && npx tsx prisma/seed.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 10);

// Colour-coded avatar URLs via ui-avatars
const avatar = (name: string, bg = '4F46E5') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128`;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production. Provision real school accounts instead.');
  }
  console.log('🌱  Seeding demo data…');

  const pw = await hash('Password1');

  // ──────────────────────────────────────────────────────────────────────────
  // SUPER ADMIN (the Creator)
  // ──────────────────────────────────────────────────────────────────────────

  await prisma.user.upsert({
    where: { email: 'creator@smartschool.edu' },
    update: {},
    create: {
      id: 'sa_001',
      name: 'SmartSchool Creator',
      email: 'creator@smartschool.edu',
      password: pw,
      role: 'SUPER_ADMIN',
      avatar: avatar('SmartSchool Creator', '0F172A'),
      gender: 'Male',
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SCHOOL 1 — Greenfield Academy (Lagos)
  // ──────────────────────────────────────────────────────────────────────────

  const gfa = await prisma.school.upsert({
    where: { code: 'GFA-001' },
    update: {},
    create: {
      id: 'sch_gfa',
      name: 'Greenfield Academy',
      code: 'GFA-001',
      region: 'Lagos',
      adminName: 'Mrs. Adaeze Okonkwo',
      status: 'Active',
      studentCount: 0,
      motto: 'Knowledge Builds Nations',
      address: '14 Adeola Odeku Street, Victoria Island, Lagos',
      contact: '+234 801 234 5678',
      gradingSystem: 'nigeria',
      themeColor: '#059669',
      principalName: 'Mrs. Adaeze Okonkwo',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@greenfield.edu' },
    update: {},
    create: {
      id: 'u_gfa_admin',
      name: 'Adaeze Okonkwo',
      email: 'admin@greenfield.edu',
      password: pw,
      role: 'ADMIN',
      schoolId: gfa.id,
      avatar: avatar('Adaeze Okonkwo', '059669'),
      gender: 'Female',
    },
  });

  const gfaT1 = await prisma.user.upsert({
    where: { email: 'chukwu.math@greenfield.edu' },
    update: {},
    create: {
      id: 'u_gfa_t1',
      name: 'Mr. Chukwuemeka Eze',
      email: 'chukwu.math@greenfield.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: gfa.id,
      avatar: avatar('Chukwuemeka Eze', '1D4ED8'),
      gender: 'Male',
    },
  });

  const gfaT2 = await prisma.user.upsert({
    where: { email: 'ngozi.english@greenfield.edu' },
    update: {},
    create: {
      id: 'u_gfa_t2',
      name: 'Mrs. Ngozi Abiodun',
      email: 'ngozi.english@greenfield.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: gfa.id,
      avatar: avatar('Ngozi Abiodun', 'D97706'),
      gender: 'Female',
    },
  });

  // Classes
  const gfaC1 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: gfa.id, name: 'SS1A' } },
    update: {},
    create: { id: 'cls_gfa_ss1a', schoolId: gfa.id, name: 'SS1A' },
  });
  const gfaC2 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: gfa.id, name: 'SS2A' } },
    update: {},
    create: { id: 'cls_gfa_ss2a', schoolId: gfa.id, name: 'SS2A' },
  });

  // Subjects
  const gfaSub1 = await prisma.subject.upsert({
    where: { id: 'sub_gfa_math' },
    update: {},
    create: {
      id: 'sub_gfa_math',
      name: 'Mathematics',
      teacherId: gfaT1.id,
      schedule: 'Mon, Wed 08:00 AM',
      room: 'Room 101',
      schoolId: gfa.id,
    },
  });
  const gfaSub2 = await prisma.subject.upsert({
    where: { id: 'sub_gfa_eng' },
    update: {},
    create: {
      id: 'sub_gfa_eng',
      name: 'English Language',
      teacherId: gfaT2.id,
      schedule: 'Tue, Thu 10:00 AM',
      room: 'Room 102',
      schoolId: gfa.id,
    },
  });
  const gfaSub3 = await prisma.subject.upsert({
    where: { id: 'sub_gfa_bio' },
    update: {},
    create: {
      id: 'sub_gfa_bio',
      name: 'Biology',
      teacherId: gfaT1.id,
      schedule: 'Fri 09:00 AM',
      room: 'Lab 1',
      schoolId: gfa.id,
    },
  });

  // Teacher assignments
  for (const [tid, sid, cid] of [
    [gfaT1.id, gfaSub1.id, gfaC1.id],
    [gfaT1.id, gfaSub1.id, gfaC2.id],
    [gfaT2.id, gfaSub2.id, gfaC1.id],
    [gfaT2.id, gfaSub2.id, gfaC2.id],
    [gfaT1.id, gfaSub3.id, gfaC1.id],
  ] as [string, string, string][]) {
    await prisma.teacherAssignment.upsert({
      where: { teacherId_subjectId_schoolClassId: { teacherId: tid, subjectId: sid, schoolClassId: cid } },
      update: {},
      create: { teacherId: tid, subjectId: sid, schoolClassId: cid },
    });
  }

  // Students
  const gfaStudents = [
    { id: 'stu_gfa_001', name: 'Emeka Nwachukwu',   gender: 'Male',   grade: 'SS1A', code: 'GFA-2024-0001', classId: gfaC1.id, gpa: 3.9, att: 95 },
    { id: 'stu_gfa_002', name: 'Fatima Al-Hassan',  gender: 'Female', grade: 'SS1A', code: 'GFA-2024-0002', classId: gfaC1.id, gpa: 3.7, att: 92 },
    { id: 'stu_gfa_003', name: 'Tunde Adeleke',     gender: 'Male',   grade: 'SS1A', code: 'GFA-2024-0003', classId: gfaC1.id, gpa: 3.5, att: 88 },
    { id: 'stu_gfa_004', name: 'Chidinma Okafor',   gender: 'Female', grade: 'SS2A', code: 'GFA-2024-0004', classId: gfaC2.id, gpa: 3.8, att: 97 },
    { id: 'stu_gfa_005', name: 'Babatunde Fashola', gender: 'Male',   grade: 'SS2A', code: 'GFA-2024-0005', classId: gfaC2.id, gpa: 3.2, att: 82 },
  ] as const;

  for (const s of gfaStudents) {
    await prisma.student.upsert({
      where: { accessCode: s.code },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        gender: s.gender,
        grade: s.grade,
        enrollmentDate: new Date('2024-09-02'),
        status: 'Active',
        gpa: s.gpa,
        attendance: s.att,
        schoolId: gfa.id,
        schoolClassId: s.classId,
        accessCode: s.code,
        enrolledSubjects: [gfaSub1.id, gfaSub2.id, gfaSub3.id],
        field: 'science',
      },
    });
  }

  await prisma.school.update({ where: { id: gfa.id }, data: { studentCount: gfaStudents.length } });

  // Academic term
  await (prisma as any).schoolTerm.upsert({
    where: { schoolId_session_term: { schoolId: gfa.id, session: '2024/2025', term: 'first' } },
    update: {},
    create: {
      schoolId: gfa.id,
      name: 'First Term 2024/2025',
      session: '2024/2025',
      term: 'first',
      startDate: new Date('2024-09-02'),
      endDate: new Date('2024-12-13'),
      isCurrent: true,
    },
  });

  // Fee template
  const gfaTemplate = await prisma.feeTemplate.upsert({
    where: { id: 'ft_gfa_t1' },
    update: {},
    create: {
      id: 'ft_gfa_t1',
      schoolId: gfa.id,
      term: 'First Term 2024/2025',
      name: 'First Term Fees',
      scopeType: 'schoolClass',
      scopeId: gfaC1.id,
      lines: {
        create: [
          { title: 'School Fees',       key: 'school_fees',    order: 0, defaultAmount: 45000 },
          { title: 'Development Levy',  key: 'dev_levy',       order: 1, defaultAmount: 5000  },
          { title: 'ICT Fee',           key: 'ict_fee',        order: 2, defaultAmount: 3000  },
          { title: 'Sports Fee',        key: 'sports_fee',     order: 3, defaultAmount: 2000  },
          { title: 'PTA Fee',           key: 'pta_fee',        order: 4, defaultAmount: 1500  },
        ],
      },
    },
    include: { lines: true },
  });

  // Ledgers + assessments for each GFA student
  const gfaAssessmentData: { subId: string; ca1: number; ca2: number; ca3: number; exam: number }[][] = [
    [ // stu_gfa_001 (Emeka — strong)
      { subId: gfaSub1.id, ca1: 18, ca2: 17, ca3: 16, exam: 62 },
      { subId: gfaSub2.id, ca1: 16, ca2: 18, ca3: 17, exam: 58 },
      { subId: gfaSub3.id, ca1: 17, ca2: 16, ca3: 18, exam: 60 },
    ],
    [ // stu_gfa_002 (Fatima — good)
      { subId: gfaSub1.id, ca1: 15, ca2: 16, ca3: 14, exam: 55 },
      { subId: gfaSub2.id, ca1: 17, ca2: 15, ca3: 16, exam: 57 },
      { subId: gfaSub3.id, ca1: 14, ca2: 15, ca3: 13, exam: 50 },
    ],
    [ // stu_gfa_003 (Tunde — average)
      { subId: gfaSub1.id, ca1: 12, ca2: 11, ca3: 13, exam: 44 },
      { subId: gfaSub2.id, ca1: 13, ca2: 12, ca3: 11, exam: 46 },
      { subId: gfaSub3.id, ca1: 11, ca2: 13, ca3: 12, exam: 42 },
    ],
    [ // stu_gfa_004 (Chidinma — excellent)
      { subId: gfaSub1.id, ca1: 19, ca2: 18, ca3: 19, exam: 65 },
      { subId: gfaSub2.id, ca1: 18, ca2: 19, ca3: 18, exam: 63 },
      { subId: gfaSub3.id, ca1: 19, ca2: 17, ca3: 19, exam: 64 },
    ],
    [ // stu_gfa_005 (Babatunde — below average)
      { subId: gfaSub1.id, ca1: 9,  ca2: 8,  ca3: 10, exam: 38 },
      { subId: gfaSub2.id, ca1: 10, ca2: 9,  ca3: 8,  exam: 40 },
      { subId: gfaSub3.id, ca1: 8,  ca2: 10, ca3: 9,  exam: 36 },
    ],
  ];

  const subjectNames: Record<string, string> = {
    [gfaSub1.id]: 'Mathematics',
    [gfaSub2.id]: 'English Language',
    [gfaSub3.id]: 'Biology',
  };

  const gradeFromScore = (s: number) => {
    if (s >= 75) return 'A1';
    if (s >= 70) return 'B2';
    if (s >= 65) return 'B3';
    if (s >= 60) return 'C4';
    if (s >= 55) return 'C5';
    if (s >= 50) return 'C6';
    if (s >= 45) return 'D7';
    if (s >= 40) return 'E8';
    return 'F9';
  };

  const remarksFromScore = (s: number) => {
    if (s >= 75) return 'Outstanding performance. Keep it up!';
    if (s >= 65) return 'Very good. Consistent effort is encouraged.';
    if (s >= 55) return 'Good. Improvement is visible.';
    if (s >= 45) return 'Average. More effort needed in key areas.';
    if (s >= 40) return 'Below average. Please seek additional support.';
    return 'Needs significant improvement. Teacher attention required.';
  };

  for (let i = 0; i < gfaStudents.length; i++) {
    const stu = gfaStudents[i];
    const assessments = gfaAssessmentData[i];

    // Assessments
    for (const a of assessments) {
      await prisma.assessment.upsert({
        where: { id: `asmnt_${stu.id}_${a.subId}` },
        update: {},
        create: {
          id: `asmnt_${stu.id}_${a.subId}`,
          studentId: stu.id,
          subjectId: a.subId,
          term: 'First Term 2024/2025',
          ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam,
        },
      });

      // Results (auto-computed from assessment scores)
      const total = a.ca1 + a.ca2 + a.ca3 + a.exam;
      await (prisma.result as any).upsert({
        where: {
          studentId_subjectName_term: {
            studentId: stu.id,
            subjectName: subjectNames[a.subId],
            term: 'First Term 2024/2025',
          },
        },
        update: {},
        create: {
          studentId: stu.id,
          subjectId: a.subId,
          subjectName: subjectNames[a.subId],
          term: 'First Term 2024/2025',
          average: total,
          grade: gradeFromScore(total),
          status: 'Published',
          remarks: remarksFromScore(total),
          details: { ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam, total },
        },
      });
    }

    // Attendance records (last 30 school days)
    const today = new Date();
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
      const roll = Math.random();
      const status: 'Present' | 'Absent' | 'Late' | 'Excused' =
        roll < 0.85 ? 'Present' : roll < 0.93 ? 'Late' : roll < 0.97 ? 'Absent' : 'Excused';
      try {
        await prisma.attendanceRecord.create({
          data: { studentId: stu.id, status, date },
        });
      } catch {
        // skip if duplicate
      }
    }

    // Fee ledger
    await (prisma as any).studentFeeLedger.upsert({
      where: {
        schoolId_term_studentId_scopeType_scopeId: {
          schoolId: gfa.id, term: 'First Term 2024/2025',
          studentId: stu.id, scopeType: 'schoolClass', scopeId: gfaC1.id,
        },
      },
      update: {},
      create: {
        schoolId: gfa.id,
        studentId: stu.id,
        term: 'First Term 2024/2025',
        scopeType: 'schoolClass',
        scopeId: gfaC1.id,
        templateId: gfaTemplate.id,
        lineItems: {
          create: gfaTemplate.lines.map((line: any) => ({
            templateLineId: line.id,
            title: line.title,
            key: line.key,
            payableAmount: line.defaultAmount,
          })),
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCHOOL 2 — Sunrise International School (Abuja)
  // ──────────────────────────────────────────────────────────────────────────

  const sis = await prisma.school.upsert({
    where: { code: 'SIS-002' },
    update: {},
    create: {
      id: 'sch_sis',
      name: 'Sunrise International School',
      code: 'SIS-002',
      region: 'Abuja',
      adminName: 'Dr. Ibrahim Musa',
      status: 'Active',
      studentCount: 0,
      motto: 'Rising to Excellence Every Day',
      address: 'Plot 45, Wuse Zone 5, Abuja',
      contact: '+234 802 345 6789',
      gradingSystem: 'british',
      themeColor: '#2563EB',
      principalName: 'Dr. Ibrahim Musa',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@sunrise.edu' },
    update: {},
    create: {
      id: 'u_sis_admin',
      name: 'Ibrahim Musa',
      email: 'admin@sunrise.edu',
      password: pw,
      role: 'ADMIN',
      schoolId: sis.id,
      avatar: avatar('Ibrahim Musa', '2563EB'),
      gender: 'Male',
    },
  });

  const sisT1 = await prisma.user.upsert({
    where: { email: 'amina.sci@sunrise.edu' },
    update: {},
    create: {
      id: 'u_sis_t1',
      name: 'Mrs. Amina Garba',
      email: 'amina.sci@sunrise.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: sis.id,
      avatar: avatar('Amina Garba', '7C3AED'),
      gender: 'Female',
    },
  });

  const sisT2 = await prisma.user.upsert({
    where: { email: 'john.soc@sunrise.edu' },
    update: {},
    create: {
      id: 'u_sis_t2',
      name: 'Mr. John Obiora',
      email: 'john.soc@sunrise.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: sis.id,
      avatar: avatar('John Obiora', 'DC2626'),
      gender: 'Male',
    },
  });

  const sisC1 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: sis.id, name: 'JSS1' } },
    update: {},
    create: { id: 'cls_sis_jss1', schoolId: sis.id, name: 'JSS1' },
  });
  const sisC2 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: sis.id, name: 'JSS2' } },
    update: {},
    create: { id: 'cls_sis_jss2', schoolId: sis.id, name: 'JSS2' },
  });

  const sisSub1 = await prisma.subject.upsert({
    where: { id: 'sub_sis_math' },
    update: {},
    create: { id: 'sub_sis_math', name: 'Mathematics', teacherId: sisT1.id, schedule: 'Mon, Wed 08:00 AM', room: 'Block A Rm 3', schoolId: sis.id },
  });
  const sisSub2 = await prisma.subject.upsert({
    where: { id: 'sub_sis_eng' },
    update: {},
    create: { id: 'sub_sis_eng', name: 'English Language', teacherId: sisT2.id, schedule: 'Tue, Thu 09:00 AM', room: 'Block B Rm 1', schoolId: sis.id },
  });
  const sisSub3 = await prisma.subject.upsert({
    where: { id: 'sub_sis_sci' },
    update: {},
    create: { id: 'sub_sis_sci', name: 'Basic Science', teacherId: sisT1.id, schedule: 'Fri 10:00 AM', room: 'Lab 2', schoolId: sis.id },
  });

  const sisStudents = [
    { id: 'stu_sis_001', name: 'Zainab Usman',      gender: 'Female', grade: 'JSS1', code: 'SIS-2024-0001', classId: sisC1.id, gpa: 3.6, att: 90 },
    { id: 'stu_sis_002', name: 'Daniel Okonkwo',    gender: 'Male',   grade: 'JSS1', code: 'SIS-2024-0002', classId: sisC1.id, gpa: 3.4, att: 87 },
    { id: 'stu_sis_003', name: 'Aisha Mohammed',    gender: 'Female', grade: 'JSS2', code: 'SIS-2024-0003', classId: sisC2.id, gpa: 3.8, att: 94 },
    { id: 'stu_sis_004', name: 'Chukwudi Nnadi',    gender: 'Male',   grade: 'JSS2', code: 'SIS-2024-0004', classId: sisC2.id, gpa: 3.1, att: 80 },
  ] as const;

  for (const s of sisStudents) {
    await prisma.student.upsert({
      where: { accessCode: s.code },
      update: {},
      create: {
        id: s.id, name: s.name, gender: s.gender, grade: s.grade,
        enrollmentDate: new Date('2024-09-02'), status: 'Active',
        gpa: s.gpa, attendance: s.att, schoolId: sis.id, schoolClassId: s.classId,
        accessCode: s.code,
        enrolledSubjects: [sisSub1.id, sisSub2.id, sisSub3.id],
        field: 'general',
      },
    });
  }

  await prisma.school.update({ where: { id: sis.id }, data: { studentCount: sisStudents.length } });

  await (prisma as any).schoolTerm.upsert({
    where: { schoolId_session_term: { schoolId: sis.id, session: '2024/2025', term: 'first' } },
    update: {},
    create: {
      schoolId: sis.id, name: 'First Term 2024/2025',
      session: '2024/2025', term: 'first',
      startDate: new Date('2024-09-02'), endDate: new Date('2024-12-13'), isCurrent: true,
    },
  });

  const sisTemplate = await prisma.feeTemplate.upsert({
    where: { id: 'ft_sis_t1' },
    update: {},
    create: {
      id: 'ft_sis_t1',
      schoolId: sis.id,
      term: 'First Term 2024/2025',
      name: 'JSS First Term Fees',
      lines: {
        create: [
          { title: 'Tuition Fee',         key: 'tuition',      order: 0, defaultAmount: 60000 },
          { title: 'Library Levy',        key: 'library',      order: 1, defaultAmount: 3000  },
          { title: 'Computer Lab Fee',    key: 'computer_lab', order: 2, defaultAmount: 4000  },
          { title: 'Examination Fee',     key: 'exam_fee',     order: 3, defaultAmount: 2500  },
        ],
      },
    },
    include: { lines: true },
  });

  const sisScores = [
    [{ s: sisSub1.id, ca1: 15, ca2: 14, ca3: 16, exam: 55 }, { s: sisSub2.id, ca1: 16, ca2: 15, ca3: 14, exam: 52 }, { s: sisSub3.id, ca1: 14, ca2: 16, ca3: 15, exam: 53 }],
    [{ s: sisSub1.id, ca1: 12, ca2: 13, ca3: 11, exam: 48 }, { s: sisSub2.id, ca1: 14, ca2: 12, ca3: 13, exam: 50 }, { s: sisSub3.id, ca1: 11, ca2: 12, ca3: 14, exam: 45 }],
    [{ s: sisSub1.id, ca1: 17, ca2: 18, ca3: 16, exam: 60 }, { s: sisSub2.id, ca1: 18, ca2: 17, ca3: 19, exam: 62 }, { s: sisSub3.id, ca1: 16, ca2: 18, ca3: 17, exam: 58 }],
    [{ s: sisSub1.id, ca1: 10, ca2: 9,  ca3: 11, exam: 40 }, { s: sisSub2.id, ca1: 11, ca2: 10, ca3: 9,  exam: 42 }, { s: sisSub3.id, ca1: 9,  ca2: 11, ca3: 10, exam: 38 }],
  ];

  const sisSN: Record<string, string> = {
    [sisSub1.id]: 'Mathematics',
    [sisSub2.id]: 'English Language',
    [sisSub3.id]: 'Basic Science',
  };

  for (let i = 0; i < sisStudents.length; i++) {
    const stu = sisStudents[i];
    for (const a of sisScores[i]) {
      await prisma.assessment.upsert({
        where: { id: `asmnt_${stu.id}_${a.s}` },
        update: {},
        create: { id: `asmnt_${stu.id}_${a.s}`, studentId: stu.id, subjectId: a.s, term: 'First Term 2024/2025', ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam },
      });
      const total = a.ca1 + a.ca2 + a.ca3 + a.exam;
      await (prisma.result as any).upsert({
        where: { studentId_subjectName_term: { studentId: stu.id, subjectName: sisSN[a.s], term: 'First Term 2024/2025' } },
        update: {},
        create: { studentId: stu.id, subjectId: a.s, subjectName: sisSN[a.s], term: 'First Term 2024/2025', average: total, grade: gradeFromScore(total), status: 'Published', remarks: remarksFromScore(total), details: { ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam, total } },
      });
    }

    const today2 = new Date();
    for (let d = 0; d < 25; d++) {
      const date = new Date(today2);
      date.setDate(today2.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const roll = Math.random();
      const status: 'Present' | 'Absent' | 'Late' | 'Excused' = roll < 0.82 ? 'Present' : roll < 0.91 ? 'Late' : roll < 0.96 ? 'Absent' : 'Excused';
      try {
        await prisma.attendanceRecord.create({ data: { studentId: stu.id, status, date } });
      } catch {}
    }

    await (prisma as any).studentFeeLedger.upsert({
      where: { schoolId_term_studentId_scopeType_scopeId: { schoolId: sis.id, term: 'First Term 2024/2025', studentId: stu.id, scopeType: 'school', scopeId: sis.id } },
      update: {},
      create: {
        schoolId: sis.id, studentId: stu.id, term: 'First Term 2024/2025',
        scopeType: 'school', scopeId: sis.id, templateId: sisTemplate.id,
        lineItems: { create: sisTemplate.lines.map((line: any) => ({ templateLineId: line.id, title: line.title, key: line.key, payableAmount: line.defaultAmount })) },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCHOOL 3 — Kings College (Ibadan)
  // ──────────────────────────────────────────────────────────────────────────

  const kc = await prisma.school.upsert({
    where: { code: 'KC-003' },
    update: {},
    create: {
      id: 'sch_kc',
      name: 'Kings College Ibadan',
      code: 'KC-003',
      region: 'Oyo State',
      adminName: 'Alhaji Sulaiman Adegoke',
      status: 'Active',
      studentCount: 0,
      motto: 'Per Ardua Ad Alta',
      address: '1 Kings Drive, Ring Road, Ibadan',
      contact: '+234 803 456 7890',
      gradingSystem: 'nigeria',
      themeColor: '#7C3AED',
      principalName: 'Alhaji Sulaiman Adegoke',
    },
  });

  await prisma.user.upsert({
    where: { email: 'principal@kingsibadan.edu' },
    update: {},
    create: {
      id: 'u_kc_admin',
      name: 'Sulaiman Adegoke',
      email: 'principal@kingsibadan.edu',
      password: pw,
      role: 'ADMIN',
      schoolId: kc.id,
      avatar: avatar('Sulaiman Adegoke', '7C3AED'),
      gender: 'Male',
    },
  });

  const kcT1 = await prisma.user.upsert({
    where: { email: 'mrs.bello@kingsibadan.edu' },
    update: {},
    create: {
      id: 'u_kc_t1',
      name: 'Mrs. Kemi Bello',
      email: 'mrs.bello@kingsibadan.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: kc.id,
      avatar: avatar('Kemi Bello', 'B45309'),
      gender: 'Female',
    },
  });

  const kcT2 = await prisma.user.upsert({
    where: { email: 'mr.adewale@kingsibadan.edu' },
    update: {},
    create: {
      id: 'u_kc_t2',
      name: 'Mr. Adewale Babalola',
      email: 'mr.adewale@kingsibadan.edu',
      password: pw,
      role: 'TEACHER',
      schoolId: kc.id,
      avatar: avatar('Adewale Babalola', '0369A1'),
      gender: 'Male',
    },
  });

  const kcC1 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: kc.id, name: 'Form 1' } },
    update: {},
    create: { id: 'cls_kc_f1', schoolId: kc.id, name: 'Form 1' },
  });
  const kcC2 = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId: kc.id, name: 'Form 2' } },
    update: {},
    create: { id: 'cls_kc_f2', schoolId: kc.id, name: 'Form 2' },
  });

  const kcSub1 = await prisma.subject.upsert({
    where: { id: 'sub_kc_math' },
    update: {},
    create: { id: 'sub_kc_math', name: 'Mathematics', teacherId: kcT1.id, schedule: 'Mon, Thu 07:30 AM', room: 'Block D', schoolId: kc.id },
  });
  const kcSub2 = await prisma.subject.upsert({
    where: { id: 'sub_kc_eng' },
    update: {},
    create: { id: 'sub_kc_eng', name: 'English Language', teacherId: kcT2.id, schedule: 'Wed, Fri 09:00 AM', room: 'Block A', schoolId: kc.id },
  });
  const kcSub3 = await prisma.subject.upsert({
    where: { id: 'sub_kc_hist' },
    update: {},
    create: { id: 'sub_kc_hist', name: 'History', teacherId: kcT2.id, schedule: 'Tue 10:30 AM', room: 'Block B', schoolId: kc.id },
  });

  const kcStudents = [
    { id: 'stu_kc_001', name: 'Oluwaseun Adeyemi',  gender: 'Male',   grade: 'Form 1', code: 'KC-2024-0001', classId: kcC1.id, gpa: 3.7, att: 93 },
    { id: 'stu_kc_002', name: 'Blessing Oladele',   gender: 'Female', grade: 'Form 1', code: 'KC-2024-0002', classId: kcC1.id, gpa: 3.5, att: 89 },
    { id: 'stu_kc_003', name: 'Adebayo Ajibola',    gender: 'Male',   grade: 'Form 2', code: 'KC-2024-0003', classId: kcC2.id, gpa: 3.2, att: 85 },
    { id: 'stu_kc_004', name: 'Taiwo Oluwafemi',    gender: 'Female', grade: 'Form 2', code: 'KC-2024-0004', classId: kcC2.id, gpa: 3.9, att: 98 },
  ] as const;

  for (const s of kcStudents) {
    await prisma.student.upsert({
      where: { accessCode: s.code },
      update: {},
      create: {
        id: s.id, name: s.name, gender: s.gender, grade: s.grade,
        enrollmentDate: new Date('2024-09-02'), status: 'Active',
        gpa: s.gpa, attendance: s.att, schoolId: kc.id, schoolClassId: s.classId,
        accessCode: s.code,
        enrolledSubjects: [kcSub1.id, kcSub2.id, kcSub3.id],
        field: 'arts',
      },
    });
  }

  await prisma.school.update({ where: { id: kc.id }, data: { studentCount: kcStudents.length } });

  await (prisma as any).schoolTerm.upsert({
    where: { schoolId_session_term: { schoolId: kc.id, session: '2024/2025', term: 'first' } },
    update: {},
    create: {
      schoolId: kc.id, name: 'First Term 2024/2025',
      session: '2024/2025', term: 'first',
      startDate: new Date('2024-09-02'), endDate: new Date('2024-12-13'), isCurrent: true,
    },
  });

  const kcScores = [
    [{ s: kcSub1.id, ca1: 16, ca2: 15, ca3: 17, exam: 58 }, { s: kcSub2.id, ca1: 17, ca2: 16, ca3: 15, exam: 56 }, { s: kcSub3.id, ca1: 15, ca2: 17, ca3: 16, exam: 57 }],
    [{ s: kcSub1.id, ca1: 13, ca2: 14, ca3: 12, exam: 50 }, { s: kcSub2.id, ca1: 15, ca2: 13, ca3: 14, exam: 53 }, { s: kcSub3.id, ca1: 12, ca2: 14, ca3: 13, exam: 49 }],
    [{ s: kcSub1.id, ca1: 10, ca2: 11, ca3: 9,  exam: 43 }, { s: kcSub2.id, ca1: 12, ca2: 10, ca3: 11, exam: 45 }, { s: kcSub3.id, ca1: 9,  ca2: 11, ca3: 10, exam: 41 }],
    [{ s: kcSub1.id, ca1: 18, ca2: 19, ca3: 18, exam: 63 }, { s: kcSub2.id, ca1: 19, ca2: 18, ca3: 19, exam: 65 }, { s: kcSub3.id, ca1: 18, ca2: 19, ca3: 18, exam: 64 }],
  ];

  const kcSN: Record<string, string> = {
    [kcSub1.id]: 'Mathematics',
    [kcSub2.id]: 'English Language',
    [kcSub3.id]: 'History',
  };

  for (let i = 0; i < kcStudents.length; i++) {
    const stu = kcStudents[i];
    for (const a of kcScores[i]) {
      await prisma.assessment.upsert({
        where: { id: `asmnt_${stu.id}_${a.s}` },
        update: {},
        create: { id: `asmnt_${stu.id}_${a.s}`, studentId: stu.id, subjectId: a.s, term: 'First Term 2024/2025', ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam },
      });
      const total = a.ca1 + a.ca2 + a.ca3 + a.exam;
      await (prisma.result as any).upsert({
        where: { studentId_subjectName_term: { studentId: stu.id, subjectName: kcSN[a.s], term: 'First Term 2024/2025' } },
        update: {},
        create: { studentId: stu.id, subjectId: a.s, subjectName: kcSN[a.s], term: 'First Term 2024/2025', average: total, grade: gradeFromScore(total), status: 'Published', remarks: remarksFromScore(total), details: { ca1: a.ca1, ca2: a.ca2, ca3: a.ca3, exam: a.exam, total } },
      });
    }

    const today3 = new Date();
    for (let d = 0; d < 20; d++) {
      const date = new Date(today3);
      date.setDate(today3.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const roll = Math.random();
      const status: 'Present' | 'Absent' | 'Late' | 'Excused' = roll < 0.88 ? 'Present' : roll < 0.94 ? 'Late' : roll < 0.98 ? 'Absent' : 'Excused';
      try {
        await prisma.attendanceRecord.create({ data: { studentId: stu.id, status, date } });
      } catch {}
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Recompute attendance percentages from records
  // ──────────────────────────────────────────────────────────────────────────

  const allStudentIds = [
    ...gfaStudents.map(s => s.id),
    ...sisStudents.map(s => s.id),
    ...kcStudents.map(s => s.id),
  ];

  for (const studentId of allStudentIds) {
    const groups = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { id: true },
    });
    const total = groups.reduce((sum, g) => sum + g._count.id, 0);
    const present = groups.filter(g => g.status === 'Present' || g.status === 'Late').reduce((sum, g) => sum + g._count.id, 0);
    if (total > 0) {
      await prisma.student.update({
        where: { id: studentId },
        data: { attendance: Math.round((present / total) * 100) },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FORM MASTERS (class teachers) — one per class per school
  // ──────────────────────────────────────────────────────────────────────────
  const classMasterEntries = [
    // Greenfield Academy
    { schoolId: gfa.id, grade: 'SS1A', teacherId: gfaT1.id },
    { schoolId: gfa.id, grade: 'SS2A', teacherId: gfaT2.id },
    // Sunrise International School
    { schoolId: sis.id, grade: 'JSS1', teacherId: 'u_sis_t1' },
    { schoolId: sis.id, grade: 'JSS2', teacherId: 'u_sis_t2' },
    // Kings College Ibadan
    { schoolId: kc.id, grade: 'Form 1', teacherId: 'u_kc_t1' },
    { schoolId: kc.id, grade: 'Form 2', teacherId: 'u_kc_t2' },
  ];
  for (const { schoolId, grade, teacherId } of classMasterEntries) {
    await prisma.classMaster.upsert({
      where: { schoolId_grade: { schoolId, grade } },
      update: { teacherId },
      create: { schoolId, grade, teacherId },
    });
  }

  console.log('✅  Seed complete.');
  console.log('');
  console.log('  SCHOOL LOGINS');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  Creator       creator@smartschool.edu       Password1');
  console.log('  GFA Admin     admin@greenfield.edu          Password1');
  console.log('  GFA Teacher   chukwu.math@greenfield.edu    Password1');
  console.log('  SIS Admin     admin@sunrise.edu             Password1');
  console.log('  SIS Teacher   amina.sci@sunrise.edu         Password1');
  console.log('  KC Admin      principal@kingsibadan.edu     Password1');
  console.log('  KC Teacher    mrs.bello@kingsibadan.edu     Password1');
  console.log('');
  console.log('  STUDENT LOGINS  (school code + access code)');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  GFA: GFA-001 / GFA-2024-0001 through GFA-2024-0005');
  console.log('  SIS: SIS-002 / SIS-2024-0001 through SIS-2024-0004');
  console.log('  KC:  KC-003  / KC-2024-0001  through KC-2024-0004');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
