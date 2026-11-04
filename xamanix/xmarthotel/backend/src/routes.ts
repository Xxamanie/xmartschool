import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { roomsRouter } from './modules/rooms/rooms.routes';
import { guestsRouter } from './modules/guests/guests.routes';
import { reservationsRouter } from './modules/reservations/reservations.routes';
import { frontdeskRouter } from './modules/frontdesk/frontdesk.routes';
import { housekeepingRouter } from './modules/housekeeping/housekeeping.routes';
import { billingRouter } from './modules/billing/billing.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { restaurantRouter } from './modules/restaurant/restaurant.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { staffRouter } from './modules/staff/staff.routes';
import { publicRouter } from './modules/public/public.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { channelsRouter } from './modules/channels/channels.routes';
import { insightsRouter } from './modules/insights/insights.routes';

/** All API routes mounted under /api. */
export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, data: { status: 'up' } }));

apiRouter.use('/public', publicRouter); // unauthenticated guest-facing endpoints
apiRouter.use('/auth', authRouter);
apiRouter.use('/', roomsRouter); // /room-types, /rooms
apiRouter.use('/guests', guestsRouter);
apiRouter.use('/reservations', reservationsRouter);
apiRouter.use('/frontdesk', frontdeskRouter);
apiRouter.use('/housekeeping', housekeepingRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/channels', channelsRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/restaurant', restaurantRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/staff', staffRouter);
