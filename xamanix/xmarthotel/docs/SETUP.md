# XmartHotel — Setup

## Prerequisites
- Node 18+ and npm
- PostgreSQL 14+ (local, Docker, or a managed provider like Supabase/Neon/Render)

## Backend
```bash
cd backend
cp .env.example .env
# edit .env:
#   DATABASE_URL=postgresql://user:pass@host:5432/xmarthotel
#   JWT_SECRET=<32+ random chars>
#   CORS_ORIGIN=http://localhost:5173
npm install
npx prisma generate
npx prisma migrate dev --name init     # or: npx prisma db push
npm run seed                           # demo property + rooms + admin
npm run dev                            # API on http://localhost:5050
```

## Frontend
```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5050/api
npm install
npm run dev                 # http://localhost:5173
```

## Demo login
`admin@xmarthotel.demo` / `Password1`

## Common issues
- **P1001 can't reach database** — DB not running or wrong host; if on Supabase
  free tier it may be paused, or the direct host is IPv6-only (use the session
  pooler).
- **CORS error** — set `CORS_ORIGIN` to the exact frontend origin.
- **401 on every request** — token missing/expired; log in again.
