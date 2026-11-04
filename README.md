<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SmartSchool Enterprise Edition

A comprehensive school management system built with React, TypeScript, and modern web technologies.

The [implementation checklist and production setup](docs/IMPLEMENTATION_CHECKLIST.md) describe the current features, verification commands, and provider configuration. Read the [database migration guide](backend/prisma/README.md) before deploying to an existing database.

## 🚀 Recent Updates & Fixes

### ✅ Authentication System Improvements
- **Enhanced Supabase Integration**: Better error handling and configuration validation
- **Dual Authentication Mode**: Supabase authentication and explicitly enabled local demo authentication
- **Improved Error Messages**: Clear, actionable feedback for login issues
- **Auth State Management**: Better session handling and cleanup

### ✅ API Service Overhaul
- **Consistent Response Handling**: Unified data extraction across all endpoints
- **Better Error Reporting**: Standardized error messages and fallback responses
- **Demo Configuration**: Separate frontend and backend demo authentication flags
- **Type Safety**: Better TypeScript integration throughout

### ✅ Security & Configuration
- **Environment Security**: Removed exposed credentials, added proper `.env.example`
- **Better Credential Management**: Clear separation between demo and production
- **TypeScript Fixes**: Resolved all configuration and type issues

### ✅ User Experience Enhancements
- **Login Page**: Added auth mode indicator and better error display
- **Loading States**: Improved feedback and loading indicators
- **Error Boundaries**: Better error handling and recovery options

## Features

- **Multi-role Authentication** - Support for Super Admin, Admin, Teacher, Student, and Parent roles
- **School Management** - Complete school administration and management
- **Student Information System** - Student enrollment, attendance, and academic tracking
- **Assessment & Results** - Comprehensive assessment and result management
- **Live Classes** - Virtual classroom functionality
- **Real-time Updates** - Live data synchronization
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-school
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.production.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   # API Configuration
   VITE_API_BASE_URL=http://localhost:4000/api
   
   # AI requests use the backend GEMINI_API_KEY; no frontend secret is needed.
   
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SUPABASE_STORAGE_BUCKET=files
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000`

## Demo Accounts

The application includes demo accounts for testing:

### Staff/Admin Login
The [demo seed](./backend/prisma/seed-demo.ts) creates working pitch accounts. Every staff account uses `Password1`:
- **Creator**: `creator@smartschool.edu`
- **Group Owner**: `owner@brightedu.demo`
- **School Admin**: `admin@greenfield.demo`
- **Teacher**: `math.teacher@gfd-101.demo`

### Student Portal
- **School Code**: `GFD-101`
- **Student Code**: `GFD-101-2025-0001`

Run `npx tsx prisma/seed-demo.ts` from `backend/` against the database used by the app to create these accounts and their walkthrough data. Demo email/password logins use the seeded bcrypt password and work even when the optional password-free local demo fallback is disabled. Supabase authentication remains the sign-in path for other provisioned accounts. Treat these shared demo credentials as temporary and remove the demo seed before a full production launch.

## Project Structure

```
smart-school/
├── components/          # Reusable UI components
├── context/            # React context providers
├── pages/              # Application pages/routes
├── services/           # API services and data layer
├── src/
│   ├── services/       # Additional services
│   └── utils/          # Utility functions
├── types.ts            # TypeScript type definitions
└── ...
```

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom components

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Environment Modes

- **Development**: Uses `.env.local` or `.env.development`
- **Production**: Uses `.env.production`

### Backend Integration

The application supports both:
- **Live Backend**: Full API integration with backend services
- **Demo Authentication**: Explicit opt-in for local previews; backend API errors remain visible

## Deployment

### Frontend Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting provider, or use Docker Compose for fullstack deployment.

### Fullstack Docker Deployment

The repository now includes production and development compose files for frontend and backend.

Production startup runs `prisma migrate deploy`. A database created previously with `db push` needs the verified migration adoption described in [the migration guide](backend/prisma/README.md) before Docker startup. Set a random `SESSION_SECRET` of at least 64 characters; production startup rejects demo authentication and shorter secrets. Demo seeding is also blocked when `NODE_ENV=production`.

- **Production**
  ```bash
  docker compose -f docker-compose.production.yaml up --build
  ```

- **Development**
  ```bash
  docker compose -f compose.debug.yaml up --build
  ```

> Note: The backend requires production environment variables such as `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `GEMINI_API_KEY`.

### Environment Configuration

Ensure production environment variables are properly set:
- Set `VITE_API_BASE_URL` to your backend API URL (for frontend)
- Configure Supabase credentials
- Set backend `GEMINI_API_KEY` for AI features (optional); the frontend does not need the secret
- Set backend-specific variables: `DATABASE_URL`, `FRONTEND_URL`, `CORS_ORIGIN`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Configure storage, password recovery, SMTP, and optional payment/video providers using the [production setup checklist](docs/IMPLEMENTATION_CHECKLIST.md)

## Features Overview

### Authentication & Authorization
- Role-based access control
- Supabase authentication integration
- Demo account support
- Session management

### School Management
- Multi-school support
- School administration
- User management
- Impersonation mode for super admins

### Academic Management
- Student enrollment and management
- Subject and class management
- Assessment and grading
- Result computation and publishing
- Attendance tracking

### Live Features
- Virtual classrooms
- Real-time messaging
- Screen sharing capabilities
- Recording functionality

## Troubleshooting

### Common Issues

1. **Styling not loading**
   - Ensure Tailwind CSS is properly configured
   - Check that `index.css` is imported in `index.tsx`

2. **Authentication issues**
   - Verify Supabase credentials in environment variables
   - Check network connectivity to Supabase

3. **API connection problems**
   - Verify `VITE_API_BASE_URL` is correct
   - Check backend server status
   - Inspect the reported API error; demo authentication requires explicit local configuration

### Development Tips

- Use browser developer tools to check console for errors
- Verify environment variables are loaded correctly
- Check network tab for failed API requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team.

---

**SmartSchool Enterprise Edition** - Transforming Education Management
