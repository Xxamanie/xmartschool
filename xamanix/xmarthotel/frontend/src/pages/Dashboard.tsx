import { useEffect, useState } from 'react';
import axios from 'axios';
import { get } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { DashboardData } from '../lib/types';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<DashboardData>('/reports/dashboard')
      .then(setData)
      .catch((err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 403 || status === 401) {
          setDenied(true);
        } else {
          setError('Failed to load dashboard data. Please refresh.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (denied) {
    return (
      <>
        <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] ?? ''}`} subtitle="Your daily workspace" />
        <div className="card p-6 text-sm text-slate-500">
          Use the navigation to access your assigned modules. Performance dashboards are available to management and accounting.
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Today at a glance" />
        <div className="card p-6 text-sm text-rose-600">{error ?? 'No data available.'}</div>
      </>
    );
  }

  const s = data.roomsByStatus;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Today at a glance" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Occupancy" value={`${data.occupancyRate}%`} hint={`${s.occupied}/${data.totalRooms} rooms`} />
        <Stat label="Avg room rate" value={formatMoney(data.adrMinor)} hint="Tonight's contracted rates" />
        <Stat label="Room rev / total" value={formatMoney(data.revparMinor)} hint="Potential RevPAR tonight" />
        <Stat label="Revenue today" value={formatMoney(data.revenueTodayMinor)} hint="Payments collected" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Arrivals today" value={String(data.arrivalsToday)} />
        <Stat label="Departures today" value={String(data.departuresToday)} />
        <Stat label="In-house" value={String(data.inHouse)} />
        <Stat label="Out of order" value={String(s.outOfOrder)} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Room status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            ['Available', s.available, 'text-emerald-600'],
            ['Occupied', s.occupied, 'text-brand-600'],
            ['Dirty', s.dirty, 'text-amber-600'],
            ['Cleaning', s.cleaning, 'text-sky-600'],
            ['Out of order', s.outOfOrder, 'text-rose-600'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-lg bg-slate-50 py-3">
              <div className={`text-xl font-bold ${color as string}`}>{value as number}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label as string}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
