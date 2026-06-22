import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, UserRole } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, MapPin, Plus, CheckCircle2, XCircle, Crown,
  LogIn, Trash2, RefreshCcw, Lock, Unlock, Filter, Mail, Key, Users,
} from 'lucide-react';
import { CredentialRow, generateCodeFromName, ToastApi } from './shared';

interface SchoolsTabProps {
  schools: School[];
  setSchools: React.Dispatch<React.SetStateAction<School[]>>;
  loading: boolean;
  toast: ToastApi;
}

export const SchoolsTab: React.FC<SchoolsTabProps> = ({ schools, setSchools, loading, toast }) => {
  const { impersonateSchool, setViewingSchoolId } = useAuth();
  const navigate = useNavigate();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // School creation state
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

  // School groups (for assigning a school to a multi-branch owner's group)
  const [groups, setGroups] = useState<Array<{ id: string; name: string; schoolCount: number }>>([]);
  useEffect(() => {
    (async () => {
      const r = await api.getGroups();
      if (r.ok) setGroups(r.data || []);
    })();
  }, []);

  const handleAssignGroup = async (schoolId: string, groupId: string) => {
    const res = await api.assignSchoolToGroup(schoolId, groupId || null);
    if (res.ok) {
      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, groupId: groupId || undefined } : s));
      toast.success('School group updated');
    } else {
      toast.error(res.message || 'Failed to update group');
    }
  };

  // Group owner creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupOwnerName, setGroupOwnerName] = useState('');
  const [groupOwnerEmail, setGroupOwnerEmail] = useState('');
  const [groupCredentials, setGroupCredentials] = useState<{
    groupName: string; ownerEmail: string; tempPassword: string; userId: string;
  } | null>(null);
  // Schools selected to link to the new owner at registration time.
  const [groupSchoolIds, setGroupSchoolIds] = useState<string[]>([]);
  const toggleGroupSchool = (id: string) =>
    setGroupSchoolIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreateGroupOwner = async () => {
    if (!groupName.trim()) { toast.warning('Group name is required'); return; }
    if (!groupOwnerName.trim()) { toast.warning('Owner name is required'); return; }
    if (!groupOwnerEmail.trim()) { toast.warning('Owner email is required'); return; }
    const res = await api.createGroupOwner({
      groupName: groupName.trim(),
      ownerName: groupOwnerName.trim(),
      ownerEmail: groupOwnerEmail.trim(),
      schoolIds: groupSchoolIds,
    });
    if (res.ok) {
      const linked = res.data.linkedSchoolIds || [];
      if (linked.length) {
        setSchools(prev => prev.map(s => linked.includes(s.id) ? { ...s, groupId: res.data.groupId } : s));
      }
      setIsCreatingGroup(false);
      setGroupName(''); setGroupOwnerName(''); setGroupOwnerEmail(''); setGroupSchoolIds([]);
      setGroupCredentials({ groupName: res.data.groupName, ownerEmail: res.data.ownerEmail, tempPassword: res.data.tempPassword, userId: res.data.userId });
    } else {
      toast.error(res.message || 'Failed to create group owner');
    }
  };

  // Announcement state
  const [makeAnnouncementOpen, setMakeAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);

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
          setDeleteConfirmText('');
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

  const filteredSchools = useMemo(() => {
    if (!Array.isArray(schools)) return [];
    return schools.filter(s => {
      if (!s) return false;
      if (statusFilter === 'All') return true;
      return s.status === statusFilter;
    });
  }, [schools, statusFilter]);

  // Refresh the group list after a new group owner is registered, so the new
  // group is immediately available in the per-school assignment dropdown.
  useEffect(() => {
    if (!groupCredentials) return;
    api.getGroups().then(r => { if (r.ok) setGroups(r.data || []); });
  }, [groupCredentials]);

  return (
    <>
      {/* Group Owner credentials modal */}
      {groupCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Group Owner Created</h3>
                <p className="text-xs text-slate-500">Save these credentials — the password will not be shown again.</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <CredentialRow label="Group Name" value={groupCredentials.groupName} />
              <CredentialRow label="User ID (login account)" value={groupCredentials.userId} mono icon={<Users size={14} />} />
              <CredentialRow label="Owner Email" value={groupCredentials.ownerEmail} icon={<Mail size={14} />} />
              <CredentialRow label="Temp Password" value={groupCredentials.tempPassword} mono icon={<Key size={14} />} sensitive />
            </div>
            <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">
              Share these credentials with the group owner. They can now log in and see their portfolio. Assign schools to this group to populate their dashboard.
            </p>
            <button
              onClick={() => setGroupCredentials(null)}
              className="w-full px-4 py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-bold hover:bg-indigo-800 transition-colors"
            >
              I've saved the credentials
            </button>
          </div>
        </div>
      )}

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
                        aria-label="Filter schools by status"
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
                  onClick={() => { setIsCreatingGroup(true); setIsCreating(false); }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-all shadow-lg shadow-indigo-700/20 hover:shadow-indigo-700/40 hover:-translate-y-0.5"
                >
                   <Users size={16} className="text-indigo-200" />
                   Register Group Owner
                </button>
                <button
                  onClick={() => { setIsCreating(true); setIsCreatingGroup(false); }}
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
                     <label htmlFor="new-school-code" className="block text-xs font-medium text-slate-500 mb-1">
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
                     <label htmlFor="new-school-admin-email" className="block text-xs font-medium text-slate-500 mb-1">
                       Administrator Email <span className="text-slate-400 font-normal">(optional — creates a login account)</span>
                     </label>
                     <input
                       id="new-school-admin-email" name="new-school-admin-email"
                       type="email"
                       autoComplete="off"
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

        {isCreatingGroup && (
          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-inner animate-in fade-in slide-in-from-top-2 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">New Group Owner Account</h3>
            </div>
            <p className="text-xs text-indigo-700 mb-4">Creates a named school group and a Group Owner login account, and links the schools you tick below so the owner sees and manages them on login.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label htmlFor="group-name" className="block text-xs font-medium text-slate-500 mb-1">Group / Organisation Name *</label>
                <input
                  id="group-name" name="group-name" type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="block w-full border border-indigo-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  placeholder="e.g. Bright Future Education Group"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="group-owner-name" className="block text-xs font-medium text-slate-500 mb-1">Owner Full Name *</label>
                <input
                  id="group-owner-name" name="group-owner-name" type="text"
                  value={groupOwnerName}
                  onChange={(e) => setGroupOwnerName(e.target.value)}
                  className="block w-full border border-indigo-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  placeholder="e.g. Emeka Obi"
                />
              </div>
              <div>
                <label htmlFor="group-owner-email" className="block text-xs font-medium text-slate-500 mb-1">Owner Login Email *</label>
                <input
                  id="group-owner-email" name="group-owner-email" type="email"
                  autoComplete="off"
                  value={groupOwnerEmail}
                  onChange={(e) => setGroupOwnerEmail(e.target.value)}
                  className="block w-full border border-indigo-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  placeholder="e.g. owner@groupname.com"
                />
              </div>
            </div>

            {/* Link schools to this owner */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">
                Schools owned by this person <span className="text-slate-400 font-normal">({groupSchoolIds.length} selected)</span>
              </label>
              {schools.length === 0 ? (
                <p className="text-xs text-slate-400">No schools yet — register schools first, then assign them.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-indigo-200 bg-white divide-y divide-slate-100">
                  {schools.map(s => {
                    const otherGroup = s.groupId && !groupSchoolIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-indigo-50/60">
                        <input
                          type="checkbox"
                          checked={groupSchoolIds.includes(s.id)}
                          onChange={() => toggleGroupSchool(s.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="flex-1 text-sm text-slate-700">
                          {s.name} <span className="text-xs text-slate-400 font-mono">{s.code}</span>
                        </span>
                        {otherGroup && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">in another group — will move</span>}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-xs text-slate-400">You can also change a school's owner later from the table below.</p>
            </div>

            <div className="flex gap-4 justify-end">
              <button
                onClick={handleCreateGroupOwner}
                className="px-6 py-2.5 bg-indigo-700 text-white rounded-lg text-sm font-bold hover:bg-indigo-800 shadow-md shadow-indigo-700/20 transition-colors"
              >
                Create Group Owner
              </button>
              <button
                onClick={() => { setIsCreatingGroup(false); setGroupName(''); setGroupOwnerName(''); setGroupOwnerEmail(''); setGroupSchoolIds([]); }}
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
                             <select
                                aria-label="Assign school to group"
                                value={school.groupId || ''}
                                onChange={(e) => handleAssignGroup(school.id, e.target.value)}
                                className="mt-1 ml-2 text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600 focus:ring-2 focus:ring-indigo-400 focus:outline-none cursor-pointer"
                                title="Assign this school to a group owner"
                             >
                                <option value="">— No group —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                             </select>
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
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                The school will be archived and hidden, and its students, teachers, and data will no longer be accessible. To confirm, type the school name
                {' '}<span className="font-bold text-slate-900">{schools.find(s => s.id === deleteConfirmId)?.name}</span> below.
              </p>
              <input
                id="delete-confirm-text" name="delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                placeholder="Type the school name to confirm"
                className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => { setDeleteConfirmId(null); setDeleteConfirmText(''); }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmText.trim() !== (schools.find(s => s.id === deleteConfirmId)?.name ?? '').trim()}
                onClick={() => {
                  if (!deleteConfirmId) return;
                  handleDeleteSchool(deleteConfirmId);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
