import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SchoolClassItem, TeacherAssignment, TimetableEntry, UserRole } from '../types';
import { Grid3x3, Download, Printer, Wand2, Trash2, Pencil, Eye, Plus, Lock } from 'lucide-react';
import { colorForString } from '../src/utils/colorHash';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';
import { createCsv } from '../src/utils/csv';

type ClassAssignment = TeacherAssignment & { teacherName?: string };

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];
const colorFor = (name: string) => colorForString(name || '', COLORS);
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

export const Timetable: React.FC = () => {
  const { effectiveSchoolId, user } = useAuth();
  const { toasts, toast, dismiss } = useToast();

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isTeacher = user?.role === UserRole.TEACHER;

  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [config, setConfig] = useState<{ days: number; periods: number }>({ days: 5, periods: 8 });
  const [classAssignments, setClassAssignments] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<'school' | 'mine'>('school');
  const [newSubject, setNewSubject] = useState('');

  const days = useMemo(() => Array.from({ length: config.days }, (_, i) => DAY_LABELS[i]), [config.days]);
  const periods = useMemo(() => Array.from({ length: config.periods }, (_, i) => i), [config.periods]);

  const reloadTimetable = useCallback(async () => {
    if (!effectiveSchoolId) return;
    setLoading(true);
    try {
      const res = await api.getTimetable(effectiveSchoolId);
      if (res.ok) {
        setEntries(res.data || []);
        if (res.config) setConfig(res.config);
      } else {
        toast.error(res.message || 'Failed to load timetable');
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveSchoolId]);

  useEffect(() => {
    if (!effectiveSchoolId) return;
    api.getSchoolClasses(effectiveSchoolId).then(res => {
      if (res.ok && res.data.length > 0) {
        setClasses(res.data);
        setSelectedClass(prev => prev || res.data[0].id);
      } else {
        setClasses([]);
      }
    });
    reloadTimetable();
  }, [effectiveSchoolId, reloadTimetable]);

  // Load the selected class's subject/teacher assignments (drives the editor).
  useEffect(() => {
    if (!selectedClass) { setClassAssignments([]); return; }
    api.getClassAssignments(selectedClass).then(res => { if (res.ok) setClassAssignments(res.data || []); });
  }, [selectedClass]);

  // entry lookup: classId|day|period
  const byClassSlot = useMemo(() => {
    const m = new Map<string, TimetableEntry>();
    entries.forEach(e => m.set(`${e.schoolClassId}|${e.day}|${e.period}`, e));
    return m;
  }, [entries]);

  // teacher's own lessons: day|period (their classes across the week)
  const myBySlot = useMemo(() => {
    const m = new Map<string, TimetableEntry>();
    if (!user?.id) return m;
    entries.filter(e => e.teacherId === user.id).forEach(e => m.set(`${e.day}|${e.period}`, e));
    return m;
  }, [entries, user?.id]);

  // unique subjects available to assign in the selected class
  const classSubjects = useMemo(() => {
    const seen = new Map<string, string>();
    classAssignments.forEach(a => { if (!seen.has(a.subjectId)) seen.set(a.subjectId, a.subjectName || a.subjectId); });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const handleGenerate = async () => {
    setBusy(true);
    const res = await api.generateTimetable(effectiveSchoolId || undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(`Timetable generated — ${res.data.placed} lessons across ${res.data.classes} classes`);
      reloadTimetable();
    } else {
      toast.error(res.message || 'Failed to generate timetable');
    }
  };

  const handleClear = async () => {
    setBusy(true);
    const res = await api.clearTimetable(effectiveSchoolId || undefined);
    setBusy(false);
    if (res.ok) { toast.success('Timetable cleared'); reloadTimetable(); }
    else toast.error(res.message || 'Failed to clear');
  };

  const handleSlotChange = async (day: number, period: number, subjectId: string | null) => {
    const res = await api.updateTimetableSlot(
      { schoolClassId: selectedClass, day, period, subjectId },
      effectiveSchoolId || undefined,
    );
    if (res.ok) {
      reloadTimetable();
    } else {
      toast.error(res.message || 'Could not update that slot');
    }
  };

  const handleAddSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    const res = await api.addSchoolSubject(name, effectiveSchoolId || undefined);
    if (res.ok) {
      setNewSubject('');
      toast.success(`"${name}" added. Assign a teacher to it in Teachers, then it can be scheduled.`);
    } else {
      toast.error(res.message || 'Failed to add subject');
    }
  };

  const className = classes.find(c => c.id === selectedClass)?.name || '';

  const printTimetable = () => {
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    const rows = days.map((day, di) => {
      const cells = periods.map(p => {
        const slot = byClassSlot.get(`${selectedClass}|${di}|${p}`);
        return `<td style="border:1px solid #ddd;padding:8px;text-align:center;font-size:12px;min-width:90px">${slot ? `<strong>${escapeHtml(slot.subjectName)}</strong><br><span style="color:#666;font-size:10px">${escapeHtml(slot.teacherName || '')}</span><br><span style="color:#666;font-size:10px">Room: ${escapeHtml(slot.room || 'Not set')}</span>` : '<span style="color:#ccc">—</span>'}</td>`;
      }).join('');
      return `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600;font-size:12px;white-space:nowrap">${day}</td>${cells}</tr>`;
    }).join('');
    w.document.write(`<html><head><title>Timetable — ${escapeHtml(className)}</title></head><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin-bottom:4px">Class Timetable — ${escapeHtml(className)}</h2>
      <p style="color:#888;font-size:12px;margin-bottom:16px">Generated ${new Date().toLocaleDateString()}</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="border:1px solid #ddd;padding:8px;text-align:left;font-size:12px">Day</th>${periods.map(p => `<th style="border:1px solid #ddd;padding:8px;font-size:12px">Period ${p + 1}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const exportCSV = () => {
    const rows = days.map((day, di) => {
      const cells = periods.map(p => {
        const s = byClassSlot.get(`${selectedClass}|${di}|${p}`);
        return s ? `${s.subjectName} (${s.teacherName || ''}) - Room: ${s.room || 'Not set'}` : '';
      });
      return [day, ...cells];
    });
    const csv = createCsv([['Day', ...periods.map(p => `Period ${p + 1}`)], ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timetable_${className.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!effectiveSchoolId) {
    return <div className="py-12 text-center text-gray-500">Select a school to view its timetable.</div>;
  }

  const showMine = isTeacher; // teachers get a personal tab

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Grid3x3 className="text-primary-600" size={24} /> Timetable
          </h1>
          <p className="text-gray-500 text-sm">
            {isAdmin
              ? 'Auto-generate a clash-free schedule, then fine-tune any slot.'
              : 'Your school schedule — read only.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={handleGenerate} disabled={busy}
                className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 disabled:opacity-50">
                <Wand2 size={15} /> {busy ? 'Working…' : 'Auto-generate'}
              </button>
              <button onClick={() => setEditMode(e => !e)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${editMode ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {editMode ? <Eye size={15} /> : <Pencil size={15} />} {editMode ? 'Done editing' : 'Edit'}
              </button>
              <button onClick={handleClear} disabled={busy}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={15} /> Clear
              </button>
            </>
          )}
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={15} /> CSV
          </button>
          <button onClick={printTimetable} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Tabs (teachers only) */}
      {showMine && (
        <div className="border-b border-gray-200 flex gap-6">
          <button onClick={() => setTab('school')}
            className={`pb-2.5 px-1 text-sm font-bold border-b-2 ${tab === 'school' ? 'border-primary-600 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            School Schedule
          </button>
          <button onClick={() => setTab('mine')}
            className={`pb-2.5 px-1 text-sm font-bold border-b-2 ${tab === 'mine' ? 'border-primary-600 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            My Timetable
          </button>
        </div>
      )}

      {/* Admin add-subject helper */}
      {isAdmin && editMode && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Plus size={15} className="text-amber-600" />
          <input
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
            placeholder="Add a subject your school offers (e.g. Yoruba, Agric Science)"
            className="flex-1 max-w-md text-sm border border-amber-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button onClick={handleAddSubject} className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700">Add</button>
          <span className="text-xs text-amber-700">then assign a teacher to it in Teachers</span>
        </div>
      )}

      {/* SCHOOL SCHEDULE */}
      {(!showMine || tab === 'school') && (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="tt-class" className="text-sm font-medium text-gray-700">Class:</label>
            <select id="tt-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="" disabled>Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
            {!isAdmin && <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400"><Lock size={12} /> read only</span>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Day</th>
                  {periods.map(p => (
                    <th key={p} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">
                      Period {p + 1}{p <= 2 && <span className="block text-[9px] text-primary-400 normal-case">priority window</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map((day, di) => (
                  <tr key={day} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-100">{day}</td>
                    {periods.map(p => {
                      const slot = byClassSlot.get(`${selectedClass}|${di}|${p}`);
                      if (isAdmin && editMode) {
                        return (
                          <td key={p} className="px-1.5 py-1.5 text-center align-middle">
                            <select
                              value={slot?.subjectId || ''}
                              onChange={e => handleSlotChange(di, p, e.target.value || null)}
                              className={`w-full text-xs rounded border px-1 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 ${slot ? slot.subjectName ? colorFor(slot.subjectName) : 'bg-white border-gray-200' : 'bg-white border-gray-200 text-gray-400'}`}
                            >
                              <option value="">— Free —</option>
                              {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {slot && <span className="block mt-1 text-[10px] text-gray-500">Room: {slot.room || 'Not set'}</span>}
                          </td>
                        );
                      }
                      return (
                        <td key={p} className="px-2 py-2 text-center align-middle">
                          {slot ? (
                            <div className={`inline-flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs w-full ${colorFor(slot.subjectName)}`}>
                              <span className="font-semibold leading-tight">{slot.subjectName}</span>
                              <span className="text-[10px] opacity-70 truncate max-w-[110px]">{slot.teacherName || '—'}</span>
                              <span className="text-[10px] opacity-70" title={slot.room}>Room: {slot.room || 'Not set'}</span>
                            </div>
                          ) : <span className="text-gray-200 text-lg">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && entries.length === 0 && (
            <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
              <Grid3x3 size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No timetable yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                {isAdmin ? 'Assign teachers to subjects/classes, then click Auto-generate.' : 'Your school has not published a timetable yet.'}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            The scheduler keeps every teacher clash-free and places Mathematics & English Language in the first three periods (period 4 only if unavoidable).
          </p>
        </>
      )}

      {/* MY TIMETABLE (teacher) */}
      {showMine && tab === 'mine' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Day</th>
                {periods.map(p => (
                  <th key={p} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">Period {p + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {days.map((day, di) => (
                <tr key={day} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-100">{day}</td>
                  {periods.map(p => {
                    const slot = myBySlot.get(`${di}|${p}`);
                    return (
                      <td key={p} className="px-2 py-2 text-center align-middle">
                        {slot ? (
                          <div className={`inline-flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs w-full ${colorFor(slot.subjectName)}`}>
                            <span className="font-semibold leading-tight">{slot.subjectName}</span>
                            <span className="text-[10px] opacity-70 truncate max-w-[110px]">{slot.className}</span>
                            <span className="text-[10px] opacity-70" title={slot.room}>Room: {slot.room || 'Not set'}</span>
                          </div>
                        ) : <span className="text-gray-200 text-lg">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-gray-400">Your personal teaching schedule across all your classes this week.</p>
        </div>
      )}
    </div>
  );
};
