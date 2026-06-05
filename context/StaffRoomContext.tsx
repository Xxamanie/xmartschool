import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  PropsWithChildren,
} from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { StaffMessage } from '../types';

interface StaffRoomContextType {
  messages: StaffMessage[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => void;
}

const StaffRoomContext = createContext<StaffRoomContextType>({
  messages: [],
  unreadCount: 0,
  loading: false,
  markAllRead: () => {},
});

const lastReadKey = (userId: string, schoolId: string) =>
  `staffroom_lastread_${userId}_${schoolId}`;

export const StaffRoomProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const lastReadRef = useRef<Date | null>(null);
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);

  const isStaff =
    user?.role === 'ADMIN' || user?.role === 'TEACHER' || user?.role === 'SUPER_ADMIN';

  const fetchMessages = useCallback(async () => {
    if (!isAuthenticated || !isStaff) return;
    const res = await api.getStaffMessages();
    if (res.ok) setMessages(res.data);
  }, [isAuthenticated, isStaff]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated || !isStaff || !user) return;
    setLoading(true);

    // Restore lastReadAt from localStorage
    const key = lastReadKey(user.id, user.schoolId ?? '');
    const stored = localStorage.getItem(key);
    const restored = stored ? new Date(stored) : null;
    lastReadRef.current = restored;
    setLastReadAt(restored);

    fetchMessages().finally(() => setLoading(false));
  }, [isAuthenticated, isStaff, user?.id]);

  // Poll every 4 seconds
  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    const id = setInterval(fetchMessages, 4000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    const now = new Date();
    const key = lastReadKey(user.id, user.schoolId ?? '');
    localStorage.setItem(key, now.toISOString());
    lastReadRef.current = now;
    setLastReadAt(now);
  }, [user]);

  const unreadCount = lastReadAt
    ? messages.filter(
        (m) => m.userId !== user?.id && new Date(m.createdAt) > lastReadAt,
      ).length
    : 0;

  return (
    <StaffRoomContext.Provider value={{ messages, unreadCount, loading, markAllRead }}>
      {children}
    </StaffRoomContext.Provider>
  );
};

export const useStaffRoom = () => useContext(StaffRoomContext);
