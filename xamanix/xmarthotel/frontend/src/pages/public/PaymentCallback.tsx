import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { get, errorMessage } from '../../lib/api';
import PublicShell from './PublicShell';

type State = 'verifying' | 'success' | 'failed';

/** Guests land here after returning from Paystack; we verify the reference. */
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  const [state, setState] = useState<State>('verifying');
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    if (!reference) { setState('failed'); setMessage('Missing payment reference.'); return; }
    get<{ status: string; recorded?: boolean }>('/public/pay/verify', { reference })
      .then((r) => {
        if (r.status === 'success') { setState('success'); setMessage('Payment received. Thank you!'); }
        else { setState('failed'); setMessage('Your payment was not completed.'); }
      })
      .catch((e) => { setState('failed'); setMessage(errorMessage(e, 'We could not confirm this payment.')); });
  }, [reference]);

  const icon = state === 'success' ? '✓' : state === 'failed' ? '!' : '…';
  const tone = state === 'success' ? 'bg-emerald-50 text-emerald-600' : state === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500';

  return (
    <PublicShell title="Payment">
      <div className="card p-8 text-center">
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 ${tone}`}>{icon}</div>
        <p className="text-slate-700">{message}</p>
        {reference && <div className="text-xs font-mono text-slate-400 mt-2">{reference}</div>}
        <Link to="/" className="btn-ghost mt-6 inline-block">Done</Link>
      </div>
    </PublicShell>
  );
}
