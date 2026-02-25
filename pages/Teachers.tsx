import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, MoreHorizontal, Plus, ArrowUp, ArrowDown, ArrowUpDown, X, UserCheck, CheckCircle2, Trash2, Edit, Mail, Phone, Save, Briefcase, User as UserIcon } from 'lucide-react';

// Inline TeacherForm component to resolve module resolution issues
interface InlineTeacherFormProps {
  teacher?: User | null;
  onSubmit: (teacherData: Partial<User>) => void;
  onCancel: () => void;
}

const InlineTeacherForm: React.FC<InlineTeacherFormProps> = ({ teacher, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: teacher?.name || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    role: teacher?.role || UserRole.TEACHER,
    gender: teacher?.gender || '',
    bio: teacher?.bio || '',
    schoolId: teacher?.schoolId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <UserIcon size={14} className="sm:w-4 sm:h-4" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`pl-9 pr-3 py-2 sm:py-2 border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter teacher's full name"
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={14} className="sm:w-4 sm:h-4" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`pl-9 pr-3 py-2 sm:py-2 border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="teacher@school.edu"
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Phone size={14} className="sm:w-4 sm:h-4" />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`pl-9 pr-3 py-2 sm:py-2 border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
                  errors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="+1234567890"
              />
            </div>
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Briefcase size={14} className="sm:w-4 sm:h-4" />
              </div>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="pl-9 pr-8 py-2 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full appearance-none"
              >
                <option value={UserRole.TEACHER}>Teacher</option>
                <option value={UserRole.ADMIN}>Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="px-3 py-2 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bio (Optional)</label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              rows={3}
              className="px-3 py-2 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full resize-none"
              placeholder="Brief description about the teacher..."
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 bg-white sticky bottom-0">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 sm:px-4 sm:py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-3 py-2 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Save size={12} className="sm:w-4 sm:h-4" />
          {teacher ? 'Update Teacher' : 'Add Teacher'}
        </button>
      </div>
    </form>
  );
};

export const Teachers: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const [searchParams, setSearchParams] = useSearchParams();

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

  useEffect(() => {
    const quick = searchParams.get('quick');
    if (!quick) return;
    if (quick === 'create-teacher' && isAdmin) {
      setShowAddModal(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('quick');
    setSearchParams(next, { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

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
      setTeachers(prev => [...prev, response.data]);
      setShowAddModal(false);
      alert('Teacher added successfully!');
    } catch (e) {
      console.error("Failed to add teacher", e);
      alert(`Error adding teacher: ${(e as any)?.message || 'Unknown error'}`);
    }
  };

  const handleEditTeacher = async (teacherData: Partial<User>) => {
    if (!editingTeacher) return;
    try {
      const response = await api.updateTeacher(editingTeacher.id, teacherData);
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? response.data : t));
      setEditingTeacher(null);
      alert('Teacher updated successfully!');
    } catch (e) {
      console.error("Failed to update teacher", e);
      alert(`Error updating teacher: ${(e as any)?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteTeacher(deleteConfirm.id);
      setTeachers(prev => prev.filter(t => t.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      alert('Teacher deleted successfully!');
    } catch (e) {
      console.error("Failed to delete teacher", e);
      alert(`Error deleting teacher: ${(e as any)?.message || 'Unknown error'}`);
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {editingTeacher ? 'Update teacher information.' : 'Enter details to add a new teacher.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTeacher(null);
                }} 
                className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <InlineTeacherForm
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
