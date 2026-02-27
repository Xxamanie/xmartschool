
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { GraduatedStudent, Student, UserRole, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { StudentForm } from '../components/StudentForm';
import { Search, Filter, MoreHorizontal, Plus, ArrowUp, ArrowDown, ArrowUpDown, Calendar, Crown, X, UserCheck, CheckCircle2, Trash2, Edit } from 'lucide-react';

export const Students: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const [searchParams, setSearchParams] = useSearchParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [formMasters, setFormMasters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionTerm, setPromotionTerm] = useState('Term 3');
  const [promotionYear, setPromotionYear] = useState(new Date().getFullYear());
  const [graduatingInput, setGraduatingInput] = useState('Primary 5, JSS 3, SSS 3');
  const [promotionSummary, setPromotionSummary] = useState<{ promoted: number; graduated: number; skipped: number } | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [showGraduatedModal, setShowGraduatedModal] = useState(false);
  const [graduatedStudents, setGraduatedStudents] = useState<GraduatedStudent[]>([]);
  const [graduatedLevel, setGraduatedLevel] = useState('All');
  const [graduatedTerm, setGraduatedTerm] = useState('');
  const [graduatedYear, setGraduatedYear] = useState<number | ''>(new Date().getFullYear());
  
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
          // Filter students based on user role
          let filteredStudents = response.data;
          if (user?.role === UserRole.TEACHER) {
            // Teachers only see students from classes they are assigned to teach
            // For now, we'll show all students but this can be enhanced with class assignments
            filteredStudents = response.data;
          }
          setStudents(filteredStudents);
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
  }, [user]);

  useEffect(() => {
    const quick = searchParams.get('quick');
    if (!quick) return;
    if (quick === 'create-student' && isAdmin) {
      setShowAddModal(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('quick');
    setSearchParams(next, { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

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
          s.grade.toLowerCase().includes(term) ||
          (s.house || '').toLowerCase().includes(term)
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

  const handleAddStudent = async (studentData: Omit<Student, 'id' | 'enrollmentDate'>) => {
      try {
          const payload = {
            ...studentData,
            schoolId: studentData.schoolId || user?.schoolId,
          };
          const response = await api.createStudent(payload);
          setStudents(prev => [...prev, response.data]);
          setShowAddModal(false);
          alert(response.message || 'Student added successfully!');
      } catch (e) {
          console.error("Failed to add student", e);
          alert(`Error adding student: ${(e as any)?.message || 'Unknown error'}`);
      }
  };

  const handleEditStudent = async (studentData: Partial<Student>) => {
      if (!editingStudent) return;
      try {
          const response = await api.updateStudent(editingStudent.id, studentData);
          setStudents(prev => prev.map(s => s.id === editingStudent.id ? response.data : s));
          setEditingStudent(null);
          alert('Student updated successfully!');
      } catch (e) {
          console.error("Failed to update student", e);
          alert(`Error updating student: ${(e as any)?.message || 'Unknown error'}`);
      }
  };

  const handleDeleteStudent = async () => {
      if (!deleteConfirm) return;
      try {
          await api.deleteStudent(deleteConfirm.id);
          setStudents(prev => prev.filter(s => s.id !== deleteConfirm.id));
          setDeleteConfirm(null);
          alert('Student deleted successfully!');
      } catch (e) {
          console.error("Failed to delete student", e);
          alert(`Error deleting student: ${(e as any)?.message || 'Unknown error'}`);
      }
  };

  const handleBulkDelete = async () => {
      if (selectedStudents.size === 0) return;
      try {
          await Promise.all((Array.from(selectedStudents) as string[]).map(id => api.deleteStudent(id)));
          setStudents(prev => prev.filter(s => !selectedStudents.has(s.id)));
          setSelectedStudents(new Set<string>());
          setBulkDeleteMode(false);
          alert('Students deleted successfully!');
      } catch (e) {
          console.error("Failed to delete students", e);
          alert(`Error deleting students: ${(e as any)?.message || 'Unknown error'}`);
      }
  };

  const toggleStudentSelection = (studentId: string) => {
      setSelectedStudents(prev => {
          const newSet = new Set(prev);
          if (newSet.has(studentId)) {
              newSet.delete(studentId);
          } else {
              newSet.add(studentId);
          }
          return newSet;
      });
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

  const loadGraduatedStudents = async () => {
    try {
      const response = await api.getGraduatedStudents({
        schoolId: user?.schoolId,
        level: graduatedLevel === 'All' ? undefined : graduatedLevel,
        term: graduatedTerm || undefined,
        year: typeof graduatedYear === 'number' ? graduatedYear : undefined,
      });
      if (response.ok) {
        setGraduatedStudents(response.data);
      }
    } catch (error) {
      console.error('Failed to load graduated students', error);
    }
  };

  const handlePromoteStudents = async () => {
    setPromotionLoading(true);
    try {
      const graduatingGrades = graduatingInput
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const response = await api.promoteStudents({
        schoolId: user?.schoolId,
        term: promotionTerm,
        year: promotionYear,
        graduatingGrades,
      });

      if (response.ok) {
        setPromotionSummary(response.data);
        const studentsRes = await api.getStudents(user?.schoolId);
        if (studentsRes.ok) {
          setStudents(studentsRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to promote students', error);
      alert(`Promotion failed: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setPromotionLoading(false);
    }
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
                <button
                    onClick={() => {
                      setPromotionSummary(null);
                      setShowPromotionModal(true);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                >
                    Promote Students
                </button>
                <button
                    onClick={() => {
                      setShowGraduatedModal(true);
                      loadGraduatedStudents();
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                >
                    Graduation Archive
                </button>
                <button className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm" onClick={() => setShowAddModal(true)}>
                    <Plus size={16} className="mr-2" /> Add Student
                </button>
                <button 
                    onClick={() => setBulkDeleteMode(!bulkDeleteMode)}
                    className={`inline-flex items-center justify-center px-4 py-2 border rounded-lg transition-colors text-sm font-medium shadow-sm ${
                        bulkDeleteMode 
                            ? 'bg-red-600 text-white hover:bg-red-700 border-red-600' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Trash2 size={16} className="mr-2" /> 
                    {bulkDeleteMode ? 'Cancel' : 'Delete'}
                </button>
                {bulkDeleteMode && selectedStudents.size > 0 && (
                    <button 
                        onClick={handleBulkDelete}
                        className="inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                    >
                        Delete {selectedStudents.size} Selected
                    </button>
                )}
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

      {bulkDeleteMode && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 size={20} className="text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-red-600">
                  Choose students to delete or cancel to exit delete mode
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedStudents.size > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Delete {selectedStudents.length} Selected
                </button>
              )}
              <button 
                onClick={() => {
                  setBulkDeleteMode(false);
                  setSelectedStudents(new Set());
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {bulkDeleteMode && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedStudents.size === processedStudents.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents(new Set(processedStudents.map(s => s.id)));
                        } else {
                          setSelectedStudents(new Set());
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                )}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  House
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
                    {bulkDeleteMode && <td className="px-6 py-4"><div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div></td>}
                    <td colSpan={9} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : processedStudents.length > 0 ? (
                processedStudents.map((student) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-gray-50 transition-colors ${selectedStudents.has(student.id) ? 'bg-red-50' : ''}`}
                  >
                    {bulkDeleteMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
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
                      {student.house || 'Unassigned'}
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
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => setEditingStudent(student)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit student"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(student)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete student"
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
                  <td
                    colSpan={bulkDeleteMode ? 10 : 9}
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

      {/* Promotion Modal */}
      {showPromotionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Promote Students</h2>
                <p className="text-sm text-gray-500">Move students to the next class and archive graduating lists.</p>
              </div>
              <button onClick={() => setShowPromotionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={promotionTerm}
                  onChange={(e) => setPromotionTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Graduating classes are archived only in Term 3.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={promotionYear}
                  onChange={(e) => setPromotionYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Graduating Classes (comma-separated)</label>
                <input
                  type="text"
                  value={graduatingInput}
                  onChange={(e) => setGraduatingInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {promotionSummary && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                  <p><strong>{promotionSummary.promoted}</strong> promoted</p>
                  <p><strong>{promotionSummary.graduated}</strong> archived as graduates</p>
                  <p><strong>{promotionSummary.skipped}</strong> skipped (no next class mapping)</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setShowPromotionModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
                disabled={promotionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handlePromoteStudents}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                disabled={promotionLoading}
              >
                {promotionLoading ? 'Promoting...' : 'Run Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graduation Archive Modal */}
      {showGraduatedModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Graduation Archive</h2>
                <p className="text-sm text-gray-500">View graduating students by level.</p>
              </div>
              <button onClick={() => setShowGraduatedModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={graduatedLevel}
                  onChange={(e) => setGraduatedLevel(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="All">All Levels</option>
                  <option value="Primary">Primary</option>
                  <option value="Junior Secondary">Junior Secondary</option>
                  <option value="Senior Secondary">Senior Secondary</option>
                </select>
                <input
                  type="text"
                  value={graduatedTerm}
                  onChange={(e) => setGraduatedTerm(e.target.value)}
                  placeholder="Term (optional)"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="number"
                  value={graduatedYear}
                  onChange={(e) => setGraduatedYear(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Year"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={loadGraduatedStudents}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
              >
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {graduatedStudents.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">House</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {graduatedStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-3 text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 text-gray-600">{student.grade}</td>
                        <td className="px-4 py-3 text-gray-600">{student.house || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-gray-600">{student.level}</td>
                        <td className="px-4 py-3 text-gray-600">{student.term}</td>
                        <td className="px-4 py-3 text-gray-600">{student.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-500">No graduates found for the selected filters.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingStudent ? 'Update student information.' : 'Enter details to enroll a new student.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStudent(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <StudentForm
              student={editingStudent}
              onSubmit={editingStudent ? handleEditStudent : handleAddStudent}
              onCancel={() => {
                setShowAddModal(false);
                setEditingStudent(null);
              }}
            />
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
                Delete Student
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
                  Grade: {deleteConfirm.grade} • ID: {deleteConfirm.id}
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
                onClick={handleDeleteStudent}
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
