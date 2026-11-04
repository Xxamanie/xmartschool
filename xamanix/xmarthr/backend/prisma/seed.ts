import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password1', 10);

  let org = await prisma.org.findFirst({ where: { name: 'XmartHR Demo Co.' } });
  if (!org) org = await prisma.org.create({ data: { name: 'XmartHR Demo Co.', country: 'Nigeria', currency: 'NGN' } });
  const orgId = org.id;

  // Users
  const owner = await prisma.user.upsert({
    where: { email: 'admin@xmarthr.demo' },
    update: { name: 'HR Owner', role: 'OWNER', orgId, active: true },
    create: { orgId, name: 'HR Owner', email: 'admin@xmarthr.demo', role: 'OWNER', passwordHash },
  });
  const hr = await prisma.user.upsert({
    where: { email: 'hr@xmarthr.demo' },
    update: { name: 'Hannah HR', role: 'HR_ADMIN', orgId, active: true },
    create: { orgId, name: 'Hannah HR', email: 'hr@xmarthr.demo', role: 'HR_ADMIN', passwordHash },
  });
  const empUser = await prisma.user.upsert({
    where: { email: 'employee@xmarthr.demo' },
    update: { name: 'Emeka Employee', role: 'EMPLOYEE', orgId, active: true },
    create: { orgId, name: 'Emeka Employee', email: 'employee@xmarthr.demo', role: 'EMPLOYEE', passwordHash },
  });
  void owner; void hr;

  // Departments & positions
  const deptDefs = ['Engineering', 'Sales', 'Operations'];
  const depts: Record<string, string> = {};
  for (const name of deptDefs) {
    const d = await prisma.department.upsert({ where: { orgId_name: { orgId, name } }, update: {}, create: { orgId, name } });
    depts[name] = d.id;
  }
  const posDefs = [['Software Engineer', 'L3'], ['Sales Executive', 'L2'], ['Operations Lead', 'L4']];
  const positions: Record<string, string> = {};
  for (const [title, grade] of posDefs) {
    const p = await prisma.position.upsert({ where: { orgId_title: { orgId, title } }, update: { grade }, create: { orgId, title, grade } });
    positions[title] = p.id;
  }

  // Leave types
  const leaveDefs = [{ name: 'Annual', daysPerYear: 20, paid: true }, { name: 'Sick', daysPerYear: 10, paid: true }, { name: 'Unpaid', daysPerYear: 0, paid: false }];
  const leaveTypes: Record<string, string> = {};
  for (const lt of leaveDefs) {
    const t = await prisma.leaveType.upsert({ where: { orgId_name: { orgId, name: lt.name } }, update: { daysPerYear: lt.daysPerYear, paid: lt.paid }, create: { orgId, ...lt } });
    leaveTypes[lt.name] = t.id;
  }

  // Statutory rules (auto-applied) — Nigeria-style defaults; tune for production.
  const ruleCount = await prisma.statutoryRule.count({ where: { orgId } });
  if (ruleCount === 0) {
    await prisma.statutoryRule.create({ data: { orgId, name: 'Pension (employee 8%)', kind: 'Pension', method: 'PercentOfBasic', rateBps: 800, order: 1 } });
    await prisma.statutoryRule.create({ data: { orgId, name: 'NHF (2.5%)', kind: 'Levy', method: 'PercentOfBasic', rateBps: 250, order: 2 } });
    // PAYE: progressive monthly bands (minor units). 20% relief approximates CRA.
    await prisma.statutoryRule.create({
      data: {
        orgId, name: 'PAYE', kind: 'Tax', method: 'PayeBands', reliefBps: 2000, order: 3,
        bands: [
          { uptoMinor: 2_500_000, rateBps: 700 },
          { uptoMinor: 5_000_000, rateBps: 1100 },
          { uptoMinor: 9_166_700, rateBps: 1500 },
          { uptoMinor: 13_333_400, rateBps: 1900 },
          { uptoMinor: 26_666_700, rateBps: 2100 },
          { uptoMinor: null, rateBps: 2400 },
        ],
      },
    });
  }

  // Checklist templates (used to auto-start onboarding/offboarding).
  await prisma.checklistTemplate.upsert({
    where: { orgId_type_name: { orgId, type: 'Onboarding', name: 'Standard onboarding' } },
    update: {},
    create: { orgId, type: 'Onboarding', name: 'Standard onboarding', items: ['Sign employment contract', 'Submit ID & bank details', 'Set up email & accounts', 'Office tour & introductions', 'Assign equipment', 'Add to payroll'] },
  });
  await prisma.checklistTemplate.upsert({
    where: { orgId_type_name: { orgId, type: 'Offboarding', name: 'Standard offboarding' } },
    update: {},
    create: { orgId, type: 'Offboarding', name: 'Standard offboarding', items: ['Revoke system access', 'Recover equipment', 'Final settlement & payslip', 'Exit interview', 'Update records'] },
  });

  // Review cycle
  const cycle = await prisma.reviewCycle.upsert({
    where: { orgId_name: { orgId, name: `H1 ${new Date().getFullYear()}` } },
    update: {},
    create: { orgId, name: `H1 ${new Date().getFullYear()}`, periodLabel: `${new Date().getFullYear()}-H1` },
  });

  // Employees
  const empCount = await prisma.employee.count({ where: { orgId } });
  if (empCount === 0) {
    const emeka = await prisma.employee.create({
      data: {
        orgId, userId: empUser.id, staffNo: 'EMP-001', firstName: 'Emeka', lastName: 'Employee', email: 'employee@xmarthr.demo',
        departmentId: depts['Engineering'], positionId: positions['Software Engineer'], baseSalaryMinor: 45_000_00,
        components: { create: [{ name: 'Housing allowance', type: 'Earning', amountMinor: 10_000_00 }, { name: 'Pension', type: 'Deduction', amountMinor: 3_600_00 }] },
      },
    });
    const manager = await prisma.employee.create({
      data: { orgId, staffNo: 'EMP-002', firstName: 'Ngozi', lastName: 'Manager', departmentId: depts['Operations'], positionId: positions['Operations Lead'], baseSalaryMinor: 80_000_00 },
    });
    await prisma.employee.create({
      data: { orgId, staffNo: 'EMP-003', firstName: 'Sade', lastName: 'Sales', departmentId: depts['Sales'], positionId: positions['Sales Executive'], managerId: manager.id, baseSalaryMinor: 38_000_00 },
    });

    // Annual leave entitlement + a pending request for Emeka
    const year = new Date().getFullYear();
    await prisma.leaveBalance.create({ data: { employeeId: emeka.id, leaveTypeId: leaveTypes['Annual'], year, entitled: 20, used: 0 } });
    await prisma.leaveRequest.create({
      data: { employeeId: emeka.id, leaveTypeId: leaveTypes['Annual'], startDate: new Date(Date.now() + 7 * 86_400_000), endDate: new Date(Date.now() + 9 * 86_400_000), days: 3, reason: 'Family trip' },
    });

    // Today's attendance for Emeka
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const clockIn = new Date(today); clockIn.setHours(8, 45, 0, 0);
    await prisma.attendanceRecord.create({ data: { employeeId: emeka.id, date: today, clockIn, status: 'Present' } });
  }

  console.log('✅ Seed complete. Logins (all / Password1):');
  console.log('   admin@xmarthr.demo (OWNER) · hr@xmarthr.demo (HR_ADMIN) · employee@xmarthr.demo (EMPLOYEE)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
