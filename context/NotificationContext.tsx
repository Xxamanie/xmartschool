import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  PropsWithChildren,
} from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => void;
  markRead: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  refresh: () => {},
  markRead: async () => {},
});

export const NotificationProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await api.getNotifications();
    if (res.ok) {
      setNotifications(res.data as Notification[]);
    }
  }, [isAuthenticated]);

  const markRead = useCallback(async (notificationId: string) => {
    const res = await api.markNotificationRead(notificationId);
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refresh, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
