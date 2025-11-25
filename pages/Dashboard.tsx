import React, { useEffect, useState } from 'react';
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
import { ArrowDown, ArrowUp, Calendar, Users, BookOpen } from 'lucide-react';
import { DASHBOARD_STATS } from '../services/mockData';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading for the dashboard
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard Overview
          </h1>
          <p className="text-gray-500">
            Welcome back, Alex! Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-md border shadow-sm">
            Term 2, Week 5
          </span>
        </div>
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
                    <span>•</span>
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
