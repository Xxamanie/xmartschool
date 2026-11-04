export type Role = 'OWNER' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface User { id: string; name: string; email: string; role: Role; orgId: string | null; employeeId: string | null; }

export type EmploymentStatus = 'Active' | 'OnLeave' | 'Suspended' | 'Terminated';
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Remote' | 'OnLeave';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface Department { id: string; name: string; _count?: { employees: number }; }
export interface Position { id: string; title: string; grade: string; }

export interface Employee {
  id: string; staffNo: string; firstName: string; lastName: string;
  email?: string | null; phone?: string | null; status: EmploymentStatus;
  baseSalaryMinor: number; hireDate: string;
  departmentId?: string | null; positionId?: string | null; managerId?: string | null;
  department?: { name: string } | null; position?: { title: string } | null;
  manager?: { firstName: string; lastName: string } | null;
}

export interface AttendanceRecord {
  id: string; date: string; clockIn?: string | null; clockOut?: string | null;
  status: AttendanceStatus; workedMinutes: number;
  employee?: { firstName: string; lastName: string; staffNo: string };
}

export interface LeaveType { id: string; name: string; daysPerYear: number; paid: boolean; }
export interface LeaveBalance { id: string; year: number; entitled: number; used: number; leaveType?: { name: string; daysPerYear: number; paid: boolean }; }
export interface LeaveRequest {
  id: string; startDate: string; endDate: string; days: number; status: LeaveStatus; reason?: string | null;
  leaveType?: { name: string }; employee?: { firstName: string; lastName: string; staffNo: string };
}

export interface SalaryComponent { id: string; name: string; type: 'Earning' | 'Deduction'; amountMinor: number; recurring: boolean; }
export interface PayrollRun { id: string; periodLabel: string; status: 'Draft' | 'Finalized'; _count?: { payslips: number }; }
export interface Payslip {
  id: string; grossMinor: number; deductionsMinor: number; netMinor: number;
  employee?: { firstName: string; lastName: string; staffNo: string }; run?: { periodLabel: string };
}

export interface DashboardData {
  headcount: number; active: number; onLeave: number; suspended: number; terminated: number;
  presentToday: number; lateToday: number; attendanceRate: number; pendingLeave: number;
  byDepartment: { name: string; count: number }[];
  lastPayroll: { periodLabel: string; netMinor: number; payslips: number } | null;
}

export type StatutoryKind = 'Pension' | 'Tax' | 'Levy' | 'Other';
export type StatutoryMethod = 'PercentOfBasic' | 'PercentOfGross' | 'Fixed' | 'PayeBands';
export interface StatutoryRule { id: string; name: string; kind: StatutoryKind; method: StatutoryMethod; rateBps: number; fixedMinor: number; active: boolean; order: number; }

export interface ReviewCycle { id: string; name: string; periodLabel: string; status: 'Open' | 'Closed'; _count?: { reviews: number }; }
export interface Review {
  id: string; cycleId: string; overallRating: number; strengths?: string | null; improvements?: string | null; comments?: string | null;
  status: 'Draft' | 'Submitted' | 'Acknowledged';
  employee?: { firstName: string; lastName: string; staffNo: string }; reviewer?: { firstName: string; lastName: string } | null; cycle?: { name: string };
}
export interface Goal { id: string; title: string; description?: string | null; status: 'Open' | 'InProgress' | 'Done' | 'Cancelled'; dueDate?: string | null; }

export interface HrMetrics {
  headcount: number; active: number; onLeave: number; suspended: number; terminated: number;
  attritionRatePct: number; hiresLast90: number; punctualityRatePct: number; avgReviewRating: number;
  pendingLeave: number; lastPayrollNetMinor: number | null;
}
export interface AttritionRisk { employeeId: string; name: string; department: string; score: number; level: 'Low' | 'Medium' | 'High'; reasons: string[]; }
export interface LeaveCoverage {
  upcoming: { employee: string; department: string; leaveType: string; startDate: string; endDate: string; days: number }[];
  byDepartment: { department: string; days: number }[];
}

export type SignatureMethod = 'Typed' | 'Drawn';
export interface Signature { id: string; signerName: string; method: SignatureMethod; signedAt: string; contentHash?: string; }
export interface DocumentMeta {
  id: string; employeeId?: string | null; checklistId?: string | null; itemIndex?: number | null;
  name: string; mimeType: string; sizeBytes: number; requiresSignature: boolean; createdAt: string;
  signatures?: { id: string; signerName: string; method: SignatureMethod; signedAt: string }[];
}

export type ChecklistType = 'Onboarding' | 'Offboarding';
export interface ChecklistItem { title: string; done: boolean; doneAt?: string; }
export interface Checklist { id: string; type: ChecklistType; title: string; status: 'Open' | 'Done'; items: ChecklistItem[]; employee?: { firstName: string; lastName: string; staffNo: string }; }
export interface ChecklistTemplate { id: string; type: ChecklistType; name: string; items: string[]; }

export type AnnouncementAudience = 'All' | 'Department';
export interface Announcement { id: string; message: string; audience: AnnouncementAudience; departmentId?: string | null; channel: string; sentCount: number; createdAt: string; }

export interface PayslipLine { name: string; type: string; category: string; amountMinor: number; }
export interface PayslipDetail {
  id: string; grossMinor: number; deductionsMinor: number; taxMinor: number; pensionMinor: number; statutoryMinor: number; netMinor: number;
  breakdown?: PayslipLine[];
  run?: { periodLabel: string; status: string; org?: { name: string; currency: string } };
  employee?: { firstName: string; lastName: string; staffNo: string; department?: { name: string } | null; position?: { title: string } | null; bankName?: string | null; bankAccount?: string | null };
}
