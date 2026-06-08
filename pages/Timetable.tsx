import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SchoolClassItem, TeacherAssignment } from '../types';
import { Grid3x3, Download, Printer } from 'lucide-react';

type ClassAssignment = TeacherAssignment & { teacherName?: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'];

interface Slot {
  subjectName: string;
  teacherName: string;
  color: string;
}

type TimetableGrid = Record<string, Record<string, Slot | null>>; // day → period → slot

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

const colorForSubject = (name: string) => COLORS[
  [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLORS.length
];

// Deterministic "timetable" generated from TeacherAssignment data.
// Since no explicit scheduling DB exists yet, we distribute subjects evenly across the week.
const buildGrid = (
  assignments: ClassAssignment[],
): TimetableGrid => {
  const grid: TimetableGrid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    PERIODS.forEach(p => { grid[d][p] = null; });
  });

  let cursor = 0;
  const used = new Set<string>(); // day|period already assigned

  for (const a of assignments) {
    // Spread each subject across 2 different days per week
    let placed = 0;
    for (let attempt = 0; attempt < DAYS.length * PERIODS.length && placed < 2; attempt++) {
      const day = DAYS[cursor % DAYS.length];
      const period = PERIODS[Math.floor(cursor / DAYS.length) % PERIODS.length];
      const key = `${day}|${period}`;
      if (!used.has(key) && !grid[day][period]) {
        grid[day][period] = {
          subjectName: a.subjectName || a.subjectId,
          teacherName: a.teacherName || 'Staff',
          color: colorForSubject(a.subjectName || a.subjectId),
        };
        used.add(key);
        placed++;
      }
      cursor++;
    }
  }

  return grid;
};

export const Timetable: React.FC = () => {
  const { effectiveSchoolId } = useAuth();

  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!effectiveSchoolId) return;
    api.getSchoolClasses(effectiveSchoolId).then(res => {
      if (res.ok) {
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClass(res.data[0].id);
      }
    });
  }, [effectiveSchoolId]);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    // Single request — backend returns all assignments for this class including teacher names
    api.getClassAssignments(selectedClass)
      .then(res => { if (res.ok) setAssignments(res.data); })
      .finally(() => setLoading(false));
  }, [selectedClass]);

  const grid = useMemo(() => buildGrid(assignments), [assignments]);

  const printTimetable = () => {
    const className = classes.find(c => c.id === selectedClass)?.name || selectedClass;
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    let rows = DAYS.map(day => {
      const cells = PERIODS.map(p => {
        const slot = grid[day]?.[p];
        return `<td style="border:1px solid #ddd;padding:8px;text-align:center;font-size:12px;min-width:90px">${slot ? `<strong>${slot.subjectName}</strong><br><span style="color:#666;font-size:10px">${slot.teacherName}</span>` : '<span style="color:#ccc">—</span>'}</td>`;
      }).join('');
      return `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600;font-size:12px;white-space:nowrap">${day}</td>${cells}</tr>`;
    }).join('');
    w.document.write(`<html><head><title>Timetable — ${className}</title></head><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin-bottom:4px">Class Timetable — ${className}</h2>
      <p style="color:#888;font-size:12px;margin-bottom:16px">Generated ${new Date().toLocaleDateString()}</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="border:1px solid #ddd;padding:8px;text-align:left;font-size:12px">Day</th>${PERIODS.map(p => `<th style="border:1px solid #ddd;padding:8px;font-size:12px">${p}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  const exportCSV = () => {
    const className = classes.find(c => c.id === selectedClass)?.name || '';
    const header = ['Day', ...PERIODS].join(',') + '\n';
    const rows = DAYS.map(day => {
      const cells = PERIODS.map(p => {
        const s = grid[day]?.[p];
        return s ? `"${s.subjectName} (${s.teacherName})"` : '""';
      });
      return [day, ...cells].join(',');
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timetable_${className.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
          <p className="text-gray-500 text-sm">
            Weekly class schedule derived from teacher subject assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={assignments.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={printTimetable}
            disabled={assignments.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="timetable-class" className="text-sm font-medium text-gray-700">Class:</label>
        <select
          id="timetable-class" name="timetable-class"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="" disabled>Select class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {/* Grid */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Day</th>
                {PERIODS.map(p => (
                  <th key={p} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-100">{day}</td>
                  {PERIODS.map(period => {
                    const slot = grid[day]?.[period] ?? null;
                    return (
                      <td key={period} className="px-2 py-2 text-center align-middle">
                        {slot ? (
                          <div className={`inline-flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs w-full ${slot.color}`}>
                            <span className="font-semibold leading-tight">{slot.subjectName}</span>
                            <span className="text-[10px] opacity-70 truncate max-w-[100px]">{slot.teacherName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-200 text-lg">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && assignments.length === 0 && selectedClass && (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <Grid3x3 size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-500 font-medium">No subjects assigned to this class yet.</p>
          <p className="text-xs text-gray-400 mt-1">Go to Teachers → assign subjects to this class to populate the timetable.</p>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Periods are automatically distributed from teacher-subject assignments.
        A dedicated scheduling tool to drag-and-drop periods manually is on the roadmap.
      </p>
    </div>
  );
};
