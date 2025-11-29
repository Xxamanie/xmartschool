import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { TeacherForm } from '../components/TeacherForm';
import { Search, Filter, MoreHorizontal, Plus, ArrowUp, ArrowDown, ArrowUpDown, X, UserCheck, CheckCircle2, Trash2, Edit, Mail, Phone } from 'lucide-react';

export const Teachers: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await api.getAllUsers();
        if (response.ok) {
          let filteredTeachers = response.data.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.ADMIN);
          
          // If the user is a teacher, only show themselves (prevent seeing other teachers)
          if (user?.role === UserRole.TEACHER) {
            filteredTeachers = filteredTeachers.filter(t => t.id === user.id);
          }
          
          setTeachers(filteredTeachers);
        }
      } catch (error) {
        console.error('Failed to fetch teachers', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, [user]);

  const handleSort = (key: keyof User) => {
    if (!isAdmin) return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const processedTeachers = useMemo(() => {
    let result = [...teachers];

    // Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.email?.toLowerCase().includes(term) ||
          t.phone?.toLowerCase().includes(term)
      );
    }

    // Sort
    if (isAdmin) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort for teachers (Name ASC)
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [teachers, searchTerm, sortConfig, isAdmin]);

  const handleAddTeacher = async (teacherData: Partial<User>) => {
    try {
      const response = await api.createTeacher(teacherData as Omit<User, 'id'>);
      if (response.ok) {
        setTeachers(prev => [...prev, response.data]);
        setShowAddModal(false);
      }
    } catch (e) {
      console.error("Failed to add teacher", e);
    }
  };

  const handleEditTeacher = async (teacherData: Partial<User>) => {
    if (!editingTeacher) return;
    try {
      const response = await api.updateTeacher(editingTeacher.id, teacherData);
      if (response.ok) {
        setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? response.data : t));
        setEditingTeacher(null);
      }
    } catch (e) {
      console.error("Failed to update teacher", e);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteConfirm) return;
    try {
      const response = await api.deleteTeacher(deleteConfirm.id);
      if (response.ok) {
        setTeachers(prev => prev.filter(t => t.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      }
    } catch (e) {
      console.error("Failed to delete teacher", e);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-purple-100 text-purple-800';
      case UserRole.TEACHER:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const SortIcon = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-40 ml-1 transition-opacity" />;
    return direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-gray-500">Manage teaching staff and administrators.</p>
        </div>
        {isAdmin && (
          <button 
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm" 
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} className="mr-2" /> Add Teacher
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
          <Filter size={16} /> Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${isAdmin ? 'cursor-pointer hover:bg-gray-100 group select-none' : ''}`}
                    onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                      Name
                      {isAdmin && <SortIcon active={sortConfig.key === 'name'} direction={sortConfig.direction} />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gender
                </th>
                <th 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${isAdmin ? 'cursor-pointer hover:bg-gray-100 group select-none' : ''}`}
                    onClick={() => handleSort('role')}
                >
                   <div className="flex items-center">
                      Role
                      {isAdmin && <SortIcon active={sortConfig.key === 'role'} direction={sortConfig.direction} />}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : processedTeachers.length > 0 ? (
                processedTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xs mr-3">
                          {teacher.name.charAt(0)}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {teacher.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {teacher.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail size={14} className="text-gray-400" />
                          {teacher.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {teacher.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400" />
                          {teacher.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {teacher.gender || 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(
                          teacher.role
                        )}`}
                      >
                        {teacher.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => setEditingTeacher(teacher)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit teacher"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(teacher)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete teacher"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No teachers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Teacher Modal */}
      {(showAddModal || editingTeacher) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingTeacher ? 'Update teacher information.' : 'Enter details to add a new teacher.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTeacher(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[60vh]">
              <TeacherForm
                teacher={editingTeacher}
                onSubmit={editingTeacher ? handleEditTeacher : handleAddTeacher}
                onCancel={() => {
                  setShowAddModal(false);
                  setEditingTeacher(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Trash2 size={20} className="text-red-500" />
                Delete Teacher
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone.
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Role: {deleteConfirm.role} • ID: {deleteConfirm.id}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteTeacher}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
