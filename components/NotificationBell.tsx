import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.readAt);
    await Promise.all(unread.map((n) => markRead(n.id)));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              Notifications{unreadCount > 0 && <span className="text-red-500 ml-1">({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No notifications yet</div>
            )}
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 flex gap-3 items-start hover:bg-gray-50 transition-colors ${!n.readAt ? 'bg-primary-50/40' : ''}`}
              >
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.readAt ? 'bg-primary-500' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString()} ·{' '}
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-primary-500 transition-colors mt-0.5"
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
