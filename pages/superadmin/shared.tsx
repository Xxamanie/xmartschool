import React from 'react';
import { UserRole } from '../../types';
import { Copy, Check, Eye } from 'lucide-react';

// Shared toast API shape (matches the object returned by useToast()).
export type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
};

// Role badge colour classes — defined outside any component for stability.
export const getRoleBadgeClasses = (role: string | undefined) => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'bg-amber-100 text-amber-800';
    case UserRole.ADMIN:
      return 'bg-purple-100 text-purple-800';
    case UserRole.TEACHER:
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateCodeFromName = (name: string): string => {
  const initials = name.split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase()).slice(0, 4).join('') || 'SCH';
  const suffix = Array.from({ length: 4 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
  return `${initials}-${suffix}`;
};

export const toDateTimeInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const CredentialRow: React.FC<{
  label: string; value: string; mono?: boolean; icon?: React.ReactNode; sensitive?: boolean;
}> = ({ label, value, mono, icon, sensitive }) => {
  const [copied, setCopied] = React.useState(false);
  const [revealed, setRevealed] = React.useState(!sensitive);
  const copy = async () => {
    try {
      // navigator.clipboard is undefined on non-HTTPS origins and throws if
      // permission is denied — fall back to a hidden textarea + execCommand.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{label}</p>
          <p className={`text-sm font-semibold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>
            {revealed ? value : '••••••••••••'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {sensitive && (
          <button onClick={() => setRevealed(r => !r)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors" title={revealed ? 'Hide' : 'Reveal'}>
            <Eye size={14} />
          </button>
        )}
        <button onClick={copy} className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors" title="Copy">
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};
