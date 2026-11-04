import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import Onboarding from './pages/Onboarding';
import Documents from './pages/Documents';
import Insights from './pages/Insights';
import Announcements from './pages/Announcements';
import MyProfile from './pages/MyProfile';
import PayslipView from './pages/PayslipView';
import SignDocument from './pages/public/SignDocument';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign/:token" element={<SignDocument />} />
      <Route path="/login" element={<LoginGate />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/me" element={<MyProfile />} />
        <Route path="/payslip/:id" element={<PayslipView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
