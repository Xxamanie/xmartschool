# Cross-Device Test Guide

## Goal

Verify that data created on one device is visible on another device through the shared backend API/database.

## Preconditions

- Backend is running and healthy (`/api/health`).
- Frontend points to the same backend (`VITE_API_BASE_URL`).
- Test users exist (seeded or created).

## Test Steps

1. Open app in two sessions (different browsers or devices).
2. Sign in as admin on both sessions.
3. In session A:
   - Create or update a student.
   - Create or update a subject.
4. In session B:
   - Refresh affected pages.
   - Confirm data appears and matches.
5. Repeat using student portal verification (`schoolCode + studentCode`) to confirm student access flow.

## Expected Results

- Data persists after refresh and across devices.
- No dependence on localStorage for source-of-truth data.
- API requests resolve successfully on both sessions.

## Troubleshooting

- Check browser network tab for failed `/api/*` calls.
- Confirm backend CORS allows the frontend origin.
- Confirm both devices use the same `VITE_API_BASE_URL`.
- Validate DB connectivity from backend logs.
