import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../services/api';
import { StaffMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { useStaffRoom } from '../context/StaffRoomContext';
import {
  Send, Image, Mic, Video, Paperclip, Hash, Users,
  Smile, X, ChevronRight,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-red-500',
  'bg-cyan-500', 'bg-amber-500',
];

const avatarColor = (id: string) =>
  AVATAR_COLORS[
    [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

// ── Avatar ────────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string; userId: string; avatar?: string; size?: 'sm' | 'md' }> = ({
  name, userId, avatar, size = 'md',
}) => {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return avatar ? (
    <img src={avatar} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div className={`${sz} rounded-full ${avatarColor(userId)} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials(name)}
    </div>
  );
};

// ── Message bubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  msg: StaffMessage;
  isMine: boolean;
  showSender: boolean;
}> = ({ msg, isMine, showSender }) => (
  <div className={`flex gap-2.5 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
    {/* Avatar — only shown for others on first message in a run */}
    <div className="flex-shrink-0 w-9">
      {showSender && !isMine && (
        <Avatar name={msg.senderName ?? msg.userId} userId={msg.userId} avatar={msg.senderAvatar} />
      )}
    </div>

    <div className={`flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
      {showSender && !isMine && (
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-gray-800">
            {msg.senderName ?? 'Staff Member'}
          </span>
          {msg.senderRole && (
            <span className="text-[10px] text-gray-400 capitalize">
              {msg.senderRole.toLowerCase()}
            </span>
          )}
        </div>
      )}

      <div
        className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm leading-relaxed ${
          isMine
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        {msg.mediaUrl && msg.type === 'image' && (
          <img src={msg.mediaUrl} alt="attachment" className="rounded-xl mb-2 max-w-full max-h-48 object-cover" />
        )}
        {msg.mediaUrl && msg.type === 'audio' && (
          <audio controls src={msg.mediaUrl} className="w-full mb-2" />
        )}
        {msg.mediaUrl && msg.type === 'video' && (
          <video controls src={msg.mediaUrl} className="rounded-xl mb-2 max-w-full max-h-48" />
        )}
        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
      </div>

      <span className={`text-[10px] mt-1 px-1 ${isMine ? 'text-gray-400' : 'text-gray-400'}`}>
        {formatTime(msg.createdAt)}
      </span>
    </div>
  </div>
);

// ── Date separator ────────────────────────────────────────────────────────────

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-0.5 rounded-full border border-gray-200">
      {label}
    </span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

// ── New messages indicator ────────────────────────────────────────────────────

const NewMessagesDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-3">
    <div className="flex-1 h-px bg-red-300" />
    <span className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-0.5 rounded-full border border-red-200">
      New messages
    </span>
    <div className="flex-1 h-px bg-red-300" />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const MEDIA_TYPES: { type: StaffMessage['type']; icon: React.ReactNode; label: string }[] = [
  { type: 'image', icon: <Image size={14} />, label: 'Image' },
  { type: 'audio', icon: <Mic size={14} />, label: 'Voice' },
  { type: 'video', icon: <Video size={14} />, label: 'Video' },
];

export const StaffRoom: React.FC = () => {
  const { user } = useAuth();
  const { messages, unreadCount, markAllRead } = useStaffRoom();

  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<StaffMessage['type']>('text');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track where unread starts (before marking as read)
  const firstUnreadIdRef = useRef<string | null>(null);
  const hasMarkedRead = useRef(false);

  // Find the first unread message before we mark as read
  useEffect(() => {
    if (hasMarkedRead.current || messages.length === 0 || !user) return;
    if (unreadCount > 0) {
      const stored = localStorage.getItem(`staffroom_lastread_${user.id}_${user.schoolId ?? ''}`);
      const lastRead = stored ? new Date(stored) : null;
      const firstUnread = messages.find(
        (m) => m.userId !== user.id && lastRead && new Date(m.createdAt) > lastRead,
      );
      firstUnreadIdRef.current = firstUnread?.id ?? null;
    }
  }, [messages.length, unreadCount]);

  // Mark as read when component mounts
  useEffect(() => {
    if (!hasMarkedRead.current && messages.length > 0) {
      hasMarkedRead.current = true;
      markAllRead();
    }
  }, [messages.length, markAllRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !mediaUrl.trim()) return;
    setSending(true);
    try {
      const type = mediaUrl.trim() ? mediaType : 'text';
      await api.sendStaffMessage({
        type,
        content: text.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
      });
      setText('');
      setMediaUrl('');
      setShowMediaInput(false);
      setMediaType('text');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  // Build unique member list from messages
  const members = Array.from(
    new Map(
      messages.map((m) => [
        m.userId,
        { id: m.userId, name: m.senderName ?? m.userId, avatar: m.senderAvatar, role: m.senderRole },
      ]),
    ).values(),
  );

  return (
    <div className="flex h-[calc(100vh-4.5rem)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm">

      {/* ── Left: chat area ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-sm">
              <Hash size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Staff Room</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Private staff channel'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                {unreadCount} new
              </span>
            )}
            <button
              onClick={() => setShowMembers((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showMembers
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Users size={13} />
              Members
              <ChevronRight
                size={12}
                className={`transition-transform ${showMembers ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <Hash size={40} />
              <p className="text-sm font-medium text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-400">Be the first to say something!</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMine = msg.userId === user?.id;
            const prev = messages[idx - 1];
            const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const showSender = !prev || prev.userId !== msg.userId || showDate;
            const isFirstUnread = msg.id === firstUnreadIdRef.current;

            return (
              <React.Fragment key={msg.id}>
                {showDate && <DateSeparator label={formatDateLabel(msg.createdAt)} />}
                {isFirstUnread && <NewMessagesDivider />}
                <MessageBubble msg={msg} isMine={isMine} showSender={showSender} />
              </React.Fragment>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 p-3 flex-shrink-0">
          {showMediaInput && (
            <div className="flex gap-2 items-center mb-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
              <div className="flex gap-1">
                {MEDIA_TYPES.map((m) => (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => setMediaType(m.type)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      mediaType === m.type
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100 bg-white'
                    }`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Paste media URL…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => { setShowMediaInput(false); setMediaUrl(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setShowMediaInput((v) => !v)}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                showMediaInput ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
              }`}
              title="Attach media"
            >
              <Paperclip size={18} />
            </button>

            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-primary-400 focus-within:bg-white transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message #staff-room…"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              <button type="button" className="text-gray-400 hover:text-amber-500 transition-colors flex-shrink-0">
                <Smile size={18} />
              </button>
            </div>

            <button
              type="submit"
              disabled={sending || (!text.trim() && !mediaUrl.trim())}
              className="bg-primary-600 text-white p-2.5 rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors flex-shrink-0 shadow-sm"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Right: members panel ─────────────────────────────────────────────── */}
      {showMembers && (
        <div className="w-56 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Members · {members.length}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
            {members.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No members yet</p>
            )}
            {members.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${
                  m.id === user?.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="relative flex-shrink-0">
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-full ${avatarColor(m.id)} flex items-center justify-center text-[10px] font-bold text-white`}
                    >
                      {initials(m.name)}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate leading-none">
                    {m.name}
                    {m.id === user?.id && <span className="text-gray-400 font-normal ml-1">(you)</span>}
                  </p>
                  {m.role && (
                    <p className="text-[10px] text-gray-400 capitalize mt-0.5">{m.role.toLowerCase()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
