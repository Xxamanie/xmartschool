import { useEffect, useState } from 'react';
import { api, get, post, errorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import SignModal from '../components/SignModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { DocumentMeta, Employee, Checklist } from '../lib/types';

export default function Documents() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user ? ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(user.role) : false;

  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<DocumentMeta | null>(null);
  const [reqFor, setReqFor] = useState<DocumentMeta | null>(null);
  const [reqForm, setReqForm] = useState({ recipientEmail: '', recipientName: '' });
  const [reqLink, setReqLink] = useState<string | null>(null);

  const [up, setUp] = useState<{ employeeId: string; requiresSignature: boolean; checklistId: string; itemIndex: string; file: File | null }>({ employeeId: '', requiresSignature: true, checklistId: '', itemIndex: '', file: null });

  const load = () => {
    const calls: Promise<unknown>[] = [];
    if (isManager) {
      calls.push(get<DocumentMeta[]>('/documents').then(setDocs).catch(() => {}));
      calls.push(get<Employee[]>('/employees').then(setEmployees).catch(() => {}));
    } else if (user?.employeeId) {
      calls.push(get<DocumentMeta[]>('/documents/me').then(setDocs).catch(() => {}));
    }
    Promise.all(calls).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isManager && up.employeeId) get<Checklist[]>('/checklists', { employeeId: up.employeeId }).then(setChecklists).catch(() => setChecklists([]));
    else setChecklists([]);
  }, [up.employeeId, isManager]);

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!up.file || !up.employeeId) { toast.push('error', 'Pick an employee and a file'); return; }
    try {
      const contentBase64 = await toBase64(up.file);
      await post('/documents', {
        employeeId: up.employeeId, name: up.file.name, mimeType: up.file.type || 'application/octet-stream',
        contentBase64, requiresSignature: up.requiresSignature,
        checklistId: up.checklistId || undefined, itemIndex: up.itemIndex ? Number(up.itemIndex) : undefined,
      });
      toast.push('success', 'Document uploaded');
      setUp({ employeeId: '', requiresSignature: true, checklistId: '', itemIndex: '', file: null });
      const fileInput = document.getElementById('doc-file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      load();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const download = async (doc: DocumentMeta) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = doc.name; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  const sign = async (method: 'Typed' | 'Drawn', signerName: string, imageBase64?: string) => {
    if (!signing) return;
    try {
      await post(`/documents/${signing.id}/sign`, { method, signerName, imageBase64: imageBase64?.split(',')[1] ?? imageBase64 });
      toast.push('success', 'Document signed');
      setSigning(null);
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqFor) return;
    try {
      const r = await post<{ url: string; emailed: boolean }>(`/documents/${reqFor.id}/sign-requests`, { recipientEmail: reqForm.recipientEmail, recipientName: reqForm.recipientName || undefined });
      toast.push('success', r.emailed ? 'Signature request emailed' : 'Request created — share the link');
      setReqLink(r.url);
      setReqForm({ recipientEmail: '', recipientName: '' });
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;
  const selectedChecklist = checklists.find((c) => c.id === up.checklistId);

  return (
    <>
      <PageHeader title="Documents" subtitle={isManager ? 'Store, share and e-sign documents' : 'Your documents to review and sign'} />

      {isManager && (
        <div className="card p-5 mb-6">
          <form onSubmit={upload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Employee</label>
                <select className="input" value={up.employeeId} onChange={(e) => setUp({ ...up, employeeId: e.target.value, checklistId: '', itemIndex: '' })} required>
                  <option value="">Select…</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} · {emp.staffNo}</option>)}
                </select>
              </div>
              <div><label className="label">File</label><input id="doc-file" className="input" type="file" onChange={(e) => setUp({ ...up, file: e.target.files?.[0] ?? null })} required /></div>
            </div>
            {checklists.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Link to checklist (optional)</label>
                  <select className="input" value={up.checklistId} onChange={(e) => setUp({ ...up, checklistId: e.target.value, itemIndex: '' })}>
                    <option value="">—</option>
                    {checklists.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Checklist step (auto-ticks on sign)</label>
                  <select className="input" value={up.itemIndex} disabled={!selectedChecklist} onChange={(e) => setUp({ ...up, itemIndex: e.target.value })}>
                    <option value="">—</option>
                    {selectedChecklist?.items.map((it, i) => <option key={i} value={i}>{it.title}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={up.requiresSignature} onChange={(e) => setUp({ ...up, requiresSignature: e.target.checked })} /> Requires signature</label>
              <button className="btn-primary" type="submit">Upload</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">{isManager ? 'All documents' : 'My documents'}</div>
        {docs.length === 0 ? <EmptyState message="No documents yet." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Uploaded</th><th className="px-4 py-2 font-medium">Signatures</th><th className="px-4 py-2 font-medium text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => {
                const signed = (d.signatures?.length ?? 0) > 0;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2"><div className="font-medium text-slate-800">{d.name}</div><div className="text-xs text-slate-400">{Math.round(d.sizeBytes / 1024)} KB</div></td>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(d.createdAt)}</td>
                    <td className="px-4 py-2">
                      {d.requiresSignature ? (signed ? <span className="text-xs text-emerald-600">{d.signatures!.map((s) => s.signerName).join(', ')}</span> : <StatusBadge status="Pending" />) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button className="text-brand-700 hover:underline text-xs mr-3" onClick={() => download(d)}>Download</button>
                      {d.requiresSignature && !signed && <button className="text-brand-700 hover:underline text-xs mr-3" onClick={() => setSigning(d)}>Sign</button>}
                      {isManager && d.requiresSignature && !signed && <button className="text-brand-700 hover:underline text-xs" onClick={() => { setReqFor(d); setReqLink(null); }}>Request e-sign</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SignModal open={!!signing} onClose={() => setSigning(null)} onSign={sign} />

      <Modal open={!!reqFor} onClose={() => { setReqFor(null); setReqLink(null); }} title="Request signature by email">
        {reqLink ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Share this signing link with the recipient:</p>
            <input className="input text-xs" readOnly value={reqLink} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex justify-end"><button className="btn-primary" onClick={() => { setReqFor(null); setReqLink(null); }}>Done</button></div>
          </div>
        ) : (
          <form onSubmit={sendRequest} className="space-y-4">
            <div><label className="label">Recipient email</label><input className="input" type="email" value={reqForm.recipientEmail} onChange={(e) => setReqForm({ ...reqForm, recipientEmail: e.target.value })} required /></div>
            <div><label className="label">Recipient name (optional)</label><input className="input" value={reqForm.recipientName} onChange={(e) => setReqForm({ ...reqForm, recipientName: e.target.value })} /></div>
            <p className="text-xs text-slate-400">They can sign without an account via a secure link (expires in 14 days).</p>
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setReqFor(null)}>Cancel</button><button type="submit" className="btn-primary">Send request</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}
