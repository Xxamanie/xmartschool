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
  AreaChart,
  Area,
} from 'recharts';
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Calendar,
  Clock3,
  GraduationCap,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  DollarSign,
  Search,
  Menu,
  ChevronRight,
  MoreVertical,
  Star,
  Trophy,
  UserCheck,
  FileText,
  UserPlus,
  Activity,
  Download,
  Plus,
  Eye,
  CreditCard,
  BookOpen,
  UserMinus,
  Shield,
  EyeOff,
  Zap,
  Home,
  Library,
  Bus,
  Settings,
  LogOut,
  HelpCircle,
  MessageCircle,
  Flame,
  Gift,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { Announcement, CalendarEvent, School, SchoolTerm, Student, User, UserRole } from '../types';

// Some roles may not exist in older type definitions; keep UI functional.
const ROLE_PARENT = (UserRole as any).PARENT ?? 'PARENT';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

// Extended mock data for the new dashboard
const weeklyPerformanceData = [
  { day: 'SUN', female: 65, male: 58, both: 62 },
  { day: 'MON', female: 72, male: 68, both: 70 },
  { day: 'TUE', female: 78, male: 72, both: 75 },
  { day: 'WED', female: 82, male: 76, both: 79 },
  { day: 'THU', female: 85, male: 80, both: 82.5 },
  { day: 'FRI', female: 88, male: 84, both: 86 },
  { day: 'SAT', female: 90, male: 86, both: 88 },
];

const topScorers = [
  { name: 'Branden Harris', score: 99.9, avatar: 'BH', trend: 'up', subject: 'Mathematics' },
  { name: 'Olivia Patricia', score: 99.75, avatar: 'OP', trend: 'up', subject: 'English' },
  { name: 'Mike Peter', score: 99.5, avatar: 'MP', trend: 'steady', subject: 'Science' },
];

const upcomingEvents = [
  { 
    title: 'School Annual Function', 
    subtitle: 'Celebration 2023-2024', 
    date: '10 Dec',
    color: 'purple',
    icon: '🎉',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-50',
    path: '/events'
  },
  { 
    title: 'Inter-school competition', 
    subtitle: 'Sports, Singing, Dancing', 
    date: '6 Aug',
    color: 'blue',
    icon: '🏆',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50',
    path: '/events'
  },
  { 
    title: 'Parent-Teacher Meeting', 
    subtitle: 'Quarterly Review', 
    date: '15 Sep',
    color: 'green',
    icon: '👥',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-50',
    path: '/meetings'
  },
  { 
    title: 'Science Exhibition', 
    subtitle: 'Annual Tech Fair', 
    date: '20 Oct',
    color: 'orange',
    icon: '🔬',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-50',
    path: '/events'
  },
];

const recentActivities = [
  { user: 'Dr. Sarah Johnson', action: 'added new student', target: 'Emma Watson', time: '2 min ago', avatar: 'SJ', color: 'purple', path: '/students' },
  { user: 'Prof. Michael Chen', action: 'updated grades for', target: 'Mathematics Class 10A', time: '15 min ago', avatar: 'MC', color: 'blue', path: '/results' },
  { user: 'Admin Team', action: 'published new', target: 'exam schedule', time: '1 hour ago', avatar: 'AT', color: 'green', path: '/exams' },
  { user: 'Mrs. Patricia Okon', action: 'submitted attendance for', target: 'SS3 Students', time: '3 hours ago', avatar: 'PO', color: 'orange', path: '/attendance' },
];

const toDateTimeInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const Dashboard: React.FC = () => {
  const { user, logout, effectiveSchoolId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [schoolUsers, setSchoolUsers] = useState<User[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<Student[]>([]);
  const [schoolCatalog, setSchoolCatalog] = useState<School[]>([]);
  const [classMasters, setClassMasters] = useState<Record<string, string>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');
  const [financeSummary, setFinanceSummary] = useState<{ totalCollected: number; outstanding: number; totalPayable: number } | null>(null);
  const [currentTerm, setCurrentTerm] = useState<SchoolTerm | null>(null);
  const [selectedGender, setSelectedGender] = useState<'female' | 'male' | 'both'>('both');
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [hoveredStat, setHoveredStat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const canManageCalendar = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isAdminDashboard = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isTeacherDashboard = user?.role === UserRole.TEACHER;

  // Navigation handlers
  const navigateTo = (path: string) => {
    navigate(path);
    setShowSidebar(false);
    setShowUserMenu(false);
  };

  const handleLogout = async () => {
    await logout();
    navigateTo('/login');
  };

  // Role-aware quick actions — all paths must match registered routes in App.tsx
  const getRoleSpecificActions = () => {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
      return [
        { label: 'Add Student',       icon: UserPlus,   color: 'purple',  gradient: 'from-purple-500 to-purple-600', path: '/students'     },
        { label: 'Add Teacher',        icon: Users,      color: 'blue',    gradient: 'from-blue-500 to-blue-600',    path: '/teachers'     },
        { label: 'Record Fees',        icon: CreditCard, color: 'emerald', gradient: 'from-emerald-500 to-teal-600', path: '/finance'      },
        { label: 'View Results',       icon: FileText,   color: 'orange',  gradient: 'from-orange-500 to-red-500',   path: '/results'      },
        { label: 'Take Attendance',    icon: UserCheck,  color: 'pink',    gradient: 'from-pink-500 to-pink-600',    path: '/attendance'   },
        { label: 'Notifications',      icon: Megaphone,  color: 'indigo',  gradient: 'from-indigo-500 to-violet-600',path: '/notifications' },
      ];
    } else if (user?.role === UserRole.TEACHER) {
      return [
        { label: 'Take Attendance',    icon: UserCheck,    color: 'purple',  gradient: 'from-purple-500 to-purple-600', path: '/attendance'    },
        { label: 'Enter Results',      icon: FileText,     color: 'blue',    gradient: 'from-blue-500 to-cyan-600',    path: '/results'       },
        { label: 'My Students',        icon: GraduationCap,color: 'emerald', gradient: 'from-emerald-500 to-teal-600', path: '/students'      },
        { label: 'Scheme of Work',     icon: BookOpen,     color: 'amber',   gradient: 'from-amber-500 to-orange-500', path: '/scheme-of-work'},
        { label: 'Live Classes',       icon: Calendar,     color: 'rose',    gradient: 'from-rose-500 to-pink-600',    path: '/live-classes'  },
        { label: 'Assessments',        icon: TrendingUp,   color: 'cyan',    gradient: 'from-cyan-500 to-blue-600',    path: '/assessments'   },
      ];
    } else if (user?.role === UserRole.STUDENT) {
      return [
        { label: 'My Portal',          icon: FileText,   color: 'purple',  gradient: 'from-purple-500 to-violet-600', path: '/student-portal'},
        { label: 'Take Exam',          icon: BookOpen,   color: 'emerald', gradient: 'from-emerald-500 to-teal-600',  path: '/student-portal'},
        { label: 'Live Classes',       icon: Calendar,   color: 'blue',    gradient: 'from-blue-500 to-cyan-600',     path: '/live-classes'  },
        { label: 'My Messages',        icon: MessageCircle,color:'orange', gradient: 'from-orange-500 to-amber-500',  path: '/messages'      },
        { label: 'Notifications',      icon: BellRing,   color: 'pink',    gradient: 'from-pink-500 to-rose-600',    path: '/notifications' },
        { label: 'Settings',           icon: Settings,   color: 'cyan',    gradient: 'from-cyan-500 to-blue-600',    path: '/settings'      },
      ];
    } else if (user?.role === (UserRole as any).PARENT) {
      return [
        { label: 'View Results',       icon: FileText,   color: 'purple',  gradient: 'from-purple-500 to-purple-600', path: '/results'      },
        { label: 'Attendance',         icon: UserCheck,  color: 'blue',    gradient: 'from-blue-500 to-cyan-600',    path: '/attendance'   },
        { label: 'Live Classes',       icon: Calendar,   color: 'emerald', gradient: 'from-emerald-500 to-teal-600', path: '/live-classes' },
        { label: 'Notifications',      icon: Megaphone,  color: 'amber',   gradient: 'from-amber-500 to-orange-500', path: '/notifications'},
        { label: 'Messages',           icon: MessageCircle,color:'rose',   gradient: 'from-rose-500 to-pink-600',    path: '/messages'     },
        { label: 'Finance',            icon: CreditCard, color: 'cyan',    gradient: 'from-cyan-500 to-blue-600',    path: '/finance'      },
      ];
    }
    return [];
  };

  const roleSpecificActions = getRoleSpecificActions();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!effectiveSchoolId || (!isAdminDashboard && !isTeacherDashboard)) {
      setSchoolUsers([]);
      setSchoolStudents([]);
      setSchoolCatalog([]);
      setClassMasters({});
      return;
    }

    const loadDashboardContext = async () => {
      try {
        const [studentsRes, usersRes, schoolsRes, classMastersRes, financeRes, termRes] = await Promise.all([
          api.getStudents(effectiveSchoolId),
          api.getAllUsers(),
          api.getSchools(),
          api.getClassMasters(),
          api.getFinanceSummary(effectiveSchoolId),
          api.getCurrentTerm(effectiveSchoolId),
        ]);

        if (studentsRes.ok) {
          setSchoolStudents((studentsRes.data || []).filter((student) => student.schoolId === effectiveSchoolId));
        }
        if (usersRes.ok) {
          setSchoolUsers((usersRes.data || []).filter((entry) => entry.schoolId === effectiveSchoolId));
        }
        if (schoolsRes.ok) {
          setSchoolCatalog(schoolsRes.data || []);
        }
        if (classMastersRes.ok) {
          setClassMasters(classMastersRes.data || {});
        }
        if (financeRes.ok) setFinanceSummary(financeRes.data);
        if (termRes.ok) setCurrentTerm(termRes.data);
      } catch (error) {
        console.error('Failed to load dashboard context', error);
        setSchoolUsers([]);
        setSchoolStudents([]);
        setSchoolCatalog([]);
        setClassMasters({});
      }
    };

    loadDashboardContext();
  }, [effectiveSchoolId, isAdminDashboard, isTeacherDashboard]);

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

  useEffect(() => {
    if (!effectiveSchoolId) {
      setCalendarEvents([]);
      return;
    }

    const loadCalendarEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await api.getCalendarEvents(effectiveSchoolId);
        setCalendarEvents(res.ok ? (res.data || []) : []);
      } catch (error) {
        console.error('Failed to load calendar events', error);
        setCalendarEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };

    loadCalendarEvents();
  }, [effectiveSchoolId]);

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

  const roleLabel = user?.role ? user.role.replace(/_/g, ' ') : 'School User';
  const currentSchool = useMemo(
    () => schoolCatalog.find((school) => school.id === effectiveSchoolId) || null,
    [schoolCatalog, effectiveSchoolId],
  );
  const homeroomGrade = useMemo(
    () => Object.entries(classMasters).find(([, teacherId]) => teacherId === user?.id)?.[0] || null,
    [classMasters, user?.id],
  );
  const homeroomStudentCount = useMemo(
    () => (homeroomGrade ? schoolStudents.filter((student) => student.grade === homeroomGrade).length : 0),
    [homeroomGrade, schoolStudents],
  );
  const adminStats = useMemo(() => {
    const teachersCount = schoolUsers.filter((entry) => entry.role === UserRole.TEACHER).length;
    const parentCount = schoolUsers.filter((entry) => entry.role === ROLE_PARENT).length;
    const studentCount = schoolStudents.length || currentSchool?.studentCount || 0;

    const collected = financeSummary?.totalCollected ?? 0;
    const outstanding = financeSummary?.outstanding ?? 0;
    const earningsLabel = collected > 0
      ? `₦${collected.toLocaleString()}`
      : 'No data yet';
    const earningsChange = outstanding > 0
      ? `₦${outstanding.toLocaleString()} outstanding`
      : currentTerm?.name ?? 'View Finance';

    return [
      { label: 'Earnings', value: earningsLabel, change: earningsChange, positive: outstanding === 0, icon: DollarSign, color: 'emerald', gradient: 'from-emerald-500 to-teal-600', path: '/finance' },
      { label: 'Students', value: studentCount.toLocaleString(), change: `${calendarEvents.length} events`, positive: true, icon: GraduationCap, color: 'blue', gradient: 'from-blue-500 to-cyan-600', path: '/students' },
      { label: 'Teachers', value: teachersCount.toLocaleString(), change: currentSchool?.name ? 'School staff' : 'Faculty', positive: true, icon: Users, color: 'purple', gradient: 'from-purple-500 to-pink-600', path: '/teachers' },
      { label: 'Parents', value: parentCount.toLocaleString(), change: parentCount > 0 ? 'Guardian accounts' : 'Not tracked yet', positive: true, icon: UserPlus, color: 'orange', gradient: 'from-orange-500 to-red-600', path: '/parents' },
    ];
  }, [calendarEvents.length, currentSchool?.name, currentSchool?.studentCount, financeSummary, currentTerm, schoolStudents.length, schoolUsers]);

  const getChartData = () => {
    return weeklyPerformanceData.map(item => ({
      day: item.day,
      value: selectedGender === 'female' ? item.female : selectedGender === 'male' ? item.male : item.both,
    }));
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setEventStartAt('');
    setEventEndAt('');
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventLocation(event.location || '');
    setEventStartAt(toDateTimeInputValue(event.startAt));
    setEventEndAt(toDateTimeInputValue(event.endAt));
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveSchoolId || !eventTitle.trim() || !eventStartAt) return;

    setEventSaving(true);
    try {
      const payload = {
        schoolId: effectiveSchoolId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        location: eventLocation.trim() || undefined,
        startAt: new Date(eventStartAt).toISOString(),
        endAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      };

      const res = editingEventId
        ? await api.updateCalendarEvent(editingEventId, payload)
        : await api.createCalendarEvent(payload);

      if (!res.ok) return;

      setCalendarEvents((prev) => {
        const next = editingEventId
          ? prev.map((item) => (item.id === editingEventId ? res.data : item))
          : [...prev, res.data];
        return [...next].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      });
      resetEventForm();
    } catch (error) {
      console.error('Failed to save calendar event', error);
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!effectiveSchoolId) return;
    try {
      const res = await api.deleteCalendarEvent(eventId, effectiveSchoolId);
      if (!res.ok) return;
      setCalendarEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        resetEventForm();
      }
    } catch (error) {
      console.error('Failed to delete calendar event', error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-2xl bg-gray-200" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-gray-200" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-96 rounded-2xl bg-gray-200" />
          <div className="h-96 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-x-hidden">
      {/* Colorful Floating Dots Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000" />
        <div className="absolute top-40 right-40 w-64 h-64 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1500" />
        <div className="absolute bottom-40 left-40 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2500" />
      </div>

      {/* Sidebar Overlay for Mobile */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setShowSidebar(false)}>
          <div className="fixed left-0 top-0 h-full w-72 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-600 flex items-center justify-center">
                  <GraduationCap size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">SmartSchool</h2>
                  <p className="text-xs text-gray-500">Management System</p>
                </div>
              </div>
              <nav className="space-y-2">
                {[
                  { name: 'Dashboard', path: '/dashboard', icon: Home },
                  { name: 'Students', path: '/students', icon: GraduationCap },
                  { name: 'Teachers', path: '/teachers', icon: Users },
                  { name: 'Parents', path: '/parents', icon: UserPlus },
                  { name: 'Attendance', path: '/attendance', icon: UserCheck },
                  { name: 'Results', path: '/results', icon: FileText },
                  { name: 'Fees', path: '/fees', icon: CreditCard },
                  { name: 'Library', path: '/library', icon: Library },
                  { name: 'Transport', path: '/transport', icon: Bus },
                  { name: 'Settings', path: '/settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigateTo(item.path)}
                      className="w-full text-left px-4 py-2 rounded-xl text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all flex items-center gap-3"
                    >
                      <Icon size={18} />
                      {item.name}
                    </button>
                  );
                })}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all flex items-center gap-3 mt-4"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        {/* Header with Sparkle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <Sparkles size={20} className="text-yellow-500 animate-pulse" />
              </div>
              <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name?.split(' ')[0] || 'Admin'} ✨</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="dashboard-search" name="dashboard-search"
                type="text"
                placeholder="Search students, teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-80 bg-white/80 backdrop-blur-sm"
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors relative bg-white/80 backdrop-blur-sm"
              >
                <BellRing size={20} className="text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse"></span>
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                  </div>
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No new notifications
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 flex items-center justify-center text-white font-semibold shadow-lg hover:scale-105 transition-transform"
              >
                {user?.name?.charAt(0) || 'A'}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-20">
                  <div className="p-4 border-b border-gray-100">
                    <p className="font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                  <div className="p-2">
                    <button onClick={() => navigateTo('/profile')} className="w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2">
                      <UserCheck size={16} /> Profile
                    </button>
                    <button onClick={() => navigateTo('/settings')} className="w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2">
                      <Settings size={16} /> Settings
                    </button>
                    <button onClick={() => navigateTo('/help')} className="w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2">
                      <HelpCircle size={16} /> Help
                    </button>
                    <hr className="my-2" />
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards - Role Aware */}
        {isAdminDashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {adminStats.map((stat, index) => {
            const Icon = stat.icon;
            const borderColors = {
              emerald: 'border-l-emerald-500',
              blue: 'border-l-blue-500',
              purple: 'border-l-purple-500',
              orange: 'border-l-orange-500',
            };
            
            return (
              <button 
                key={stat.label}
                onClick={() => navigateTo(stat.path)}
                className={`group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-105 border-l-4 ${borderColors[stat.color as keyof typeof borderColors]} text-left`}
                onMouseEnter={() => setHoveredStat(index)}
                onMouseLeave={() => setHoveredStat(null)}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-transparent rounded-bl-full opacity-50" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.positive ? (
                        <ArrowUp size={14} className="text-emerald-500" />
                      ) : (
                        <ArrowDown size={14} className="text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${stat.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-gray-400">vs last month</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={22} className="text-white" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}

        {isTeacherDashboard && homeroomGrade && (
          <div className="mb-8">
            <button
              onClick={() => navigateTo('/students')}
              className="w-full sm:w-auto min-w-[320px] rounded-2xl border-l-4 border-l-emerald-500 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Form Teacher Class</p>
                  <p className="text-3xl font-bold text-gray-900">{homeroomStudentCount}</p>
                  <p className="mt-2 text-sm font-medium text-emerald-700">{homeroomGrade}</p>
                  <p className="mt-1 text-xs text-gray-500">Students currently assigned to your class.</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <GraduationCap size={22} className="text-white" />
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Student Performance Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Performance Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp size={20} className="text-purple-500" />
                  Student Performance
                </h2>
                <p className="text-sm text-gray-500 mt-1">Weekly academic progress tracking</p>
              </div>
              <div className="flex gap-2">
                {['female', 'male', 'both'].map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setSelectedGender(gender as any)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                      selectedGender === gender
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedGender === 'female' ? '#a855f7' : selectedGender === 'male' ? '#eab308' : '#10b981'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={selectedGender === 'female' ? '#a855f7' : selectedGender === 'male' ? '#eab308' : '#10b981'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
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
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      background: 'white',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={selectedGender === 'female' ? '#a855f7' : selectedGender === 'male' ? '#eab308' : '#10b981'} 
                    strokeWidth={3}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-4">
              <button onClick={() => setSelectedGender('female')} className="flex items-center gap-2 group cursor-pointer">
                <div className="w-3 h-3 rounded-full bg-purple-500 group-hover:scale-150 transition-transform" />
                <span className="text-xs text-gray-600">Female</span>
              </button>
              <button onClick={() => setSelectedGender('male')} className="flex items-center gap-2 group cursor-pointer">
                <div className="w-3 h-3 rounded-full bg-yellow-500 group-hover:scale-150 transition-transform" />
                <span className="text-xs text-gray-600">Male</span>
              </button>
              <button onClick={() => setSelectedGender('both')} className="flex items-center gap-2 group cursor-pointer">
                <div className="w-3 h-3 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform" />
                <span className="text-xs text-gray-600">Both</span>
              </button>
            </div>
          </div>

          {/* Calendar & Events */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar size={20} className="text-blue-500" />
                  Event Calendar
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {effectiveSchoolId ? 'Live schedule for your school' : 'No school context selected'}
                </p>
              </div>
              <span className="text-purple-600 text-sm font-medium">
                {calendarEvents.length} scheduled
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {eventsLoading ? (
                [1, 2, 3].map((item) => (
                  <div key={item} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))
              ) : calendarEvents.length > 0 ? (
                calendarEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl bg-gradient-to-r from-blue-50 to-white border border-blue-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">{event.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(event.startAt).toLocaleString()}
                          {event.endAt ? ` to ${new Date(event.endAt).toLocaleString()}` : ''}
                        </p>
                        {event.location && <p className="text-xs text-blue-700 mt-2">{event.location}</p>}
                        {event.description && <p className="text-xs text-gray-500 mt-2">{event.description}</p>}
                      </div>
                      {canManageCalendar && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditEvent(event)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                            title="Edit event"
                          >
                            <PencilLine size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                            title="Delete event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                  No school events have been scheduled yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Scorers */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-500" />
                  Top Scorer
                </h2>
                <p className="text-sm text-gray-500 mt-1">Highest performing students</p>
              </div>
              <button 
                onClick={() => navigateTo('/students/top-performers')}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Star size={16} className="text-white" />
              </button>
            </div>
            <div className="space-y-4">
              {topScorers.map((scorer, idx) => (
                <button 
                  key={scorer.name}
                  onClick={() => navigateTo(`/students/${scorer.name.toLowerCase().replace(' ', '-')}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-300 group"
                >
                  <div className="text-2xl font-bold text-gray-300 w-8">{idx + 1}</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 via-pink-100 to-indigo-100 flex items-center justify-center font-semibold text-purple-700 group-hover:scale-110 transition-transform">
                    {scorer.avatar}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">{scorer.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-sm text-gray-600">{scorer.score}%</span>
                      <span className="text-xs text-gray-400">in {scorer.subject}</span>
                    </div>
                  </div>
                  {scorer.trend === 'up' && <TrendingUp size={16} className="text-emerald-500 animate-pulse" />}
                </button>
              ))}
            </div>
            {/* Rainbow Progress Bar */}
            <div className="mt-6 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-pulse" style={{ width: '75%' }} />
            </div>
          </div>

          {/* School Calendar Manager */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar size={20} className="text-emerald-500" />
                  {canManageCalendar ? 'Calendar Manager' : 'Upcoming Schedule'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {canManageCalendar
                    ? 'Admins can create and maintain their school calendar here.'
                    : 'Your school timeline is maintained by the admin team.'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center">
                <Gift size={16} className="text-white" />
              </div>
            </div>
            {canManageCalendar ? (
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <input
                  id="dash-event-title" name="dash-event-title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  id="dash-event-location" name="dash-event-location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Location"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <textarea
                  id="dash-event-description" name="dash-event-description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="grid grid-cols-1 gap-3">
                  <input
                    id="dash-event-start" name="dash-event-start"
                    type="datetime-local"
                    value={eventStartAt}
                    onChange={(e) => setEventStartAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    id="dash-event-end" name="dash-event-end"
                    type="datetime-local"
                    value={eventEndAt}
                    onChange={(e) => setEventEndAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-3">
                  {editingEventId && (
                    <button
                      type="button"
                      onClick={resetEventForm}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={eventSaving || !effectiveSchoolId}
                    className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-medium text-white hover:shadow-md transition-all disabled:opacity-60"
                  >
                    {eventSaving ? 'Saving...' : editingEventId ? 'Update event' : 'Create event'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {calendarEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="rounded-xl bg-gradient-to-r from-emerald-50 to-white border border-emerald-100 p-4">
                    <h3 className="font-semibold text-gray-900 text-sm">{event.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{new Date(event.startAt).toLocaleString()}</p>
                  </div>
                ))}
                {calendarEvents.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                    No upcoming events available.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity size={20} className="text-orange-500 animate-pulse" />
                  Recent Activity
                </h2>
                <p className="text-sm text-gray-500 mt-1">Latest school updates</p>
              </div>
              <button 
                onClick={() => navigateTo('/activities')}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Zap size={16} className="text-white" />
              </button>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const colorGradients = {
                  purple: 'from-purple-100 to-indigo-100',
                  blue: 'from-blue-100 to-cyan-100',
                  green: 'from-emerald-100 to-teal-100',
                  orange: 'from-orange-100 to-red-100',
                };
                return (
                  <button 
                    key={activity.user}
                    onClick={() => navigateTo(activity.path)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-300 group text-left"
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorGradients[activity.color as keyof typeof colorGradients]} flex items-center justify-center text-sm font-semibold text-gray-600 group-hover:scale-110 transition-transform`}>
                      {activity.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{activity.user}</span>{' '}
                        <span className="text-gray-600">{activity.action}</span>{' '}
                        <span className="font-medium text-purple-600">{activity.target}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
                  </button>
                );
              })}
            </div>
            {/* Activity pulse indicator */}
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse delay-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Footer with Rainbow Colors - ALL CLICKABLE */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Quick Actions</h3>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {roleSpecificActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigateTo(action.path)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${action.gradient} text-white transition-all duration-300 hover:scale-105 hover:shadow-lg`}
                >
                  <Icon size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
            <Sparkles size={12} className="text-purple-500" />
            Powered by SmartSchool Management System
            <Sparkles size={12} className="text-pink-500" />
          </p>
        </div>
      </div>
    </div>
  );
};
