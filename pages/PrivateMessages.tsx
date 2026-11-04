import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ArrowLeft, User, Plus, CheckCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import type { PrivateConversation, PrivateConversationMessage } from '../types';
import { avatarColor } from '../src/utils/colorHash';
import { subscribeMessageEvents } from '../src/utils/messageEvents';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatConvTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

// ── Unread tracking (localStorage) ───────────────────────────────────────────

const readKey = (userId: string, convId: string) => `pm_read_${userId}_${convId}`;

const getLastRead = (userId: string, convId: string): Date | null => {
  const v = localStorage.getItem(readKey(userId, convId));
  return v ? new Date(v) : null;
};

const setLastRead = (userId: string, convId: string, date: Date) => {
  localStorage.setItem(readKey(userId, convId), date.toISOString());
};

const isConvUnread = (
  conv: PrivateConversation,
  userId: string,
  myConvId: string | undefined,
): boolean => {
  if (conv.id === myConvId) return false; // currently open
  if (!conv.lastMessage) return false;
  const lastRead = getLastRead(userId, conv.id);
  if (!lastRead) return true;
  return new Date(conv.lastMessage.createdAt) > lastRead;
};

// ── Components ───────────────────────────────────────────────────────────────

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-3">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-[10px] font-semibold text-gray-400 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">
      {label}
    </span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const PrivateMessages: React.FC = () => {
  const { user, effectiveSchoolId } = useAuth();
  const role = user?.role as UserRole;
  const isStudent = role === UserRole.STUDENT;
  const scopeKey = JSON.stringify([user?.id, user?.schoolId, user?.role, effectiveSchoolId]);
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const lifecycleRef = useRef<object | null>(null);
  const inboxRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  const [dataScope, setDataScope] = useState(scopeKey);

  const [conversationRows, setConversations] = useState<PrivateConversation[]>([]);
  const [selectedConversation, setActiveConv] = useState<PrivateConversation | null>(null);
  const [messageRows, setMessages] = useState<PrivateConversationMessage[]>([]);
  const conversations = dataScope === scopeKey ? conversationRows : [];
  const activeConv = dataScope === scopeKey ? selectedConversation : null;
  const messages = dataScope === scopeKey ? messageRows : [];
  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = activeConv?.id ?? null;
  const [content, setContent] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Force re-render to update unread badges after localStorage changes
  const [readTick, setReadTick] = useState(0);

  // New conversation form (students only)
  const [showNewForm, setShowNewForm] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [starting, setStarting] = useState(false);

  const isCurrent = useCallback((session: object | null) =>
    session !== null && lifecycleRef.current === session && scopeRef.current === scopeKey,
  [scopeKey]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    const session = lifecycleRef.current;
    if (!isCurrent(session)) return;
    const request = ++inboxRequestRef.current;
    const res = await api.getConversations();
    if (res.ok && isCurrent(session) && request === inboxRequestRef.current) setConversations(res.data);
  }, [user?.id, isCurrent]);

  useEffect(() => {
    const session = {};
    lifecycleRef.current = session;
    setDataScope(scopeKey);
    setConversations([]);
    setActiveConv(null);
    activeConvRef.current = null;
    setMessages([]);
    setContent('');
    setLoadingMsgs(false);
    setSending(false);
    setTeachers([]);
    setSelectedTeacher('');
    setShowNewForm(false);
    setStarting(false);
    void loadConversations();
    return () => {
      if (lifecycleRef.current === session) lifecycleRef.current = null;
      ++inboxRequestRef.current;
      ++threadRequestRef.current;
    };
  }, [loadConversations, scopeKey]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const session = lifecycleRef.current;
    if (!isCurrent(session)) return;
    const request = ++threadRequestRef.current;
    const res = await api.getConversationMessages(conversationId);
    if (!isCurrent(session) || request !== threadRequestRef.current || activeConvRef.current !== conversationId) return;
    if (res.ok) {
      setMessages(res.data);
      const latest = res.data[res.data.length - 1];
      if (user && latest) {
        setLastRead(user.id, conversationId, new Date(latest.createdAt));
        setReadTick(t => t + 1);
      }
    }
    setLoadingMsgs(false);
  }, [user?.id, isCurrent]);

  const openConversation = useCallback(
    async (conv: PrivateConversation) => {
      const session = lifecycleRef.current;
      if (!isCurrent(session)) return;
      activeConvRef.current = conv.id;
      setActiveConv(conv);
      setMessages([]);
      setLoadingMsgs(true);
      await loadMessages(conv.id);
      if (isCurrent(session) && activeConvRef.current === conv.id) inputRef.current?.focus();
    },
    [isCurrent, loadMessages],
  );

  // Refresh the inbox and open thread on relevant events.
  useEffect(() => {
    if (!user) return;
    return subscribeMessageEvents({ userId: user.id, schoolId: user.schoolId, role: user.role, contextSchoolId: effectiveSchoolId }, event => {
      if (event.type !== 'private-message') return;
      void loadConversations();
      const conversationId = activeConvRef.current;
      if (conversationId && (!event.conversationId || event.conversationId === conversationId)) void loadMessages(conversationId);
    });
  }, [scopeKey, loadConversations, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: Pick<React.SyntheticEvent, 'preventDefault'>) => {
    e.preventDefault();
    if (!content.trim() || !activeConv || sending) return;
    const session = lifecycleRef.current;
    const conversationId = activeConv.id;
    const sentContent = content.trim();
    setSending(true);
    const res = await api.sendConversationMessage(conversationId, sentContent);
    if (!isCurrent(session)) return;
    if (res.ok) {
      if (activeConvRef.current === conversationId) {
        setMessages(prev => prev.some(message => message.id === res.data.id) ? prev : [...prev, res.data]);
        setContent(previous => previous.trim() === sentContent ? '' : previous);
        if (user) setLastRead(user.id, conversationId, new Date(res.data.createdAt));
        void loadMessages(conversationId);
      }
      void loadConversations();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e);
    }
  };

  const loadTeachers = async () => {
    const session = lifecycleRef.current;
    const res = await api.getAllUsers();
    if (res.ok && isCurrent(session)) {
      setTeachers(
        res.data
          .filter((u) => u.role === UserRole.TEACHER)
          .map((u) => ({ id: u.id, name: u.name })),
      );
    }
  };

  const startNewConversation = async () => {
    if (!selectedTeacher || !effectiveSchoolId || !user) return;
    const session = lifecycleRef.current;
    setStarting(true);
    const res = await api.getOrCreateConversation({
      schoolId: effectiveSchoolId,
      studentId: user.id,
      teacherId: selectedTeacher,
    });
    if (!isCurrent(session)) return;
    setStarting(false);
    if (res.ok) {
      await loadConversations();
      if (!isCurrent(session)) return;
      setShowNewForm(false);
      setSelectedTeacher('');
      void openConversation(res.data);
    }
  };

  const otherName = (conv: PrivateConversation) =>
    isStudent ? conv.teacherName : conv.studentName;

  const otherInitial = (conv: PrivateConversation) =>
    otherName(conv).charAt(0).toUpperCase();

  const otherId = (conv: PrivateConversation) =>
    isStudent ? conv.teacherId : conv.studentId;

  const totalUnread = user
    ? conversations.filter((c) => isConvUnread(c, user.id, activeConv?.id)).length
    : 0;

  return (
    <div className="flex h-[calc(100vh-4.5rem)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm">

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <div
        className={`w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden ${
          activeConv ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">Messages</span>
            {totalUnread > 0 && (
              <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {totalUnread}
              </span>
            )}
          </div>
          {isStudent && (
            <button
              onClick={() => {
                setShowNewForm((v) => !v);
                if (!showNewForm) loadTeachers();
              }}
              className="w-7 h-7 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center"
              title="Start a new conversation"
            >
              <Plus size={15} />
            </button>
          )}
        </div>

        {/* New conversation form */}
        {dataScope === scopeKey && showNewForm && isStudent && (
          <div className="p-4 border-b border-gray-100 bg-primary-50/30 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Ask a teacher</p>
            <select
              id="pm-teacher-select" name="pm-teacher-select"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={startNewConversation}
                disabled={!selectedTeacher || starting}
                className="flex-1 text-xs bg-primary-600 text-white py-2 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
              >
                {starting ? 'Starting…' : 'Start chat'}
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex-1 text-xs bg-gray-100 text-gray-600 py-2 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-2 text-gray-300">
              <User size={28} />
              <p className="text-sm text-gray-400">No conversations yet</p>
              {isStudent && (
                <p className="text-xs text-gray-400 mt-0.5 text-center px-4">
                  Tap + to start a conversation with a teacher
                </p>
              )}
            </div>
          )}

          {conversations.map((conv) => {
            const unread = user ? isConvUnread(conv, user.id, activeConv?.id) : false;
            const isActive = activeConv?.id === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-b border-gray-50 ${
                  isActive
                    ? 'bg-primary-50 border-l-2 border-l-primary-500'
                    : unread
                    ? 'bg-red-50/50 hover:bg-red-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full ${avatarColor(otherId(conv))} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
                >
                  {otherInitial(conv)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`text-sm truncate leading-none ${
                        unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                      }`}
                    >
                      {otherName(conv)}
                    </p>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatConvTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 gap-1">
                    {conv.lastMessage ? (
                      <p
                        className={`text-xs truncate ${
                          unread ? 'text-gray-700 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {conv.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">No messages yet</p>
                    )}
                    {unread && (
                      <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col overflow-hidden bg-white ${
          !activeConv ? 'hidden md:flex' : 'flex'
        }`}
      >
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300">
            <MessageCircle size={44} />
            <p className="text-sm font-medium text-gray-400">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-3 bg-white flex-shrink-0">
              <button
                onClick={() => { activeConvRef.current = null; ++threadRequestRef.current; setActiveConv(null); }}
                className="md:hidden text-gray-400 hover:text-gray-600 p-1 -ml-1"
              >
                <ArrowLeft size={18} />
              </button>
              <div
                className={`w-9 h-9 rounded-full ${avatarColor(otherId(activeConv))} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
              >
                {otherInitial(activeConv)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-none">{otherName(activeConv)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isStudent ? 'Teacher' : 'Student'} · Private conversation
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Active
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50/30">
              {loadingMsgs && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                  <MessageCircle size={36} />
                  <p className="text-sm text-gray-400">No messages yet — say hello!</p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isMine = msg.senderId === user?.id;
                const prev = messages[idx - 1];
                const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
                const groupWithPrev =
                  prev && prev.senderId === msg.senderId && !showDate;

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && <DateSeparator label={dateLabel(msg.createdAt)} />}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${groupWithPrev ? 'mt-0.5' : 'mt-3'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          isMine
                            ? 'bg-primary-600 text-white rounded-tr-sm'
                            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
                            {formatTime(msg.createdAt)}
                          </span>
                          {isMine && (
                            <CheckCheck size={12} className="text-primary-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="p-4 border-t border-gray-100 flex gap-3 bg-white flex-shrink-0"
            >
              <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-primary-400 focus-within:bg-white transition-colors">
                <input
                  ref={inputRef}
                  id="pm-message-input" name="pm-message-input"
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${otherName(activeConv)}…`}
                  className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={sending || !content.trim()}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors flex-shrink-0 shadow-sm"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
