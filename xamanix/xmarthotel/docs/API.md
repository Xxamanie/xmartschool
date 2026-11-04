# XmartHotel — API Reference

Base URL: `/api` · All responses: `{ ok: boolean, data: T, message?: string }` ·
Auth: `Authorization: Bearer <jwt>` (except `/auth/login`).

## Auth
| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | — |

## Rooms
| Method | Path | Role |
|---|---|---|
| GET | `/rooms` | any |
| POST | `/rooms` | MANAGER+ |
| PATCH | `/rooms/:id/status` | FRONT_DESK+ |
| GET | `/room-types` | any |
| POST | `/room-types` | MANAGER+ |

## Reservations
| Method | Path | Role |
|---|---|---|
| GET | `/reservations` | FRONT_DESK+ |
| POST | `/reservations` | FRONT_DESK+ — `{ guest, roomTypeId, checkIn, checkOut, ... }` |
| GET | `/reservations/:id` | FRONT_DESK+ |
| POST | `/reservations/:id/cancel` | FRONT_DESK+ |

## Front desk
| Method | Path | Role |
|---|---|---|
| POST | `/frontdesk/:reservationId/check-in` | FRONT_DESK+ — `{ roomId }` |
| POST | `/frontdesk/:reservationId/check-out` | FRONT_DESK+ |
| GET | `/frontdesk/arrivals` | FRONT_DESK+ |
| GET | `/frontdesk/in-house` | FRONT_DESK+ |

## Housekeeping
| Method | Path | Role |
|---|---|---|
| GET | `/housekeeping/tasks` | HOUSEKEEPING+ |
| POST | `/housekeeping/tasks` | HOUSEKEEPING+ |
| PATCH | `/housekeeping/tasks/:id` | HOUSEKEEPING+ — `{ status }` |

## Billing
| Method | Path | Role |
|---|---|---|
| GET | `/billing/folio/:reservationId` | ACCOUNTANT+ |
| POST | `/billing/folio/:reservationId/charge` | FRONT_DESK+ — `{ description, amount }` |
| POST | `/billing/folio/:reservationId/payment` | FRONT_DESK+ — `{ amount, method }` |

## Reports
| Method | Path | Role |
|---|---|---|
| GET | `/reports/dashboard` | MANAGER+ — occupancy, ADR, RevPAR, revenue |

Roles ascend: `STAFF < HOUSEKEEPING/FRONT_DESK/ACCOUNTANT < MANAGER < OWNER`.
`OWNER` bypasses all role checks.
