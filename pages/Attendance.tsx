import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Student, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { createCsv } from '../src/utils/csv';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, AlertCircle, Save, Loader2, Users, Filter, BarChart2, Download } from 'lucide-react';

// ── Termly Report ────────────────────────────────────────────────────────────

interface TermSummary {
  studentId: string;
  name: string;
  grade: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  pct: number;
}

const TermlyReport: React.FC<{ students: Student[] }> = ({ students }) => {
  const [summaries, setSummaries] = useState<TermSummary[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');

  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort(), [students]);

  useEffect(() => {
    setSelectedGrade(current => uniqueGrades.includes(current) ? current : uniqueGrades[0] ?? '');
  }, [uniqueGrades]);

  useEffect(() => {
    let active = true;
    setSummaries([]);
    setReportError('');
    const gradeStudents = students.filter(s => s.grade === selectedGrade);
    if (!selectedGrade || gradeStudents.length === 0) { setLoadingReport(false); return; }

    setLoadingReport(true);
    api.getAttendanceSummaries(gradeStudents.map(s => s.id), true).then(res => {
      if (!active) return;
      if (res.ok) {
        const rows: TermSummary[] = gradeStudents.map(s => {
          const raw = res.data[s.id];
          const present = raw?.present ?? 0;
          const total = raw?.total ?? 0;
          const absent = raw?.absent ?? 0;
          const late = raw?.late ?? 0;
          const excused = raw?.excused ?? 0;
          return {
            studentId: s.id,
            name: s.name,
            grade: s.grade,
            present,
            absent,
            late,
            excused,
            total,
            pct: total > 0 ? Math.round((present / total) * 100) : 0,
          };
        });
        setSummaries(rows.sort((a, b) => b.pct - a.pct));
      } else { setSummaries([]); setReportError(res.message || 'Could not load termly attendance'); }
    }).catch(() => {
      if (active) { setSummaries([]); setReportError('Could not load termly attendance'); }
    }).finally(() => { if (active) setLoadingReport(false); });
    return () => { active = false; };
  }, [selectedGrade, students]);

  const exportCSV = () => {
    const csv = createCsv([
      ['Name', 'Grade', 'Present', 'Absent', 'Late', 'Excused', 'Total Days', 'Attendance %'],
      ...summaries.map(s => [s.name, s.grade, s.present, s.absent, s.late, s.excused, s.total, `${s.pct}%`]),
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_report_${selectedGrade.replace(/\s+/g, '_')}.csv`;
    link.hidden = true;
    document.body.appendChild(link);
    try { link.click(); }
    finally { link.remove(); URL.revokeObjectURL(url); }
  };

  return (
    <div className="space-y-5">
      {reportError && <p role="alert" className="text-red-600">{reportError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <select
          id="report-class"
          name="report-class"
          value={selectedGrade}
          onChange={e => { setSummaries([]); setSelectedGrade(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="" disabled>Select class</option>
          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button
          onClick={exportCSV}
          disabled={loadingReport || summaries.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Present</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Absent</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Late</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Excused</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Attendance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loadingReport ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-5 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : summaries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                  No attendance data yet for {selectedGrade}.
                </td>
              </tr>
            ) : summaries.map(s => (
              <tr key={s.studentId} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-center text-sm text-green-700 font-semibold">{s.present}</td>
                <td className="px-4 py-3 text-center text-sm text-red-600 font-semibold">{s.absent}</td>
                <td className="px-4 py-3 text-center text-sm text-amber-600 font-semibold">{s.late}</td>
                <td className="px-4 py-3 text-center text-sm text-blue-600 font-semibold">{s.excused}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-500">{s.total}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                      <div
                        className={`h-2 rounded-full ${s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${s.pct >= 75 ? 'text-emerald-600' : s.pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.pct}%
                    </span>
                    {s.pct < 75 && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">LOW</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summaries.length > 0 && (
        <p className="text-xs text-gray-400">
          Flagged in red: students below 75% attendance threshold.
        </p>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'register' | 'report'>('register');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const studentsRes = await api.getStudents();
        if (studentsRes.ok) {
          setStudents(studentsRes.data);
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

  useEffect(() => {
    if (!selectedGrade) return;
    const loadAttendance = async () => {
      try {
        const res = await api.getAttendance(selectedDate, selectedGrade);
        if (res.ok) {
          const map: Record<string, any> = {};
          students.filter(s => s.grade === selectedGrade).forEach(s => {
            const record = res.data.find((r: any) => r.studentId === s.id);
            map[s.id] = record ? record.status : 'Present';
          });
          setAttendanceMap(map);
        }
      } catch (e) { console.error(e); }
    };
    loadAttendance();
  }, [selectedGrade, selectedDate, students]);

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused') =>
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));

  const handleSave = async () => {
    setSaving(true); setSuccessMsg('');
    try {
      const updates = Object.entries(attendanceMap).map(([studentId, status]) => ({
        studentId, status: status as any, date: selectedDate,
      }));
      await api.markAttendance(updates);
      setSuccessMsg('Attendance saved successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const filteredStudents = useMemo(() =>
    students.filter(s => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name)),
    [students, selectedGrade]);

  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort(), [students]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, late = 0, excused = 0;
    Object.values(attendanceMap).forEach(s => {
      if (s === 'Present') present++;
      else if (s === 'Absent') absent++;
      else if (s === 'Late') late++;
      else if (s === 'Excused') excused++;
    });
    return { present, absent, late, excused };
  }, [attendanceMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500">Mark daily registers and view termly attendance reports.</p>
        </div>
        {activeTab === 'register' && (
          <button
            onClick={handleSave}
            disabled={saving || filteredStudents.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Register
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-gray-100 p-1 rounded-lg flex items-center self-start gap-0.5 w-fit">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CalendarIcon size={15} /> Daily Register
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'report' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BarChart2 size={15} /> Termly Report
        </button>
      </div>

      {activeTab === 'report' && <TermlyReport students={students} />}

      {activeTab === 'register' && (
        <>
          {/* Filters & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Filter size={16} /> Configuration
              </h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="attendance-class" className="block text-xs font-medium text-gray-500 mb-1">Select Class</label>
                  <select
                    id="attendance-class"
                    name="attendance-class"
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="" disabled>Select a Class</option>
                    {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="attendance-date" className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input
                    id="attendance-date"
                    name="attendance-date"
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-4">
                <Users size={16} /> Class Summary: {selectedGrade}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 font-bold uppercase">Excused</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.excused}</p>
                </div>
              </div>
              {successMsg && (
                <div className="mt-4 p-2 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={14} /> {successMsg}
                </div>
              )}
            </div>
          </div>

          {/* Student register table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Student</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Excused</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-6 bg-gray-100 rounded w-full animate-pulse" /></td></tr>
                  ))
                ) : filteredStudents.length > 0 ? filteredStudents.map(student => {
                  const status = attendanceMap[student.id] || 'Present';
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.accessCode}</p>
                          </div>
                        </div>
                      </td>
                      {(['Present', 'Absent', 'Late', 'Excused'] as const).map(s => (
                        <td key={s} className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleStatusChange(student.id, s)}
                            className={`p-2 rounded-full transition-all ${status === s
                              ? s === 'Present' ? 'bg-green-100 text-green-600 ring-2 ring-green-500 ring-offset-1'
                              : s === 'Absent' ? 'bg-red-100 text-red-600 ring-2 ring-red-500 ring-offset-1'
                              : s === 'Late' ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-500 ring-offset-1'
                              : 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-1'
                              : 'text-gray-300 hover:bg-gray-100'}`}
                          >
                            {s === 'Present' && <CheckCircle2 size={20} fill={status === s ? 'currentColor' : 'none'} />}
                            {s === 'Absent' && <XCircle size={20} fill={status === s ? 'currentColor' : 'none'} />}
                            {s === 'Late' && <Clock size={20} fill={status === s ? 'currentColor' : 'none'} />}
                            {s === 'Excused' && <AlertCircle size={20} fill={status === s ? 'currentColor' : 'none'} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No students found in this class.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
