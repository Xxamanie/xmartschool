import { prisma } from '../lib/prisma';

// ── Grid configuration ──────────────────────────────────────────────────────
export const DAYS = 5;        // Monday … Friday
export const PERIODS = 8;     // lesson periods per day
const TOTAL_SLOTS = DAYS * PERIODS;

// Subjects that should sit in the first three periods where possible.
const isPriority = (name: string) => {
  const n = (name || '').toLowerCase();
  return n.includes('math') || n.includes('english');
};

type Resp<T> = { ok: boolean; data: T; message?: string };
const ok = <T>(data: T, message?: string): Resp<T> => ({ ok: true, data, message });
const fail = <T>(message: string, data: T): Resp<T> => ({ ok: false, data, message });

export type TimetableEntryDTO = {
  id: string;
  schoolClassId: string;
  className: string;
  day: number;
  period: number;
  subjectId: string;
  subjectName: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
};

type Assignment = { subjectId: string; subjectName: string; teacherId?: string; teacherName?: string };

// Period preference orders. Priority subjects favour early periods (1–3, then 4);
// non-priority subjects favour later periods so the early ones stay free for
// Mathematics / English.
const priorityPeriodOrder = [0, 1, 2, 3, 4, 5, 6, 7];
const normalPeriodOrder = [4, 5, 6, 7, 3, 2, 1, 0];

/**
 * Build a conflict-free weekly timetable for every class in a school and
 * persist it (replacing any existing timetable for that school).
 *
 * Hard guarantees:
 *  - a class never has two lessons in the same slot
 *  - a teacher is never scheduled in two classes in the same (day, period)
 * Soft preferences:
 *  - Mathematics / English Language land in periods 1–3 (then 4) where possible
 *  - a subject avoids repeating twice in one day until it has to
 */
export const generateTimetable = async (
  schoolId: string,
): Promise<Resp<{ placed: number; classes: number }>> => {
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  if (classes.length === 0) return fail('No classes to schedule for this school', { placed: 0, classes: 0 });

  // teacherId|day|period → busy
  const teacherBusy = new Set<string>();
  const newEntries: Array<{
    schoolId: string; schoolClassId: string; day: number; period: number;
    subjectId: string; subjectName: string; teacherId: string | null; teacherName: string | null;
  }> = [];

  for (const cls of classes) {
    const rows = await prisma.teacherAssignment.findMany({
      where: { schoolClassId: cls.id },
      include: { subject: { select: { name: true } }, teacher: { select: { name: true } } },
    });

    // De-duplicate by subject (one subject may have multiple assignment rows).
    const bySubject = new Map<string, Assignment>();
    for (const r of rows) {
      if (!bySubject.has(r.subjectId)) {
        bySubject.set(r.subjectId, {
          subjectId: r.subjectId,
          subjectName: r.subject?.name ?? 'Subject',
          teacherId: r.teacherId ?? undefined,
          teacherName: r.teacher?.name ?? undefined,
        });
      }
    }
    const assignments = [...bySubject.values()];
    if (assignments.length === 0) continue;

    // Even share of the weekly grid, clamped to a sane 2–5 periods/subject.
    const per = Math.min(5, Math.max(2, Math.floor(TOTAL_SLOTS / assignments.length)));

    // Priority subjects first.
    const ordered = [
      ...assignments.filter(a => isPriority(a.subjectName)),
      ...assignments.filter(a => !isPriority(a.subjectName)),
    ];

    const classBusy = new Set<string>(); // day|period within this class

    ordered.forEach((a, subjectIdx) => {
      const priority = isPriority(a.subjectName);
      const periodOrder = priority ? priorityPeriodOrder : normalPeriodOrder;
      const dayStart = subjectIdx % DAYS;
      const dayOrder = Array.from({ length: DAYS }, (_, i) => (dayStart + i) % DAYS);
      const daysUsed = new Set<number>();
      let placed = 0;

      const tryPlace = (avoidSameDay: boolean) => {
        for (const period of periodOrder) {
          if (placed >= per) return;
          for (const day of dayOrder) {
            if (placed >= per) return;
            if (avoidSameDay && daysUsed.has(day)) continue;
            if (classBusy.has(`${day}|${period}`)) continue;
            if (a.teacherId && teacherBusy.has(`${a.teacherId}|${day}|${period}`)) continue;
            classBusy.add(`${day}|${period}`);
            if (a.teacherId) teacherBusy.add(`${a.teacherId}|${day}|${period}`);
            daysUsed.add(day);
            newEntries.push({
              schoolId, schoolClassId: cls.id, day, period,
              subjectId: a.subjectId, subjectName: a.subjectName,
              teacherId: a.teacherId ?? null, teacherName: a.teacherName ?? null,
            });
            placed++;
          }
        }
      };

      tryPlace(true);   // spread across different days first
      tryPlace(false);  // then allow same-day repeats to hit the target
    });
  }

  await prisma.$transaction([
    prisma.timetableEntry.deleteMany({ where: { schoolId } }),
    prisma.timetableEntry.createMany({ data: newEntries }),
  ]);

  return ok({ placed: newEntries.length, classes: classes.length }, 'Timetable generated');
};

export const getTimetable = async (schoolId: string): Promise<Resp<TimetableEntryDTO[]>> => {
  const [entries, classes] = await Promise.all([
    prisma.timetableEntry.findMany({
      where: { schoolId },
      orderBy: [{ schoolClassId: 'asc' }, { day: 'asc' }, { period: 'asc' }],
    }),
    prisma.schoolClass.findMany({ where: { schoolId }, select: { id: true, name: true } }),
  ]);
  const classNames = new Map(classes.map(c => [c.id, c.name]));
  const subjectIds = [...new Set(entries.map(entry => entry.subjectId))];
  const subjects = subjectIds.length > 0
    ? await prisma.subject.findMany({
        where: { schoolId, id: { in: subjectIds } },
        select: { id: true, room: true },
      })
    : [];
  const subjectRooms = new Map(subjects.map(subject => [subject.id, subject.room?.trim() || undefined]));
  return ok(entries.map((e): TimetableEntryDTO => ({
    id: e.id,
    schoolClassId: e.schoolClassId,
    className: classNames.get(e.schoolClassId) ?? '',
    day: e.day,
    period: e.period,
    subjectId: e.subjectId,
    subjectName: e.subjectName,
    teacherId: e.teacherId ?? undefined,
    teacherName: e.teacherName ?? undefined,
    room: subjectRooms.get(e.subjectId),
  })));
};

/**
 * Admin manual override of a single slot. Pass subjectId = null to clear it.
 * Rejects the change if it would double-book the subject's teacher.
 */
export const updateTimetableSlot = async (params: {
  schoolId: string;
  schoolClassId: string;
  day: number;
  period: number;
  subjectId: string | null;
}): Promise<Resp<TimetableEntryDTO | null>> => {
  const { schoolId, schoolClassId, day, period, subjectId } = params;

  const cls = await prisma.schoolClass.findUnique({ where: { id: schoolClassId }, select: { schoolId: true } });
  if (!cls || cls.schoolId !== schoolId) return fail('Class not found in this school', null);
  if (day < 0 || day >= DAYS || period < 0 || period >= PERIODS) return fail('Invalid slot', null);

  // Clear the slot.
  if (!subjectId) {
    await prisma.timetableEntry.deleteMany({ where: { schoolClassId, day, period } });
    return ok(null, 'Slot cleared');
  }

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true, room: true } });
  if (!subject) return fail('Subject not found in this school', null);

  // Resolve the teacher who teaches this subject in this class (if assigned).
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolClassId, subjectId },
    include: { teacher: { select: { id: true, name: true } } },
  });
  const teacherId = assignment?.teacher?.id ?? null;
  const teacherName = assignment?.teacher?.name ?? null;

  // Teacher clash check: same teacher, same slot, a *different* class.
  if (teacherId) {
    const clash = await prisma.timetableEntry.findFirst({
      where: { schoolId, day, period, teacherId, NOT: { schoolClassId } },
      select: { schoolClassId: true },
    });
    if (clash) {
      const clashClass = await prisma.schoolClass.findUnique({ where: { id: clash.schoolClassId }, select: { name: true } });
      return fail(`${teacherName ?? 'That teacher'} is already teaching ${clashClass?.name ?? 'another class'} in this period`, null);
    }
  }

  const existing = await prisma.timetableEntry.findUnique({
    where: { schoolClassId_day_period: { schoolClassId, day, period } },
  });
  const saved = existing
    ? await prisma.timetableEntry.update({
        where: { id: existing.id },
        data: { subjectId, subjectName: subject.name, teacherId, teacherName },
      })
    : await prisma.timetableEntry.create({
        data: { schoolId, schoolClassId, day, period, subjectId, subjectName: subject.name, teacherId, teacherName },
      });

  const className = (await prisma.schoolClass.findUnique({ where: { id: schoolClassId }, select: { name: true } }))?.name ?? '';
  return ok({
    id: saved.id, schoolClassId, className, day, period,
    subjectId, subjectName: subject.name,
    teacherId: teacherId ?? undefined, teacherName: teacherName ?? undefined,
    room: subject.room?.trim() || undefined,
  }, 'Slot updated');
};

export const clearTimetable = async (schoolId: string): Promise<Resp<boolean>> => {
  await prisma.timetableEntry.deleteMany({ where: { schoolId } });
  return ok(true, 'Timetable cleared');
};
