import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Rooms from './pages/Rooms';
import FrontDesk from './pages/FrontDesk';
import Housekeeping from './pages/Housekeeping';
import Billing from './pages/Billing';
import Restaurant from './pages/Restaurant';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Channels from './pages/Channels';
import Insights from './pages/Insights';
import BookingEngine from './pages/public/BookingEngine';
import RoomService from './pages/public/RoomService';
import PaymentCallback from './pages/public/PaymentCallback';

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
      <Route path="/book" element={<BookingEngine />} />
      <Route path="/book/:propertyId" element={<BookingEngine />} />
      <Route path="/order/:propertyId" element={<RoomService />} />
      <Route path="/payment/callback" element={<PaymentCallback />} />
      <Route path="/login" element={<LoginGate />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/frontdesk" element={<FrontDesk />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/housekeeping" element={<Housekeeping />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/restaurant" element={<Restaurant />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/staff" element={<Staff />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
