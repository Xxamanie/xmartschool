import React from 'react';
import { Search, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClickSound } from '../src/utils/useClickSound';
import { UserRole } from '../types';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  toggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { user, isImpersonating, logout } = useAuth();
  const { playSound } = useClickSound();
  const isStudent = user?.role === UserRole.STUDENT;

  return (
    <header
      className={`
        h-16 bg-white/80 backdrop-blur-md border-b border-gray-100/80
        fixed right-0 left-0 z-10 px-4 md:px-6
        flex items-center justify-between
        ${!isStudent ? 'md:left-64' : 'left-0'}
        ${isImpersonating ? 'top-12' : 'top-0'}
      `}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {!isStudent && (
          <button
            onClick={() => { playSound(); toggleSidebar?.(); }}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors md:hidden"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="hidden md:flex items-center gap-2.5 bg-gray-50 border border-gray-200/70 rounded-xl px-3.5 py-2 w-60 group focus-within:border-violet-300 focus-within:bg-white transition-all">
          <Search size={15} className="text-gray-400 group-focus-within:text-violet-500 transition-colors flex-shrink-0" />
          <input
            id="global-search" name="global-search"
            type="text"
            placeholder="Search anything…"
            className="bg-transparent border-none outline-none text-sm text-gray-700 w-full placeholder-gray-400"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="w-px h-6 bg-gray-200 mx-2" />

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-[13px] font-semibold text-gray-900 leading-none">{user?.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
          </div>
          <img
            src={user?.avatar}
            alt={user?.name}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
          />
          {isStudent && (
            <button
              onClick={() => { playSound(); logout(); }}
              className="ml-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Log Out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
