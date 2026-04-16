
import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { UserRole } from './types';
import { useClickSound } from './src/utils/useClickSound';

const Login = React.lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Students = React.lazy(() => import('./pages/Students').then((module) => ({ default: module.Students })));
const Classes = React.lazy(() => import('./pages/Classes').then((module) => ({ default: module.Classes })));
const Attendance = React.lazy(() => import('./pages/Attendance').then((module) => ({ default: module.Attendance })));
const SchemeOfWork = React.lazy(() => import('./pages/SchemeOfWork').then((module) => ({ default: module.SchemeOfWork })));
const Subjects = React.lazy(() => import('./pages/Subjects').then((module) => ({ default: module.Subjects })));
const Assessments = React.lazy(() => import('./pages/Assessments').then((module) => ({ default: module.Assessments })));
const Results = React.lazy(() => import('./pages/Results').then((module) => ({ default: module.Results })));
const Teachers = React.lazy(() => import('./pages/Teachers').then((module) => ({ default: module.Teachers })));
const SuperAdmin = React.lazy(() => import('./pages/SuperAdmin').then((module) => ({ default: module.SuperAdmin })));
const StudentPortal = React.lazy(() => import('./pages/StudentPortal').then((module) => ({ default: module.StudentPortal })));
const Settings = React.lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const SchoolDetail = React.lazy(() => import('./pages/SchoolDetail').then((module) => ({ default: module.SchoolDetail })));
const LiveClasses = React.lazy(() => import('./pages/LiveClasses').then((module) => ({ default: module.LiveClasses })));
const LiveClassRoom = React.lazy(() => import('./pages/LiveClassRoom').then((module) => ({ default: module.LiveClassRoom })));

const RouteFallback = () => <LoadingScreen message="Loading page..." />;

const ProtectedRoute = ({ children, allowedRoles }: React.PropsWithChildren<{ allowedRoles?: UserRole[] }>) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // SUPER_ADMIN has unrestricted access to all routes
  if (user?.role === UserRole.SUPER_ADMIN) {
    return <>{children}</>;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === UserRole.STUDENT) return <Navigate to="/student-portal" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const GlobalClickSound = () => {
  const { playSound } = useClickSound();

  React.useEffect(() => {
    const handler = () => playSound();
    document.body.addEventListener('click', handler, { capture: true });
    return () => {
      document.body.removeEventListener('click', handler, true);
    };
  }, [playSound]);

  return null;
};

const AppContent: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Initializing SmartSchool..." />;
  }

  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<Layout />}>
            {/* Super Admin Routes */}
            <Route index element={
               <ProtectedRoute>
                  <DashboardWrapper />
               </ProtectedRoute>
            } />
            
            <Route path="schools" element={
               <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <SuperAdmin />
               </ProtectedRoute>
            } />
            <Route path="schools/:schoolId" element={
               <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <SchoolDetail />
               </ProtectedRoute>
            } />

            {/* Student Portal Route */}
            <Route path="student-portal" element={
               <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                  <StudentPortal />
               </ProtectedRoute>
            } />

            {/* Regular Admin/Teacher Routes */}
            <Route path="teachers" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Teachers /></ProtectedRoute>} />
            <Route path="classes" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Classes /></ProtectedRoute>} />
            <Route path="attendance" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Attendance /></ProtectedRoute>} />
            <Route path="students" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Students /></ProtectedRoute>} />
            <Route path="subjects" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Subjects /></ProtectedRoute>} />
            <Route path="scheme-of-work" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><SchemeOfWork /></ProtectedRoute>} />
            <Route path="assessments" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Assessments /></ProtectedRoute>} />
            <Route path="results" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><Results /></ProtectedRoute>} />
            <Route path="live-classes" element={<ProtectedRoute><LiveClasses /></ProtectedRoute>} />
            <Route path="live-classes/:classId" element={<ProtectedRoute><LiveClassRoom /></ProtectedRoute>} />
            
            <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <GlobalClickSound />
      <AppContent />
    </AuthProvider>
  );
};

// Helper to decide which Dashboard to show at root '/'
const DashboardWrapper = () => {
   const { user, viewingSchoolId } = useAuth();
   if (user?.role === UserRole.SUPER_ADMIN) {
     // If Creator has scoped to a school, show the school dashboard
     if (viewingSchoolId) return <Dashboard />;
     return <SuperAdmin />;
   }
   if (user?.role === UserRole.STUDENT) return <Navigate to="/student-portal" replace />;
   return <Dashboard />;
};

export default App;
