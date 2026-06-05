import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, AlertCircle, Users, Plus, ChevronDown,
  Loader2, CheckCircle2, CreditCard, BookOpen, Trash2, X, Download, Printer,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SchoolTerm, StudentFeeLedger, UserRole } from '../types';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';

export const Finance: React.FC = () => {
  const { user, effectiveSchoolId } = useAuth();
  const { toasts, toast, dismiss } = useToast();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  type Tab = 'overview' | 'ledgers' | 'templates';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  // Summary
  const [summary, setSummary] = useState<{
    totalPayable: number; totalCollected: number; outstanding: number;
    studentCount: number; fullyPaidCount: number;
  } | null>(null);

  // Terms
  const [currentTerm, setCurrentTerm] = useState<SchoolTerm | null>(null);
  const [allTerms, setAllTerms] = useState<SchoolTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  // Ledgers
  const [ledgers, setLedgers] = useState<StudentFeeLedger[]>([]);
  const [ledgersLoading, setLedgersLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', term: '', lines: [{ title: '', key: '', defaultAmount: 0 }] });
  const [templateSaving, setTemplateSaving] = useState(false);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ itemId: string; title: string; payable: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  // ── Load summary + terms on mount ─────────────────────────────────────────

  useEffect(() => {
    if (!effectiveSchoolId) return;
    const init = async () => {
      setLoading(true);
      const [sumRes, termRes, termsRes] = await Promise.all([
        api.getFinanceSummary(effectiveSchoolId),
        api.getCurrentTerm(effectiveSchoolId),
        api.getTerms(effectiveSchoolId),
      ]);
      if (sumRes.ok) setSummary(sumRes.data);
      if (termRes.ok) setCurrentTerm(termRes.data);
      if (termsRes.ok) {
        setAllTerms(termsRes.data);
        const cur = termsRes.data.find((t) => t.isCurrent);
        if (cur) setSelectedTerm(cur.name);
      }
      setLoading(false);
    };
    init();
  }, [effectiveSchoolId]);

  // ── Load ledgers when tab/term changes ────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'ledgers' || !effectiveSchoolId) return;
    setLedgersLoading(true);
    api.getLedgers({ schoolId: effectiveSchoolId, term: selectedTerm || undefined })
      .then((res) => { if (res.ok) setLedgers(res.data); })
      .finally(() => setLedgersLoading(false));
  }, [activeTab, effectiveSchoolId, selectedTerm]);

  // ── Load templates when tab changes ──────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'templates' || !effectiveSchoolId) return;
    setTemplatesLoading(true);
    api.getFeeTemplates(effectiveSchoolId)
      .then((res) => { if (res.ok) setTemplates(res.data); })
      .finally(() => setTemplatesLoading(false));
  }, [activeTab, effectiveSchoolId]);

  // ── Template CRUD ─────────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!effectiveSchoolId || !templateForm.name || !templateForm.term) {
      toast.error('Name and term are required.'); return;
    }
    setTemplateSaving(true);
    const res = await api.createFeeTemplate({
      schoolId: effectiveSchoolId,
      term: templateForm.term,
      name: templateForm.name,
      lines: templateForm.lines.filter((l) => l.title.trim()),
    });
    if (res.ok) {
      toast.success('Template created.');
      setShowTemplateForm(false);
      setTemplateForm({ name: '', term: selectedTerm, lines: [{ title: '', key: '', defaultAmount: 0 }] });
      const refreshed = await api.getFeeTemplates(effectiveSchoolId);
      if (refreshed.ok) setTemplates(refreshed.data);
    } else {
      toast.error(res.message || 'Failed to create template.');
    }
    setTemplateSaving(false);
  };

  const addTemplateLine = () => {
    setTemplateForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { title: '', key: '', defaultAmount: 0 }],
    }));
  };

  const updateTemplateLine = (index: number, field: string, value: string | number) => {
    setTemplateForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        if (field === 'title') updated.key = (value as string).toLowerCase().replace(/\s+/g, '_');
        return updated;
      }),
    }));
  };

  const removeTemplateLine = (index: number) => {
    setTemplateForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };

  // ── Ledger CSV export ─────────────────────────────────────────────────────

  const exportLedgersCSV = () => {
    const header = 'Student,Term,Payable (₦),Paid (₦),Outstanding (₦),Status\n';
    const rows = ledgers.map(l =>
      `"${l.studentName || l.studentId}","${l.term}",${l.totalPayable},${l.totalPaid},${l.outstanding},${l.outstanding === 0 ? 'Paid' : 'Owing'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fee_ledger_${selectedTerm || 'all'}.csv`;
    link.click();
  };

  // ── Print receipt for a payment ──────────────────────────────────────────

  const printReceipt = (ledger: typeof ledgers[0], item: typeof ledgers[0]['lineItems'][0]) => {
    const w = window.open('', '_blank', 'width=600,height=700');
    if (!w) return;
    w.document.write(`
      <html><head><title>Payment Receipt</title>
      <style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:18px;margin-bottom:4px}
      .sub{color:#666;font-size:13px;margin-bottom:24px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
      .bold{font-weight:700}.footer{margin-top:32px;font-size:11px;color:#999;text-align:center}</style>
      </head><body>
      <h1>Payment Receipt</h1>
      <div class="sub">Generated ${new Date().toLocaleString()}</div>
      <div class="row"><span>Student</span><span class="bold">${ledger.studentName || ledger.studentId}</span></div>
      <div class="row"><span>Fee Item</span><span class="bold">${item.title}</span></div>
      <div class="row"><span>Term</span><span>${ledger.term}</span></div>
      <div class="row"><span>Total Payable</span><span>₦${item.payableAmount.toLocaleString()}</span></div>
      <div class="row"><span>Total Paid</span><span class="bold" style="color:#059669">₦${item.totalPaid.toLocaleString()}</span></div>
      <div class="row"><span>Outstanding</span><span style="color:${item.payableAmount - item.totalPaid > 0 ? '#dc2626' : '#059669'}">${item.payableAmount - item.totalPaid > 0 ? '₦' + (item.payableAmount - item.totalPaid).toLocaleString() : 'NIL'}</span></div>
      <div class="footer">SmartSchool Finance — Keep this receipt for your records</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  // ── Payment recording ─────────────────────────────────────────────────────

  const handleRecordPayment = async () => {
    if (!paymentModal || !effectiveSchoolId) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid payment amount.'); return; }
    setPaymentSaving(true);
    const res = await api.recordPayment({
      ledgerItemId: paymentModal.itemId,
      amount,
      method: paymentMethod,
      paymentRef: paymentRef.trim() || undefined,
      schoolId: effectiveSchoolId,
    });
    if (res.ok) {
      toast.success('Payment recorded.');
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentRef('');
      // Refresh ledgers
      const refreshed = await api.getLedgers({ schoolId: effectiveSchoolId, term: selectedTerm || undefined });
      if (refreshed.ok) setLedgers(refreshed.data);
      // Refresh summary
      const sumRes = await api.getFinanceSummary(effectiveSchoolId, selectedTerm || undefined);
      if (sumRes.ok) setSummary(sumRes.data);
    } else {
      toast.error(res.message || 'Failed to record payment.');
    }
    setPaymentSaving(false);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const collectionRate = summary && summary.totalPayable > 0
    ? Math.round((summary.totalCollected / summary.totalPayable) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500">
            {currentTerm ? `${currentTerm.name} · ${currentTerm.session}` : 'Fee collection and ledger management'}
          </p>
        </div>
        {allTerms.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Viewing:</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Terms</option>
              {allTerms.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Payable',
            value: `₦${(summary?.totalPayable ?? 0).toLocaleString()}`,
            icon: BookOpen,
            color: 'blue',
            bg: 'bg-blue-50',
            iconColor: 'text-blue-600',
          },
          {
            label: 'Collected',
            value: `₦${(summary?.totalCollected ?? 0).toLocaleString()}`,
            icon: CheckCircle2,
            color: 'emerald',
            bg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
          },
          {
            label: 'Outstanding',
            value: `₦${(summary?.outstanding ?? 0).toLocaleString()}`,
            icon: AlertCircle,
            color: summary?.outstanding ? 'red' : 'gray',
            bg: summary?.outstanding ? 'bg-red-50' : 'bg-gray-50',
            iconColor: summary?.outstanding ? 'text-red-600' : 'text-gray-400',
          },
          {
            label: 'Collection Rate',
            value: `${collectionRate}%`,
            icon: TrendingUp,
            color: collectionRate >= 80 ? 'emerald' : 'amber',
            bg: collectionRate >= 80 ? 'bg-emerald-50' : 'bg-amber-50',
            iconColor: collectionRate >= 80 ? 'text-emerald-600' : 'text-amber-600',
          },
        ].map(({ label, value, icon: Icon, bg, iconColor }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 ${bg} rounded-lg`}>
                <Icon size={20} className={iconColor} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['overview', 'ledgers', 'templates'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Users size={18} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Student Breakdown</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Students with ledgers</span>
                      <span className="font-semibold">{summary?.studentCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fully paid</span>
                      <span className="font-semibold text-emerald-600">{summary?.fullyPaidCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pending payment</span>
                      <span className="font-semibold text-red-500">
                        {(summary?.studentCount ?? 0) - (summary?.fullyPaidCount ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <DollarSign size={18} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Collection Progress</span>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold text-emerald-600">{collectionRate}%</span> of target collected
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 text-center pt-2">
                Switch to <strong>Ledgers</strong> to view individual student fee records or <strong>Templates</strong> to manage fee structures.
              </p>
            </div>
          )}

          {/* Ledgers Tab */}
          {activeTab === 'ledgers' && (
            <div>
              {!ledgersLoading && ledgers.length > 0 && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={exportLedgersCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              )}
              {ledgersLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-primary-600" />
                </div>
              )}
              {!ledgersLoading && ledgers.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">
                  No ledgers found for the selected term. Generate ledgers from a fee template on the Templates tab.
                </div>
              )}
              {!ledgersLoading && ledgers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        <th className="pb-3 pr-4">Student</th>
                        <th className="pb-3 pr-4">Term</th>
                        <th className="pb-3 pr-4 text-right">Payable</th>
                        <th className="pb-3 pr-4 text-right">Paid</th>
                        <th className="pb-3 pr-4 text-right">Outstanding</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ledgers.map((ledger) => (
                        <React.Fragment key={ledger.id}>
                          <tr className="hover:bg-gray-50/60 group">
                            <td className="py-3 pr-4 font-medium text-gray-900">{ledger.studentName || ledger.studentId.slice(0, 8)}</td>
                            <td className="py-3 pr-4 text-gray-500">{ledger.term}</td>
                            <td className="py-3 pr-4 text-right">₦{ledger.totalPayable.toLocaleString()}</td>
                            <td className="py-3 pr-4 text-right text-emerald-600">₦{ledger.totalPaid.toLocaleString()}</td>
                            <td className="py-3 pr-4 text-right font-semibold text-red-500">
                              {ledger.outstanding > 0 ? `₦${ledger.outstanding.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                ledger.outstanding === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {ledger.outstanding === 0 ? 'Paid' : 'Owing'}
                              </span>
                            </td>
                          </tr>
                          {isAdmin && ledger.lineItems.map((item) => (
                            <tr key={item.id} className="bg-gray-50/40 text-xs text-gray-500">
                              <td className="py-1.5 pl-6 pr-4 text-gray-400">{item.title}</td>
                              <td />
                              <td className="py-1.5 pr-4 text-right">₦{item.payableAmount.toLocaleString()}</td>
                              <td className="py-1.5 pr-4 text-right text-emerald-600">₦{item.totalPaid.toLocaleString()}</td>
                              <td className="py-1.5 pr-4 text-right">
                                {item.payableAmount - item.totalPaid > 0
                                  ? `₦${(item.payableAmount - item.totalPaid).toLocaleString()}`
                                  : '—'}
                              </td>
                              <td className="py-1.5">
                                <div className="flex items-center gap-2">
                                  {isAdmin && item.payableAmount - item.totalPaid > 0 && (
                                    <button
                                      onClick={() => setPaymentModal({ itemId: item.id, title: item.title, payable: item.payableAmount - item.totalPaid })}
                                      className="flex items-center gap-1 text-[10px] font-medium text-primary-600 hover:text-primary-800"
                                    >
                                      <CreditCard size={11} /> Pay
                                    </button>
                                  )}
                                  {item.totalPaid > 0 && (
                                    <button
                                      onClick={() => printReceipt(ledger, item)}
                                      className="flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-gray-700"
                                      title="Print receipt"
                                    >
                                      <Printer size={11} /> Receipt
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowTemplateForm((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                  >
                    <Plus size={15} /> New Template
                  </button>
                </div>
              )}

              {showTemplateForm && (
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Create Fee Template</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Template Name</label>
                      <input type="text" placeholder="e.g. First Term Fees" value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
                      <input type="text" placeholder="e.g. First Term 2024/2025" value={templateForm.term}
                        onChange={(e) => setTemplateForm({ ...templateForm, term: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">Fee Lines</label>
                      <button onClick={addTemplateLine} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <Plus size={11} /> Add line
                      </button>
                    </div>
                    <div className="space-y-2">
                      {templateForm.lines.map((line, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" placeholder="Title (e.g. Tuition Fee)" value={line.title}
                            onChange={(e) => updateTemplateLine(i, 'title', e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                          <input type="number" placeholder="Amount (₦)" value={line.defaultAmount || ''}
                            onChange={(e) => updateTemplateLine(i, 'defaultAmount', parseFloat(e.target.value) || 0)}
                            className="w-32 border border-gray-300 rounded-lg p-2 text-sm" />
                          {templateForm.lines.length > 1 && (
                            <button onClick={() => removeTemplateLine(i)} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleCreateTemplate} disabled={templateSaving}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
                      {templateSaving ? 'Creating…' : 'Create Template'}
                    </button>
                    <button onClick={() => setShowTemplateForm(false)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {templatesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary-600" />
                </div>
              )}
              {!templatesLoading && templates.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No fee templates yet.</div>
              )}
              <div className="space-y-3">
                {templates.map((t: any) => (
                  <div key={t.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.term}</p>
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {t.lines?.length ?? 0} line{t.lines?.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {t.lines?.length > 0 && (
                      <div className="mt-3 divide-y divide-gray-50">
                        {t.lines.map((line: any) => (
                          <div key={line.id} className="flex justify-between py-1.5 text-xs text-gray-600">
                            <span>{line.title}</span>
                            <span className="font-medium">₦{Number(line.defaultAmount).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1.5 text-xs font-semibold text-gray-900 pt-2">
                          <span>Total</span>
                          <span>₦{t.lines.reduce((s: number, l: any) => s + Number(l.defaultAmount), 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Record Payment</h3>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{paymentModal.title}</span>{' '}
              — ₦{paymentModal.payable.toLocaleString()} outstanding
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₦)</label>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Max ₦${paymentModal.payable.toLocaleString()}`}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="pos">POS</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference (optional)</label>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Receipt / transaction ref"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleRecordPayment} disabled={paymentSaving}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
                {paymentSaving ? 'Saving…' : 'Record Payment'}
              </button>
              <button onClick={() => setPaymentModal(null)}
                className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
