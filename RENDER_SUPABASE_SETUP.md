# Render + Supabase Backend Configuration

Your backend has been migrated to use Supabase PostgreSQL. Here's how to complete the setup on Render.

## Step 1: Update Render Environment Variables

1. Go to [render.com](https://render.com)
2. Navigate to your backend service: **xmartschool-backend**
3. Click **Environment** (or go to Settings → Environment)
4. Update/Add the following environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:Hard2die%40427333@db.ufhlqqurxymvirjgmztz.supabase.co:5432/postgres` |
| `PORT` | `4000` |
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | (leave empty if not used) |

**IMPORTANT: Use the URL-encoded version** (`%40` instead of `@` for the @ in password)

### How to Add/Update Variables:

1. Find the variable name (e.g., `DATABASE_URL`)
2. If it exists, click the edit icon
3. Replace the value with the new one
4. Click **Save Changes**
5. The service will automatically restart with new variables

## Step 2: Verify Prisma Schema

The schema is already synced to Supabase. Verify locally:

```bash
cd backend
npx prisma db push
```

Expected output:
```
Your database is now in sync with your Prisma schema.
```

## Step 3: Restart Render Service

After updating environment variables:

1. Go to Render dashboard → xmartschool-backend service
2. Click **Manual Deploy** (or wait for automatic restart)
3. Monitor the build logs to ensure it succeeds

Expected flow:
```
↳ Installing build environment
↳ Running build command: npm ci && npm run build
↳ Build successful
↳ Service started on port 4000
```

## Step 4: Verify Backend Connectivity

Test the backend is running:

```bash
curl https://xmartschool.onrender.com/api/health
```

Expected response:
```json
{"ok":true,"data":{"status":"healthy"}}
```

### Or test in browser:
Visit: `https://xmartschool.onrender.com/api/health`

## Step 5: Verify Frontend Connects

1. Frontend is already configured to use: `https://xmartschool.onrender.com/api`
2. Deploy frontend to Firebase (or test locally with `npm run dev`)
3. Check browser console for API requests

Expected in console:
```
[API] GET https://xmartschool.onrender.com/api/health
[API] Response OK: 200
```

If you see errors, check:
- Render DATABASE_URL is URL-encoded correctly
- Render service is running (check dashboard)
- Firebase CORS allows your domain

## Step 6: Test Data Persistence

### Create test data:
1. Open frontend app
2. Create a school/student/teacher
3. Refresh the page

Expected: Data still visible (saved to Supabase)

### Cross-device test:
1. Create data on one browser
2. Open another browser/device to same app
3. Data should be visible (Supabase is single source of truth)

## Step 7: Monitor Deployment

After pushing code changes:

1. GitHub Actions triggers automatically on push to `master`
2. Backend builds and deploys to Render
3. Render runs: `npm run build` which includes `prisma migrate deploy`

Monitor at:
- **Render**: https://render.com (view logs)
- **GitHub**: Repository → Actions tab
- **Firebase**: https://console.firebase.google.com/hosting

## Troubleshooting

### "Error: connect ECONNREFUSED"
- Render DATABASE_URL is not set or incorrect
- Check URL encoding: `%40` for @ symbol
- Restart Render service after updating variables

### "Connection timeout"
- Supabase database might be unreachable
- Check Supabase dashboard that database is running
- Verify firewall allows PostgreSQL port 5432

### "relation does not exist"
- Prisma migrations haven't run
- Run locally: `npx prisma migrate deploy`
- Or restart Render service to trigger migrations

### Frontend can't reach backend
- Check Render service is running
- Verify `VITE_API_BASE_URL` includes `/api`
- Check CORS in backend allows your domain:
  - `https://xmartschool.firebaseapp.com`
  - `https://xmartschool.web.app`

## Quick Command Reference

```bash
# Local development - verify database connection
npx prisma db push

# Check database status
npx prisma db execute

# View database with Prisma Studio
npx prisma studio

# Generate Prisma Client after schema changes
npx prisma generate

# Create a migration
npx prisma migrate dev --name "description"
```

## Current Architecture

```
┌─────────────────────────────────────────────┐
│  Firebase Hosting (Frontend)                │
│  https://xmartschool.firebaseapp.com        │
│  - React app (built from root)              │
│  - Routes to backend at /api                │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Render (Backend API)   │
         │  https://xmartschool... │
         │  - Node.js/Express      │
         │  - Listens on port 4000 │
         └──────────────┬──────────┘
                        │
                        ↓
        ┌───────────────────────────────────┐
        │  Supabase PostgreSQL Database    │
        │  db.ufhlqqurxymvirjgmztz        │
        │  - Tables created by Prisma      │
        │  - Accessible from Render only   │
        │  - Persistent across restarts    │
        └───────────────────────────────────┘
```

## Next Steps

1. ✅ Update DATABASE_URL in Render
2. ✅ Verify Prisma schema is synced
3. Restart Render service (manual deploy)
4. Test health endpoint: `/api/health`
5. Deploy frontend changes (push to master)
6. Verify data persistence

Everything is configured. Just update Render environment and restart!
