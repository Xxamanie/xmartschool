import React, { useState, useEffect } from 'react';
import { School, User } from '../../types';
import { api } from '../../services/api';
import { Building2, Search, ExternalLink } from 'lucide-react';
import { getRoleBadgeClasses, ToastApi } from './shared';

const USER_PAGE_SIZE = 25;

interface UsersTabProps {
  schools: School[];
  toast: ToastApi;
  // Keeps the parent's hero "Total System Users" stat in sync with the
  // latest (possibly search-filtered) total — matching the original behaviour.
  onTotalChange?: (total: number) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ schools, toast, onTotalChange }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const handleViewUser = (_userId: string) => {
    // User detail page not yet implemented.
  };

  const handleResetPassword = (_userId: string) => {
    void api.resetUserPassword(_userId).then(response => {
      if (response.ok) window.alert(`Temporary password: ${response.data.temporaryPassword}`);
      else toast.error(response.message || 'Could not reset password');
    });
  };

  // Server-side user search + pagination. Debounced on the search term.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setUsersLoading(true);
      try {
        const res = await api.searchUsers({
          search: userSearch.trim() || undefined,
          page: userPage,
          pageSize: USER_PAGE_SIZE,
        });
        if (cancelled) return;
        if (res.ok) {
          setUsers(res.data.users || []);
          setUserTotal(res.data.total || 0);
          onTotalChange?.(res.data.total || 0);
        } else {
          setUsers([]);
          toast.error(res.message || 'Failed to load users');
        }
      } catch (e: any) {
        if (cancelled) return;
        setUsers([]);
        toast.error(e?.message || 'Failed to load users');
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [userSearch, userPage]);

  // Reset to page 1 whenever the search term changes.
  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  const totalUserPages = Math.max(1, Math.ceil(userTotal / USER_PAGE_SIZE));

  return (
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
              Showing {users.length} of {userTotal.toLocaleString()} users
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
                 {usersLoading ? (
                    [1,2,3,4,5].map(i => (
                       <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse"></div></td></tr>
                    ))
                 ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found{userSearch ? ` matching “${userSearch}”` : ''}.</td></tr>
                 ) : users.map((user) => (
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
                                onClick={() => handleResetPassword(user.id)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Reset to temporary password">
                                Reset password
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
           <p className="text-xs text-slate-500">
              Page {userPage} of {totalUserPages}
           </p>
           <div className="flex items-center gap-2">
              <button
                 onClick={() => setUserPage(p => Math.max(1, p - 1))}
                 disabled={userPage <= 1 || usersLoading}
                 className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Previous
              </button>
              <button
                 onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                 disabled={userPage >= totalUserPages || usersLoading}
                 className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Next
              </button>
           </div>
        </div>
    </div>
  );
};
