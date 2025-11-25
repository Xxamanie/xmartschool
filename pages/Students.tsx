
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Student, UserRole, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, MoreHorizontal, Plus, ArrowUp, ArrowDown, ArrowUpDown, Calendar, Crown, X, UserCheck, CheckCircle2 } from 'lucide-react';

export const Students: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [formMasters, setFormMasters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMasterModal, setShowMasterModal] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Student; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [response, usersRes, mastersRes] = await Promise.all([
            api.getStudents(),
            api.getAllUsers(),
            api.getClassMasters()
        ]);

        if (response.ok) {
          setStudents(response.data);
        }
        if (usersRes.ok) {
            setTeachers(usersRes.data.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.ADMIN));
        }
        if (mastersRes.ok) {
            setFormMasters(mastersRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch students', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSort = (key: keyof Student) => {
    if (!isAdmin) return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const processedStudents = useMemo(() => {
    let result = [...students];

    // 1. Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.grade.toLowerCase().includes(term)
      );
    }

    // 2. Sort
    // Teachers always see alphabetical (default), Admins can sort
    if (isAdmin) {
        result.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        // Default sort for teachers (Name ASC)
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [students, searchTerm, sortConfig, isAdmin]);

  // Extract unique grades from all students
  const uniqueGrades = useMemo(() => {
      const grades = new Set(students.map(s => s.grade));
      return Array.from(grades).sort();
  }, [students]);

  const handleAssignMaster = async (grade: string, teacherId: string) => {
      try {
          await api.assignClassMaster(grade, teacherId);
          setFormMasters(prev => ({ ...prev, [grade]: teacherId }));
      } catch (e) {
          console.error("Failed to assign form master", e);
      }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Inactive':
        return 'bg-gray-100 text-gray-800';
      case 'Suspended':
        return 'bg-red-100 text-red-800';
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
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500">Manage student enrollment and details.</p>
        </div>
        {isAdmin && (
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowMasterModal(true)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                >
                    <Crown size={16} className="mr-2 text-amber-500" /> Form Masters
                </button>
                <button className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm">
                    <Plus size={16} className="mr-2" /> Add Student
                </button>
            </div>
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
            placeholder="Search by name or grade..."
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
                  Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${isAdmin ? 'cursor-pointer hover:bg-gray-100 group select-none' : ''}`}
                    onClick={() => handleSort('enrollmentDate')}
                >
                   <div className="flex items-center">
                      Enrollment Date
                      {isAdmin && <SortIcon active={sortConfig.key === 'enrollmentDate'} direction={sortConfig.direction} />}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GPA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance
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
                    <td colSpan={8} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : processedStudents.length > 0 ? (
                processedStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xs mr-3">
                          {student.name.charAt(0)}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {student.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.grade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-gray-400" />
                          {student.enrollmentDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          student.status
                        )}`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {student.gpa.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${student.attendance}%` }}
                          ></div>
                        </div>
                        {student.attendance}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Masters Modal */}
      {showMasterModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                 <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                     <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Crown size={20} className="text-amber-500" />
                            Form Masters Assignment
                        </h2>
                        <p className="text-sm text-gray-500">Assign a teacher to oversee each grade/class.</p>
                     </div>
                     <button onClick={() => setShowMasterModal(false)} className="text-gray-400 hover:text-gray-600">
                         <X size={24} />
                     </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6">
                    {uniqueGrades.length > 0 ? (
                        <div className="space-y-4">
                            {uniqueGrades.map(grade => {
                                const assignedId = formMasters[grade] || '';
                                return (
                                    <div key={grade} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-primary-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm">
                                                {grade.substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{grade}</p>
                                                <p className="text-xs text-gray-500">{students.filter(s => s.grade === grade).length} Students</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            {assignedId && (
                                                <div className="hidden sm:flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 size={12} /> Assigned
                                                </div>
                                            )}
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                    <UserCheck size={16} />
                                                </div>
                                                <select
                                                    value={assignedId}
                                                    onChange={(e) => handleAssignMaster(grade, e.target.value)}
                                                    className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-48 appearance-none"
                                                >
                                                    <option value="">-- Select Master --</option>
                                                    {teachers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            No active classes/grades found. Add students first.
                        </div>
                    )}
                 </div>

                 <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
                     <button 
                        onClick={() => setShowMasterModal(false)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                     >
                         Close
                     </button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};
