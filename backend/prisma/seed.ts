import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Use plain text password for demo accounts (fallback in appService handles this)
  const plainPassword = 'password';

  // Create demo schools
  const school1 = await prisma.school.upsert({
    where: { code: 'SPR-001' },
    update: {},
    create: {
      id: 'sch_001',
      name: 'Springfield High School',
      code: 'SPR-001',
      region: 'North District',
      adminName: 'Principal Skinner',
      status: 'Active',
      studentCount: 450,
      motto: 'Excellence and Integrity',
      address: '742 Evergreen Terrace, Springfield',
      contact: '+1 (555) 123-4567',
    },
  });

  // Create demo users
  const superAdmin = await prisma.user.upsert({
    where: { email: 'creator@smartschool.edu' },
    update: {},
    create: {
      id: 'sa1',
      name: 'System Creator',
      email: 'creator@smartschool.edu',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      avatar: 'https://ui-avatars.com/api/?name=System+Creator&background=0D8ABC&color=fff',
      gender: 'Male',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartschool.edu' },
    update: {},
    create: {
      id: 'admin1',
      name: 'School Principal',
      email: 'admin@smartschool.edu',
      password: hashedPassword,
      role: 'ADMIN',
      schoolId: school1.id,
      avatar: 'https://ui-avatars.com/api/?name=School+Principal&background=random',
      gender: 'Male',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'alex.j@smartschool.edu' },
    update: {},
    create: {
      id: 'u1',
      name: 'Alex Johnson',
      email: 'alex.j@smartschool.edu',
      password: hashedPassword,
      role: 'TEACHER',
      schoolId: school1.id,
      avatar: 'https://picsum.photos/200/200',
      gender: 'Male',
    },
  });

  // Create demo students
  const student1 = await prisma.student.upsert({
    where: { accessCode: 'STU-2024-001' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Emma Thompson',
      gender: 'Female',
      grade: '10th',
      enrollmentDate: new Date('2023-09-01'),
      status: 'Active',
      gpa: 3.8,
      attendance: 98,
      schoolId: school1.id,
      accessCode: 'STU-2024-001',
      enrolledSubjects: ['sub1', 'sub2'],
    },
  });

  // Create demo subjects
  const subject1 = await prisma.subject.upsert({
    where: { id: 'sub1' },
    update: {},
    create: {
      id: 'sub1',
      name: 'Mathematics 101',
      teacherId: teacher.id,
      schedule: 'Mon, Wed 09:00 AM',
      room: 'Rm 204',
      schoolId: school1.id,
    },
  });

  const subject2 = await prisma.subject.upsert({
    where: { id: 'sub2' },
    update: {},
    create: {
      id: 'sub2',
      name: 'Physics Basics',
      teacherId: teacher.id,
      schedule: 'Tue, Thu 11:00 AM',
      room: 'Lab 3',
      schoolId: school1.id,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
