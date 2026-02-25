import React from 'react';
import { Bell, Search, Menu, LogOut, Command } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClickSound } from '../src/utils/useClickSound';
import { UserRole } from '../types';

interface HeaderProps {
  toggleSidebar?: () => void;
  openCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar, openCommandPalette }) => {
  const { user, isImpersonating, logout } = useAuth();
  const { playSound } = useClickSound();
  const isStudent = user?.role === UserRole.STUDENT;

  return (
    <header className={`h-16 bg-white border-b border-gray-200 fixed right-0 left-0 ${!isStudent ? 'md:left-64' : 'left-0'} z-10 px-4 md:px-8 flex items-center justify-between ${isImpersonating ? 'top-12' : 'top-0'}`}>
      <div className="flex items-center gap-4">
        {!isStudent && (
          <button 
            onClick={() => { playSound(); toggleSidebar?.(); }}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 md:hidden"
          >
            <Menu size={20} />
          </button>
        )}
        <button
          onClick={() => {
            playSound();
            openCommandPalette?.();
          }}
          className="hidden md:flex items-center gap-2 text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 w-80 hover:border-gray-300 transition-colors"
        >
          <Search size={16} />
          <span className="text-sm text-gray-500 flex-1 text-left">Find pages, actions, and tools...</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 border border-gray-300 rounded px-2 py-0.5">
            <Command size={12} />
            K
          </span>
        </button>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={playSound} className="relative text-gray-500 hover:text-gray-700 transition-colors">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
          <img 
            src={user?.avatar} 
            alt="User" 
            className="w-9 h-9 rounded-full object-cover border border-gray-200"
          />
          {isStudent && (
            <button 
              onClick={() => { playSound(); logout(); }}
              className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Log Out"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
