# SmartSchool Environment Setup

## Frontend

Use `.env.local` locally and `.env.example` as the template.

Required variables:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

Optional:

- `VITE_GEMINI_API_KEY`

## Backend

Use `backend/.env` locally and `backend/.env.example` as the template.

Required variables:

- `DATABASE_URL`
- `SESSION_SECRET`

Recommended:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## Security rules

- Do not commit real `.env` files.
- Use distinct credentials for local, staging, and production.
- Rotate any key that was previously stored in version control.
- Keep the Supabase service role key backend-only.
