import React, { useEffect, useState, useMemo } from 'react';
import {
  GraduationCap, TrendingUp, DollarSign, CalendarCheck, ChevronDown, ChevronUp,
  BookOpen, Award, AlertTriangle, CheckCircle2, Clock, CreditCard, Loader2,
  User, Phone, Mail, FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student, ResultData, StudentFeeLedger } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────

interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

interface ChildData {
  student: Student;
  results: ResultData[];
  attendance: AttendanceSummary;
  ledgers: StudentFeeLedger[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const gradeColor = (g: string) => {
  if (g.startsWith('A')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (g.startsWith('B')) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (g.startsWith('C') || g.startsWith('D') || g.startsWith('E')) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
};

const attendColor = (p: number) =>
  p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-red-500';

// ── Sub-components ────────────────────────────────────────────────────────

const AttendanceCard: React.FC<{ summary: AttendanceSummary }> = ({ summary }) => {
  const { present, absent, late, excused, total } = summary;
  const attendPct = pct(present + late, total);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <CalendarCheck size={16} className="text-primary-500" /> Attendance
      </h3>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{present + late}/{total} days attended</span>
          <span className={`text-sm font-bold ${attendPct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
            {attendPct}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full ${attendColor(attendPct)}`} style={{ width: `${attendPct}%` }} />
        </div>
        {attendPct < 75 && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={12} /> Below 75% — contact the school
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { label: 'Present', val: present, color: 'text-emerald-600' },
          { label: 'Late', val: late, color: 'text-amber-600' },
          { label: 'Absent', val: absent, color: 'text-red-600' },
          { label: 'Excused', val: excused, color: 'text-blue-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold ${color}`}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ResultsCard: React.FC<{ results: ResultData[] }> = ({ results }) => {
  const published = results.filter(r => r.status === 'Published');
  const avg = published.length
    ? Math.round(published.reduce((s, r) => s + r.average, 0) / published.length)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary-500" /> Academic Results
        </h3>
        {avg !== null && (
          <span className="text-xs font-semibold text-gray-500">
            Avg: <span className="text-gray-900">{avg}%</span>
          </span>
        )}
      </div>
      {published.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No published results yet</p>
      ) : (
        <div className="space-y-2">
          {published.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{r.subjectName}</p>
                {r.term && <p className="text-xs text-gray-400">{r.term}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className="text-sm font-semibold text-gray-700">{r.average}%</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColor(r.grade)}`}>
                  {r.grade}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FinanceCard: React.FC<{ ledgers: StudentFeeLedger[] }> = ({ ledgers }) => {
  const totalPayable = ledgers.reduce((s, l) => s + l.totalPayable, 0);
  const totalPaid = ledgers.reduce((s, l) => s + l.totalPaid, 0);
  const outstanding = totalPayable - totalPaid;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <DollarSign size={16} className="text-primary-500" /> Fees
      </h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Total', val: totalPayable, color: 'text-gray-700' },
          { label: 'Paid', val: totalPaid, color: 'text-emerald-600' },
          { label: 'Outstanding', val: outstanding, color: outstanding > 0 ? 'text-red-600' : 'text-emerald-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${color}`}>₦{val.toLocaleString()}</p>
          </div>
        ))}
      </div>
      {outstanding > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          Outstanding balance — please contact the school bursary
        </div>
      )}
      {ledgers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">No fee records yet</p>
      )}
    </div>
  );
};

// ── Child Card ─────────────────────────────────────────────────────────────

const ChildCard: React.FC<{ data: ChildData }> = ({ data }) => {
  const { student, results, attendance, ledgers } = data;
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-5 hover:bg-gray-100 transition-colors text-left"
      >
        {student.avatar ? (
          <img src={student.avatar} alt={student.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg flex-shrink-0">
            {student.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900">{student.name}</p>
          <p className="text-sm text-gray-500">{student.grade} · {student.status}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
            student.status === 'Suspended' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>{student.status}</span>
          {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <AttendanceCard summary={attendance} />
          <ResultsCard results={results} />
          <FinanceCard ledgers={ledgers} />
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────

export const ParentPortal: React.FC = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getParentChildren().then(res => {
      if (res.ok) setChildren(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const totalOutstanding = useMemo(() =>
    children.reduce((s, c) => s + c.ledgers.reduce((ls, l) => ls + (l.totalPayable - l.totalPaid), 0), 0),
    [children],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Portal</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Welcome, {user?.name} — tracking {children.length} child{children.length !== 1 ? 'ren' : ''}
          </p>
        </div>
        {totalOutstanding > 0 && (
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <CreditCard size={16} />
            ₦{totalOutstanding.toLocaleString()} outstanding
          </div>
        )}
      </div>

      {/* Quick stats */}
      {!loading && children.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: GraduationCap, label: 'Children', val: children.length, color: 'bg-primary-50 text-primary-600' },
            {
              icon: TrendingUp, label: 'Avg Grade', color: 'bg-emerald-50 text-emerald-600',
              val: (() => {
                const allResults = children.flatMap(c => c.results.filter(r => r.status === 'Published'));
                return allResults.length
                  ? Math.round(allResults.reduce((s, r) => s + r.average, 0) / allResults.length) + '%'
                  : '—';
              })(),
            },
            {
              icon: CalendarCheck, label: 'Attendance', color: 'bg-blue-50 text-blue-600',
              val: (() => {
                const totals = children.map(c => pct(c.attendance.present + c.attendance.late, c.attendance.total));
                return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) + '%' : '—';
              })(),
            },
            {
              icon: DollarSign, label: 'Fees Paid', color: 'bg-amber-50 text-amber-600',
              val: (() => {
                const p = children.reduce((s, c) => s + c.ledgers.reduce((ls, l) => ls + l.totalPaid, 0), 0);
                const t = children.reduce((s, c) => s + c.ledgers.reduce((ls, l) => ls + l.totalPayable, 0), 0);
                return t > 0 ? pct(p, t) + '%' : '—';
              })(),
            },
          ].map(({ icon: Icon, label, val, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">{val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Children list */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      )}

      {!loading && children.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400 gap-3">
          <GraduationCap size={40} />
          <p className="font-medium text-gray-500">No children linked to your account</p>
          <p className="text-sm text-center max-w-xs">
            Contact the school administrator to link your child's record to this account.
          </p>
        </div>
      )}

      {!loading && children.map(c => (
        <ChildCard key={c.student.id} data={c} />
      ))}
    </div>
  );
};
