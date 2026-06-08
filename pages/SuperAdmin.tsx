
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarEvent, School, User, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';
import {
  Building2, MapPin, Users, Plus, Search,
  CheckCircle2, XCircle, BarChart3, Crown,
  LogIn, Trash2, Ban, RefreshCcw, Lock, Unlock,
  GraduationCap, TrendingUp, Activity, Filter, ExternalLink,
  CalendarDays, PencilLine, Copy, Check, Key, Mail, Eye
} from 'lucide-react';

// Helper function for role badges - Defined outside component for stability
const getRoleBadgeClasses = (role: string | undefined) => {
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

const CredentialRow: React.FC<{
  label: string; value: string; mono?: boolean; icon?: React.ReactNode; sensitive?: boolean;
}> = ({ label, value, mono, icon, sensitive }) => {
  const [copied, setCopied] = React.useState(false);
  const [revealed, setRevealed] = React.useState(!sensitive);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCodeFromName = (name: string): string => {
  const initials = name.split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase()).slice(0, 4).join('') || 'SCH';
  const suffix = Array.from({ length: 4 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
  return `${initials}-${suffix}`;
};

const toDateTimeInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const SuperAdmin: React.FC = () => {
  const { impersonateSchool, setViewingSchoolId } = useAuth();
  const navigate = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schools' | 'users' | 'events'>('schools');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // School Actions State
  const [isCreating, setIsCreating] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [codeAutoMode, setCodeAutoMode] = useState(true);
  const [newSchoolRegion, setNewSchoolRegion] = useState('');
  const [newSchoolAdminName, setNewSchoolAdminName] = useState('');
  const [newSchoolAdminEmail, setNewSchoolAdminEmail] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{
    schoolName: string; schoolCode: string; adminEmail: string; tempPassword: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Announcement Actions State (Admin-only)
  const [makeAnnouncementOpen, setMakeAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [selectedEventSchoolId, setSelectedEventSchoolId] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schoolsRes, usersRes] = await Promise.all([
            api.getSchools(),
            api.getAllUsers()
        ]);
        if (schoolsRes.ok) {
          const nextSchools = schoolsRes.data || [];
          setSchools(nextSchools);
          setSelectedEventSchoolId((current) => current || nextSchools[0]?.id || '');
        }
        if (usersRes.ok) setAllUsers(usersRes.data || []);
      } catch (e) {
        console.error('Data fetch failed', e);
        setSchools([]);
        setAllUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedEventSchoolId) {
      setEvents([]);
      return;
    }

    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await api.getCalendarEvents(selectedEventSchoolId);
        if (res.ok) {
          setEvents(res.data || []);
        } else {
          setEvents([]);
          toast.error(res.message || 'Failed to load events');
        }
      } catch (error: any) {
        console.error('Failed to fetch events:', error);
        setEvents([]);
        toast.error(error?.message || 'Failed to load events');
      } finally {
        setEventsLoading(false);
      }
    };

    loadEvents();
  }, [selectedEventSchoolId]);

  const handleCreateSchool = async () => {
    if (!newSchoolName.trim()) { toast.warning('School name is required'); return; }
    if (newSchoolAdminEmail.trim() && !newSchoolAdminName.trim()) {
      toast.warning('Admin name is required when an email is provided'); return;
    }
    const res = await api.createSchool({
      name: newSchoolName.trim(),
      code: newSchoolCode.trim() || undefined,
      region: newSchoolRegion.trim() || undefined,
      adminName: newSchoolAdminName.trim() || undefined,
      adminEmail: newSchoolAdminEmail.trim() || undefined,
    });
    if (res.ok) {
      setSchools(prev => [...prev, res.data]);
      setIsCreating(false);
      setNewSchoolName('');
      setNewSchoolCode('');
      setCodeAutoMode(true);
      setNewSchoolRegion('');
      setNewSchoolAdminName('');
      setNewSchoolAdminEmail('');
      if (res.data.tempAdminPassword && res.data.adminEmail) {
        setCreatedCredentials({
          schoolName: res.data.name,
          schoolCode: res.data.code || '',
          adminEmail: res.data.adminEmail,
          tempPassword: res.data.tempAdminPassword,
        });
      } else {
        toast.success('School created successfully!');
      }
    } else {
      toast.error(res.message || 'Failed to create school');
    }
  };

  const handleDeleteSchool = async (id: string) => {
      try {
          const res = await api.deleteSchool(id);
          if (res.ok) {
              setSchools(prev => prev.filter(s => s.id !== id));
              toast.success('School deleted successfully');
          }
      } catch (e) {
          console.error(e);
          toast.error('Failed to delete school');
      } finally {
          setDeleteConfirmId(null);
      }
  };

  // Admin announcement publisher (targets all staff + students)
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.warning('Title and message are required');
      return;
    }

    setAnnouncementSaving(true);
    try {
      const res = await api.createAnnouncement({
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        // Backend supports: all | teachers | students
        // “All staff + students” => use `all` so both audiences are included.
        targetAudience: 'all',
        source: UserRole.SUPER_ADMIN,
      });

      if (res.ok) {
        toast.success('Announcement published');
        setMakeAnnouncementOpen(false);
        setAnnouncementTitle('');
        setAnnouncementMessage('');
      } else {
        toast.error(res.message || 'Failed to publish announcement');
      }
    } catch (err: any) {
      console.error('Failed to publish announcement', err);
      toast.error(err?.message || 'Failed to publish announcement');
    } finally {
      setAnnouncementSaving(false);
    }
  };


  const handleViewSchool = (schoolId: string) => {
    navigate(`/schools/${schoolId}`);
  };

  const handleEnterSchool = (schoolId: string) => {
    setViewingSchoolId(schoolId);
    navigate('/');
  };

  const handleViewUser = (_userId: string) => {
    // User detail page not yet implemented — no-op
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
    setSelectedEventSchoolId(event.schoolId);
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventLocation(event.location || '');
    setEventStartAt(toDateTimeInputValue(event.startAt));
    setEventEndAt(toDateTimeInputValue(event.endAt));
    setActiveTab('events');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEventSchoolId) {
      toast.warning('Select a school first');
      return;
    }
    if (!eventTitle.trim() || !eventStartAt) {
      toast.warning('Title and start date are required');
      return;
    }

    setEventSaving(true);
    try {
      const payload = {
        schoolId: selectedEventSchoolId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        location: eventLocation.trim() || undefined,
        startAt: new Date(eventStartAt).toISOString(),
        endAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      };

      const res = editingEventId
        ? await api.updateCalendarEvent(editingEventId, payload)
        : await api.createCalendarEvent(payload);

      if (!res.ok) {
        toast.error(res.message || 'Failed to save event');
        return;
      }

      setEvents((prev) => {
        const next = editingEventId
          ? prev.map((item) => (item.id === editingEventId ? res.data : item))
          : [...prev, res.data];
        return [...next].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      });
      toast.success(editingEventId ? 'Event updated' : 'Event created');
      resetEventForm();
    } catch (error: any) {
      console.error('Failed to save event:', error);
      toast.error(error?.message || 'Failed to save event');
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedEventSchoolId) return;

    try {
      const res = await api.deleteCalendarEvent(eventId, selectedEventSchoolId);
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete event');
        return;
      }

      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        resetEventForm();
      }
      toast.success('Event deleted');
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      toast.error(error?.message || 'Failed to delete event');
    }
  };

  const toggleSchoolStatus = async (school: School) => {
      const newStatus = school.status === 'Active' ? 'Inactive' : 'Active';
      try {
          const res = await api.updateSchoolStatus(school.id, newStatus);
          if (res.ok) {
              setSchools(prev => prev.map(s => s.id === school.id ? { ...s, status: newStatus } : s));
          }
      } catch (e) {
          console.error(e);
      }
  };

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    return allUsers.filter(u => {
       if (!u) return false;
       const term = (userSearch || '').trim().toLowerCase();
       if (!term) return true;

       const nameMatch = (u.name || '').toLowerCase().includes(term);
       const emailMatch = (u.email || '').toLowerCase().includes(term);
       const role = u.role ? String(u.role) : '';
       const roleMatch = role.toLowerCase().includes(term);
       return nameMatch || emailMatch || roleMatch;
    });
  }, [allUsers, userSearch]);

  const filteredSchools = useMemo(() => {
    if (!Array.isArray(schools)) return [];
    return schools.filter(s => {
      if (!s) return false;
      if (statusFilter === 'All') return true;
      return s.status === statusFilter;
    });
  }, [schools, statusFilter]);

  // Statistics Calculation
  const totalSchools = schools.length;
  const totalStudents = schools.reduce((acc, s) => acc + (s.studentCount || 0), 0);
  const activeSchoolsCount = schools.filter(s => s.status === 'Active').length;
  const averageSchoolSize = totalSchools > 0 ? Math.round(totalStudents / totalSchools) : 0;

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {/* Hero Section - Dark Slate & Gold */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
         {/* Decorative ambient lights */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

         <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[520px] h-[220px] bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
         
         <div className="relative z-10">

            <div className="flex items-center gap-3 mb-2">
                <Crown className="text-amber-400" size={32} fill="currentColor" fillOpacity={0.2} />
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
                    Creator Dashboard
                </h1>
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wider uppercase">
                    God Mode
                </span>
            </div>
            <p className="text-slate-400 max-w-2xl text-sm leading-relaxed ml-11">
                Welcome, Architect. You have full control over the SmartSchool ecosystem. Override permissions, manage institutions, and analyze global statistics.
            </p>
         </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Total Schools Card */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
             <div className="absolute right-0 top-0 w-20 h-20 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
             <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                        <Building2 size={20} />
                    </div>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center">
                        <Activity size={10} className="mr-1" />
                        {activeSchoolsCount} Active
                    </span>
                 </div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Schools</p>
                 <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalSchools}</h3>
             </div>
         </div>

         {/* Total Students Card */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
             <div className="absolute right-0 top-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
             <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                        <GraduationCap size={20} />
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center">
                        <TrendingUp size={10} className="mr-1" />
                        Global
                    </span>
                 </div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</p>
                 <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalStudents.toLocaleString()}</h3>
             </div>
         </div>

         {/* Average School Size */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
             <div className="absolute right-0 top-0 w-20 h-20 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
             <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                        <BarChart3 size={20} />
                    </div>
                 </div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg. School Size</p>
                 <h3 className="text-2xl font-bold text-slate-900 mt-1">{averageSchoolSize} <span className="text-sm text-slate-400 font-medium">students</span></h3>
             </div>
         </div>

         {/* System Users Card */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
             <div className="absolute right-0 top-0 w-20 h-20 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
             <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                        <Users size={20} />
                    </div>
                 </div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total System Users</p>
                 <h3 className="text-2xl font-bold text-slate-900 mt-1">{allUsers.length}</h3>
             </div>
         </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 items-center">
          <button 
            onClick={() => setActiveTab('schools')}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 ${activeTab === 'schools' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
              Schools Registry
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 ${activeTab === 'users' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
              Global User Database
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 ${activeTab === 'events' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
              Calendar Events
          </button>
       </div>

      {/* Credentials Banner — shown once after school creation with admin account */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">School Created Successfully</h3>
                <p className="text-xs text-slate-500">Save these credentials — the password will not be shown again.</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <CredentialRow label="School Name" value={createdCredentials.schoolName} />
              <CredentialRow label="School Code" value={createdCredentials.schoolCode} mono />
              <CredentialRow label="Admin Email" value={createdCredentials.adminEmail} icon={<Mail size={14} />} />
              <CredentialRow label="Temp Password" value={createdCredentials.tempPassword} mono icon={<Key size={14} />} sensitive />
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Share the email and temporary password with the school administrator. They should change the password on first login.
            </p>
            <button
              onClick={() => setCreatedCredentials(null)}
              className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              I've saved the credentials
            </button>
          </div>
        </div>
      )}

      {/* Schools Registry Tab */}
      {activeTab === 'schools' && (
      <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="text-amber-500" size={24} />
                Registered Institutions
            </h2>
            
        <div className="flex items-center gap-3">
                {/* Filter Dropdown */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Filter size={14} />
                    </div>
                    <select
                        id="school-status-filter" name="school-status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
                        className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>

                <button 
                  type="button"
                  onClick={() => setMakeAnnouncementOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5"
                >
                   <Plus size={16} className="text-white" />
                   Make an announcement
                </button>

                <button 
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 hover:-translate-y-0.5"
                >
                   <Plus size={16} className="text-amber-400" />
                   Register New School
                </button>
            </div>
        </div>

        {isCreating && (
           <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner animate-in fade-in slide-in-from-top-2 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">New Institution Details</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                     <label htmlFor="new-school-name" className="block text-xs font-medium text-slate-500 mb-1">School Name *</label>
                     <input
                       id="new-school-name" name="new-school-name"
                       type="text"
                       value={newSchoolName}
                       onChange={(e) => {
                         const name = e.target.value;
                         setNewSchoolName(name);
                         if (codeAutoMode) setNewSchoolCode(name.trim() ? generateCodeFromName(name) : '');
                       }}
                       className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                       placeholder="e.g. International Heights Academy"
                       autoFocus
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">
                       School Code
                       {codeAutoMode && newSchoolCode && (
                         <span className="ml-2 text-xs text-amber-600 font-normal">auto-generated</span>
                       )}
                     </label>
                     <div className="relative">
                       <input
                         id="new-school-code" name="new-school-code"
                         type="text"
                         value={newSchoolCode}
                         onChange={(e) => {
                           setCodeAutoMode(false);
                           setNewSchoolCode(e.target.value.toUpperCase());
                         }}
                         className="block w-full border border-slate-300 rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm font-mono"
                         placeholder="Auto-generated from name"
                       />
                       <button
                         type="button"
                         onClick={() => {
                           const code = newSchoolName.trim() ? generateCodeFromName(newSchoolName) : '';
                           setNewSchoolCode(code);
                           setCodeAutoMode(true);
                         }}
                         className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-amber-600 transition-colors"
                         title="Regenerate code from name"
                       >
                         <RefreshCcw size={14} />
                       </button>
                     </div>
                  </div>
                  <div>
                     <label htmlFor="new-school-region" className="block text-xs font-medium text-slate-500 mb-1">Region</label>
                     <input
                       id="new-school-region" name="new-school-region"
                       type="text"
                       value={newSchoolRegion}
                       onChange={(e) => setNewSchoolRegion(e.target.value)}
                       className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                       placeholder="e.g. Lagos"
                     />
                  </div>
                  <div>
                     <label htmlFor="new-school-admin-name" className="block text-xs font-medium text-slate-500 mb-1">Administrator Name</label>
                     <input
                       id="new-school-admin-name" name="new-school-admin-name"
                       type="text"
                       value={newSchoolAdminName}
                       onChange={(e) => setNewSchoolAdminName(e.target.value)}
                       className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                       placeholder="e.g. John Doe"
                     />
                  </div>
                  <div className="sm:col-span-2">
                     <label className="block text-xs font-medium text-slate-500 mb-1">
                       Administrator Email <span className="text-slate-400 font-normal">(optional — creates a login account)</span>
                     </label>
                     <input
                       id="new-school-admin-email" name="new-school-admin-email"
                       type="email"
                       value={newSchoolAdminEmail}
                       onChange={(e) => setNewSchoolAdminEmail(e.target.value)}
                       className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                       placeholder="e.g. admin@schoolname.edu"
                     />
                     <p className="mt-1 text-xs text-slate-400">A temporary password will be generated and shown once after creation.</p>
                  </div>
              </div>
              <div className="flex gap-4 justify-end">
                  <button 
                    onClick={handleCreateSchool}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-colors"
                  >
                    Create School
                  </button>
                  <button 
                    onClick={() => { setIsCreating(false); setNewSchoolName(''); setNewSchoolCode(''); setCodeAutoMode(true); setNewSchoolRegion(''); setNewSchoolAdminName(''); setNewSchoolAdminEmail(''); }}
                    className="px-4 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
              </div>
           </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
           <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                 <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">School Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Enrollment</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Administrator</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Override Actions</th>
                 </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                 {loading ? (
                    [1,2,3].map(i => (
                       <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse"></div></td></tr>
                    ))
                 ) : filteredSchools.length > 0 ? (
                    filteredSchools.map(school => (
                       <tr key={school.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-600 flex items-center justify-center mr-3 transition-colors cursor-pointer"
                                     onClick={() => handleViewSchool(school.id)}
                                     title="View School Dashboard">
                                   <Building2 size={20} />
                                </div>
                                <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                                     onClick={() => handleViewSchool(school.id)}
                                     title="View School Dashboard">
                                   <div className="text-sm font-bold text-slate-900">{school.name}</div>
                                   <div className="text-xs text-slate-400 font-mono">{school.code}</div>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                             <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
                                  onClick={() => handleViewSchool(school.id)}
                                  title="View School Dashboard">
                                <MapPin size={14} className="text-slate-400" /> {school.region}
                             </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex flex-col gap-1 w-24">
                                 <span className="text-sm font-bold text-slate-900">{(school.studentCount || 0).toLocaleString()}</span>
                                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                         className="h-full bg-blue-500 rounded-full" 
                                         style={{ width: `${Math.min(100, ((school.studentCount || 0) / 500) * 100)}%` }} 
                                     ></div>
                                 </div>
                             </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                             <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                                  onClick={() => handleViewSchool(school.id)}
                                  title="View School Dashboard">
                                {school.adminName}
                             </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${school.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {school.status === 'Active' ? <CheckCircle2 size={12} className="mr-1"/> : <XCircle size={12} className="mr-1"/>}
                                {school.status}
                             </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                             <div className="flex items-center justify-end gap-2">
                                <button 
                                   onClick={() => handleEnterSchool(school.id)}
                                   className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                   title="Enter School (God Mode — full unrestricted access)"
                                >
                                    <Crown size={18} />
                                </button>
                                <button 
                                   onClick={() => impersonateSchool(school.id)}
                                   className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                   title="Impersonate Administrator"
                                >
                                    <LogIn size={18} />
                                </button>
                                <button 
                                   onClick={() => toggleSchoolStatus(school)}
                                   className={`p-1.5 rounded-lg transition-colors ${school.status === 'Active' ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                   title={school.status === 'Active' ? "Suspend School" : "Activate School"}
                                >
                                    {school.status === 'Active' ? <Lock size={18} /> : <Unlock size={18} />}
                                </button>
                                <button 
                                    onClick={() => setDeleteConfirmId(school.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete School Permanently"
                                >
                                    <Trash2 size={18} />
                                </button>
                             </div>
                          </td>
                       </tr>
                    ))
                 ) : (
                    <tr>
                       <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No schools found matching the selected filter.</td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
      )}

      {activeTab === 'events' && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="text-amber-500" size={22} />
                Event Control Room
              </h2>
              <p className="text-sm text-slate-500 mt-1">Create or update school-specific calendar entries.</p>
            </div>

            <div>
              <label htmlFor="event-school" className="block text-xs font-medium text-slate-500 mb-1">School</label>
              <select
                id="event-school" name="event-school"
                value={selectedEventSchoolId}
                onChange={(e) => {
                  setSelectedEventSchoolId(e.target.value);
                  resetEventForm();
                }}
                className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              >
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input
                  id="event-title" name="event-title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  placeholder="e.g. Inter-house sports"
                />
              </div>

              <div>
                <label htmlFor="event-location" className="block text-xs font-medium text-slate-500 mb-1">Location</label>
                <input
                  id="event-location" name="event-location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  placeholder="School main field"
                />
              </div>

              <div>
                <label htmlFor="event-description" className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  id="event-description" name="event-description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={4}
                  className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  placeholder="What should staff and students know?"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-start" className="block text-xs font-medium text-slate-500 mb-1">Start</label>
                  <input
                    id="event-start" name="event-start"
                    type="datetime-local"
                    value={eventStartAt}
                    onChange={(e) => setEventStartAt(e.target.value)}
                    className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  />
                </div>
                <div>
                  <label htmlFor="event-end" className="block text-xs font-medium text-slate-500 mb-1">End</label>
                  <input
                    id="event-end" name="event-end"
                    type="datetime-local"
                    value={eventEndAt}
                    onChange={(e) => setEventEndAt(e.target.value)}
                    className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                {editingEventId && (
                  <button
                    type="button"
                    onClick={resetEventForm}
                    className="px-4 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={eventSaving}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70"
                >
                  {eventSaving ? 'Saving...' : editingEventId ? 'Update event' : 'Create event'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Scheduled Events</h3>
                <p className="text-sm text-slate-500">
                  {selectedEventSchoolId
                    ? `Showing ${schools.find((school) => school.id === selectedEventSchoolId)?.name || 'selected school'}`
                    : 'Pick a school to manage its events.'}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {events.length} events
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {eventsLoading ? (
                [1, 2, 3].map((item) => (
                  <div key={item} className="px-6 py-5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse mb-3"></div>
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3"></div>
                  </div>
                ))
              ) : !selectedEventSchoolId ? (
                <div className="px-6 py-10 text-sm text-slate-500 text-center">Select a school to begin.</div>
              ) : events.length === 0 ? (
                <div className="px-6 py-10 text-sm text-slate-500 text-center">No calendar events have been created for this school yet.</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="px-6 py-5 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900">{event.title}</h4>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {new Date(event.startAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {new Date(event.startAt).toLocaleString()}
                        {event.endAt ? ` to ${new Date(event.endAt).toLocaleString()}` : ''}
                      </div>
                      {event.location && (
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          {event.location}
                        </div>
                      )}
                      {event.description && <p className="text-sm text-slate-500 max-w-2xl">{event.description}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditEvent(event)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit event"
                      >
                        <PencilLine size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Make Announcement Modal */}
      {makeAnnouncementOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-amber-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <Plus size={20} className="text-amber-600" />
                Make an announcement (General)
              </h2>
              <p className="text-sm text-amber-800 mt-1">
                This will be posted to <span className="font-semibold">all</span> staff and students.
              </p>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="p-6 space-y-4">
              <div>
                <label htmlFor="announcement-title" className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input
                  id="announcement-title" name="announcement-title"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  placeholder="e.g. Term break schedule"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="announcement-message" className="block text-xs font-medium text-slate-600 mb-1">Message</label>
                <textarea
                  id="announcement-message" name="announcement-message"
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  rows={6}
                  className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                  placeholder="Share the key details staff and students need to act on."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMakeAnnouncementOpen(false);
                    setAnnouncementTitle('');
                    setAnnouncementMessage('');
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={announcementSaving}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {announcementSaving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete School Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">

          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl">
            <div className="p-6 border-b border-gray-200 bg-red-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <Trash2 size={20} className="text-red-600" />
                Delete School Permanently
              </h2>
              <p className="text-sm text-red-700 mt-1">This action cannot be undone.</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700">
                All associated students, teachers, and data will be permanently removed. Are you sure you want to proceed?
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!deleteConfirmId) return;
                  handleDeleteSchool(deleteConfirmId);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
            <div className="flex justify-between items-center">
               <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    id="user-search" name="user-search"
                    type="text"
                    placeholder="Search any user across platform..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
               </div>
               <div className="text-xs text-slate-500">
                  Showing {filteredUsers.length} of {allUsers.length} users
               </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50">
                     <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User Identity</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Gender</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Global Role</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">School Context</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Authority Actions</th>
                     </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                     {filteredUsers.slice(0, 50).map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                                   onClick={() => handleViewUser(user.id)}
                                   title="View User Profile">
                                 <img className="h-8 w-8 rounded-full mr-3 bg-slate-200" src={user.avatar} alt="" />
                                 <div>
                                    <div className="text-sm font-bold text-slate-900">{user.name}</div>
                                    <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
                                   onClick={() => handleViewUser(user.id)}
                                   title="View User Profile">
                                {user.gender || '-'}
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                              <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors inline-flex items-center"
                                   onClick={() => handleViewUser(user.id)}
                                   title="View User Profile">
                                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${getRoleBadgeClasses(user.role)}`}>
                                     {user.role}
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              <div className="cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                                   onClick={() => handleViewUser(user.id)}
                                   title="View User Profile">
                                {user.schoolId ? (
                                   <div className="flex items-center gap-1">
                                      <Building2 size={12} />
                                      {schools.find(s => s.id === user.schoolId)?.name || 'Unknown School'}
                                   </div>
                                ) : <span className="text-slate-400">Global</span>}
                              </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                 <button 
                                    onClick={() => handleViewUser(user.id)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="View User Profile">
                                    <ExternalLink size={16} />
                                 </button>
                                 <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Reset Password">
                                    <RefreshCcw size={16} />
                                 </button>
                                 <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Ban User">
                                    <Ban size={16} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
        </div>
      )}
    </div>
  );
};
