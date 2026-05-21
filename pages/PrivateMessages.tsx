import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ArrowLeft, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import type { PrivateConversation, PrivateConversationMessage } from '../types';

export const PrivateMessages: React.FC = () => {
  const { user, effectiveSchoolId } = useAuth();
  const role = user?.role as UserRole;
  const isStudent = role === UserRole.STUDENT;

  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [activeConv, setActiveConv] = useState<PrivateConversation | null>(null);
  const [messages, setMessages] = useState<PrivateConversationMessage[]>([]);
  const [content, setContent] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // New conversation form (students only)
  const [showNewForm, setShowNewForm] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [starting, setStarting] = useState(false);

  const loadConversations = useCallback(async () => {
    const res = await api.getConversations();
    if (res.ok) setConversations(res.data);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (conv: PrivateConversation) => {
    setActiveConv(conv);
    setLoadingMsgs(true);
    const res = await api.getConversationMessages(conv.id);
    if (res.ok) setMessages(res.data);
    setLoadingMsgs(false);
  }, []);

  // Poll for new messages in active conversation
  useEffect(() => {
    if (!activeConv) return;
    const interval = setInterval(async () => {
      const res = await api.getConversationMessages(activeConv.id);
      if (res.ok) setMessages(res.data);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeConv) return;
    setSending(true);
    const res = await api.sendConversationMessage(activeConv.id, content.trim());
    if (res.ok) {
      setMessages((prev) => [...prev, res.data]);
      setContent('');
      // Refresh conversation list to update lastMessage
      loadConversations();
    }
    setSending(false);
  };

  const loadTeachers = async () => {
    const res = await api.getAllUsers();
    if (res.ok) {
      setTeachers(
        res.data
          .filter((u) => u.role === UserRole.TEACHER)
          .map((u) => ({ id: u.id, name: u.name })),
      );
    }
  };

  const startNewConversation = async () => {
    if (!selectedTeacher || !effectiveSchoolId || !user) return;
    setStarting(true);
    const res = await api.getOrCreateConversation({
      schoolId: effectiveSchoolId,
      studentId: user.id,
      teacherId: selectedTeacher,
    });
    setStarting(false);
    if (res.ok) {
      await loadConversations();
      setShowNewForm(false);
      setSelectedTeacher('');
      openConversation(res.data);
    }
  };

  const otherName = (conv: PrivateConversation) =>
    isStudent ? conv.teacherName : conv.studentName;

  const otherInitial = (conv: PrivateConversation) =>
    otherName(conv).charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
          <MessageCircle size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Private Messages</h1>
          <p className="text-sm text-gray-500">
            {isStudent
              ? 'Ask your teachers questions privately'
              : 'Private conversations with your students'}
          </p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        {/* Conversation list */}
        <div
          className={`w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden ${
            activeConv ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Conversations</span>
            {isStudent && (
              <button
                onClick={() => {
                  setShowNewForm((v) => !v);
                  if (!showNewForm) loadTeachers();
                }}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
              >
                + Ask a teacher
              </button>
            )}
          </div>

          {/* New conversation form */}
          {showNewForm && isStudent && (
            <div className="p-4 border-b border-gray-100 bg-primary-50/40 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Select a teacher</p>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Choose teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={startNewConversation}
                  disabled={!selectedTeacher || starting}
                  className="flex-1 text-xs bg-primary-600 text-white py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {starting ? 'Starting…' : 'Start'}
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="flex-1 text-xs bg-gray-100 text-gray-600 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {conversations.length === 0 && (
              <div className="py-12 text-center">
                <User size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No conversations yet</p>
                {isStudent && (
                  <p className="text-xs text-gray-400 mt-1">Tap "+ Ask a teacher" to start</p>
                )}
              </div>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  activeConv?.id === conv.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary-700">
                    {otherInitial(conv)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{otherName(conv)}</p>
                    {conv.lastMessage ? (
                      <p className="text-xs text-gray-400 truncate">{conv.lastMessage.content}</p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">No messages yet</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div
          className={`flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden ${
            !activeConv ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300">
              <MessageCircle size={40} />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setActiveConv(null)}
                  className="md:hidden text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700 flex-shrink-0">
                  {otherInitial(activeConv)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{otherName(activeConv)}</p>
                  <p className="text-xs text-gray-400">
                    {isStudent ? 'Teacher' : 'Student'} · Private conversation
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                {loadingMsgs && (
                  <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
                )}
                {!loadingMsgs && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-300">
                    <MessageCircle size={32} />
                    <p className="text-sm">No messages yet — say hello!</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          isMine
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? 'text-primary-200 text-right' : 'text-gray-400'
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-gray-100 flex gap-3 bg-white"
              >
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={sending || !content.trim()}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors flex-shrink-0"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
