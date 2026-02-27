
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  X,
  Building2,
  Globe,
  Crown,
  Layers,
  CalendarCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClickSound } from '../src/utils/useClickSound';
import { UserRole } from '../types';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout, user, isImpersonating } = useAuth();
  const { playSound } = useClickSound();
  const isCreator = user?.role === UserRole.SUPER_ADMIN;

  // Theme Configuration based on Role
  const theme = isCreator ? {
    container: 'bg-slate-950 border-slate-800',
    headerBorder: 'border-slate-800',
    logoBox: 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 shadow-lg shadow-amber-500/20',
    title: 'text-white',
    subtitle: 'text-amber-500',
    sectionTitle: 'text-slate-500',
    activeItem: 'bg-amber-500/10 text-amber-400 border-amber-500',
    inactiveItem: 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
    logoutBtn: 'text-slate-400 hover:bg-slate-900 hover:text-red-400'
  } : {
    container: 'bg-[#2e1065] border-primary-900', // Darker Purple (Violet 950 equivalent)
    headerBorder: 'border-primary-900',
    logoBox: 'bg-white text-primary-900',
    title: 'text-white',
    subtitle: 'text-primary-300',
    sectionTitle: 'text-primary-400',
    activeItem: 'bg-white/10 text-white border-white',
    inactiveItem: 'text-primary-200 hover:bg-white/5 hover:text-white',
    logoutBtn: 'text-primary-200 hover:bg-white/10 hover:text-white'
  };

  const activeClass = `flex items-center gap-3 px-4 py-3 text-sm font-medium border-r-4 transition-colors ${theme.activeItem}`;
  const inactiveClass = `flex items-center gap-3 px-4 py-3 text-sm font-medium border-r-4 border-transparent transition-colors ${theme.inactiveItem}`;

  const getNavItems = () => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      return [
        { to: '/', icon: Globe, label: 'Global Dashboard' },
        { to: '/schools', icon: Building2, label: 'Schools Registry' },
        { to: '/settings', icon: Settings, label: 'System Config' },
      ];
    } else if (user?.role === UserRole.STUDENT) {
      return [
        { to: '/student-portal', icon: FileText, label: 'My Result Slip' },
      ];
    } else if (user?.role === UserRole.ADMIN) {
      // Standard School Admin items
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/students', icon: Users, label: 'Students' },
        { to: '/teachers', icon: UserPlus, label: 'Teachers' },
        { to: '/classes', icon: Layers, label: 'Classes' },
        { to: '/subjects', icon: BookOpen, label: 'Subjects' },
        { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
        { to: '/assessments', icon: ClipboardCheck, label: 'Assessments' },
        { to: '/results', icon: TrendingUp, label: 'Results' },
        { to: '/scheme-of-work', icon: FileText, label: 'Scheme of Work' },
        { to: '/live-classes', icon: Globe, label: 'Live Classes' },
      ];
    } else {
      // Teacher items (role-isolated)
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
        { to: '/assessments', icon: ClipboardCheck, label: 'Assessments' },
        { to: '/results', icon: TrendingUp, label: 'Results' },
        { to: '/scheme-of-work', icon: FileText, label: 'Scheme of Work' },
        { to: '/live-classes', icon: Globe, label: 'Live Classes' },
      ];
    }
  };

  return (
    <div 
      className={`w-64 h-[calc(100vh-3rem)] fixed left-0 border-r flex flex-col z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${theme.container} ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isImpersonating ? 'top-12 h-[calc(100vh-3rem)]' : 'top-0 h-screen'}`}
    >
      <div className={`p-6 flex items-center justify-between border-b ${theme.headerBorder}`}>
        <div className="flex items-center gap-3">
          {/* Logo Box */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme.logoBox}`}>
            {isCreator ? <Crown size={18} fill="currentColor" className="opacity-90" /> : <GraduationCap size={20} />}
          </div>
          <div>
            <span className={`text-lg font-bold tracking-tight block leading-tight ${theme.title}`}>
              SmartSchool
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${theme.subtitle}`}>
              {user?.role === UserRole.SUPER_ADMIN ? 'Creator Mode' : user?.role === UserRole.STUDENT ? 'Student Portal' : 'Admin Panel'}
            </span>
          </div>
        </div>
        <button 
          onClick={() => { playSound(); onClose?.(); }}
          className="md:hidden text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1">
          {getNavItems().map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => { playSound(); onClose?.(); }}
                className={({ isActive }) =>
                  isActive ? activeClass : inactiveClass
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {user?.role !== UserRole.STUDENT && (
          <>
            <div className={`mt-8 px-6 text-xs font-bold uppercase tracking-wider mb-2 ${theme.sectionTitle}`}>
              Account
            </div>
            <ul className="space-y-1">
              <li>
                <NavLink to="/settings" onClick={() => { playSound(); onClose?.(); }} className={inactiveClass}>
                  <Settings size={20} />
                  Settings
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>

      <div className={`p-4 border-t ${theme.headerBorder}`}>
        <button
          onClick={() => { playSound(); logout(); }}
          className={`flex items-center gap-3 w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${theme.logoutBtn}`}
        >
          <LogOut size={20} />
          {user?.role === UserRole.STUDENT ? 'Close Portal' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};
