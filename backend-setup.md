# Backend Setup

The backend is already implemented in `backend/` using:
- Express + TypeScript
- Prisma ORM
- PostgreSQL datasource

## Local Setup

1. Install dependencies:
```bash
npm --prefix backend install
```

2. Create `backend/.env`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=
```

3. Generate Prisma client and seed:
```bash
npm --prefix backend run prisma:generate
npm --prefix backend run db:seed
```

4. Run backend:
```bash
npm --prefix backend run dev
```

## API Base URL

- Local: `http://localhost:4000/api`
- Health check: `http://localhost:4000/api/health`

## Notes

- Student verification endpoint: `POST /api/auth/student`
- Profile update endpoint: `PUT /api/auth/profile`
- Class master endpoints:
  - `GET /api/students/form-masters`
  - `POST /api/students/form-masters`
