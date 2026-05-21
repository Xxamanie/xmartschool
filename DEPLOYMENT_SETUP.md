# SmartSchool Deployment Setup

## Architecture

- Frontend: Vite/React application
- Backend: Express/TypeScript API
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- File storage: Supabase Storage
- Hosting: Render or another container-capable platform

## Required services

1. Supabase project with PostgreSQL, Auth, and Storage enabled
2. Render web service for `backend/`
3. Render static site or equivalent for the frontend

## Backend deployment

1. Build command:
   `npm ci && npm run build`
2. Start command:
   `npm run start`
3. Required environment variables:
   - `NODE_ENV=production`
   - `PORT=4000`
   - `DATABASE_URL`
   - `FRONTEND_URL`
   - `CORS_ORIGIN`
   - `SESSION_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` if AI features are enabled

## Frontend deployment

1. Build command:
   `npm ci && npm run build`
2. Publish directory:
   `dist`
3. Required environment variables:
   - `VITE_API_BASE_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET`
   - `VITE_GEMINI_API_KEY` if AI features are enabled

## Post-deploy checks

1. Confirm backend health at `/api/health`
2. Confirm frontend can authenticate against Supabase
3. Confirm backend CORS allows the deployed frontend origin
4. Confirm Prisma can connect to Supabase PostgreSQL
5. Confirm uploads work against Supabase Storage
