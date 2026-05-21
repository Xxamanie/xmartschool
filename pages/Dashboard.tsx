import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  BookOpen,
  Calendar,
  ClipboardList,
  Clock3,
  GraduationCap,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { DASHBOARD_STATS } from '../services/mockData';
import { api } from '../services/api';
import { Announcement, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { HeroBannerSlider } from '../components/HeroBannerSlider';
import { AnnouncementsBannerSlider } from '../components/AnnouncementsBannerSlider';



const attendanceData = [
  { name: 'Mon', attendance: 92 },
  { name: 'Tue', attendance: 95 },
  { name: 'Wed', attendance: 88 },
  { name: 'Thu', attendance: 96 },
  { name: 'Fri', attendance: 91 },
];

const performanceData = [
  { subject: 'Math', score: 85 },
  { subject: 'Eng', score: 92 },
  { subject: 'Sci', score: 78 },
  { subject: 'Hist', score: 88 },
  { subject: 'Art', score: 95 },
];

const scheduleItems = [
  {
    title: 'Mathematics 101',
    time: '09:00 AM - 10:30 AM',
    room: 'Rm 204',
    type: 'Class',
  },
  {
    title: 'Staff Meeting',
    time: '11:00 AM - 12:00 PM',
    room: 'Conference A',
    type: 'Meeting',
  },
  {
    title: 'Physics Basics',
    time: '01:00 PM - 02:30 PM',
    room: 'Lab 3',
    type: 'Class',
  },
];

const priorities = [
  {
    title: 'Attendance follow-up',
    description: 'Wednesday attendance dipped below the weekly target and needs review.',
  },
  {
    title: 'Pending reports',
    description: 'Twelve reports are still open before the end-of-week release window.',
  },
  {
    title: 'Announcement cadence',
    description: 'Keep students and teachers aligned with one visible communication channel.',
  },
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedBannerDetail, setSelectedBannerDetail] = useState<
    'announcements' | 'attendance' | 'events' | 'subject-trends' | null
  >(null);
  const [createState, setCreateState] = useState({
    title: '',
    message: '',
    audience: 'all' as Announcement['targetAudience'],
    saving: false,
  });

  const handleViewBannerDetails = (slide: { id: string }) => {
    if (['announcements', 'attendance', 'events', 'subject-trends'].includes(slide.id)) {
      setSelectedBannerDetail(slide.id as 'announcements' | 'attendance' | 'events' | 'subject-trends');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const res = await api.getAnnouncements(user?.role);
        if (res.ok) setAnnouncements(res.data);
      } catch (e) {
        console.error('Failed to load announcements', e);
      }
    };

    loadAnnouncements();
  }, [user?.role]);

  const visibleAnnouncements = useMemo(() => {
    if (!user?.role) return announcements;
    if (user.role === UserRole.STUDENT) {
      return announcements.filter((a) => ['all', 'students'].includes(a.targetAudience));
    }
    if (user.role === UserRole.TEACHER) {
      return announcements.filter((a) => ['all', 'teachers'].includes(a.targetAudience));
    }
    return announcements;
  }, [announcements, user?.role]);

  const canCreateAnnouncements = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const averageAttendance = Math.round(
    attendanceData.reduce((total, item) => total + item.attendance, 0) / attendanceData.length,
  );

  const topSubject = performanceData.reduce((best, current) => {
    return current.score > best.score ? current : best;
  }, performanceData[0]);

  const roleLabel = user?.role ? user.role.replace(/_/g, ' ') : 'school user';

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createState.title.trim() || !createState.message.trim()) return;

    setCreateState((state) => ({ ...state, saving: true }));

    try {
      const res = await api.createAnnouncement({
        title: createState.title,
        message: createState.message,
        targetAudience: createState.audience,
        source: user?.role || 'admin',
      });

      if (res.ok) {
        setAnnouncements((current) => [res.data, ...current]);
        setCreateState({
          title: '',
          message: '',
          audience: 'all',
          saving: false,
        });
      }
    } catch (e) {
      console.error('Failed to create announcement', e);
      setCreateState((state) => ({ ...state, saving: false }));
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-40 rounded-[28px] bg-gray-200" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-36 rounded-2xl bg-gray-200" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-80 rounded-2xl bg-gray-200 xl:col-span-2" />
          <div className="h-80 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-700 via-primary-600 to-slate-900 text-white shadow-xl shadow-primary-900/10">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.45fr_0.9fr] lg:px-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-primary-100">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
                <Sparkles size={14} />
                Daily control center
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                Term 2, Week 5
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {roleLabel}
              </span>
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                A sharper view of what needs attention across the school today.
              </h1>
              <p className="text-sm leading-6 text-primary-100 sm:text-base">
                Welcome back, {user?.name?.split(' ')[0] || 'there'}. This dashboard groups the live signals,
                academic progress, announcements, and schedule into one clean operating surface.
              </p>
            </div>

            <div className="mt-2">
              <HeroBannerSlider
                autoPlayMs={5200}
                onViewDetails={handleViewBannerDetails}
                slides={[
                  {
                    id: 'announcements',
                    eyebrow: 'Announcements',
                    title: `Visible updates for your current access level`,
                    subtitle: `You have ${visibleAnnouncements.length} active update${visibleAnnouncements.length === 1 ? '' : 's'} right now.`,
                    tone: 'primary',
                  },
                  {
                    id: 'attendance',
                    eyebrow: 'Attendance pulse',
                    title: `${averageAttendance}%`,
                    subtitle: 'Average attendance across the current school week.',
                    tone: 'emerald',
                  },
                  {
                    id: 'events',
                    eyebrow: 'Upcoming events',
                    title: `${scheduleItems.length} events`,
                    subtitle: 'Next items on your calendar are ready to review.',
                    tone: 'amber',
                  },
                  {
                    id: 'subject-trends',
                    eyebrow: 'Subject trends',
                    title: `${topSubject.subject} leads`,
                    subtitle: `${topSubject.score}% average performance this cycle.`,
                    tone: 'indigo',
                  },
                ]}
              />
            </div>

          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(255,248,231,0.08)] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-primary-100">Today&apos;s focus</p>
                <h2 className="mt-1 text-xl font-semibold">Operational priorities</h2>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-white">
                <TrendingUp size={22} />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {priorities.map((priority) => (
                <div key={priority.title} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                  <p className="text-sm font-semibold text-white">{priority.title}</p>
                  <p className="mt-1 text-sm leading-6 text-primary-100">{priority.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_STATS.map((stat, index) => {
          const Icon = [GraduationCap, Users, Calendar, ClipboardList][index] || GraduationCap;

          return (
            <article
              key={stat.label}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <span className="inline-flex rounded-2xl bg-primary-50 p-3 text-primary-700">
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <h3 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stat.value}</h3>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    stat.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {stat.positive ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
                  {stat.change}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.85fr]">
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-700">Schedule</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">Upcoming schedule</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {scheduleItems.length} items
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {scheduleItems.map((item) => (
              <div key={`${item.title}-${item.time}`} className="flex gap-4 rounded-2xl border border-gray-100 p-4">
                <div
                  className={`mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    item.type === 'Class' ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {item.type === 'Class' ? <BookOpen size={20} /> : <Users size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      {item.type}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={14} />
                      {item.time}
                    </span>
                    <span>{item.room}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
              <BellRing size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-primary-700">Communication</p>
              <h2 className="text-xl font-semibold text-gray-900">Announcement queue</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            Keep academic updates, timetable changes, and school-wide notices in one visible stream for staff and students.
          </p>

          <div className="mt-5">
            <AnnouncementsBannerSlider announcements={visibleAnnouncements} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary-700">School updates</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">Announcements</h2>
              <p className="mt-1 text-sm text-gray-500">Recent communication sorted into one readable stream.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {visibleAnnouncements.length} active
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {visibleAnnouncements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
                <div className="mx-auto inline-flex rounded-2xl bg-primary-50 p-3 text-primary-700">
                  <Megaphone size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">No announcements yet</h3>
                <p className="mt-2 text-sm text-gray-500">Published notices will appear here for the current audience.</p>
              </div>
            ) : (
              visibleAnnouncements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-2xl border border-gray-200 p-5 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">{announcement.title}</h3>
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                          {announcement.targetAudience}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{announcement.message}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>Source: {announcement.source}</span>
                    <span>Posted {new Date(announcement.createdAt).toLocaleTimeString()}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {canCreateAnnouncements && (
          <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">
                <Megaphone size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-700">Admin action</p>
                <h2 className="text-xl font-semibold text-gray-900">Publish announcement</h2>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateAnnouncement}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={createState.title}
                  onChange={(e) => setCreateState((state) => ({ ...state, title: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Exam timetable release"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  value={createState.message}
                  onChange={(e) => setCreateState((state) => ({ ...state, message: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                  rows={5}
                  placeholder="Share the key details staff and students need to act on."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Target audience</label>
                <select
                  value={createState.audience}
                  onChange={(e) =>
                    setCreateState((state) => ({
                      ...state,
                      audience: e.target.value as Announcement['targetAudience'],
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="teachers">Teachers</option>
                  <option value="students">Students</option>
                </select>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                Published updates are inserted directly into the shared announcement stream for the selected audience.
              </div>

              <button
                type="submit"
                disabled={createState.saving}
                className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createState.saving ? 'Publishing...' : 'Publish announcement'}
              </button>
            </form>
          </div>
        )}
      </section>

      {selectedBannerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary-700">
                  {selectedBannerDetail === 'attendance'
                    ? 'Attendance detail'
                    : selectedBannerDetail === 'events'
                    ? 'Upcoming events'
                    : selectedBannerDetail === 'subject-trends'
                    ? 'Subject trends'
                    : 'Announcements'}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                  {selectedBannerDetail === 'attendance'
                    ? 'Attendance breakdown'
                    : selectedBannerDetail === 'events'
                    ? 'Upcoming calendar items'
                    : selectedBannerDetail === 'subject-trends'
                    ? 'Subject performance snapshot'
                    : 'Current announcements'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBannerDetail(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-6">
              {selectedBannerDetail === 'attendance' && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Average attendance</p>
                      <p className="mt-3 text-3xl font-semibold text-gray-900">{averageAttendance}%</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Trend</p>
                      <p className="mt-3 text-lg font-semibold text-gray-900">Stable growth over the week</p>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={attendanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 12px 30px -12px rgba(15, 23, 42, 0.25)',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="attendance"
                          stroke="#2563EB"
                          strokeWidth={3}
                          dot={{ fill: '#2563EB', strokeWidth: 2, r: 4, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {selectedBannerDetail === 'events' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Review the next calendar items scheduled for today and the coming days.</p>
                  <div className="grid gap-4">
                    {scheduleItems.map((item) => (
                      <div key={`${item.title}-${item.time}`} className="rounded-3xl border border-gray-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-gray-900">{item.title}</p>
                            <p className="mt-1 text-sm text-gray-500">{item.room}</p>
                          </div>
                          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{item.type}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={14} />
                            {item.time}
                          </span>
                          <span>{item.room}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedBannerDetail === 'subject-trends' && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Top subject</p>
                    <p className="mt-3 text-3xl font-semibold text-gray-900">{topSubject.subject}</p>
                    <p className="mt-1 text-sm text-gray-600">{topSubject.score}% average performance this cycle.</p>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="subject"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          cursor={{ fill: '#EEF2FF' }}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 12px 30px -12px rgba(15, 23, 42, 0.25)',
                          }}
                        />
                        <Bar dataKey="score" fill="#6366F1" radius={[8, 8, 0, 0]} barSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {selectedBannerDetail === 'announcements' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Open the current announcements list for your view level.</p>
                  {visibleAnnouncements.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-gray-300 bg-slate-50 p-6 text-center text-gray-600">
                      No active announcements at the moment.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleAnnouncements.map((announcement) => (
                        <div key={announcement.id} className="rounded-3xl border border-gray-200 bg-slate-50 p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">{announcement.title}</h3>
                              <p className="mt-1 text-sm text-gray-600">{announcement.message}</p>
                            </div>
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                              {announcement.targetAudience}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                            <span>{new Date(announcement.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
