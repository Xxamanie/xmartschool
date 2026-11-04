import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../lib/types';

interface NavItem { to: string; label: string; roles?: Role[]; }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/employees', label: 'Employees', roles: ['MANAGER'] },
  { to: '/attendance', label: 'Attendance' },
  { to: '/leave', label: 'Leave' },
  { to: '/performance', label: 'Performance' },
  { to: '/onboarding', label: 'Onboarding' },
  { to: '/documents', label: 'Documents' },
  { to: '/payroll', label: 'Payroll', roles: [] },
  { to: '/announcements', label: 'Announcements', roles: [] },
  { to: '/insights', label: 'Insights', roles: ['MANAGER'] },
  { to: '/me', label: 'My profile' },
];

function visibleFor(role: Role, item: NavItem): boolean {
  if (role === 'OWNER' || role === 'HR_ADMIN') return true;
  if (!item.roles) return true;
  return item.roles.includes(role);
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const onLogout = () => { logout(); navigate('/login'); };
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="text-lg font-bold text-brand-700">XmartHR</div>
          <div className="text-xs text-slate-400">XamaniX Suite</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.filter((item) => visibleFor(user.role, item)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role.replace('_', ' ')}</div>
          </div>
          <button onClick={onLogout} className="btn-ghost w-full mt-1">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
