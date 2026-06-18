import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  CalendarCheck,
  ArrowLeft,
  Video,
  MessageSquare,
  Bell,
  MessageCircle,
  Grid3x3,
  Baby,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClickSound } from '../src/utils/useClickSound';
import { useNotifications } from '../context/NotificationContext';
import { useStaffRoom } from '../context/StaffRoomContext';
import { UserRole } from '../types';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout, user, isImpersonating, viewingSchoolId, setViewingSchoolId } = useAuth();
  const { playSound } = useClickSound();
  const { unreadCount } = useNotifications();
  const { unreadCount: staffUnread } = useStaffRoom();
  const navigate = useNavigate();
  const isCreator = user?.role === UserRole.SUPER_ADMIN;
  const isGroupOwner = user?.role === UserRole.GROUP_OWNER;
  const isScopedToSchool = isCreator && !!viewingSchoolId;

  const isCreatorTheme = isCreator;

  const schoolNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/teachers', icon: UserPlus, label: 'Teachers' },
    { to: '/classes', icon: Layers, label: 'Classes' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/scheme-of-work', icon: FileText, label: 'Scheme of Work' },
    { to: '/assessments', icon: ClipboardCheck, label: 'Assessments' },
    { to: '/results', icon: TrendingUp, label: 'Results' },
    { to: '/timetable', icon: Grid3x3, label: 'Timetable' },
    { to: '/live-classes', icon: Video, label: 'Live Classes' },
    { to: '/staff-room', icon: MessageSquare, label: 'Staff Room' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/messages', icon: MessageCircle, label: 'Private Messages' },
  ];

  const getNavItems = () => {
    if (isCreator && !isScopedToSchool) {
      return [
        { to: '/', icon: Globe, label: 'Global Dashboard' },
        { to: '/schools', icon: Building2, label: 'Schools Registry' },
        { to: '/settings', icon: Settings, label: 'System Config' },
      ];
    } else if (isCreator && isScopedToSchool) {
      return schoolNavItems;
    } else if (user?.role === UserRole.GROUP_OWNER) {
      return [
        { to: '/', icon: Globe, label: 'Group Portfolio' },
      ];
    } else if (user?.role === UserRole.STUDENT) {
      return [
        { to: '/student-portal', icon: FileText, label: 'My Result Slip' },
        { to: '/notifications', icon: Bell, label: 'Notifications' },
        { to: '/messages', icon: MessageCircle, label: 'Ask a Teacher' },
      ];
    } else if (user?.role === UserRole.PARENT) {
      return [
        { to: '/parent-portal', icon: Baby, label: 'My Children' },
        { to: '/notifications', icon: Bell, label: 'Notifications' },
      ];
    } else {
      return schoolNavItems;
    }
  };

  const handleExitSchoolScope = () => {
    playSound();
    setViewingSchoolId(null);
    navigate('/');
    onClose?.();
  };

  const navItems = getNavItems();

  return (
    <aside
      className={`
        w-64 fixed left-0 flex flex-col z-40
        transition-transform duration-300 ease-in-out md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isImpersonating ? 'top-12 h-[calc(100vh-3rem)]' : 'top-0 h-screen'}
        ${isCreatorTheme
          ? 'bg-[#0a0a14] border-r border-white/[0.06]'
          : isGroupOwner
            ? 'bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] border-r border-white/[0.08]'
            : 'bg-gradient-to-b from-[#1e0a4a] via-[#2a0f5e] to-[#1a0840] border-r border-white/[0.08]'
        }
      `}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`
            w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0
            ${isCreatorTheme
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30'
              : isGroupOwner
                ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-indigo-500/30'
                : 'bg-white/10 backdrop-blur-sm border border-white/20'
            }
          `}>
            {isCreatorTheme
              ? <Crown size={17} fill="currentColor" className="text-slate-900" />
              : isGroupOwner
                ? <Building2 size={17} className="text-white" />
                : <GraduationCap size={18} className="text-white" />
            }
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-white leading-none">SmartSchool</p>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${isCreatorTheme ? 'text-amber-500' : isGroupOwner ? 'text-indigo-300' : 'text-white/40'}`}>
              {isScopedToSchool ? 'God Mode' : isCreatorTheme ? 'Creator' : isGroupOwner ? 'Group Owner' : user?.role === UserRole.STUDENT ? 'Student' : 'Admin Panel'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { playSound(); onClose?.(); }}
          className="md:hidden text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Creator school scope pill */}
      {isScopedToSchool && (
        <div className="px-3 mb-2">
          <button
            onClick={handleExitSchoolScope}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
          >
            <ArrowLeft size={13} />
            Exit School View
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.to === '/'}
            onClick={() => { playSound(); onClose?.(); }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? isCreatorTheme
                    ? 'bg-amber-500/15 text-amber-300 shadow-sm'
                    : isGroupOwner
                      ? 'bg-emerald-500/15 text-emerald-300 shadow-sm'
                      : 'bg-white/12 text-white shadow-sm'
                  : isCreatorTheme
                    ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    : isGroupOwner
                      ? 'text-white/50 hover:bg-emerald-500/10 hover:text-emerald-200'
                      : 'text-white/50 hover:bg-white/8 hover:text-white/90'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={17}
                  className={isActive
                    ? isCreatorTheme ? 'text-amber-400' : isGroupOwner ? 'text-emerald-400' : 'text-white'
                    : isCreatorTheme ? 'text-slate-500' : isGroupOwner ? 'text-emerald-600' : 'text-white/40'
                  }
                />
                {item.label}
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {item.to === '/staff-room' && staffUnread > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {staffUnread > 99 ? '99+' : staffUnread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {user?.role !== UserRole.STUDENT && (
          <div className="pt-4">
            <p className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${isCreatorTheme ? 'text-slate-600' : isGroupOwner ? 'text-emerald-700/60' : 'text-white/25'}`}>
              Account
            </p>
            <NavLink
              to="/settings"
              onClick={() => { playSound(); onClose?.(); }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? isCreatorTheme ? 'bg-amber-500/15 text-amber-300' : isGroupOwner ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/12 text-white'
                    : isCreatorTheme ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : isGroupOwner ? 'text-white/50 hover:bg-emerald-500/10 hover:text-emerald-200' : 'text-white/50 hover:bg-white/8 hover:text-white/90'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Settings size={17} className={isActive ? (isCreatorTheme ? 'text-amber-400' : isGroupOwner ? 'text-emerald-400' : 'text-white') : (isCreatorTheme ? 'text-slate-500' : isGroupOwner ? 'text-emerald-600' : 'text-white/40')} />
                  Settings
                </>
              )}
            </NavLink>
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className={`px-3 py-4 border-t ${isCreatorTheme ? 'border-white/[0.06]' : 'border-white/[0.08]'}`}>
        <div className="flex items-center gap-3 px-2 mb-3">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white truncate leading-none">{user?.name}</p>
            <p className={`text-[11px] mt-0.5 truncate ${isCreatorTheme ? 'text-amber-500/70' : 'text-white/40'}`}>{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { playSound(); logout(); }}
          className={`
            flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium rounded-xl transition-colors
            ${isCreatorTheme
              ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400'
              : 'text-white/40 hover:bg-red-500/10 hover:text-red-400'
            }
          `}
        >
          <LogOut size={16} />
          {user?.role === UserRole.STUDENT ? 'Close Portal' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
};
