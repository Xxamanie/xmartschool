# Deployment Setup Guide

This guide will help you set up the complete deployment pipeline for XMart School with Firebase Hosting, GitHub Actions, and Render.

## Prerequisites

- GitHub account with repository access
- Firebase project (xmart-school)
- Render account with PostgreSQL database
- Supabase PostgreSQL connection details

---

## 1. GitHub Secrets Configuration

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Firebase Secrets
- **FIREBASE_SERVICE_ACCOUNT_XMART_SCHOOL**: Your Firebase service account JSON key
  - Get from: Firebase Console → Project Settings → Service Accounts → Generate new private key
  - Paste the entire JSON content as one line

- **VITE_API_BASE_URL**: `https://xmartschool.onrender.com/api`
  - This tells the frontend where to find the backend

- **VITE_GEMINI_API_KEY**: (optional) Your Gemini API key if needed
  - Leave empty if not using Gemini features

### Example: How to Add Secrets
1. Go to GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the name and value above

---

## 2. Backend Deployment on Render

### Create Render Service

1. Go to [render.com](https://render.com)
2. Connect your GitHub account
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure as follows:

**Service Details:**
- Name: `xmartschool-backend`
- Environment: `Node`
- Region: Choose closest to users
- Branch: `master`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`

**Environment Variables:**
```
DATABASE_URL=postgresql://postgres:Hard2die@427333@db.ufhlqqurxymvirjgmztz.supabase.co:5432/postgres
PORT=4000
NODE_ENV=production
GEMINI_API_KEY=(optional)
```

**Plan:** Free tier works initially, upgrade as needed

### After Service Creation

6. Note your service URL (e.g., `https://xmartschool.onrender.com`)
7. Update `VITE_API_BASE_URL` GitHub secret to point to this URL

---

## 3. Frontend Deployment on Firebase

### Setup Firebase CLI (Local)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

When prompted:
- Select project: `xmartschool`
- Public directory: `dist`
- Single-page app: `Yes`
- GitHub support: `Yes`

### Configure GitHub Integration

1. Firebase will create workflow files automatically
2. Authorize Firebase to deploy from GitHub
3. Workflows will use secrets you configured above

### Manual Deployment (Optional)

```bash
npm run build
firebase deploy
```

---

## 4. Environment Files Summary

### Frontend (.env files)

**.env.production** (used for production builds)
```
VITE_API_BASE_URL=https://xmartschool.onrender.com/api
VITE_GEMINI_API_KEY=
```

**.env.development** (used locally)
```
VITE_API_BASE_URL=http://localhost:4000/api
VITE_GEMINI_API_KEY=
```

### Backend (.env files)

**.env.production** (Render will use this)
```
DATABASE_URL="postgresql://postgres:Hard2die@427333@db.ufhlqqurxymvirjgmztz.supabase.co:5432/postgres"
PORT=4000
NODE_ENV=production
GEMINI_API_KEY=
```

**.env.development** (used locally)
```
DATABASE_URL="postgresql://postgres:Hard2die@427333@db.ufhlqqurxymvirjgmztz.supabase.co:5432/postgres"
PORT=4000
NODE_ENV=development
GEMINI_API_KEY=
```

---

## 5. Deployment Flow

### Automatic Deployment

Every push to `master` branch:

1. GitHub Actions triggers Firebase hosting workflow
   - Installs dependencies
   - Builds frontend with environment variables
   - Deploys to Firebase Hosting
   - Access at: `https://xmartschool.firebaseapp.com` or `https://xmartschool.web.app`

2. Render monitors for deployment changes (if configured)
   - Rebuilds backend
   - Runs Prisma migrations if needed
   - Restarts service

### Manual Testing

**Local Development:**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Access at http://localhost:3000
# Backend at http://localhost:4000/api
```

**Production Testing:**
- Frontend: https://xmartschool.firebaseapp.com
- Backend API: https://xmartschool.onrender.com/api/health

---

## 6. Troubleshooting

### Build Failures

**Frontend build fails:**
- Check `VITE_API_BASE_URL` secret is set correctly
- Verify `.env.production` is in root directory
- Run `npm run build` locally to debug

**Backend build fails:**
- Verify Prisma schema is valid: `npx prisma validate`
- Check DATABASE_URL format in Render environment
- Ensure Supabase connection is active

### API Connection Issues

- Check CORS in backend: `backend/src/server.ts`
- Ensure Firebase domain is in allowedOrigins:
  - `https://xmartschool.firebaseapp.com`
  - `https://xmartschool.web.app`
- Backend should allow: `GET, POST, PUT, PATCH, DELETE, OPTIONS`

### Database Issues

- Test connection: `npx prisma db push`
- Verify Supabase database is accessible
- Check connection string format (no spaces)
- Ensure credentials are correct

---

## 7. Domains & Access

**Frontend (React App):**
- Firebase: https://xmartschool.firebaseapp.com
- Firebase alt: https://xmartschool.web.app

**Backend (API):**
- Render: https://xmartschool.onrender.com
- Endpoints: https://xmartschool.onrender.com/api/{endpoint}

**Local Development:**
- Frontend: http://localhost:3000 or http://localhost:5173
- Backend: http://localhost:4000

---

## 8. Monitoring & Logs

### Firebase Hosting
- Console: https://console.firebase.google.com/hosting
- View logs and deployment history

### Render
- Service dashboard shows build logs and errors
- Access logs for debugging
- Set up notifications for failures

### GitHub Actions
- View workflow runs at repository → Actions tab
- Check logs if deployment fails

---

## 9. Updating Dependencies

### Frontend
```bash
npm update
npm run build  # Verify build works
git add . && git commit -m "Update dependencies"
git push origin master
```

### Backend
```bash
cd backend
npm update
npm run build  # Verify build with Prisma
git add . && git commit -m "Update backend dependencies"
git push origin master
```

---

## 10. Database Migrations

When updating Prisma schema:

```bash
cd backend
npx prisma migrate dev --name "description"
git add . && git commit -m "Add migration"
git push origin master
```

Render will automatically run migrations on deploy (via `npm run build`).

---

## Common Issues Checklist

- [ ] Firebase service account secret is set
- [ ] VITE_API_BASE_URL secret points to Render backend
- [ ] Render has DATABASE_URL environment variable
- [ ] Backend CORS allows Firebase domains
- [ ] Prisma schema is valid
- [ ] Supabase database connection works
- [ ] GitHub workflows have permissions
- [ ] Branch being deployed is `master`

For additional help, check:
- Firebase: https://firebase.google.com/docs/hosting
- Render: https://render.com/docs
- GitHub Actions: https://docs.github.com/en/actions
