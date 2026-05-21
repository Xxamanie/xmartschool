import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, Send, CheckCheck, Inbox, Sparkles, Clock, ShieldCheck,
  Users, Building2, ChevronDown, X, AlertCircle,
  GraduationCap, BookOpen,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { UserRole, type Notification, type NotificationAudience, type School, type SchoolClassItem } from '../types';

// ── Audience config per role ──────────────────────────────────────────────────
type AudienceOption = {
  value: NotificationAudience;
  label: string;
  desc: string;
  needsSchool: boolean; // requires a school to be selected
};

const AUDIENCE_OPTIONS: Record<string, AudienceOption[]> = {
  [UserRole.SUPER_ADMIN]: [
    { value: 'admins',  label: 'All School Admins',   desc: 'Every admin across all registered schools — no school selection needed', needsSchool: false },
    { value: 'admins',  label: 'Admins of one school', desc: 'Only the admin(s) of a specific school you choose',                      needsSchool: true  },
    { value: 'school',  label: 'Everyone in a school', desc: 'All staff and students within a specific school',                        needsSchool: true  },
  ],
  [UserRole.ADMIN]: [
    { value: 'teachers',       label: 'Teachers only',        desc: 'All teaching staff in your school',                    needsSchool: false },
    { value: 'school',         label: 'General — all staff & students', desc: 'Every teacher, admin and student in your school', needsSchool: false },
    { value: 'class_students', label: 'Students by class',    desc: 'Only students assigned to a specific class',           needsSchool: true  },
  ],
  [UserRole.TEACHER]: [
    { value: 'teacher_students', label: 'My Students', desc: 'Students enrolled in your subjects only', needsSchool: false },
  ],
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-100 text-amber-700 border-amber-200',
  ADMIN:       'bg-violet-100 text-violet-700 border-violet-200',
  TEACHER:     'bg-sky-100 text-sky-700 border-sky-200',
  STUDENT:     'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)       return 'Just now';
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── SchoolPicker ──────────────────────────────────────────────────────────────
const SchoolPicker: React.FC<{
  value: string;
  onChange: (id: string, name: string) => void;
}> = ({ value, onChange }) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getSchools().then((r) => { if (r.ok) setSchools(r.data); });
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = schools.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.code?.toLowerCase().includes(query.toLowerCase()));
  const selected = schools.find((s) => s.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-[13px] transition-all ${
          value ? 'border-violet-300 bg-violet-50 text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'
        } focus:outline-none focus:ring-2 focus:ring-violet-400`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className={value ? 'text-violet-500' : 'text-gray-300'} />
          <span className="truncate">{selected ? selected.name : 'Select a school…'}</span>
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools…"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-[12px] text-gray-400 text-center py-4">No schools found</p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id, s.name); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-violet-50 transition-colors flex items-center justify-between ${s.id === value ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700'}`}
              >
                <span>{s.name}</span>
                {s.code && <span className="text-[11px] text-gray-400 font-mono">{s.code}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── ClassPicker ───────────────────────────────────────────────────────────────
const ClassPicker: React.FC<{
  schoolId: string;
  value: string;
  onChange: (id: string, name: string) => void;
}> = ({ schoolId, value, onChange }) => {
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    api.getSchoolClasses(schoolId).then((r) => {
      if (r.ok) setClasses(r.data);
      setLoading(false);
    });
  }, [schoolId]);

  if (!schoolId) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-gray-600 flex items-center gap-1.5">
        <Users size={12} className="text-violet-400" />
        Select class
      </p>
      {loading && <p className="text-[12px] text-gray-400">Loading classes…</p>}
      {!loading && classes.length === 0 && (
        <p className="text-[12px] text-gray-400">No classes found for this school.</p>
      )}
      <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => onChange(cls.id, cls.name)}
            className={`w-full text-left px-3 py-2 rounded-xl border text-[13px] font-medium transition-all ${
              value === cls.id
                ? 'border-violet-400 bg-violet-50 text-violet-700'
                : 'border-gray-200 hover:border-violet-200 hover:bg-violet-50/50 text-gray-700'
            }`}
          >
            {cls.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── RecipientPreview ──────────────────────────────────────────────────────────
const RecipientPreview: React.FC<{
  audience: NotificationAudience;
  schoolId?: string;
  classId?: string;
  ready: boolean;
}> = ({ audience, schoolId, classId, ready }) => {
  const [preview, setPreview] = useState<{ count: number; breakdown: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) { setPreview(null); return; }
    let cancelled = false;
    setLoading(true);
    api.previewNotificationRecipients(audience, schoolId, classId).then((r) => {
      if (!cancelled && r.ok) setPreview(r.data);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [audience, schoolId, classId, ready]);

  if (!ready) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition-all ${
      preview && preview.count > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <Users size={15} className={`mt-0.5 flex-shrink-0 ${preview && preview.count > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
      <div className="flex-1 min-w-0">
        {loading && <p className="text-[12px] text-gray-400">Calculating recipients…</p>}
        {!loading && preview && (
          <>
            <p className="text-[13px] font-semibold text-gray-800">
              {preview.count === 0 ? 'No recipients found' : `${preview.count} recipient${preview.count !== 1 ? 's' : ''}`}
            </p>
            {preview.count > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {Object.entries(preview.breakdown).map(([label, n]) => (
                  <span key={label} className="text-[11px] bg-white border border-emerald-200 text-emerald-700 rounded-lg px-2 py-0.5 font-medium">
                    {n} {label}
                  </span>
                ))}
              </div>
            )}
            {preview.count === 0 && (
              <p className="text-[12px] text-gray-400 mt-0.5">No users match this audience yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const AUDIENCE_ICONS: Record<NotificationAudience, React.ReactNode> = {
  admins:           <ShieldCheck size={16} />,
  teachers:         <GraduationCap size={16} />,
  staff:            <Users size={16} />,
  students:         <BookOpen size={16} />,
  class_students:   <Users size={16} />,
  school:           <Building2 size={16} />,
  teacher_students: <BookOpen size={16} />,
  all:              <Users size={16} />,
  specific_users:   <Users size={16} />,
};

// ── ComposeForm ───────────────────────────────────────────────────────────────
const ComposeForm: React.FC = () => {
  const { user, effectiveSchoolId } = useAuth();
  const role = user?.role as UserRole;
  const options = AUDIENCE_OPTIONS[role] ?? [];

  // accordion: which option is expanded (null = none open yet)
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  // selected = the confirmed choice (set when user clicks inside an open panel)
  const [optionIdx, setOptionIdx] = useState<number | null>(null);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [classId, setClassId] = useState('');
  const [className, setClassName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const selected = optionIdx !== null ? options[optionIdx] : null;
  const resolvedSchoolId = selected?.needsSchool ? schoolId : (effectiveSchoolId ?? undefined);
  // class_students needs a classId to be ready; school picker options need schoolId
  const previewReady = !!selected && (
    selected.value === 'class_students' ? !!classId :
    selected.needsSchool ? !!schoolId : true
  );

  const toggleAccordion = (i: number) => {
    setOpenIdx((prev) => (prev === i ? null : i));
  };

  const selectOption = (i: number) => {
    setOptionIdx(i);
    setSchoolId('');
    setSchoolName('');
    setClassId('');
    setClassName('');
    setResult(null);
    // if the option needs no school, collapse after selecting
    if (!options[i]?.needsSchool) setOpenIdx(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim() || !selected) return;
    if (selected.needsSchool && !schoolId) return;
    setSending(true);
    setResult(null);
    const res = await api.createNotification({
      title: title.trim(),
      message: message.trim(),
      audience: selected.value,
      schoolId: resolvedSchoolId,
      classId: selected.value === 'class_students' ? classId : undefined,
      source: user?.name ?? role,
    });
    setSending(false);
    if (res.ok) {
      setResult({ ok: true, msg: 'Delivered successfully.' });
      setTitle('');
      setMessage('');
      setOptionIdx(null);
      setOpenIdx(null);
      setSchoolId('');
      setSchoolName('');
      setClassId('');
      setClassName('');
    } else {
      setResult({ ok: false, msg: res.message ?? 'Failed to send.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-violet-50/60 to-transparent flex items-center gap-3">
        <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-gray-900">New Notification</p>
          <p className="text-[12px] text-gray-500">Recipients are enforced server-side — only authorised targets receive this</p>
        </div>
      </div>

      <form onSubmit={handleSend} className="p-6 space-y-5">

        {/* ── Target accordion ── */}
        <div>
          <p className="text-[13px] font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Users size={13} className="text-violet-500" />
            Who receives this?
            {selected && (
              <span className="ml-auto text-[11px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2 py-0.5">
                {selected.label}
                {selected.value === 'class_students' && className ? ` · ${className}` : ''}
                {selected.needsSchool && selected.value !== 'class_students' && schoolName ? ` · ${schoolName}` : ''}
              </span>
            )}
          </p>

          <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {options.map((opt, i) => {
              const isOpen     = openIdx === i;
              const isSelected = optionIdx === i;

              return (
                <div key={`${opt.value}-${i}`} className={isSelected ? 'bg-violet-50/60' : 'bg-white'}>
                  {/* Accordion header — always visible */}
                  <button
                    type="button"
                    onClick={() => toggleAccordion(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      isOpen ? 'bg-violet-50' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    {/* Selection indicator */}
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-violet-600 bg-violet-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>

                    {/* Icon */}
                    <span className={`flex-shrink-0 ${isSelected ? 'text-violet-600' : 'text-gray-400'}`}>
                      {AUDIENCE_ICONS[opt.value]}
                    </span>

                    {/* Label */}
                    <span className="flex-1 min-w-0">
                      <span className={`text-[13px] font-semibold block ${isSelected ? 'text-violet-700' : 'text-gray-800'}`}>
                        {opt.label}
                      </span>
                      {!isOpen && (
                        <span className="text-[11px] text-gray-400 truncate block">{opt.desc}</span>
                      )}
                    </span>

                    {/* Chevron */}
                    <ChevronDown
                      size={15}
                      className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Accordion body — expanded content */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 bg-white">
                      <p className="text-[12px] text-gray-500 leading-relaxed">{opt.desc}</p>

                      {/* School picker or class picker lives inside the panel when needed */}
                      {opt.needsSchool && opt.value !== 'class_students' && (
                        <div className="space-y-2">
                          <p className="text-[12px] font-semibold text-gray-600 flex items-center gap-1.5">
                            <Building2 size={12} className="text-violet-400" />
                            Select school
                          </p>
                          <SchoolPicker
                            value={isSelected ? schoolId : ''}
                            onChange={(id, name) => {
                              selectOption(i);
                              setSchoolId(id);
                              setSchoolName(name);
                            }}
                          />
                          {isSelected && schoolId && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-violet-700 font-medium bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                                <Building2 size={10} />
                                {schoolName}
                                <button
                                  type="button"
                                  onClick={() => { setSchoolId(''); setSchoolName(''); }}
                                  className="ml-1 text-violet-400 hover:text-violet-700"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Class picker for class_students */}
                      {opt.value === 'class_students' && (
                        <div className="space-y-3">
                          {/* For admin, effectiveSchoolId is their own school — no school picker needed */}
                          <ClassPicker
                            schoolId={effectiveSchoolId ?? ''}
                            value={isSelected ? classId : ''}
                            onChange={(id, name) => {
                              selectOption(i);
                              setClassId(id);
                              setClassName(name);
                            }}
                          />
                          {isSelected && classId && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-violet-700 font-medium bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                                <Users size={10} />
                                {className}
                                <button
                                  type="button"
                                  onClick={() => { setClassId(''); setClassName(''); }}
                                  className="ml-1 text-violet-400 hover:text-violet-700"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Select button for options that don't need a school */}
                      {!opt.needsSchool && (
                        <button
                          type="button"
                          onClick={() => selectOption(i)}
                          className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select this audience'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Recipient preview (shown once a valid selection is made) ── */}
        <RecipientPreview
          audience={selected?.value ?? 'admins'}
          schoolId={resolvedSchoolId}
          classId={selected?.value === 'class_students' ? classId : undefined}
          ready={previewReady}
        />

        {/* ── Privacy notice ── */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <ShieldCheck size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-amber-700">
            {role === UserRole.SUPER_ADMIN && 'Only school admins receive this — sensitive info like fee changes stays private from students.'}
            {role === UserRole.ADMIN && 'Recipients are scoped to your school only. Students cannot see admin-to-teacher messages.'}
            {role === UserRole.TEACHER && 'Only students enrolled in your subjects will receive this.'}
          </p>
        </div>

        {/* ── Title ── */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fee payment reminder"
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-[14px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent focus:bg-white transition-all"
          />
        </div>

        {/* ── Message ── */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message here…"
            required
            rows={5}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-[14px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent focus:bg-white transition-all resize-none"
          />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{message.length} chars</p>
        </div>

        {/* ── Result banner ── */}
        {result && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium border ${
            result.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {result.ok ? <CheckCheck size={15} /> : <AlertCircle size={15} />}
            {result.msg}
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-gray-400">
            Sending as <span className="font-semibold text-gray-600">{user?.name}</span>
          </p>
          <button
            type="submit"
            disabled={sending || !title.trim() || !message.trim() || !selected || (selected.value === 'class_students' ? !classId : selected.needsSchool && !schoolId)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-violet-200"
          >
            <Send size={14} />
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const { refresh: refreshBadge } = useNotifications();
  const role = user?.role as UserRole;
  const canSend = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.TEACHER;

  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.getNotifications();
    if (res.ok) setNotifications(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.readAt);
    await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    refreshBadge();
  };

  const markOne = (id: string) => {
    api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    refreshBadge();
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Private, role-scoped communications</p>
        </div>
        {unreadCount > 0 && tab === 'inbox' && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl transition-colors"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all ${
            tab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Inbox size={14} />
          Inbox
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {unreadCount}
            </span>
          )}
        </button>
        {canSend && (
          <button
            onClick={() => setTab('compose')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all ${
              tab === 'compose' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send size={14} />
            Compose
          </button>
        )}
      </div>

      {/* ── Inbox ── */}
      {tab === 'inbox' && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bell size={24} className="text-violet-400" />
              </div>
              <p className="text-[15px] font-semibold text-gray-700">All caught up</p>
              <p className="text-sm text-gray-400 mt-1">No notifications have been sent to you yet.</p>
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`group bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${
                !n.readAt ? 'border-violet-200 shadow-violet-100/50' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.readAt ? 'bg-violet-500' : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-[14px] leading-snug ${!n.readAt ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    {!n.readAt && (
                      <button
                        onClick={() => markOne(n.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-violet-500 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-2.5 mt-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${ROLE_BADGE[n.sourceRole] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {n.sourceRole.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock size={11} />
                      {timeAgo(n.createdAt)}
                    </span>
                    {n.readAt && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <CheckCheck size={11} className="text-emerald-500" />
                        Read
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Compose ── */}
      {tab === 'compose' && canSend && <ComposeForm />}
    </div>
  );
};
