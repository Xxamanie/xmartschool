# Render + Supabase PostgreSQL Setup

Use this guide to connect Render backend to a Supabase-hosted PostgreSQL database.

## 1. Render Environment Variables

Set these in your Render backend service:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
GEMINI_API_KEY=
```

Notes:
- Keep credentials in Render secret env vars only.
- URL-encode special password characters in `DATABASE_URL` when required.

## 2. Build/Start Commands

- Build: `npm ci && npm run build`
- Start: `npm start`

## 3. Verify Deployment

1. Open:
   - `https://<render-service>/api/health`
2. Expect:
```json
{"ok":true,"data":{"status":"healthy"}}
```

## 4. Prisma Commands (local verification)

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
```

## 5. Functional Smoke Checks

- Staff login via `/api/auth/login`
- Student verification via `/api/auth/student`
- Students/subjects/attendance flows persist after refresh

## 6. Troubleshooting

- `ECONNREFUSED`:
  - check `DATABASE_URL`, network access, and DB availability
- CORS issues:
  - ensure `FRONTEND_URL` is correct
- Missing tables:
  - apply migrations and redeploy
