
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Student, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Layers, Search, ChevronRight, UserPlus, X, GraduationCap, Users } from 'lucide-react';

// Class Constants
const PRIMARY_CLASSES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
const JSS_LEVELS = ["JSS 1", "JSS 2", "JSS 3"];
const SSS_LEVELS = ["SSS 1", "SSS 2", "SSS 3"];
const ARMS = ["A", "B", "C", "D"];

export const Classes: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [activeTab, setActiveTab] = useState<'primary' | 'junior' | 'senior'>('junior');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Helper to generate full class lists
  const getClassesForTab = (tab: string) => {
    if (tab === 'primary') return PRIMARY_CLASSES;
    if (tab === 'junior') {
        return JSS_LEVELS.flatMap(level => ARMS.map(arm => `${level}${arm}`));
    }
    if (tab === 'senior') {
        return SSS_LEVELS.flatMap(level => ARMS.map(arm => `${level}${arm}`));
    }
    return [];
  };

  const currentClasses = useMemo(() => getClassesForTab(activeTab), [activeTab]);

  const fetchData = async () => {
    try {
        const response = await api.getStudents();
        if (response.ok) {
            setStudents(response.data);
        }
    } catch (error) {
        console.error("Failed to fetch students", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStudentCount = (className: string) => {
      return students.filter(s => s.grade === className).length;
  };

  const handleEnrollStudent = async (studentId: string) => {
      if (!selectedClass) return;
      try {
          const res = await api.updateStudent(studentId, { grade: selectedClass });
          if (res.ok) {
              setStudents(prev => prev.map(s => s.id === studentId ? { ...s, grade: selectedClass } : s));
          }
      } catch (e) {
          console.error("Failed to enroll student", e);
      }
  };

  // Filter students for the enrollment modal (exclude those already in the selected class)
  const studentsAvailableForEnrollment = useMemo(() => {
      if (!showEnrollModal || !selectedClass) return [];
      return students.filter(s => {
          const notInClass = s.grade !== selectedClass;
          const matchesSearch = s.name.toLowerCase().includes(enrollSearchTerm.toLowerCase()) || 
                                (s.grade || '').toLowerCase().includes(enrollSearchTerm.toLowerCase());
          return notInClass && matchesSearch;
      }).slice(0, 50); // Limit results for performance
  }, [students, showEnrollModal, selectedClass, enrollSearchTerm]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
        <p className="text-gray-500">Organize students into specific grades and arms.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => { setActiveTab('primary'); setSelectedClass(null); }}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'primary' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              Primary (1-6)
          </button>
          <button 
            onClick={() => { setActiveTab('junior'); setSelectedClass(null); }}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'junior' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              Junior Secondary (JSS 1-3)
          </button>
          <button 
            onClick={() => { setActiveTab('senior'); setSelectedClass(null); }}
            className={`pb-3 px-1 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'senior' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              Senior Secondary (SSS 1-3)
          </button>
      </div>

      {/* Grid of Classes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {currentClasses.map((className) => {
              const count = getStudentCount(className);
              const isSelected = selectedClass === className;
              return (
                  <button 
                    key={className}
                    onClick={() => setSelectedClass(className)}
                    className={`p-4 rounded-xl border text-left transition-all hover:shadow-md relative overflow-hidden group ${isSelected ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-gray-200 hover:border-primary-300'}`}
                  >
                      <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-white text-primary-600' : 'bg-gray-100 text-gray-600 group-hover:bg-primary-50 group-hover:text-primary-600'}`}>
                              <Layers size={18} />
                          </div>
                          {count > 0 && (
                             <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {count}
                             </span>
                          )}
                      </div>
                      <h3 className="text-base font-bold text-gray-900">{className}</h3>
                      <p className="text-xs text-gray-500 mt-1">{count === 0 ? 'Empty' : 'Students'}</p>
                  </button>
              );
          })}
      </div>

      {/* Detail View / Management Section */}
      {selectedClass && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 rounded-t-xl">
                  <div>
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <GraduationCap className="text-primary-600" size={20} />
                          {selectedClass} Class List
                      </h2>
                      <p className="text-sm text-gray-500">Manage students enrolled in this class.</p>
                  </div>
                  {isAdmin && (
                      <button 
                        onClick={() => setShowEnrollModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
                      >
                          <UserPlus size={16} />
                          Enroll Student
                      </button>
                  )}
              </div>
              
              <div className="p-0 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-white">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {students.filter(s => s.grade === selectedClass).length > 0 ? (
                              students.filter(s => s.grade === selectedClass).map(student => (
                                  <tr key={student.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xs mr-3">
                                                  {student.name.charAt(0)}
                                              </div>
                                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              student.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                              student.status === 'Inactive' ? 'bg-gray-100 text-gray-800' : 
                                              'bg-red-100 text-red-800'
                                          }`}>
                                              {student.status}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                          <button className="text-gray-400 hover:text-primary-600">
                                              <ChevronRight size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              ))
                          ) : (
                              <tr>
                                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                      <div className="flex flex-col items-center justify-center">
                                          <Users size={40} className="text-gray-300 mb-2" />
                                          <p>No students currently enrolled in {selectedClass}.</p>
                                      </div>
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Enroll Students</h3>
                        <p className="text-sm text-gray-500">Target Class: <span className="font-bold text-primary-600">{selectedClass}</span></p>
                    </div>
                    <button onClick={() => setShowEnrollModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search students by name or current grade..."
                            value={enrollSearchTerm}
                            onChange={(e) => setEnrollSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {studentsAvailableForEnrollment.length > 0 ? (
                        <div className="space-y-1">
                            {studentsAvailableForEnrollment.map(student => (
                                <div key={student.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg group transition-colors border border-transparent hover:border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">
                                            {student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{student.name}</p>
                                            <p className="text-xs text-gray-500">Current: <span className="font-medium text-gray-700">{student.grade}</span></p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleEnrollStudent(student.id)}
                                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-xs font-bold hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all shadow-sm"
                                    >
                                        Move Here
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <Search size={32} className="mx-auto mb-3 text-gray-300" />
                            <p>{enrollSearchTerm ? 'No matching students found.' : 'Start typing to find students...'}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl text-right">
                    <button 
                        onClick={() => setShowEnrollModal(false)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
