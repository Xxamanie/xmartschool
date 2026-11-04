import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { orgRouter } from './modules/org/org.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { leaveRouter } from './modules/leave/leave.routes';
import { payrollRouter } from './modules/payroll/payroll.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { performanceRouter } from './modules/performance/performance.routes';
import { insightsRouter } from './modules/insights/insights.routes';
import { announcementsRouter } from './modules/announcements/announcements.routes';
import { checklistsRouter } from './modules/checklists/checklists.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { signingRouter } from './modules/public/signing.routes';

/** All API routes mounted under /api. */
export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, data: { status: 'up' } }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/org', orgRouter); // /departments, /positions
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/leave', leaveRouter);
apiRouter.use('/payroll', payrollRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/performance', performanceRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/checklists', checklistsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/public', signingRouter); // unauthenticated e-sign links
