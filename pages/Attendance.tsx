import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Student, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, AlertCircle, Save, Loader2, Users, Filter } from 'lucide-react';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load Students
        const studentsRes = await api.getStudents();
        if (studentsRes.ok) {
            setStudents(studentsRes.data);
            // Default to first available grade if not set
            if (!selectedGrade && studentsRes.data.length > 0) {
                const grades = Array.from(new Set(studentsRes.data.map(s => s.grade))).sort();
                if (grades.length > 0) setSelectedGrade(grades[0]);
            }
        }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
    };
    loadData();
  }, []);

  // Load attendance when grade or date changes
  useEffect(() => {
      if (!selectedGrade) return;

      const loadAttendance = async () => {
          try {
              const res = await api.getAttendance(selectedDate, selectedGrade);
              if (res.ok) {
                  const map: Record<string, any> = {};
                  // Default everyone to 'Present' if no record exists yet, otherwise load record
                  const filteredStudents = students.filter(s => s.grade === selectedGrade);
                  filteredStudents.forEach(s => {
                      const record = res.data.find(r => r.studentId === s.id);
                      map[s.id] = record ? record.status : 'Present';
                  });
                  setAttendanceMap(map);
              }
          } catch (e) {
              console.error(e);
          }
      };
      loadAttendance();
  }, [selectedGrade, selectedDate, students]);

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused') => {
      setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
      setSaving(true);
      setSuccessMsg('');
      try {
          const updates = Object.entries(attendanceMap).map(([studentId, status]) => ({
              studentId,
              status: status as 'Present' | 'Absent' | 'Late' | 'Excused',
              date: selectedDate
          }));
          
          await api.markAttendance(updates);
          setSuccessMsg('Attendance saved successfully');
          setTimeout(() => setSuccessMsg(''), 3000);
      } catch (e) {
          console.error(e);
      } finally {
          setSaving(false);
      }
  };

  const filteredStudents = useMemo(() => {
      return students.filter(s => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedGrade]);

  const uniqueGrades = useMemo(() => {
      return Array.from(new Set(students.map(s => s.grade))).sort();
  }, [students]);

  const stats = useMemo(() => {
      const total = filteredStudents.length;
      if (total === 0) return { present: 0, absent: 0, late: 0 };
      
      let present = 0, absent = 0, late = 0;
      Object.values(attendanceMap).forEach(status => {
          if (status === 'Present') present++;
          if (status === 'Absent') absent++;
          if (status === 'Late') late++;
      });
      
      return { present, absent, late };
  }, [attendanceMap, filteredStudents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
          <p className="text-gray-500">Mark and track student attendance records.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
            <button 
                onClick={handleSave}
                disabled={saving || filteredStudents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-70"
            >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Register
            </button>
        </div>
      </div>

      {/* Filters & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                 <Filter size={16} /> Configuration
             </h3>
             <div className="space-y-3">
                 <div>
                     <label className="block text-xs font-medium text-gray-500 mb-1">Select Class</label>
                     <select 
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                     >
                         <option value="" disabled>Select a Class</option>
                         {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                     </select>
                 </div>
                 <div>
                     <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                     <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                     />
                 </div>
             </div>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-4">
                 <Users size={16} /> Class Summary: {selectedGrade}
             </h3>
             <div className="grid grid-cols-3 gap-4">
                 <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                     <p className="text-xs text-green-600 font-bold uppercase">Present</p>
                     <p className="text-2xl font-bold text-green-700">{stats.present}</p>
                 </div>
                 <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                     <p className="text-xs text-red-600 font-bold uppercase">Absent</p>
                     <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
                 </div>
                 <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                     <p className="text-xs text-yellow-600 font-bold uppercase">Late</p>
                     <p className="text-2xl font-bold text-yellow-700">{stats.late}</p>
                 </div>
             </div>
             {successMsg && (
                 <div className="mt-4 p-2 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-2 animate-in fade-in">
                     <CheckCircle2 size={14} /> {successMsg}
                 </div>
             )}
          </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Student Name</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Excused</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                      [1,2,3,4].map(i => (
                          <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-6 bg-gray-100 rounded w-full animate-pulse"></div></td></tr>
                      ))
                  ) : filteredStudents.length > 0 ? (
                      filteredStudents.map(student => {
                          const status = attendanceMap[student.id] || 'Present';
                          return (
                              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs mr-3">
                                              {student.name.charAt(0)}
                                          </div>
                                          <div>
                                              <div className="text-sm font-bold text-gray-900">{student.name}</div>
                                              <div className="text-xs text-gray-500">{student.accessCode}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button 
                                        onClick={() => handleStatusChange(student.id, 'Present')}
                                        className={`p-2 rounded-full transition-all ${status === 'Present' ? 'bg-green-100 text-green-600 ring-2 ring-green-500 ring-offset-1' : 'text-gray-300 hover:bg-gray-100'}`}
                                      >
                                          <CheckCircle2 size={20} fill={status === 'Present' ? 'currentColor' : 'none'} />
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button 
                                        onClick={() => handleStatusChange(student.id, 'Absent')}
                                        className={`p-2 rounded-full transition-all ${status === 'Absent' ? 'bg-red-100 text-red-600 ring-2 ring-red-500 ring-offset-1' : 'text-gray-300 hover:bg-gray-100'}`}
                                      >
                                          <XCircle size={20} fill={status === 'Absent' ? 'currentColor' : 'none'} />
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button 
                                        onClick={() => handleStatusChange(student.id, 'Late')}
                                        className={`p-2 rounded-full transition-all ${status === 'Late' ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-500 ring-offset-1' : 'text-gray-300 hover:bg-gray-100'}`}
                                      >
                                          <Clock size={20} fill={status === 'Late' ? 'currentColor' : 'none'} />
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button 
                                        onClick={() => handleStatusChange(student.id, 'Excused')}
                                        className={`p-2 rounded-full transition-all ${status === 'Excused' ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-1' : 'text-gray-300 hover:bg-gray-100'}`}
                                      >
                                          <AlertCircle size={20} fill={status === 'Excused' ? 'currentColor' : 'none'} />
                                      </button>
                                  </td>
                              </tr>
                          );
                      })
                  ) : (
                      <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                              No students found in this class.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
};