
import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { StaffRoomProvider } from './context/StaffRoomContext';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { OfflineBadge } from './components/OfflineBadge';
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
const GroupPortal = React.lazy(() => import('./pages/GroupPortal').then((module) => ({ default: module.GroupPortal })));
const CreatorDashboard = React.lazy(() => import('./pages/CreatorDashboard').then((module) => ({ default: module.CreatorDashboard })));
const SystemConfig = React.lazy(() => import('./pages/SystemConfig').then((module) => ({ default: module.SystemConfig })));
const StudentPortal = React.lazy(() => import('./pages/StudentPortal').then((module) => ({ default: module.StudentPortal })));
const Settings = React.lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const SchoolDetail = React.lazy(() => import('./pages/SchoolDetail').then((module) => ({ default: module.SchoolDetail })));
const LiveClasses = React.lazy(() => import('./pages/LiveClasses').then((module) => ({ default: module.LiveClasses })));
const LiveClassRoom = React.lazy(() => import('./pages/LiveClassRoom').then((module) => ({ default: module.LiveClassRoom })));
const StaffRoom = React.lazy(() => import('./pages/StaffRoom').then((module) => ({ default: module.StaffRoom })));
const Notifications = React.lazy(() => import('./pages/Notifications').then((module) => ({ default: module.Notifications })));
const PrivateMessages = React.lazy(() => import('./pages/PrivateMessages').then((module) => ({ default: module.PrivateMessages })));
const Finance = React.lazy(() => import('./pages/Finance').then((module) => ({ default: module.Finance })));
const Timetable = React.lazy(() => import('./pages/Timetable').then((module) => ({ default: module.Timetable })));
const ParentPortal = React.lazy(() => import('./pages/ParentPortal').then((module) => ({ default: module.ParentPortal })));

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

            {/* Group Owner portfolio */}
            <Route path="group" element={
               <ProtectedRoute allowedRoles={[UserRole.GROUP_OWNER]}>
                  <GroupPortal />
               </ProtectedRoute>
            } />

            {/* Creator platform governance */}
            <Route path="system" element={
               <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <SystemConfig />
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
            <Route path="staff-room" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}><StaffRoom /></ProtectedRoute>} />
            <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="messages" element={<ProtectedRoute><PrivateMessages /></ProtectedRoute>} />
            
            <Route path="finance" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><Finance /></ProtectedRoute>} />
            <Route path="timetable" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT]}><Timetable /></ProtectedRoute>} />
            <Route path="parent-portal" element={<ProtectedRoute allowedRoles={[UserRole.PARENT]}><ParentPortal /></ProtectedRoute>} />
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
      <NotificationProvider>
        <StaffRoomProvider>
          <GlobalClickSound />
          <AppContent />
          <OfflineBadge />
        </StaffRoomProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

// Helper to decide which Dashboard to show at root '/'
const DashboardWrapper = () => {
   const { user, viewingSchoolId } = useAuth();
   if (user?.role === UserRole.SUPER_ADMIN) {
     // If Creator has scoped to a school, show the school dashboard
     if (viewingSchoolId) return <Dashboard />;
     // The Creator's home is the read-only Global Dashboard; the Schools
     // Registry (management) lives at /schools.
     return <CreatorDashboard />;
   }
   // Group Owner (when not impersonating a branch) lands on the portfolio.
   if (user?.role === UserRole.GROUP_OWNER) return <GroupPortal />;
   if (user?.role === UserRole.STUDENT) return <Navigate to="/student-portal" replace />;
   if (user?.role === UserRole.PARENT) return <Navigate to="/parent-portal" replace />;
   return <Dashboard />;
};

export default App;
