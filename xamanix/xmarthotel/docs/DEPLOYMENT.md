# XmartHotel — Deployment

Independent deployment. Nothing is shared with other XamaniX products.

## Recommended budget-friendly stack
- **Database:** managed Postgres (Supabase / Neon / Render).
- **Backend:** Render / Fly.io / Railway (always-on). Build `npm run build`, start
  `npm start`.
- **Frontend:** Cloudflare Pages / Vercel / Netlify (static `dist/`).
- **Domain:** `hotel.XamaniX.africa` (frontend), API on a subdomain/path.

## Backend (production)
Set env vars in the host (never commit them):
```
NODE_ENV=production
DATABASE_URL=...            # use the pooled connection string for the app
JWT_SECRET=...              # 32+ random chars
CORS_ORIGIN=https://hotel.xamanix.africa
PORT=5050
```
Release steps:
```bash
npm ci
npx prisma migrate deploy   # apply migrations (not migrate dev)
npm run build
npm start
```

## Frontend (production)
```
VITE_API_URL=https://api-hotel.xamanix.africa/api
npm ci && npm run build      # outputs dist/
```
Serve `dist/` on the static host. **HTTPS only.**

## Checklist
- [ ] `JWT_SECRET` is long and random
- [ ] `CORS_ORIGIN` is the real frontend origin
- [ ] DB migrated with `migrate deploy`
- [ ] Backups / PITR enabled on the database
- [ ] Rate limiting and helmet active (they are by default)
