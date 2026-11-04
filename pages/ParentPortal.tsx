import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  GraduationCap, TrendingUp, DollarSign, CalendarCheck, ChevronDown, ChevronUp,
  BookOpen, Award, AlertTriangle, CheckCircle2, Clock, CreditCard, Loader2,
  User, Phone, Mail, FileText, Receipt, Printer, KeyRound, Bell,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Student, ResultData, StudentFeeLedger } from '../types';

// ── Receipt types ─────────────────────────────────────────────────────────────

interface PaymentReceipt {
  type: 'payment_receipt';
  studentName: string;
  schoolName: string;
  paymentDate: string;
  paymentRef?: string;
  method?: string;
  itemTitle: string;
  amountPaid: number;
  totalPayable: number;
  totalPaid: number;
  outstanding: number;
  ledgerFully: boolean;
  resultPin?: string;
}

const tryParseReceipt = (message: string): PaymentReceipt | null => {
  try {
    const parsed = JSON.parse(message);
    return parsed?.type === 'payment_receipt' ? (parsed as PaymentReceipt) : null;
  } catch {
    return null;
  }
};

const fmt = (n: number) => `₦${n.toLocaleString()}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

const returnedPaymentReference = (): string | null => {
  const query = new URLSearchParams(window.location.search);
  const hashQuery = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const reference = query.get('reference') || query.get('trxref') || hashQuery.get('reference') || hashQuery.get('trxref');
  return reference?.startsWith('xss_') ? reference : null;
};

const clearReturnedPaymentReference = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  const [hashPath, hashSearch] = url.hash.split('?');
  if (hashSearch) {
    const query = new URLSearchParams(hashSearch);
    query.delete('reference');
    query.delete('trxref');
    url.hash = `${hashPath}${query.size ? `?${query.toString()}` : ''}`;
  }
  window.history.replaceState(window.history.state, '', url.href);
};

// ── Receipt Card ──────────────────────────────────────────────────────────────

const ReceiptCard: React.FC<{ receipt: PaymentReceipt; notifId: string }> = ({ receipt, notifId }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(`
      <html><head><title>Payment Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 14px; }
        td:last-child { text-align: right; font-weight: 600; }
        .pin-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 16px; margin-top: 20px; text-align: center; }
        .pin-box p { margin: 0; font-size: 13px; color: #166534; }
        .pin-box strong { display: block; font-size: 28px; letter-spacing: 8px; margin-top: 6px; color: #15803d; }
        .footer { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-emerald-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Receipt size={16} />
          <span className="font-semibold text-sm">Payment Receipt</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 transition-colors"
        >
          <Printer size={13} /> Print / Download
        </button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">{receipt.schoolName}</h2>
          <p className="text-xs text-gray-500">Fee Payment Statement · {fmtDate(receipt.paymentDate)}</p>
        </div>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 text-gray-500">Student</td><td className="py-2 text-right font-semibold text-gray-900">{receipt.studentName}</td></tr>
            <tr><td className="py-2 text-gray-500">Item</td><td className="py-2 text-right text-gray-700">{receipt.itemTitle}</td></tr>
            <tr><td className="py-2 text-gray-500">Amount Paid</td><td className="py-2 text-right text-emerald-700 font-bold">{fmt(receipt.amountPaid)}</td></tr>
            <tr><td className="py-2 text-gray-500">Total Payable</td><td className="py-2 text-right text-gray-700">{fmt(receipt.totalPayable)}</td></tr>
            <tr><td className="py-2 text-gray-500">Total Paid</td><td className="py-2 text-right text-gray-700">{fmt(receipt.totalPaid)}</td></tr>
            <tr>
              <td className="py-2 text-gray-500">Outstanding</td>
              <td className={`py-2 text-right font-bold ${receipt.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {receipt.outstanding > 0 ? fmt(receipt.outstanding) : 'NIL — Fully Cleared ✓'}
              </td>
            </tr>
            {receipt.paymentRef && <tr><td className="py-2 text-gray-500">Reference</td><td className="py-2 text-right text-gray-600 font-mono text-xs">{receipt.paymentRef}</td></tr>}
            {receipt.method && <tr><td className="py-2 text-gray-500">Method</td><td className="py-2 text-right text-gray-600">{receipt.method}</td></tr>}
          </tbody>
        </table>

        {receipt.resultPin && (
          <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wide">
              <KeyRound size={14} /> Result Access PIN
            </div>
            <p className="text-3xl font-black tracking-[0.4em] text-emerald-800 py-1">{receipt.resultPin}</p>
            <p className="text-xs text-emerald-600">Share this PIN with {receipt.studentName} to unlock their results. Keep it safe.</p>
          </div>
        )}
      </div>
    </div>
  );
};

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

const FinanceCard: React.FC<{ ledgers: StudentFeeLedger[]; studentId: string; paymentChecking: boolean }> = ({ ledgers, studentId, paymentChecking }) => {
  const { user } = useAuth();
  const [payerEmail, setPayerEmail] = useState(user?.email || '');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [startingItemId, setStartingItemId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const checkoutInFlight = useRef(false);
  useEffect(() => {
    const resume = () => { checkoutInFlight.current = false; setStartingItemId(null); };
    window.addEventListener('pageshow', resume);
    return () => window.removeEventListener('pageshow', resume);
  }, []);
  const totalPayable = ledgers.reduce((s, l) => s + l.totalPayable, 0);
  const totalPaid = ledgers.reduce((s, l) => s + l.totalPaid, 0);
  const outstanding = ledgers.reduce((sum, ledger) => sum + Math.max(0, ledger.outstanding), 0);

  const handlePay = async (ledgerItemId: string, balance: number) => {
    if (checkoutInFlight.current || paymentChecking) return;
    const email = payerEmail.trim();
    const amount = Number(amounts[ledgerItemId] ?? balance);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPaymentError('Enter a valid payer email for the payment receipt.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0.01 || amount > balance || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      setPaymentError(`Enter an amount from ₦0.01 to ${fmt(balance)}, with at most two decimal places.`);
      return;
    }
    checkoutInFlight.current = true;
    setStartingItemId(ledgerItemId);
    setPaymentError('');
    let redirecting = false;
    try {
      const response = await api.initializeFeePayment({ ledgerItemId, email, amount });
      if (!response.ok || !response.data.authorizationUrl) {
        throw new Error(response.message || 'Could not start payment. Please try again.');
      }
      const checkoutUrl = new URL(response.data.authorizationUrl);
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.paystack.com' || checkoutUrl.username || checkoutUrl.password || checkoutUrl.port) {
        throw new Error('The payment provider returned an invalid checkout URL.');
      }
      window.location.assign(checkoutUrl.href);
      redirecting = true;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Could not start payment. Please try again.');
    } finally {
      if (!redirecting) {
        checkoutInFlight.current = false;
        setStartingItemId(null);
      }
    }
  };

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
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Pay part or all of an outstanding fee through Paystack.</p>
          <label htmlFor={`payer-email-${studentId}`} className="block text-xs font-medium text-gray-600">Payer email</label>
          <input
            id={`payer-email-${studentId}`} type="email" autoComplete="email" value={payerEmail}
            onChange={event => setPayerEmail(event.target.value)} disabled={startingItemId !== null || paymentChecking}
            placeholder="parent@example.com"
            className="w-full rounded-lg border border-gray-300 p-2 text-sm disabled:opacity-50"
          />
        </div>
      )}
      {paymentError && <p role="alert" className="text-xs text-red-600">{paymentError}</p>}
      {ledgers.map(ledger => (
        <div key={ledger.id} className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-700">{ledger.term}</p>
          {ledger.lineItems.map(item => {
            const balance = Math.max(0, item.payableAmount - item.totalPaid);
            return (
              <div key={item.id} className="rounded-lg bg-gray-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-gray-500">Paid {fmt(item.totalPaid)} of {fmt(item.payableAmount)}</p>
                  </div>
                  <span className={balance > 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                    {balance > 0 ? `${fmt(balance)} due` : 'Paid'}
                  </span>
                </div>
                {balance > 0 && (
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`fee-amount-${item.id}`} className="mb-1 block text-[11px] text-gray-500">Amount (₦)</label>
                      <input
                        id={`fee-amount-${item.id}`} type="number" min="0.01" max={balance} step="0.01"
                        value={amounts[item.id] ?? balance} disabled={startingItemId !== null || paymentChecking}
                        onChange={event => setAmounts(previous => ({ ...previous, [item.id]: event.target.value }))}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={() => void handlePay(item.id, balance)} disabled={startingItemId !== null || paymentChecking}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {startingItemId === item.id ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
                      {startingItemId === item.id ? 'Opening…' : 'Pay'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {ledgers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">No fee records yet</p>
      )}
    </div>
  );
};

// ── Child Card ─────────────────────────────────────────────────────────────

const ChildCard: React.FC<{ data: ChildData; paymentChecking: boolean }> = ({ data, paymentChecking }) => {
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
          <FinanceCard ledgers={ledgers} studentId={student.id} paymentChecking={paymentChecking} />
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
  const [receipts, setReceipts] = useState<Array<{ id: string; receipt: PaymentReceipt }>>([]);
  const [returnReference, setReturnReference] = useState(returnedPaymentReference);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const verificationInFlight = useRef(false);
  const loadSequence = useRef(0);

  const loadPortalData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const [childRes, notifRes] = await Promise.all([
        api.getParentChildren(),
        api.getNotifications(),
      ]);
      if (sequence !== loadSequence.current) return;
      if (childRes.ok) setChildren(childRes.data);
      if (notifRes.ok) {
        const parsed = (notifRes.data as any[])
          .map((n: any) => ({ id: n.id, receipt: tryParseReceipt(n.message) }))
          .filter((n): n is { id: string; receipt: PaymentReceipt } => n.receipt !== null);
        setReceipts(parsed);
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [user?.id]);

  const verifyReturnedPayment = useCallback(async (reference: string) => {
    if (verificationInFlight.current) return;
    verificationInFlight.current = true;
    setVerificationBusy(true);
    setVerificationError('');
    setVerificationMessage('');
    try {
      const response = await api.verifyFeePayment(reference);
      if (!response.ok || !response.data.recorded) {
        setVerificationError(response.message || 'Payment has not been confirmed. Complete checkout, then check again.');
        return;
      }
      clearReturnedPaymentReference();
      setReturnReference(null);
      setVerificationMessage('Payment confirmed. Your child’s fee balance has been updated.');
      await loadPortalData();
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'Could not check payment. Please try again.');
    } finally {
      verificationInFlight.current = false;
      setVerificationBusy(false);
    }
  }, [loadPortalData]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await loadPortalData();
      const reference = returnedPaymentReference();
      if (active && reference) {
        setReturnReference(reference);
        await verifyReturnedPayment(reference);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadPortalData, verifyReturnedPayment]);

  const totalOutstanding = useMemo(() =>
    children.reduce((s, c) => s + c.ledgers.reduce((ls, l) => ls + Math.max(0, l.outstanding), 0), 0),
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

      {(returnReference || verificationMessage || verificationError) && (
        <div role={verificationError ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${
          verificationError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <p>{verificationBusy ? 'Checking your payment…' : verificationError || verificationMessage || 'Checking payment status…'}</p>
            {returnReference && (
              <button
                onClick={() => void verifyReturnedPayment(returnReference)} disabled={verificationBusy}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-current px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {verificationBusy && <Loader2 size={13} className="animate-spin" />}
                {verificationBusy ? 'Checking…' : 'Check payment again'}
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* Payment Receipts */}
      {receipts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Bell size={16} className="text-emerald-600" />
            Payment Receipts
            <span className="ml-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{receipts.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {receipts.map(({ id, receipt }) => (
              <ReceiptCard key={id} notifId={id} receipt={receipt} />
            ))}
          </div>
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
        <ChildCard key={c.student.id} data={c} paymentChecking={verificationBusy} />
      ))}
    </div>
  );
};
