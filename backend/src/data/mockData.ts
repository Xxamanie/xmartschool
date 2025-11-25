import { Assessment, ResultData, School, SchemeSubmission, Student, Subject, User, UserRole } from '../types';

export const MOCK_SCHOOLS: School[] = [
  {
    id: 'sch_001',
    name: 'Springfield High School',
    code: 'SPR-001',
    region: 'North District',
    adminName: 'Principal Skinner',
    status: 'Active',
    studentCount: 450,
  },
  {
    id: 'sch_002',
    name: 'Westside Academy',
    code: 'WST-002',
    region: 'West District',
    adminName: 'Sarah Connor',
    status: 'Active',
    studentCount: 320,
  },
  {
    id: 'sch_003',
    name: 'Downtown International',
    code: 'DTN-003',
    region: 'City Center',
    adminName: 'James Bond',
    status: 'Inactive',
    studentCount: 0,
  },
];

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Johnson',
  email: 'alex.j@smartschool.edu',
  role: UserRole.TEACHER,
  avatar: 'https://picsum.photos/200/200',
  schoolId: 'sch_001',
  gender: 'Male',
};

export const MOCK_SUPER_ADMIN: User = {
  id: 'sa1',
  name: 'System Creator',
  email: 'creator@smartschool.edu',
  role: UserRole.SUPER_ADMIN,
  avatar: 'https://ui-avatars.com/api/?name=System+Creator&background=0D8ABC&color=fff',
  gender: 'Male',
};

const generateStudents = (count: number): Student[] => {
  const students: Student[] = [
    {
      id: 's1',
      name: 'Emma Thompson',
      gender: 'Female',
      grade: '10th',
      enrollmentDate: '2023-09-01',
      status: 'Active',
      gpa: 3.8,
      attendance: 98,
      schoolId: 'sch_001',
      accessCode: 'STU-2024-001',
    },
    {
      id: 's2',
      name: 'Liam Wilson',
      gender: 'Male',
      grade: '10th',
      enrollmentDate: '2023-09-01',
      status: 'Active',
      gpa: 3.2,
      attendance: 92,
      schoolId: 'sch_001',
      accessCode: 'STU-2024-002',
    },
    {
      id: 's3',
      name: 'Olivia Davis',
      gender: 'Female',
      grade: '11th',
      enrollmentDate: '2022-09-01',
      status: 'Inactive',
      gpa: 2.9,
      attendance: 85,
      schoolId: 'sch_001',
      accessCode: 'STU-2024-003',
    },
    {
      id: 's4',
      name: 'Noah Martinez',
      gender: 'Male',
      grade: '9th',
      enrollmentDate: '2024-09-01',
      status: 'Active',
      gpa: 3.5,
      attendance: 95,
      schoolId: 'sch_002',
      accessCode: 'STU-2024-004',
    },
    {
      id: 's5',
      name: 'Ava Taylor',
      gender: 'Female',
      grade: '12th',
      enrollmentDate: '2021-09-01',
      status: 'Active',
      gpa: 4.0,
      attendance: 99,
      schoolId: 'sch_001',
      accessCode: 'STU-2024-005',
    },
    {
      id: 's6',
      name: 'William Brown',
      gender: 'Male',
      grade: '11th',
      enrollmentDate: '2022-09-01',
      status: 'Suspended',
      gpa: 1.8,
      attendance: 60,
      schoolId: 'sch_002',
      accessCode: 'STU-2024-006',
    },
    {
      id: 's7',
      name: 'Sophia Anderson',
      gender: 'Female',
      grade: '10th',
      enrollmentDate: '2023-09-01',
      status: 'Active',
      gpa: 3.9,
      attendance: 96,
      schoolId: 'sch_001',
      accessCode: 'STU-2024-007',
    },
  ];

  for (let i = 8; i <= count; i++) {
    const isMale = Math.random() > 0.5;
    students.push({
      id: `s${i}`,
      name: `Student ${i}`,
      gender: isMale ? 'Male' : 'Female',
      grade: ['9th', '10th', '11th', '12th'][Math.floor(Math.random() * 4)],
      enrollmentDate: `202${Math.floor(Math.random() * 3 + 1)}-09-${Math.floor(Math.random() * 28 + 1)
        .toString()
        .padStart(2, '0')}`,
      status: Math.random() > 0.9 ? 'Inactive' : 'Active',
      gpa: Number((Math.random() * 2 + 2).toFixed(1)),
      attendance: Math.floor(Math.random() * 20 + 80),
      schoolId: 'sch_001',
      accessCode: `STU-2024-${String(i).padStart(3, '0')}`,
    });
  }
  return students;
};

export const MOCK_STUDENTS: Student[] = generateStudents(50);

export const MOCK_SUBJECTS: Subject[] = [
  {
    id: 'sub1',
    name: 'Mathematics 101',
    teacherId: 'u1',
    schedule: 'Mon, Wed 09:00 AM',
    room: 'Rm 204',
  },
  {
    id: 'sub2',
    name: 'Physics Basics',
    teacherId: 'u1',
    schedule: 'Tue, Thu 11:00 AM',
    room: 'Lab 3',
  },
  {
    id: 'sub3',
    name: 'Computer Science',
    teacherId: 'u1',
    schedule: 'Fri 01:00 PM',
    room: 'Lab 1',
  },
];

export const MOCK_SCHEMES: SchemeSubmission[] = [
  {
    id: 'sch1',
    subjectName: 'Mathematics 101',
    term: 'Term 1',
    uploadDate: '2023-09-10',
    status: 'Approved',
    fileName: 'Math_Term1_SoW.pdf',
  },
  {
    id: 'sch2',
    subjectName: 'Physics Basics',
    term: 'Term 1',
    uploadDate: '2023-09-12',
    status: 'Approved',
    fileName: 'Physics_Term1_SoW.docx',
  },
  {
    id: 'sch3',
    subjectName: 'Computer Science',
    term: 'Term 2',
    uploadDate: '2024-01-05',
    status: 'Pending',
    fileName: 'CS_Term2_Draft.xlsx',
  },
];

export const MOCK_ASSESSMENTS: Assessment[] = [
  {
    id: 'a1',
    studentId: 's1',
    studentName: 'Emma Thompson',
    subjectId: 'sub1',
    term: 'Term 1',
    ca1: 9,
    ca2: 8,
    ca3: 10,
    exam: 65,
  },
  {
    id: 'a2',
    studentId: 's2',
    studentName: 'Liam Wilson',
    subjectId: 'sub1',
    term: 'Term 1',
    ca1: 7,
    ca2: 6,
    ca3: 8,
    exam: 55,
  },
  {
    id: 'a3',
    studentId: 's7',
    studentName: 'Sophia Anderson',
    subjectId: 'sub1',
    term: 'Term 1',
    ca1: 10,
    ca2: 9,
    ca3: 10,
    exam: 68,
  },
];

const generateResults = (): ResultData[] => {
  const baseResults: ResultData[] = [
    {
      id: 'r1',
      studentName: 'Emma Thompson',
      studentId: 's1',
      subjectName: 'Mathematics 101',
      average: 92.5,
      grade: 'A+',
      status: 'Published',
      remarks: 'Outstanding performance throughout the term.',
      details: { ca1: 9, ca2: 8, ca3: 10, exam: 65 },
    },
    {
      id: 'r2',
      studentName: 'Liam Wilson',
      studentId: 's2',
      subjectName: 'Mathematics 101',
      average: 78.4,
      grade: 'B',
      status: 'Published',
      remarks: '',
      details: { ca1: 7, ca2: 6, ca3: 8, exam: 55 },
    },
    {
      id: 'r3',
      studentName: 'Olivia Davis',
      studentId: 's3',
      subjectName: 'Physics Basics',
      average: 65.2,
      grade: 'C',
      status: 'Draft',
      remarks: 'Shows improvement but needs more focus on Sciences.',
      details: { ca1: 6, ca2: 5, ca3: 7, exam: 47 },
    },
    {
      id: 'r4',
      studentName: 'Noah Martinez',
      studentId: 's4',
      subjectName: 'Mathematics 101',
      average: 88.9,
      grade: 'A',
      status: 'Published',
      remarks: '',
      details: { ca1: 9, ca2: 9, ca3: 8, exam: 62 },
    },
    {
      id: 'r5',
      studentName: 'Ava Taylor',
      studentId: 's5',
      subjectName: 'Computer Science',
      average: 95.0,
      grade: 'A+',
      status: 'Published',
      remarks: 'Exceptional work. A role model for the class.',
      details: { ca1: 10, ca2: 10, ca3: 10, exam: 65 },
    },
    {
      id: 'r6',
      studentName: 'William Brown',
      studentId: 's6',
      subjectName: 'Physics Basics',
      average: 45.5,
      grade: 'F',
      status: 'withheld',
      remarks: 'Academic warning issued.',
      details: { ca1: 4, ca2: 3, ca3: 5, exam: 33.5 },
    },
    {
      id: 'r7',
      studentName: 'Sophia Anderson',
      studentId: 's7',
      subjectName: 'Mathematics 101',
      average: 97.0,
      grade: 'A+',
      status: 'Published',
      remarks: 'Perfect scores.',
      details: { ca1: 10, ca2: 9, ca3: 10, exam: 68 },
    },
  ];

  for (let i = 8; i <= 50; i++) {
    const exam = Math.floor(Math.random() * 40 + 30);
    const ca1 = Math.floor(Math.random() * 5 + 5);
    const ca2 = Math.floor(Math.random() * 5 + 5);
    const ca3 = Math.floor(Math.random() * 5 + 5);
    const total = exam + ca1 + ca2 + ca3;
    let grade = 'F';
    if (total >= 90) grade = 'A+';
    else if (total >= 80) grade = 'A';
    else if (total >= 70) grade = 'B';
    else if (total >= 60) grade = 'C';
    else if (total >= 50) grade = 'D';

    baseResults.push({
      id: `r${i}`,
      studentName: `Student ${i}`,
      studentId: `s${i}`,
      subjectName: ['Mathematics 101', 'Physics Basics', 'Computer Science'][Math.floor(Math.random() * 3)],
      average: total,
      grade,
      status: Math.random() > 0.8 ? 'Draft' : 'Published',
      remarks: '',
      details: { ca1, ca2, ca3, exam },
    });
  }
  return baseResults;
};

export const MOCK_RESULTS: ResultData[] = generateResults();
