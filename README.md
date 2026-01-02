<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SmartSchool Enterprise Edition

A comprehensive school management system built with React, TypeScript, and modern web technologies.

## 🚀 Recent Updates & Fixes

### ✅ Authentication System Improvements
- **Enhanced Supabase Integration**: Better error handling and configuration validation
- **Dual Authentication Mode**: Seamless fallback from Supabase to demo mode
- **Improved Error Messages**: Clear, actionable feedback for login issues
- **Auth State Management**: Better session handling and cleanup

### ✅ API Service Overhaul
- **Consistent Response Handling**: Unified data extraction across all endpoints
- **Better Error Reporting**: Standardized error messages and fallback responses
- **Enhanced Demo Mode**: Improved fallback behavior when backend is unavailable
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

- **Multi-role Authentication** - Support for Super Admin, Admin, Teacher, and Student roles
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
   
   # Gemini API Key (optional - for AI features)
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   
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
- **Super Admin**: `creator@smartschool.edu`
- **School Admin**: `admin@smartschool.edu`  
- **Teacher**: `alex.j@smartschool.edu`

### Student Portal
- **School Code**: `SPR-001`
- **Student Code**: `STU-2024-001`

*Note: Password is not required for demo accounts*

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
- **Demo Mode**: Mock data fallback when backend is unavailable

## Deployment

### Frontend Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting provider

### Environment Configuration

Ensure production environment variables are properly set:
- Set `VITE_API_BASE_URL` to your backend API URL
- Configure Supabase credentials
- Set `VITE_GEMINI_API_KEY` for AI features (optional)

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
   - Application will fallback to demo mode if backend is unavailable

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
