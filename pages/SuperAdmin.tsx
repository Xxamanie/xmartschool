import React, { useState, useEffect } from 'react';
import { School } from '../types';
import { api } from '../services/api';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';
import {
  Building2, Users, Crown, BarChart3,
  GraduationCap, TrendingUp, Activity,
} from 'lucide-react';
import { SchoolsTab } from './superadmin/SchoolsTab';
import { UsersTab } from './superadmin/UsersTab';
import { EventsTab } from './superadmin/EventsTab';

export const SuperAdmin: React.FC = () => {
  const { toasts, toast, dismiss } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schools' | 'users' | 'events'>('schools');

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const schoolsRes = await api.getSchools();
        if (schoolsRes.ok) {
          setSchools(schoolsRes.data || []);
        } else {
          setSchools([]);
          toast.error(schoolsRes.message || 'Failed to load schools');
        }
      } catch (e: any) {
        console.error('Data fetch failed', e);
        setSchools([]);
        toast.error(e?.message || 'Failed to load schools');
      } finally {
        setLoading(false);
      }
    };
    fetchSchools();
  }, []);

  // Lightweight total-users count for the hero stat, so it's populated even
  // before the Users tab is opened. The Users tab keeps it fresh thereafter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.searchUsers({ page: 1, pageSize: 1 });
        if (!cancelled && res.ok) setUserTotal(res.data.total || 0);
      } catch {
        // Non-fatal — hero stat simply stays at 0 until the Users tab loads.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
                    Schools Registry
                </h1>
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wider uppercase">
                    Management
                </span>
            </div>
            <p className="text-slate-400 max-w-2xl text-sm leading-relaxed ml-11">
                Register and manage every institution, owner, user, and event. Create schools, register group owners, link branches, and impersonate any school's admin.
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
                 <h3 className="text-2xl font-bold text-slate-900 mt-1">{userTotal.toLocaleString()}</h3>
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

      {activeTab === 'schools' && (
        <SchoolsTab schools={schools} setSchools={setSchools} loading={loading} toast={toast} />
      )}

      {activeTab === 'users' && (
        <UsersTab schools={schools} toast={toast} onTotalChange={setUserTotal} />
      )}

      {activeTab === 'events' && (
        <EventsTab schools={schools} toast={toast} />
      )}
    </div>
  );
};
