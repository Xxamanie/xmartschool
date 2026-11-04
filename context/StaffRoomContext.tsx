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
import { subscribeMessageEvents } from '../src/utils/messageEvents';

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
  const { user, isAuthenticated, effectiveSchoolId } = useAuth();
  const scopeKey = JSON.stringify([user?.id, user?.schoolId, user?.role, effectiveSchoolId]);
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const [messageState, setMessageState] = useState<{ scopeKey: string; data: StaffMessage[] }>({ scopeKey: '', data: [] });
  const [loadingState, setLoadingState] = useState<{ scopeKey: string; value: boolean }>({ scopeKey: '', value: false });
  const [readState, setReadState] = useState<{ scopeKey: string; date: Date | null }>({ scopeKey: '', date: null });

  const isStaff =
    user?.role === 'ADMIN' || user?.role === 'TEACHER' || user?.role === 'SUPER_ADMIN';

  const canRead = isAuthenticated && isStaff && !!user?.schoolId;
  const messages = canRead && messageState.scopeKey === scopeKey ? messageState.data : [];
  const loading = canRead && loadingState.scopeKey === scopeKey && loadingState.value;
  const lastReadAt = readState.scopeKey === scopeKey ? readState.date : null;

  // Each session owns its requests so late responses cannot restore another school's messages.
  useEffect(() => {
    if (!canRead || !user) return;
    let active = true;
    let running = false;
    let pending = false;
    const isCurrent = () => active && scopeRef.current === scopeKey;
    setMessageState({ scopeKey, data: [] });
    setLoadingState({ scopeKey, value: true });
    const key = lastReadKey(user.id, user.schoolId ?? '');
    const stored = localStorage.getItem(key);
    const restored = stored ? new Date(stored) : null;
    setReadState({ scopeKey, date: restored && !Number.isNaN(restored.getTime()) ? restored : null });
    const refresh = async () => {
      if (!isCurrent()) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        do {
          pending = false;
          const res = await api.getStaffMessages();
          if (res.ok && isCurrent()) setMessageState({ scopeKey, data: res.data });
        } while (pending && isCurrent());
      } finally {
        running = false;
        if (isCurrent()) setLoadingState({ scopeKey, value: false });
      }
    };
    void refresh();
    const unsubscribe = subscribeMessageEvents({ userId: user.id, schoolId: user.schoolId, role: user.role, contextSchoolId: effectiveSchoolId }, event => {
      if (event.type === 'staff-message') void refresh();
    });
    return () => { active = false; unsubscribe(); };
  }, [canRead, scopeKey]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    const now = new Date();
    const key = lastReadKey(user.id, user.schoolId ?? '');
    localStorage.setItem(key, now.toISOString());
    setReadState({ scopeKey, date: now });
  }, [user, scopeKey]);

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
