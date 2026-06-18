/**
 * RICH DEMO SEED — remove before production deployment.
 *
 * Creates 3 schools, each with:
 *   • 6 classes: SS1A, SS1B, SS2A, SS2B, SS3A, SS3B
 *   • 5 students per class (30 students/school, 90 total)
 *   • 9 subject teachers (teacher #1 is also the SS1A Form Master / ClassMaster)
 *   • 9 subjects, each taught across all 6 classes (TeacherAssignments)
 *   • Assessments + Published results (WAEC grading) for every student/subject
 *   • Attendance history, a current term, fee templates + fully-paid ledgers
 *   • 2 parents linked to students, and staff-room chat messages
 *
 * Idempotent — safe to run repeatedly (upserts on stable keys).
 *
 * Run:  cd backend && npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 10);
const avatar = (name: string, bg = '4F46E5') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128`;

const TERM = 'First Term 2025/2026';
const SESSION = '2025/2026';
const DEMO_PIN = 'SMART123'; // uniform 8-char Result Access PIN for every demo student
const PASSWORD = 'Password1';

const CLASSES = ['SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];

const SUBJECTS = [
  { key: 'math', name: 'Mathematics',      color: '1D4ED8' },
  { key: 'eng',  name: 'English Language', color: '059669' },
  { key: 'bio',  name: 'Biology',          color: '16A34A' },
  { key: 'chem', name: 'Chemistry',        color: '9333EA' },
  { key: 'phy',  name: 'Physics',          color: '0891B2' },
  { key: 'civ',  name: 'Civic Education',  color: 'CA8A04' },
  { key: 'geo',  name: 'Geography',        color: 'B45309' },
  { key: 'cs',   name: 'Computer Science', color: 'DC2626' },
  { key: 'eco',  name: 'Economics',        color: '7C3AED' },
];

const MALE   = ['Emeka','Tunde','Chuka','Bola','Segun','Ifeanyi','Musa','Kunle','Yusuf','Obinna','Femi','Dayo','Uche','Sani','Tobi'];
const FEMALE = ['Amara','Ngozi','Aisha','Funke','Chioma','Zainab','Bukola','Ifeoma','Halima','Yetunde','Ada','Kemi','Nneka','Folake','Sade'];
const SURNAME= ['Okonkwo','Adeyemi','Bello','Okafor','Balogun','Eze','Abiodun','Nwosu','Lawal','Olawale','Ibrahim','Chukwu','Adewale','Mohammed','Ojo','Danjuma','Obi','Akpan','Uzo','Ogunleye'];

const SCHOOLS = [
  {
    id: 'd_gfa', code: 'GFD-101', name: 'Greenfield Academy', region: 'Lagos',
    motto: 'Knowledge Builds Nations', address: '14 Adeola Odeku St, Victoria Island, Lagos',
    contact: '+234 801 234 5678', theme: '#059669', principal: 'Mrs. Adaeze Okonkwo',
    adminEmail: 'admin@greenfield.demo', adminName: 'Adaeze Okonkwo',
  },
  {
    id: 'd_sun', code: 'SUN-202', name: 'Sunrise International School', region: 'Abuja',
    motto: 'Rising to Excellence Every Day', address: 'Plot 45, Wuse Zone 5, Abuja',
    contact: '+234 802 345 6789', theme: '#2563EB', principal: 'Dr. Ibrahim Musa',
    adminEmail: 'admin@sunrise.demo', adminName: 'Ibrahim Musa',
  },
  {
    id: 'd_crh', code: 'CRH-303', name: 'Crown Heights College', region: 'Oyo State',
    motto: 'Per Ardua Ad Alta', address: '1 Crown Drive, Ring Road, Ibadan',
    contact: '+234 803 456 7890', theme: '#7C3AED', principal: 'Alhaji Sulaiman Adegoke',
    adminEmail: 'admin@crownheights.demo', adminName: 'Sulaiman Adegoke',
  },
];

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
// Split a target total (0-100) into CA1+CA2+CA3 (≤10 each) + Exam (≤70).
const splitScore = (total: number) => {
  const t = Math.max(0, Math.min(100, Math.round(total)));
  const exam = Math.min(70, Math.round(t * 0.7));
  const caTotal = t - exam;
  const ca1 = Math.round(caTotal / 3);
  const ca2 = Math.round(caTotal / 3);
  const ca3 = caTotal - ca1 - ca2;
  return { ca1, ca2, ca3, exam };
};

// Performance tier per student-in-class index (0 best … 4 weakest)
const TIER_BASE = [89, 79, 67, 54, 42];

async function main() {
  console.log('🌱  Seeding RICH demo data…');
  const pw = await hash(PASSWORD);

  // Super Admin (Creator)
  await prisma.user.upsert({
    where: { email: 'creator@smartschool.edu' },
    update: { password: pw },
    create: {
      id: 'd_sa_001', name: 'SmartSchool Creator', email: 'creator@smartschool.edu',
      password: pw, role: 'SUPER_ADMIN', avatar: avatar('SmartSchool Creator', '0F172A'), gender: 'Male',
    },
  });

  // School Group + Group Owner — one account that owns all three branches.
  const GROUP_ID = 'd_group_brightedu';
  await (prisma as any).schoolGroup.upsert({
    where: { id: GROUP_ID },
    update: {},
    create: { id: GROUP_ID, name: 'Bright Future Education Group' },
  });
  const owner = await prisma.user.upsert({
    where: { email: 'owner@brightedu.demo' },
    update: { password: pw, role: 'GROUP_OWNER', groupId: GROUP_ID },
    create: {
      id: 'd_group_owner', name: 'Group Owner — Bright Future', email: 'owner@brightedu.demo',
      password: pw, role: 'GROUP_OWNER', groupId: GROUP_ID,
      avatar: avatar('Bright Future', '6366F1'), gender: 'Male',
    },
  });
  await (prisma as any).schoolGroup.update({ where: { id: GROUP_ID }, data: { ownerId: owner.id } });

  let nameCursor = 0; // deterministic name walker across all schools

  for (let si = 0; si < SCHOOLS.length; si++) {
    const sc = SCHOOLS[si];
    const themeHex = sc.theme.replace('#', '');

    const school = await prisma.school.upsert({
      where: { code: sc.code },
      update: { groupId: GROUP_ID } as any,
      create: {
        id: sc.id, name: sc.name, code: sc.code, region: sc.region, adminName: sc.adminName,
        status: 'Active', studentCount: 0, motto: sc.motto, address: sc.address, contact: sc.contact,
        gradingSystem: 'nigeria', themeColor: sc.theme, principalName: sc.principal,
        logoUrl: avatar(sc.name, themeHex),
        groupId: GROUP_ID,
      } as any,
    });

    // Admin
    await prisma.user.upsert({
      where: { email: sc.adminEmail },
      update: { password: pw },
      create: {
        id: `${sc.id}_admin`, name: sc.adminName, email: sc.adminEmail, password: pw,
        role: 'ADMIN', schoolId: school.id, avatar: avatar(sc.adminName, themeHex), gender: si === 0 ? 'Female' : 'Male',
      },
    });

    // 9 teachers (teacher 0 = form master)
    const teachers: { id: string; email: string; name: string }[] = [];
    for (let t = 0; t < SUBJECTS.length; t++) {
      const isF = t % 2 === 0;
      const first = (isF ? FEMALE : MALE)[(nameCursor) % 15];
      const last = SURNAME[(nameCursor * 3 + 5) % SURNAME.length];
      nameCursor++;
      const title = isF ? 'Mrs.' : 'Mr.';
      const fullName = `${title} ${first} ${last}`;
      const email = `${SUBJECTS[t].key}.teacher@${sc.code.toLowerCase()}.demo`;
      const id = `${sc.id}_t${t}`;
      await prisma.user.upsert({
        where: { email },
        update: { password: pw },
        create: {
          id, name: fullName, email, password: pw, role: 'TEACHER', schoolId: school.id,
          avatar: avatar(`${first} ${last}`, SUBJECTS[t].color), gender: isF ? 'Female' : 'Male',
          bio: `${SUBJECTS[t].name} teacher`,
        },
      });
      teachers.push({ id, email, name: fullName });
    }

    // 6 classes
    const classes: { id: string; name: string }[] = [];
    for (const cn of CLASSES) {
      const cls = await prisma.schoolClass.upsert({
        where: { schoolId_name: { schoolId: school.id, name: cn } },
        update: {},
        create: { id: `${sc.id}_cls_${cn}`, schoolId: school.id, name: cn },
      });
      classes.push({ id: cls.id, name: cn });
    }

    // 9 subjects (each owned by its teacher)
    const subjects: { id: string; name: string }[] = [];
    for (let t = 0; t < SUBJECTS.length; t++) {
      const sub = await prisma.subject.upsert({
        where: { id: `${sc.id}_sub_${SUBJECTS[t].key}` },
        update: {},
        create: {
          id: `${sc.id}_sub_${SUBJECTS[t].key}`, name: SUBJECTS[t].name, teacherId: teachers[t].id,
          schedule: 'Mon–Fri', room: `Room ${101 + t}`, schoolId: school.id,
        },
      });
      subjects.push({ id: sub.id, name: SUBJECTS[t].name });
    }
    const allSubjectIds = subjects.map(s => s.id);

    // Teacher assignments: each teacher teaches their subject in every class
    for (let t = 0; t < teachers.length; t++) {
      for (const cls of classes) {
        await prisma.teacherAssignment.upsert({
          where: { teacherId_subjectId_schoolClassId: { teacherId: teachers[t].id, subjectId: subjects[t].id, schoolClassId: cls.id } },
          update: {},
          create: { teacherId: teachers[t].id, subjectId: subjects[t].id, schoolClassId: cls.id },
        });
      }
    }

    // Form master: teacher 0 is ClassMaster of SS1A
    await prisma.classMaster.upsert({
      where: { schoolId_grade: { schoolId: school.id, grade: 'SS1A' } },
      update: { teacherId: teachers[0].id },
      create: { schoolId: school.id, grade: 'SS1A', teacherId: teachers[0].id },
    });

    // Current term
    await (prisma as any).schoolTerm.upsert({
      where: { schoolId_session_term: { schoolId: school.id, session: SESSION, term: 'first' } },
      update: { isCurrent: true },
      create: {
        schoolId: school.id, name: TERM, session: SESSION, term: 'first',
        startDate: new Date('2025-09-15'), endDate: new Date('2025-12-19'), isCurrent: true,
      },
    });

    // Fee template
    const template = await prisma.feeTemplate.upsert({
      where: { id: `${sc.id}_ft` },
      update: {},
      create: {
        id: `${sc.id}_ft`, schoolId: school.id, term: TERM, name: `${TERM} Fees`,
        scopeType: 'school', scopeId: school.id,
        lines: {
          create: [
            { title: 'Tuition Fee',      key: 'tuition',   order: 0, defaultAmount: 60000 },
            { title: 'Development Levy', key: 'dev_levy',  order: 1, defaultAmount: 5000 },
            { title: 'ICT Fee',          key: 'ict_fee',   order: 2, defaultAmount: 4000 },
            { title: 'Sports Fee',       key: 'sports',    order: 3, defaultAmount: 2000 },
            { title: 'PTA Fee',          key: 'pta',       order: 4, defaultAmount: 1500 },
          ],
        },
      },
      include: { lines: true },
    });

    // Students
    const createdStudentIds: string[] = [];
    let codeSeq = 1;
    for (let ci = 0; ci < classes.length; ci++) {
      const cls = classes[ci];
      for (let k = 0; k < 5; k++) {
        const isF = (ci + k) % 2 === 0;
        const first = (isF ? FEMALE : MALE)[(nameCursor) % 15];
        const last = SURNAME[(nameCursor * 2 + ci) % SURNAME.length];
        nameCursor++;
        const name = `${first} ${last}`;
        const code = `${sc.code}-2025-${String(codeSeq).padStart(4, '0')}`;
        codeSeq++;
        const id = `${sc.id}_stu_${cls.name}_${k}`;
        const field = ['SS1A', 'SS1B'].includes(cls.name) ? 'general'
          : ['SS2A', 'SS2B'].includes(cls.name) ? 'science' : 'arts';

        await prisma.student.upsert({
          where: { accessCode: code },
          update: {},
          create: {
            id, name, gender: isF ? 'Female' : 'Male', grade: cls.name,
            enrollmentDate: new Date('2025-09-15'), status: 'Active', gpa: 0, attendance: 0,
            schoolId: school.id, schoolClassId: cls.id, accessCode: code,
            avatar: avatar(name, SUBJECTS[(ci + k) % SUBJECTS.length].color),
            enrolledSubjects: allSubjectIds, field,
            resultPin: DEMO_PIN, resultPinTerm: TERM,
          },
        });
        createdStudentIds.push(id);

        // Assessments + Published results for all subjects
        let totalForGpa = 0;
        for (let t = 0; t < subjects.length; t++) {
          const jitter = ((id.length + t * 7 + k * 3) % 8) - 3; // -3..+4 deterministic
          const target = Math.max(32, Math.min(98, TIER_BASE[k] + jitter));
          const { ca1, ca2, ca3, exam } = splitScore(target);
          const total = ca1 + ca2 + ca3 + exam;
          totalForGpa += total;

          await prisma.assessment.upsert({
            where: { id: `asm_${id}_${subjects[t].id}` },
            update: {},
            create: {
              id: `asm_${id}_${subjects[t].id}`, studentId: id, subjectId: subjects[t].id,
              term: TERM, ca1, ca2, ca3, exam,
            },
          });
          await (prisma.result as any).upsert({
            where: { studentId_subjectName_term: { studentId: id, subjectName: subjects[t].name, term: TERM } },
            update: {},
            create: {
              studentId: id, subjectId: subjects[t].id, subjectName: subjects[t].name, term: TERM,
              average: total, grade: gradeFromScore(total), status: 'Published',
              remarks: remarksFromScore(total), details: { ca1, ca2, ca3, exam, total },
            },
          });
        }
        const gpa = Math.round((totalForGpa / subjects.length / 20) * 100) / 100;
        await prisma.student.update({ where: { id }, data: { gpa } });

        // Attendance — last 15 weekdays
        const today = new Date();
        const presentRate = 0.97 - k * 0.04;
        for (let d = 0; d < 21; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() - d);
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          const roll = ((id.length + d * 13 + k) % 100) / 100;
          const status: 'Present' | 'Absent' | 'Late' | 'Excused' =
            roll < presentRate ? 'Present' : roll < presentRate + 0.05 ? 'Late' : roll < presentRate + 0.08 ? 'Absent' : 'Excused';
          try {
            await prisma.attendanceRecord.create({ data: { studentId: id, status, date } });
          } catch { /* duplicate date — skip */ }
        }

        // Fee ledger + full payments (fees cleared)
        const ledger = await (prisma as any).studentFeeLedger.upsert({
          where: { schoolId_term_studentId_scopeType_scopeId: { schoolId: school.id, term: TERM, studentId: id, scopeType: 'school', scopeId: school.id } },
          update: {},
          create: {
            schoolId: school.id, studentId: id, term: TERM, scopeType: 'school', scopeId: school.id,
            templateId: template.id,
            lineItems: { create: (template as any).lines.map((line: any) => ({ templateLineId: line.id, title: line.title, key: line.key, payableAmount: line.defaultAmount })) },
          },
          include: { lineItems: true },
        });
        // Pay all but the weakest tier (k===4 left partially unpaid for variety)
        if (k < 4) {
          for (const item of (ledger as any).lineItems) {
            const ref = `pay_${item.id}`;
            const exists = await (prisma as any).studentFeePayment.findFirst({ where: { clientRef: ref } });
            if (!exists) {
              await (prisma as any).studentFeePayment.create({
                data: { ledgerItemId: item.id, amount: item.payableAmount, method: 'transfer', paymentRef: 'DEMO', clientRef: ref },
              });
            }
          }
        }
      }
    }

    // Recompute attendance %
    for (const studentId of createdStudentIds) {
      const groups = await prisma.attendanceRecord.groupBy({ by: ['status'], where: { studentId }, _count: { id: true } });
      const total = groups.reduce((s, g) => s + g._count.id, 0);
      const present = groups.filter(g => g.status === 'Present' || g.status === 'Late').reduce((s, g) => s + g._count.id, 0);
      if (total > 0) await prisma.student.update({ where: { id: studentId }, data: { attendance: Math.round((present / total) * 100) } });
    }

    await prisma.school.update({ where: { id: school.id }, data: { studentCount: createdStudentIds.length } });

    // Parents (2) linked to a few students each
    const parentSpecs = [
      { idx: 0, email: `parent1@${sc.code.toLowerCase()}.demo`, name: `${FEMALE[si % 15]} ${SURNAME[(si + 1) % SURNAME.length]}`, links: [0, 5, 10] },
      { idx: 1, email: `parent2@${sc.code.toLowerCase()}.demo`, name: `${MALE[si % 15]} ${SURNAME[(si + 2) % SURNAME.length]}`, links: [15, 20] },
    ];
    for (const p of parentSpecs) {
      const pid = `${sc.id}_parent${p.idx}`;
      await prisma.user.upsert({
        where: { email: p.email },
        update: { password: pw },
        create: {
          id: pid, name: p.name, email: p.email, password: pw, role: 'PARENT', schoolId: school.id,
          avatar: avatar(p.name, '475569'), gender: p.idx === 0 ? 'Female' : 'Male', bio: 'Parent / Guardian',
        },
      });
      for (const linkIdx of p.links) {
        const studentId = createdStudentIds[linkIdx];
        if (!studentId) continue;
        await prisma.parentStudent.upsert({
          where: { parentId_studentId: { parentId: pid, studentId } },
          update: {},
          create: { parentId: pid, studentId },
        });
      }
    }

    // Staff-room chats
    const chats = [
      { by: `${sc.id}_admin`, text: `Good morning team 👋 Welcome to ${TERM}. Please submit your schemes of work by Friday.` },
      { by: teachers[0].id, text: 'Noted. SS1A scheme is ready and uploaded ✅' },
      { by: teachers[1].id, text: 'Reminder: First CA tests start next Monday. Kindly finalize your question papers.' },
      { by: teachers[3].id, text: 'Can we get extra projectors for the science labs? 🔬' },
      { by: `${sc.id}_admin`, text: 'Approved 👍 Procurement will deliver two units this week.' },
    ];
    for (let m = 0; m < chats.length; m++) {
      await prisma.staffMessage.upsert({
        where: { id: `${sc.id}_msg_${m}` },
        update: {},
        create: { id: `${sc.id}_msg_${m}`, schoolId: school.id, userId: chats[m].by, type: 'text', content: chats[m].text },
      });
    }

    console.log(`  ✓ ${sc.name}: 6 classes, 30 students, 9 teachers, 2 parents, results + fees seeded.`);
  }

  console.log('\n✅  Rich demo seed complete.');
  console.log('   Logins: all email accounts use password "Password1".');
  console.log(`   Students log in with their School Code + Access Code; Result PIN = ${DEMO_PIN}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
