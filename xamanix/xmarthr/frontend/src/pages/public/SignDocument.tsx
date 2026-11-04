import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, get, post, errorMessage } from '../../lib/api';
import SignModal from '../../components/SignModal';

interface RequestMeta { documentName: string; mimeType: string; recipientName?: string | null; orgName?: string; expiresAt: string }

export default function SignDocument() {
  const { token } = useParams();
  const [meta, setMeta] = useState<RequestMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    get<RequestMeta>(`/public/sign/${token}`).then(setMeta).catch((e) => setErr(errorMessage(e))).finally(() => setLoading(false));
  }, [token]);

  const download = async () => {
    try {
      const res = await api.get(`/public/sign/${token}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = meta?.documentName ?? 'document'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr(errorMessage(e)); }
  };

  const sign = async (method: 'Typed' | 'Drawn', signerName: string, imageBase64?: string) => {
    try {
      await post(`/public/sign/${token}`, { method, signerName, imageBase64: imageBase64?.split(',')[1] ?? imageBase64 });
      setSigning(false);
      setDone(true);
    } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6"><div className="text-2xl font-bold text-brand-700">{meta?.orgName ?? 'XmartHR'}</div><div className="text-sm text-slate-400">Document signing</div></div>
        <div className="card p-6">
          {loading ? <p className="text-slate-400 text-sm text-center">Loading…</p>
            : done ? (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-3">✓</div>
                <h2 className="text-xl font-bold text-slate-900">Signed — thank you</h2>
                <p className="text-sm text-slate-500 mt-1">Your signature has been recorded.</p>
              </div>
            ) : err ? <p className="text-sm text-rose-600 text-center">{err}</p>
            : meta ? (
              <div className="space-y-4 text-center">
                <p className="text-slate-700">{meta.recipientName ? `Hello ${meta.recipientName}, ` : ''}please review and sign:</p>
                <div className="font-semibold text-slate-900">{meta.documentName}</div>
                <div className="flex justify-center gap-2">
                  <button className="btn-ghost" onClick={download}>Download to review</button>
                  <button className="btn-primary" onClick={() => setSigning(true)}>Sign document</button>
                </div>
                <p className="text-xs text-slate-400">Link expires {new Date(meta.expiresAt).toDateString()}.</p>
              </div>
            ) : null}
        </div>
      </div>
      <SignModal open={signing} onClose={() => setSigning(false)} onSign={sign} />
    </div>
  );
}
