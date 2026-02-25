# Deployment Setup

This guide reflects the current production path:
- Frontend: Firebase Hosting (or any static host)
- Backend: Render (Node/Express)
- Database: PostgreSQL (Supabase-hosted Postgres is supported)

## 1. Required Environment Variables

### Backend (Render)

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
GEMINI_API_KEY=
```

### Frontend (build env)

```env
VITE_API_BASE_URL=https://your-backend-domain/api
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 2. Backend Deployment (Render)

Recommended settings:
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Root directory: `backend`

After deploy:
- Verify health endpoint: `https://<backend-domain>/api/health`

## 3. Frontend Deployment

Build command:
```bash
npm run build
```

Serve the `dist/` output on your host.

If using Firebase Hosting:
- Ensure `firebase.json` points `public` to `dist`
- Deploy with `firebase deploy`

## 4. Post-Deploy Checks

1. `GET /api/health` returns healthy.
2. Staff login works.
3. Student verification (`/api/auth/student`) works.
4. CRUD flows (students/subjects/attendance) persist after refresh.

## 5. Security Notes

- Do not commit real credentials in docs or `.env` files.
- Use provider secret stores (Render env vars, GitHub Actions secrets).
- URL-encode credentials only in connection strings where required.
