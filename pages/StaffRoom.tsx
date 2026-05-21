import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { StaffMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { Send, Image, Mic, Video, Paperclip } from 'lucide-react';

const MEDIA_TYPES: { type: StaffMessage['type']; icon: React.ReactNode; label: string }[] = [
  { type: 'image', icon: <Image size={16} />, label: 'Image' },
  { type: 'audio', icon: <Mic size={16} />, label: 'Voice' },
  { type: 'video', icon: <Video size={16} />, label: 'Video' },
];

const MessageBubble: React.FC<{ msg: StaffMessage; isMine: boolean }> = ({ msg, isMine }) => (
  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-xs md:max-w-md rounded-2xl px-4 py-2 shadow-sm ${isMine ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
      {!isMine && <p className="text-xs font-semibold mb-1 text-primary-600">{msg.userId}</p>}
      {msg.mediaUrl && msg.type === 'image' && (
        <img src={msg.mediaUrl} alt="attachment" className="rounded-lg mb-1 max-w-full" />
      )}
      {msg.mediaUrl && msg.type === 'audio' && (
        <audio controls src={msg.mediaUrl} className="w-full mb-1" />
      )}
      {msg.mediaUrl && msg.type === 'video' && (
        <video controls src={msg.mediaUrl} className="rounded-lg mb-1 max-w-full" />
      )}
      {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
      <p className={`text-xs mt-1 ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  </div>
);

export const StaffRoom: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<StaffMessage['type']>('text');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getStaffMessages().then((res) => {
      if (res.ok) setMessages(res.data);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !mediaUrl.trim()) return;
    setSending(true);
    try {
      const type = mediaUrl.trim() ? mediaType : 'text';
      const res = await api.sendStaffMessage({
        type,
        content: text.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
      });
      if (res.ok) {
        setMessages((prev) => [...prev, res.data]);
        setText('');
        setMediaUrl('');
        setShowMediaInput(false);
        setMediaType('text');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Staff Room</h1>
        <p className="text-gray-500 text-sm">Private channel for teachers and staff.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMine={msg.userId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm space-y-2">
        {showMediaInput && (
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {MEDIA_TYPES.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => setMediaType(m.type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${mediaType === m.type ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Paste media URL..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowMediaInput((v) => !v)}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title="Attach media"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && !mediaUrl.trim())}
            className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
