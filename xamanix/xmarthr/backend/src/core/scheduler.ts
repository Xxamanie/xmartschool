import { prisma } from './prisma';
import { env } from './env';
import { markAbsenteesForOrg, employeesNotClockedIn } from '../modules/attendance/attendance.service';
import { sendSms } from '../modules/notifications/termii.service';

/**
 * In-process scheduler — runs HR automations on a daily cron without anyone
 * clicking. No external dependency: a 60s tick fires jobs at the top of the
 * configured hour, guarded so each job runs at most once per day. For a single
 * always-on instance this is sufficient; behind multiple replicas, move these to
 * a dedicated worker or a distributed scheduler.
 */
const lastRun = new Map<string, string>(); // jobKey -> YYYY-MM-DD
const today = () => new Date().toISOString().slice(0, 10);

async function runReminders(): Promise<void> {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  for (const org of orgs) {
    const pending = await employeesNotClockedIn(org.id);
    for (const e of pending) await sendSms(e.phone!, `Good morning ${e.firstName}, please remember to clock in on XmartHR.`);
    if (pending.length) console.log(`[scheduler] clock-in reminder → ${pending.length} (org ${org.id})`);
  }
}

async function runPendingLeaveNudge(): Promise<void> {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  for (const org of orgs) {
    const pending = await prisma.leaveRequest.findMany({
      where: { status: 'Pending', employee: { orgId: org.id } },
      select: { employee: { select: { manager: { select: { id: true, firstName: true, phone: true } } } } },
    });
    const byManager = new Map<string, { name: string; phone: string | null; count: number }>();
    for (const r of pending) {
      const m = r.employee.manager;
      if (!m) continue;
      const cur = byManager.get(m.id) ?? { name: m.firstName, phone: m.phone, count: 0 };
      cur.count += 1;
      byManager.set(m.id, cur);
    }
    for (const [, m] of byManager) if (m.phone) await sendSms(m.phone, `Hi ${m.name}, you have ${m.count} pending leave request(s) to review on XmartHR.`);
  }
}

async function runAbsentees(): Promise<void> {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  let total = 0;
  for (const org of orgs) total += await markAbsenteesForOrg(org.id);
  console.log(`[scheduler] auto mark-absent → ${total} record(s)`);
}

function tick(): void {
  const now = new Date();
  if (now.getMinutes() !== 0) return; // only at the top of the hour
  const hour = now.getHours();
  const day = today();

  if (hour === env.reminderHour && lastRun.get('reminders') !== day) {
    lastRun.set('reminders', day);
    runReminders().catch((e) => console.error('[scheduler] reminders failed', e));
    runPendingLeaveNudge().catch((e) => console.error('[scheduler] leave nudge failed', e));
  }
  if (hour === env.absenteeHour && lastRun.get('absentees') !== day) {
    lastRun.set('absentees', day);
    runAbsentees().catch((e) => console.error('[scheduler] absentees failed', e));
  }
}

export function startScheduler(): void {
  if (!env.schedulerEnabled) {
    console.log('[scheduler] disabled (SCHEDULER_ENABLED=false)');
    return;
  }
  console.log(`[scheduler] on — reminders @${env.reminderHour}:00, auto mark-absent @${env.absenteeHour}:00 (local)`);
  setInterval(tick, 60_000);
}
