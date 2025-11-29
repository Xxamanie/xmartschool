
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, User, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, MapPin, Users, Plus, Search, 
  CheckCircle2, XCircle, BarChart3, Crown, 
  LogIn, Trash2, Ban, RefreshCcw, Lock, Unlock,
  GraduationCap, TrendingUp, Activity, Filter, ExternalLink
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

export const SuperAdmin: React.FC = () => {
  const { impersonateSchool } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schools' | 'users'>('schools');
  
  // School Actions State
  const [isCreating, setIsCreating] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  
  // User Actions State
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schoolsRes, usersRes] = await Promise.all([
            api.getSchools(),
            api.getAllUsers()
        ]);
        if (schoolsRes.ok) setSchools(schoolsRes.data || []);
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

  const handleCreateSchool = async () => {
    if (!newSchoolName) return;
    try {
        const res = await api.createSchool({ name: newSchoolName });
        if (res.ok) {
            setSchools(prev => [...prev, res.data]);
            setIsCreating(false);
            setNewSchoolName('');
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleDeleteSchool = async (id: string) => {
      if (window.confirm("WARNING: This will permanently delete the school and all associated data. This action cannot be undone. Proceed?")) {
          try {
              const res = await api.deleteSchool(id);
              if (res.ok) {
                  setSchools(prev => prev.filter(s => s.id !== id));
              }
          } catch (e) {
              console.error(e);
          }
      }
  };

  const handleViewSchool = (schoolId: string) => {
    // Navigate to school admin view while maintaining creator context
    navigate(`/schools/${schoolId}`);
  };

  const handleViewUser = (userId: string) => {
    // Navigate to user profile or management page
    navigate(`/users/${userId}`);
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
      {/* Hero Section - Dark Slate & Gold */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
         {/* Decorative ambient lights */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
         
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
      <div className="border-b border-slate-200 flex gap-6">
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
      </div>

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
              <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">New Institution Details</h3>
              <div className="flex gap-4 items-end">
                  <div className="flex-1">
                     <label className="block text-xs font-medium text-slate-500 mb-1">School Name</label>
                     <input 
                       type="text" 
                       value={newSchoolName}
                       onChange={(e) => setNewSchoolName(e.target.value)}
                       className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
                       placeholder="e.g. International Heights Academy"
                       autoFocus
                     />
                  </div>
                  <button 
                    onClick={handleCreateSchool}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-colors"
                  >
                    Create School
                  </button>
                  <button 
                    onClick={() => setIsCreating(false)}
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
                                    onClick={() => handleDeleteSchool(school.id)}
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

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
            <div className="flex justify-between items-center">
               <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input 
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