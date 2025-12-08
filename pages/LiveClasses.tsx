import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { LiveClass, Subject, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Calendar, Video, Plus, Clock, LogIn } from 'lucide-react';

export const LiveClasses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ subjectId: '', scheduledTime: '', meetingLink: '' });
  const [saving, setSaving] = useState(false);

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.TEACHER;

  useEffect(() => {
    const load = async () => {
      const [cls, subs] = await Promise.all([api.getLiveClasses(), api.getSubjects()]);
      if (cls.ok) setClasses(cls.data);
      if (subs.ok) setSubjects(subs.data);
    };
    load();
  }, []);

  const visibleClasses = useMemo(() => {
    return classes.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  }, [classes]);

  const isClassActive = (scheduledTime: string): boolean => {
    const now = new Date();
    const classTime = new Date(scheduledTime);
    const endTime = new Date(classTime.getTime() + 2 * 60 * 60 * 1000);
    return now >= classTime && now <= endTime;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scheduledTime) return;
    setSaving(true);
    try {
      const link = form.meetingLink || `https://meet.jit.si/class-${form.subjectId || 'general'}-${Date.now()}`;
      const res = await api.createLiveClass({
        subjectId: form.subjectId || undefined,
        scheduledTime: form.scheduledTime,
        meetingLink: link,
        teacherId: user?.id,
      });
      if (res.ok) {
        setClasses((prev) => [...prev, res.data]);
        setForm({ subjectId: '', scheduledTime: '', meetingLink: '' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Classes</h1>
          <p className="text-gray-500">Schedule and join live video sessions (WebRTC-friendly links).</p>
        </div>
      </div>

      {canCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <select
                value={form.subjectId}
                onChange={(e) => setForm((s) => ({ ...s, subjectId: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg p-2"
              >
                <option value="">General</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="datetime-local"
                value={form.scheduledTime}
                onChange={(e) => setForm((s) => ({ ...s, scheduledTime: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Meeting Link (optional)</label>
              <input
                type="text"
                value={form.meetingLink}
                onChange={(e) => setForm((s) => ({ ...s, meetingLink: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                placeholder="https://meet.jit.si/..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
          >
            <Plus size={16} /> {saving ? 'Saving...' : 'Schedule Class'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleClasses.map((cls) => {
          const active = isClassActive(cls.scheduledTime);
          return (
            <div key={cls.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary-700 font-semibold">
                  <Video size={18} />
                  <span>{cls.subjectId ? subjects.find((s) => s.id === cls.subjectId)?.name || 'Live Class' : 'Live Class'}</span>
                </div>
                <span className={`text-xs uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  active 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {active ? 'Live' : 'Scheduled'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Calendar size={16} />
                {new Date(cls.scheduledTime).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Clock size={16} />
                Teacher: {cls.teacherId || 'TBD'}
              </div>
              <div className="flex gap-2 mt-auto">
                {active ? (
                  <button
                    onClick={() => navigate(`/live-classes/${cls.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700"
                  >
                    <LogIn size={16} />
                    Join Now
                  </button>
                ) : (
                  <a
                    href={cls.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700"
                  >
                    <Video size={16} />
                    View Link
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {visibleClasses.length === 0 && (
          <p className="text-sm text-gray-500">No live classes scheduled yet.</p>
        )}
      </div>
    </div>
  );
};
