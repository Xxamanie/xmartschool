import React, { createContext, useContext, useEffect, useState, useCallback, PropsWithChildren } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadCount: number;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType>({ unreadCount: 0, refresh: () => {} });

export const NotificationProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await api.getNotifications();
    if (res.ok) {
      setUnreadCount(res.data.filter((n) => !n.readAt).length);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
