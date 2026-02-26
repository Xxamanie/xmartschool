import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowDown, ArrowUp, Calendar, Users, BookOpen, Sparkles, Rocket, CheckSquare2, Bot, AlertTriangle } from 'lucide-react';
import { DASHBOARD_STATS } from '../services/mockData';
import { api } from '../services/api';
import { Announcement, AIActivity, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

const data = [
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

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [aiActivities, setAiActivities] = useState<AIActivity[]>([]);
  const [loggingAI, setLoggingAI] = useState(false);
  const [createState, setCreateState] = useState({ title: '', message: '', audience: 'all' as Announcement['targetAudience'], saving: false });

  useEffect(() => {
    // Simulate data loading for the dashboard
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

  const loadAIActivities = async () => {
    if (!user) return;
    const params: {
      limit: number;
      actorId?: string;
      schoolId?: string;
    } = { limit: 6 };

    if (user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) {
      params.actorId = user.id;
    } else if (user.schoolId) {
      params.schoolId = user.schoolId;
    }

    const res = await api.getAIActivities(params);
    if (res.ok) setAiActivities(res.data);
  };

  useEffect(() => {
    loadAIActivities();
  }, [user]);

  const handleLogTestAI = async () => {
    if (!user) return;
    setLoggingAI(true);
    const res = await api.logAIActivity({
      action: 'manual_ai_activity_test',
      scope: 'general',
      status: 'success',
      actorId: user.id,
      actorRole: user.role,
      schoolId: user.schoolId,
      metadata: { source: 'dashboard_test' },
    });
    if (res.ok) {
      await loadAIActivities();
    }
    setLoggingAI(false);
  };

  const visibleAnnouncements = useMemo(() => {
    if (!user?.role) return announcements;
    if (user.role === UserRole.STUDENT) return announcements.filter(a => ['all', 'students'].includes(a.targetAudience));
    if (user.role === UserRole.TEACHER) return announcements.filter(a => ['all', 'teachers'].includes(a.targetAudience));
    return announcements;
  }, [announcements, user?.role]);

  const canCreateAnnouncements = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const greetingName = user?.name?.split(' ')[0] || 'there';
  const quickActions = useMemo(() => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      return [
        { label: 'Open Schools Registry', hint: 'Manage all schools', path: '/schools' },
        { label: 'Review Platform Settings', hint: 'System configuration', path: '/settings' },
      ];
    }
    if (user?.role === UserRole.STUDENT) {
      return [{ label: 'Open My Result Slip', hint: 'Check current performance', path: '/student-portal' }];
    }
    return [
      { label: 'Take Attendance', hint: 'Mark today in under 2 minutes', path: '/attendance' },
      { label: 'Grade Assessments', hint: 'Update continuous assessment', path: '/assessments' },
      { label: 'Publish Results', hint: 'Release term performance', path: '/results' },
    ];
  }, [user?.role]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createState.title.trim() || !createState.message.trim()) return;
    setCreateState((s) => ({ ...s, saving: true }));
    try {
      const res = await api.createAnnouncement({
        title: createState.title,
        message: createState.message,
        targetAudience: createState.audience,
        source: user?.role || 'admin',
      });
      if (res.ok) {
        setAnnouncements((prev) => [res.data, ...prev]);
        setCreateState({ title: '', message: '', audience: 'all', saving: false });
      }
    } catch (e) {
      console.error('Failed to create announcement', e);
      setCreateState((s) => ({ ...s, saving: false }));
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 md:p-8 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-2">
              <Sparkles size={14} />
              Mission Control
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome back, {greetingName}.</h1>
            <p className="text-slate-200 mt-2 text-sm md:text-base">Move fast today: command search (`Ctrl/Cmd + K`), quick actions, and live school metrics are ready.</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl p-4 min-w-[220px]">
            <p className="text-xs uppercase tracking-wider text-indigo-200">Current Cycle</p>
            <p className="text-lg font-bold mt-1">Term 2, Week 5</p>
            <p className="text-xs text-slate-200 mt-1">Keep momentum on attendance, grading, and publishing.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="text-left bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 transition-colors"
            >
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Rocket size={14} />
                {action.label}
              </p>
              <p className="text-xs text-slate-200 mt-1">{action.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Execution Overview</h2>
          <p className="text-gray-500">Stay on top of performance, communication, and schedule health.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-md border shadow-sm inline-flex items-center gap-2">
            <CheckSquare2 size={14} />
            Daily Focus Active
          </span>
        </div>
      </div>

      {/* Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Announcements</h3>
            <span className="text-xs text-gray-500">Showing {visibleAnnouncements.length}</span>
          </div>
          {visibleAnnouncements.length === 0 ? (
            <p className="text-sm text-gray-500">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {visibleAnnouncements.map((a) => (
                <div key={a.id} className="p-4 border border-gray-200 rounded-lg flex flex-col gap-1 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900">{a.title}</h4>
                    <span className="text-[11px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {a.targetAudience}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{a.message}</p>
                  <div className="text-xs text-gray-500 flex gap-2 items-center">
                    <span>Source: {a.source}</span>
                    <span>|</span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canCreateAnnouncements && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="text-md font-bold text-gray-900 mb-4">Create Announcement</h4>
            <form className="space-y-3" onSubmit={handleCreateAnnouncement}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={createState.title}
                  onChange={(e) => setCreateState((s) => ({ ...s, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Exam timetable release"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={createState.message}
                  onChange={(e) => setCreateState((s) => ({ ...s, message: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  placeholder="Details about the announcement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                <select
                  value={createState.audience}
                  onChange={(e) => setCreateState((s) => ({ ...s, audience: e.target.value as Announcement['targetAudience'] }))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All</option>
                  <option value="teachers">Teachers</option>
                  <option value="students">Students</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={createState.saving}
                className="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-70"
              >
                {createState.saving ? 'Saving...' : 'Publish Announcement'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Bot size={18} />
            AI Activity
          </h3>
          <div className="flex items-center gap-2">
            {(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
              <button
                onClick={handleLogTestAI}
                disabled={loggingAI}
                className="text-xs font-semibold px-3 py-1 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-70"
                title="Create a test AI activity entry"
              >
                {loggingAI ? 'Logging...' : 'Log Test Activity'}
              </button>
            )}
            <span className="text-xs text-gray-500">Last {aiActivities.length}</span>
          </div>
        </div>
        {aiActivities.length === 0 ? (
          <p className="text-sm text-gray-500">No AI actions logged yet.</p>
        ) : (
          <div className="space-y-2">
            {aiActivities.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">
                    {item.scope} • {item.actorName || item.actorRole || 'system'} • {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${
                  item.status === 'failed'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : item.status === 'fallback'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {item.status === 'failed' && <AlertTriangle size={12} />}
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {DASHBOARD_STATS.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </h3>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  stat.positive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {stat.positive ? (
                  <ArrowUp size={12} className="mr-1" />
                ) : (
                  <ArrowDown size={12} className="mr-1" />
                )}
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              Weekly Attendance
            </h3>
            <button className="text-primary-600 text-sm font-medium hover:text-primary-700">
              View Report
            </button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                />
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
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{
                    fill: '#3B82F6',
                    strokeWidth: 2,
                    r: 4,
                    stroke: '#fff',
                  }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Performance */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              Average Subject Scores
            </h3>
            <button className="text-primary-600 text-sm font-medium hover:text-primary-700">
              Details
            </button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                />
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
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar
                  dataKey="score"
                  fill="#818CF8"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity / Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Upcoming Schedule</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
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
          ].map((item, idx) => (
            <div
              key={idx}
              className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    item.type === 'Class'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  {item.type === 'Class' ? (
                    <BookOpen size={20} />
                  ) : (
                    <Users size={20} />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> {item.time}
                    </span>
                    <span>|</span>
                    <span>{item.room}</span>
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-primary-600">
                Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
