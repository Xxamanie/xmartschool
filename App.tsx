
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { Classes } from './pages/Classes';
import { Attendance } from './pages/Attendance';
import { SchemeOfWork } from './pages/SchemeOfWork';
import { Subjects } from './pages/Subjects';
import { Assessments } from './pages/Assessments';
import { Results } from './pages/Results';
import { Teachers } from './pages/Teachers';
import { SuperAdmin } from './pages/SuperAdmin';
import { StudentPortal } from './pages/StudentPortal';
import { Settings } from './pages/Settings';
import { SchoolDetail } from './pages/SchoolDetail';
import { UserRole } from './types';
import { useClickSound } from './src/utils/useClickSound';
import { LiveClasses } from './pages/LiveClasses';
import { LiveClassRoom } from './pages/LiveClassRoom';

const ProtectedRoute = ({ children, allowedRoles }: React.PropsWithChildren<{ allowedRoles?: UserRole[] }>) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
     // Redirect based on role if trying to access unauthorized page
     if (user.role === UserRole.STUDENT) return <Navigate to="/student-portal" replace />;
     if (user.role === UserRole.SUPER_ADMIN) return <Navigate to="/" replace />; // Super Admin Root
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <GlobalClickSound />
      <Router>
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
      </Router>
    </AuthProvider>
  );
};

// Helper to decide which Dashboard to show at root '/'
const DashboardWrapper = () => {
   const { user } = useAuth();
   if (user?.role === UserRole.SUPER_ADMIN) return <SuperAdmin />; // Super Admin sees School Manager primarily
   if (user?.role === UserRole.STUDENT) return <Navigate to="/student-portal" replace />;
   return <Dashboard />; // Teachers/Admins see standard dashboard
};

export default App;
