import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { Crown, ChevronLeft } from 'lucide-react';
import { UserRole } from '../types';

export const Layout: React.FC = () => {
  const { isAuthenticated, isImpersonating, stopImpersonating, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isStudent = user?.role === UserRole.STUDENT;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withMeta = event.metaKey || event.ctrlKey;
      if (withMeta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setIsCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* God Mode Banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 h-12 bg-amber-500 text-slate-900 font-bold flex items-center justify-between px-6 z-50 shadow-lg">
            <div className="flex items-center gap-3 text-sm">
                <div className="bg-slate-900 text-amber-500 p-1 rounded">
                   <Crown size={18} fill="currentColor" />
                </div>
                <span>GOD MODE ACTIVE: You are currently unrestricted.</span>
            </div>
            <button 
              onClick={stopImpersonating} 
              className="bg-slate-900 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider flex items-center gap-2"
            >
                <ChevronLeft size={14} />
                Return to Headquarters
            </button>
        </div>
      )}

      <div className={isImpersonating ? 'pt-12' : ''}>
          {!isStudent && (
            <>
              <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
              {/* Mobile Sidebar Overlay */}
              {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
              )}
            </>
          )}
          
          {/* Adjust header position if impersonating */}
          <div className={isImpersonating ? 'relative top-12' : ''}>
             <Header
               toggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
               openCommandPalette={() => setIsCommandOpen(true)}
             />
          </div>
          
          <main className={`pt-20 ${!isStudent ? 'md:pl-64' : ''} p-6 min-h-screen transition-all duration-300 ${isImpersonating ? 'mt-12' : ''}`}>
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
      </div>
      <CommandPalette open={isCommandOpen} onClose={() => setIsCommandOpen(false)} user={user} />
    </div>
  );
};
