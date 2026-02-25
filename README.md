# SmartSchool

SmartSchool is a full-stack school management platform with:
- React + Vite frontend
- Express + TypeScript backend
- PostgreSQL + Prisma data layer
- Optional Supabase auth/session integration
- AI helpers for grading and proctoring hooks

## Repository Structure

- `backend/`: Express API, Prisma schema/migrations, seed script
- `pages/`, `components/`, `context/`, `services/`: frontend app code
- `src/services/`: shared frontend service clients (Supabase + API utilities)

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Quick Start

1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
npm --prefix backend install
```

3. Configure backend environment variables in `backend/.env`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
PORT=4000
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_key_optional
```

4. Configure frontend environment variables in `.env.development` (or `.env.local`):
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_SUPABASE_URL=your_supabase_url_optional
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_optional
```

5. Generate Prisma client and run seed data:
```bash
npm --prefix backend run prisma:generate
npm --prefix backend run db:seed
```

6. Start backend:
```bash
npm --prefix backend run dev
```

7. Start frontend:
```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

## Useful Commands

- Frontend typecheck:
```bash
npx tsc --noEmit
```

- Backend build:
```bash
npm --prefix backend run build
```

- Prisma dev migration:
```bash
npm --prefix backend run prisma:migrate
```

## Notes

- Auth currently supports:
  - staff login via `/api/auth/login`
  - student code verification via `/api/auth/student`
- Legacy `services/cloud-api.ts` and `services/firebase-api.ts` are compatibility wrappers over `services/api.ts`.
- Supabase is optional at runtime; if missing, API-based auth/data flow is used.
