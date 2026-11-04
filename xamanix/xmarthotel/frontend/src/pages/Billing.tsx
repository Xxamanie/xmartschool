import { useEffect, useState } from 'react';
import { get, post, errorMessage } from '../lib/api';
import { formatMoney, toMinor } from '../lib/format';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Reservation, Folio } from '../lib/types';

export default function Billing() {
  const toast = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [charge, setCharge] = useState({ description: '', amount: '' });
  const [payment, setPayment] = useState({ amount: '', method: 'Cash' });

  useEffect(() => {
    get<Reservation[]>('/reservations')
      .then(setReservations)
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openFolio = async (reservationId: string) => {
    setSelectedId(reservationId);
    setFolio(null);
    try {
      const detail = await get<{ folio?: { id: string } | null }>(`/reservations/${reservationId}`);
      if (!detail.folio) { toast.push('info', 'No folio on this reservation'); return; }
      const f = await get<Folio>(`/billing/folios/${detail.folio.id}`);
      setFolio(f);
    } catch (e) {
      toast.push('error', errorMessage(e));
    }
  };

  const refresh = () => folio && get<Folio>(`/billing/folios/${folio.id}`).then(setFolio).catch(() => {});

  const addCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    try {
      await post(`/billing/folios/${folio.id}/charges`, { description: charge.description, amountMinor: toMinor(charge.amount) });
      setCharge({ description: '', amount: '' });
      toast.push('success', 'Charge added');
      refresh();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    try {
      await post(`/billing/folios/${folio.id}/payments`, { amountMinor: toMinor(payment.amount), method: payment.method });
      setPayment({ amount: '', method: 'Cash' });
      toast.push('success', 'Payment recorded');
      refresh();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const refund = async (id: string) => {
    if (!confirm('Refund this payment? This cannot be undone.')) return;
    try {
      await post(`/billing/payments/${id}/refund`);
      toast.push('success', 'Payment refunded');
      refresh();
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  const payWithPaystack = async () => {
    if (!folio) return;
    try {
      const { authorizationUrl } = await post<{ authorizationUrl: string; reference: string }>(`/payments/folios/${folio.id}/init`, {});
      window.location.href = authorizationUrl; // redirect to Paystack hosted checkout
    } catch (err) { toast.push('error', errorMessage(err)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Billing" subtitle="Folios, charges and payments" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Reservations</div>
          {reservations.length === 0 ? <EmptyState message="No reservations." /> : (
            <ul className="divide-y divide-slate-100 text-sm max-h-[28rem] overflow-auto">
              {reservations.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => openFolio(r.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${selectedId === r.id ? 'bg-brand-50' : ''}`}
                  >
                    <div className="font-medium text-slate-800">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '—'}</div>
                    <div className="text-xs text-slate-400">{r.roomType?.name}{r.room ? ` · Rm ${r.room.number}` : ''}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          {!folio ? (
            <div className="card"><EmptyState message="Select a reservation to view its folio." /></div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {folio.reservation?.guest ? `${folio.reservation.guest.firstName} ${folio.reservation.guest.lastName}` : 'Folio'}
                    </div>
                    <div className="text-xs text-slate-400">Folio {folio.id.slice(-6)}</div>
                  </div>
                  <StatusBadge status={folio.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Charges</div><div className="font-bold text-slate-800">{formatMoney(folio.chargesTotal)}</div></div>
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Paid</div><div className="font-bold text-emerald-600">{formatMoney(folio.paymentsTotal)}</div></div>
                  <div className="rounded-lg bg-slate-50 py-3"><div className="text-xs text-slate-500">Balance</div><div className={`font-bold ${folio.balanceMinor > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatMoney(folio.balanceMinor)}</div></div>
                </div>
                {folio.status === 'Open' && folio.balanceMinor > 0 && (
                  <button className="btn-primary w-full mt-4" onClick={payWithPaystack}>Pay {formatMoney(folio.balanceMinor)} with Paystack</button>
                )}
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Charges</h3>
                {folio.charges.length === 0 ? <p className="text-sm text-slate-400">No charges.</p> : (
                  <ul className="text-sm divide-y divide-slate-100 mb-3">
                    {folio.charges.map((c) => (
                      <li key={c.id} className="py-2 flex justify-between">
                        <span className="text-slate-700">{c.description}{c.quantity > 1 ? ` ×${c.quantity}` : ''}</span>
                        <span className="text-slate-800">{formatMoney(c.amountMinor * c.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {folio.status === 'Open' && (
                  <form onSubmit={addCharge} className="flex gap-2">
                    <input className="input flex-1" placeholder="Description" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} required />
                    <input className="input w-32" type="number" min="0" placeholder="Amount" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} required />
                    <button className="btn-primary" type="submit">Add</button>
                  </form>
                )}
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Payments</h3>
                {folio.payments.length === 0 ? <p className="text-sm text-slate-400">No payments.</p> : (
                  <ul className="text-sm divide-y divide-slate-100 mb-3">
                    {folio.payments.map((p) => (
                      <li key={p.id} className="py-2 flex justify-between items-center">
                        <span className={`text-slate-700 ${p.refunded ? 'line-through text-slate-400' : ''}`}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-800">{formatMoney(p.amountMinor)}</span>
                          {!p.refunded && <button className="text-xs text-rose-600 hover:underline" onClick={() => refund(p.id)}>Refund</button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={addPayment} className="flex gap-2">
                  <select className="input w-32" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                    {['Cash', 'Card', 'Transfer', 'POS', 'Wallet'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input className="input flex-1" type="number" min="0" placeholder="Amount" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required />
                  <button className="btn-primary" type="submit">Record</button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
